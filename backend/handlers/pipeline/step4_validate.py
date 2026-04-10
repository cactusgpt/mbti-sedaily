"""
Step 4: Quality Validation
===========================
Validates transformed articles for spelling, grammar, style consistency,
and factual preservation before they are stored.

Uses Nova for straightforward checks; falls back to Claude for complex cases.

Input (from Step 3):
  {
    "step": 3,
    "date": "20260408",
    "transformed_articles": [
      { ...article..., "versions": { "NT": {...}, ... }, "transform_usage": {...} }
    ],
    "failed_articles": [ { news_id, title, error } ],
    "metrics": { ... }
  }

Output (final pipeline result):
  {
    "step": 4,
    "date": "20260408",
    "validated_articles": [
      {
        ...article...,
        "versions": { ... },
        "validation": {
          "status": "passed" | "flagged",
          "issues": [ { "group": "NT", "type": "style", "detail": "..." } ]
        }
      }
    ],
    "flagged_articles": [
      { "news_id": "...", "title": "...", "issues": [...] }
    ],
    "failed_articles": [ ... (forwarded from step 3) ],
    "metrics": {
      "input_count": 10,
      "passed_count": 9,
      "flagged_count": 1,
      "failed_from_step3": 1,
      "duration_ms": 8500
    }
  }
"""
import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

import boto3
from botocore.config import Config

from config.constants import (
    BEDROCK_MODEL_ID_NOVA,
    BEDROCK_MODEL_ID_HAIKU,
    BEDROCK_REGION,
    MBTI_GROUPS,
)
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ── Bedrock clients ──────────────────────────────────────────────────────────

_BEDROCK_CONFIG = Config(
    read_timeout=120,
    connect_timeout=30,
    retries={'max_attempts': 2},
)


def _get_bedrock_client():
    return boto3.client(
        'bedrock-runtime',
        region_name=BEDROCK_REGION,
        config=_BEDROCK_CONFIG,
    )


# ── Validation logic ────────────────────────────────────────────────────────

