"""
Step 4: Quality Validation (strict structural checks only)
==========================================================
Validates transformed articles for the things that make them genuinely
unusable. Stylistic reframing, different phrasing, added analytical or
emotional context, and reordered content are NEVER flagged — those are
the intended product of MBTI rewriting, not defects.

What this validator checks (any failure → status='failed'):
  a) Missing required fields: title, body, key_points (exist + non-empty)
  b) Unreasonable body length: < 100 chars or > 10000 chars
  c) Wrong language: body must be primarily Korean
  d) Obvious hallucination: version is about a completely unrelated topic
     to the original (Nova check, narrow prompt with explicit examples)

What this validator NEVER flags:
  - Different wording / phrasing from the original
  - Added analytical, emotional, or practical context
  - Restructured content order
  - Style-specific additions (key_points, closing_line, subtitle)
  - Tone differences across the four versions

Default-to-pass: if the Nova hallucination check fails (any exception or
malformed response), all articles are treated as passing the AI check.
The validator itself erroring should never cause an article to be rejected.

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

Output (to Supervisor):
  {
    "step": 4,
    "date": "20260408",
    "validated_articles": [
      {
        ...article...,
        "versions": { ... },
        "validation": {
          "status": "passed" | "failed",
          "issues": [ { "group": "NT", "type": "wrong_language", "detail": "..." } ]
        }
      }
    ],
    "failed_validation_articles": [
      { "news_id": "...", "title": "...", "issues": [...] }
    ],
    "failed_articles": [ ... (forwarded from step 3) ],
    "metrics": {
      "input_count": 30,
      "passed_count": 28,
      "failed_count": 2,
      "failed_from_step3": 0,
      "ai_check_used": true,
      "duration_ms": 8500
    }
  }
"""
import asyncio
import json
import logging
import re
import time
from typing import Any, Dict, List

import boto3
from botocore.config import Config

from config.constants import (
    BEDROCK_MODEL_ID_NOVA,
    BEDROCK_REGION,
    MBTI_GROUPS,
)
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ── Validation thresholds ────────────────────────────────────────────────────

MIN_BODY_LENGTH = 100
MAX_BODY_LENGTH = 10000

# Issue types that flip status to "failed". Anything not in this set is
# treated as informational and does not cause rejection.
CRITICAL_ISSUE_TYPES = frozenset({
    'missing',           # entire version dict is missing
    'missing_title',
    'missing_body',
    'body_too_short',
    'body_too_long',
    'wrong_language',
    'hallucination',
})
# missing_key_points is checked but NOT critical — Step 3 currently produces
# only {title, body} without key_points. When prompts are updated to generate
# key_points, promote this to CRITICAL_ISSUE_TYPES.

# Hangul syllables + Jamo blocks. Used to confirm output is Korean.
_KOREAN_CHAR = re.compile(r'[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]')


def _is_korean_text(text: str, min_ratio: float = 0.3) -> bool:
    """
    Return True if at least min_ratio of the *letter* characters in `text`
    are Korean. Punctuation, digits, whitespace are ignored. Empty input
    returns False.
    """
    if not text:
        return False
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    korean = sum(1 for c in letters if _KOREAN_CHAR.match(c))
    return (korean / len(letters)) >= min_ratio


def _body_to_text(body: Any) -> str:
    """Normalize body field (str or list-of-strings) to a single string."""
    if isinstance(body, str):
        return body
    if isinstance(body, list):
        return '\n'.join(str(x) for x in body)
    return ''


# ── Bedrock client ───────────────────────────────────────────────────────────

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


# ── Phase 1: structural checks (no AI) ──────────────────────────────────────