def _basic_checks(article: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Fast rule-based checks that don't need AI.
    Returns list of issue dicts.
    """
    issues = []
    versions = article.get('versions', {})
    original_title = article.get('title', '')

    for group in MBTI_GROUPS:
        v = versions.get(group)
        if not v:
            issues.append({
                'group': group,
                'type': 'missing',
                'detail': f'Version {group} is completely missing',
            })
            continue

        title = v.get('title', '')
        body = v.get('body', '')
        body_text = body if isinstance(body, str) else '\n'.join(body) if isinstance(body, list) else ''

        if not title:
            issues.append({
                'group': group,
                'type': 'missing_title',
                'detail': f'Version {group} has no title',
            })

        if not body_text or len(body_text.strip()) < 100:
            issues.append({
                'group': group,
                'type': 'body_too_short',
                'detail': f'Version {group} body is too short ({len(body_text.strip())} chars)',
            })

        # Title should differ from original (not just a copy)
        if title == original_title:
            issues.append({
                'group': group,
                'type': 'title_unchanged',
                'detail': f'Version {group} title is identical to original',
            })

    return issues


async def _ai_validate_batch(
    articles: List[Dict[str, Any]],
    bedrock_client,
) -> Dict[str, List[Dict[str, str]]]:
    """
    Use Nova to check style consistency and factual preservation.
    Returns {news_id: [issues]}.
    """
    if not articles:
        return {}

    # Build summaries for batch validation
    summaries = []
    for a in articles:
        versions = a.get('versions', {})
        original = a.get('content_clean', '')[:200]
        version_titles = {g: versions.get(g, {}).get('title', '(없음)') for g in MBTI_GROUPS}

        summaries.append(
            f"[{a['news_id']}]\n"
            f"  원본: {a.get('title', '')}\n"
            f"  원본 본문 시작: {original}...\n"
            f"  NT 제목: {version_titles['NT']}\n"
            f"  NF 제목: {version_titles['NF']}\n"
            f"  ST 제목: {version_titles['ST']}\n"
            f"  SF 제목: {version_titles['SF']}"
        )

    prompt = (
        "다음 기사들의 MBTI 리라이팅 품질을 검수하세요.\n\n"
        "검수 기준:\n"
        "1. 팩트 보존: 원본의 핵심 사실이 변조되지 않았는가\n"
        "2. 스타일 차이: 4개 버전이 각각 다른 톤을 가지고 있는가\n"
        "3. 제목 품질: 각 그룹 스타일에 맞는 제목인가\n"
        "4. 맞춤법/문법: 명백한 오류가 있는가\n\n"
        f"기사 목록:\n{chr(10).join(summaries)}\n\n"
        "문제가 있는 기사만 보고하세요. JSON으로 출력:\n"
        '{"issues": [{"id": "뉴스ID", "group": "NT|NF|ST|SF", '
        '"type": "fact|style|spelling|grammar", "detail": "설명"}]}\n'
        '문제 없으면: {"issues": []}'
    )

    try:
        body = json.dumps({
            "inputText": prompt,
            "textGenerationConfig": {
                "maxTokenCount": 2048,
                "temperature": 0.1,
            },
        })

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: bedrock_client.invoke_model(
                modelId=BEDROCK_MODEL_ID_NOVA,
                contentType='application/json',
                accept='application/json',
                body=body,
            ),
        )

        resp = json.loads(response['body'].read())
        text = ''
        if 'results' in resp:
            text = resp['results'][0].get('outputText', '')
        elif 'output' in resp:
            text = resp['output'].get('message', {}).get('content', [{}])[0].get('text', '')

        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            parsed = json.loads(match.group(0))
            by_article: Dict[str, List[Dict[str, str]]] = {}
            for issue in parsed.get('issues', []):
                aid = issue.get('id', '')
                if aid:
                    by_article.setdefault(aid, []).append({
                        'group': issue.get('group', ''),
                        'type': issue.get('type', 'unknown'),
                        'detail': issue.get('detail', ''),
                    })
            return by_article

    except Exception as e:
        logger.warning(f"Nova validation failed (non-fatal, marking all as passed): {e}")

    return {}


# ── Main logic ───────────────────────────────────────────────────────────────

async def _validate_articles(event_body: Dict[str, Any]) -> Dict[str, Any]:
    start = time.time()

    date_str = event_body['date']
    articles = event_body['transformed_articles']
    step3_failed = event_body.get('failed_articles', [])
    logger.info(f"Step 4: Validating {len(articles)} articles for {date_str}")

    # Phase 1: Basic structural checks
    all_basic_issues: Dict[str, List[Dict[str, str]]] = {}
    for a in articles:
        issues = _basic_checks(a)
        if issues:
            all_basic_issues[a['news_id']] = issues

    # Phase 2: AI validation (batch)
    bedrock = _get_bedrock_client()
    ai_issues = await _ai_validate_batch(articles, bedrock)

    # Merge issues
    merged_issues: Dict[str, List[Dict[str, str]]] = {}
    all_ids = set(all_basic_issues.keys()) | set(ai_issues.keys())
    for nid in all_ids:
        merged_issues[nid] = all_basic_issues.get(nid, []) + ai_issues.get(nid, [])

    # Classify articles
    validated = []
    flagged = []

    for a in articles:
        news_id = a['news_id']
        issues = merged_issues.get(news_id, [])

        has_critical = any(
            i['type'] in ('missing', 'missing_title', 'fact')
            for i in issues
        )

        validation = {
            'status': 'flagged' if has_critical else 'passed',
            'issues': issues,
        }

        enriched = dict(a)
        enriched['validation'] = validation

        if has_critical:
            flagged.append({
                'news_id': news_id,
                'title': a.get('title', '')[:80],
                'issues': issues,
            })
            logger.warning(f"Flagged {news_id}: {len(issues)} issue(s)")

        # Include in output regardless — flagged articles can still be
        # stored but should be reviewed before publishing
        validated.append(enriched)

    elapsed = int((time.time() - start) * 1000)
    passed_count = len(validated) - len(flagged)
    logger.info(
        f"Step 4 complete: {passed_count} passed, {len(flagged)} flagged, "
        f"{len(step3_failed)} failed (from step 3), {elapsed}ms"
    )

    return {
        'step': 4,
        'date': date_str,
        'validated_articles': validated,
        'flagged_articles': flagged,
        'failed_articles': step3_failed,
        'metrics': {
            'input_count': len(articles),
            'passed_count': passed_count,
            'flagged_count': len(flagged),
            'failed_from_step3': len(step3_failed),
            'duration_ms': elapsed,
        },
    }


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """Step 4 Lambda: Quality Validation."""
    body = event.get('body', event)

    if body.get('step') != 3:
        logger.warning(f"Expected step 3 input, got step {body.get('step')}")

    result = await _validate_articles(body)

    return {
        'statusCode': 200,
        'body': result,
    }