def _basic_checks(article: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Strict structural checks. Returns a list of issue dicts; an empty list
    means the article passes structurally.

    Only checks for things that make the article literally unusable. Does
    NOT compare content to the original — that comparison happens (very
    narrowly) in the AI hallucination check.
    """
    issues: List[Dict[str, str]] = []
    versions = article.get('versions', {}) or {}

    for group in MBTI_GROUPS:
        v = versions.get(group)
        if not isinstance(v, dict):
            issues.append({
                'group': group,
                'type': 'missing',
                'detail': f'{group} version is missing',
            })
            continue

        title = (v.get('title') or '').strip() if isinstance(v.get('title'), str) else ''
        if not title:
            issues.append({
                'group': group,
                'type': 'missing_title',
                'detail': f'{group} title is missing or empty',
            })

        body_text = _body_to_text(v.get('body')).strip()
        if not body_text:
            issues.append({
                'group': group,
                'type': 'missing_body',
                'detail': f'{group} body is missing or empty',
            })
            # If body is missing entirely, length / language checks would
            # be redundant noise — skip them for this group.
            continue

        body_len = len(body_text)
        if body_len < MIN_BODY_LENGTH:
            issues.append({
                'group': group,
                'type': 'body_too_short',
                'detail': f'{group} body is {body_len} chars (min {MIN_BODY_LENGTH})',
            })
        elif body_len > MAX_BODY_LENGTH:
            issues.append({
                'group': group,
                'type': 'body_too_long',
                'detail': f'{group} body is {body_len} chars (max {MAX_BODY_LENGTH})',
            })

        if not _is_korean_text(body_text):
            issues.append({
                'group': group,
                'type': 'wrong_language',
                'detail': f'{group} body does not appear to be Korean',
            })

        key_points = v.get('key_points')
        if key_points is None or (isinstance(key_points, list) and len(key_points) == 0):
            issues.append({
                'group': group,
                'type': 'missing_key_points',
                'detail': f'{group} version has no key_points',
            })

    return issues


# ── Phase 2: AI hallucination check (narrow prompt) ─────────────────────────

async def _ai_hallucination_check(
    articles: List[Dict[str, Any]],
    bedrock_client,
) -> Dict[str, List[Dict[str, str]]]:
    """
    Use Nova to detect *only* obvious hallucination — i.e., a version is
    about a completely unrelated topic to the original. Stylistic reframing,
    different phrasing, added context, and reordering are NEVER hallucinations.

    On any error or malformed response, returns {} (default to pass). The
    validator erroring must not cause an article to be rejected.
    """
    if not articles:
        return {}

    summaries = []
    for a in articles:
        versions = a.get('versions', {}) or {}
        original_title = a.get('title', '')
        original_excerpt = (a.get('content_clean') or '')[:300]
        version_titles = {
            g: (versions.get(g) or {}).get('title', '(없음)') for g in MBTI_GROUPS
        }
        summaries.append(
            f"[{a['news_id']}]\n"
            f"  원본 제목: {original_title}\n"
            f"  원본 본문(앞부분): {original_excerpt}\n"
            f"  NT 제목: {version_titles['NT']}\n"
            f"  NF 제목: {version_titles['NF']}\n"
            f"  ST 제목: {version_titles['ST']}\n"
            f"  SF 제목: {version_titles['SF']}"
        )

    from services.prompt_loader import load_prompt
    prompt_template = load_prompt('validation', 'validator')
    prompt = prompt_template.replace('{articles_context}', chr(10).join(summaries))

    try:
        body = json.dumps({
            "schemaVersion": "messages-v1",
            "messages": [
                {"role": "user", "content": [{"text": prompt}]}
            ],
            "inferenceConfig": {
                "maxTokens": 1024,
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
        text = (
            resp.get('output', {})
                .get('message', {})
                .get('content', [{}])[0]
                .get('text', '')
        )

        match = re.search(r'\{[\s\S]*\}', text)
        if not match:
            logger.warning(
                "Nova hallucination check: no JSON in response — defaulting all to pass"
            )
            return {}

        parsed = json.loads(match.group(0))
        by_article: Dict[str, List[Dict[str, str]]] = {}
        for h in parsed.get('hallucinations', []) or []:
            if not isinstance(h, dict):
                continue
            aid = h.get('id') or ''
            if not aid:
                continue
            by_article.setdefault(aid, []).append({
                'group': h.get('group', ''),
                'type': 'hallucination',
                'detail': (h.get('detail') or '')[:300],
            })
        if by_article:
            logger.info(f"Nova flagged {len(by_article)} article(s) for hallucination")
        return by_article

    except Exception as e:
        logger.warning(
            f"Nova hallucination check failed (defaulting all to pass): {e}"
        )
        return {}


# ── Main logic ───────────────────────────────────────────────────────────────

async def _validate_articles(event_body: Dict[str, Any]) -> Dict[str, Any]:
    start = time.time()

    date_str = event_body['date']
    articles = event_body.get('transformed_articles', []) or []
    step3_failed = event_body.get('failed_articles', []) or []
    logger.info(f"Step 4: Validating {len(articles)} articles for {date_str}")

    # Phase 1: structural checks
    basic_issues: Dict[str, List[Dict[str, str]]] = {}
    for a in articles:
        nid = a.get('news_id', '')
        if not nid:
            continue
        result = _basic_checks(a)
        if result:
            basic_issues[nid] = result

    # Phase 2: AI hallucination check (narrow, default-to-pass on error)
    ai_check_used = False
    ai_issues: Dict[str, List[Dict[str, str]]] = {}
    if articles:
        bedrock = _get_bedrock_client()
        ai_issues = await _ai_hallucination_check(articles, bedrock)
        ai_check_used = True

    # Merge issues per article
    merged_issues: Dict[str, List[Dict[str, str]]] = {}
    for nid in set(basic_issues) | set(ai_issues):
        merged_issues[nid] = basic_issues.get(nid, []) + ai_issues.get(nid, [])

    # Classify
    validated: List[Dict[str, Any]] = []
    failed_validation: List[Dict[str, Any]] = []

    for a in articles:
        news_id = a.get('news_id', '')
        issues = merged_issues.get(news_id, [])

        has_critical = any(i.get('type') in CRITICAL_ISSUE_TYPES for i in issues)
        status = 'failed' if has_critical else 'passed'

        enriched = dict(a)
        enriched['validation'] = {'status': status, 'issues': issues}
        validated.append(enriched)

        if has_critical:
            critical_types = [i['type'] for i in issues if i.get('type') in CRITICAL_ISSUE_TYPES]
            failed_validation.append({
                'news_id': news_id,
                'title': (a.get('title') or '')[:80],
                'issues': issues,
            })
            logger.warning(
                f"Step 4 failed {news_id}: {len(issues)} issue(s), critical: {critical_types}"
            )

    elapsed = int((time.time() - start) * 1000)
    passed_count = len(validated) - len(failed_validation)
    logger.info(
        f"Step 4 complete: {passed_count} passed, {len(failed_validation)} failed, "
        f"{len(step3_failed)} forwarded from step3, ai_check={ai_check_used}, {elapsed}ms"
    )

    return {
        'step': 4,
        'date': date_str,
        'validated_articles': validated,
        # Renamed from 'flagged_articles' — the supervisor reads each article's
        # validation.status directly, so this is metadata only.
        'failed_validation_articles': failed_validation,
        'failed_articles': step3_failed,
        'metrics': {
            'input_count': len(articles),
            'passed_count': passed_count,
            'failed_count': len(failed_validation),
            'failed_from_step3': len(step3_failed),
            'ai_check_used': ai_check_used,
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
