"""
Step 2: MBTI Classification
============================
For each selected article, determines which MBTI groups it's suitable for,
then applies per-category allocation limits.

Uses Amazon Nova for classification (simple task, not rewriting).

Input (from Step 1):
  {
    "step": 1,
    "date": "20260408",
    "selected_articles": [ { news_id, title, content_clean, category, ... } ],
    "metrics": { ... }
  }

Output (passed to Step 3):
  {
    "step": 2,
    "date": "20260408",
    "classified_articles": [
      {
        ...article fields...,
        "target_groups": ["NT", "NF", "ST", "SF"]
      }
    ],
    "classification_map": {
      "2K78XY958Z": ["NT", "NF", "ST", "SF"]
    },
    "metrics": {
      "input_count": 195,
      "classified_count": 11,
      "skipped_count": 184,
      "per_category": { "경제": 3, "IT_과학": 2, ... },
      "duration_ms": 2100
    }
  }
"""
import asyncio
import json
import logging
import re
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

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

# ── Per-category allocation (how many articles get MBTI treatment) ───────────

ALLOCATION_PER_CATEGORY = {
    '경제': 3,
    'IT_과학': 2,
    '정치': 1,
    '사회': 2,
    '문화': 1,
    '스포츠': 1,
    '국제': 1,
}
DEFAULT_ALLOCATION = 1

# ── Nova client ──────────────────────────────────────────────────────────────

NOVA_CONFIG = Config(
    read_timeout=60,
    connect_timeout=30,
    retries={'max_attempts': 2},
)


def _get_nova_client():
    return boto3.client(
        'bedrock-runtime',
        region_name=BEDROCK_REGION,
        config=NOVA_CONFIG,
    )


# ── AI classification ────────────────────────────────────────────────────────

async def _classify_batch_nova(
    articles: List[Dict[str, Any]],
    nova_client,
) -> Dict[str, List[str]]:
    """
    Ask Nova which MBTI groups each article is suitable for.
    Returns {news_id: [groups]}.  Falls back to all 4 groups on error.
    """
    summaries = []
    for a in articles:
        preview = a.get('content_clean', '')[:300]
        summaries.append(
            f"- [{a['news_id']}] ({a['category']}) {a['title']}\n  {preview}..."
        )

    prompt = (
        "다음 경제 뉴스 기사들을 4개 MBTI 그룹별 적합도로 분류하세요.\n\n"
        "MBTI 그룹:\n"
        "- NT (전략형): 구조적 분석, 데이터 기반, 시나리오 분석에 적합한 기사\n"
        "- NF (가치형): 사회적 의미, 가치 충돌, 심층 해석에 적합한 기사\n"
        "- ST (실용형): 팩트 정리, 표/수치 중심, 체크리스트에 적합한 기사\n"
        "- SF (공감형): 실생활 연결, 쉬운 설명, 독자 공감에 적합한 기사\n\n"
        "대부분의 기사는 4개 그룹 모두에 적합합니다.\n"
        "특정 그룹에 부적합한 경우에만 해당 그룹을 제외하세요.\n\n"
        f"기사 목록:\n{chr(10).join(summaries)}\n\n"
        'JSON으로 출력하세요:\n'
        '{"classifications": [{"id": "뉴스ID", "groups": ["NT","NF","ST","SF"]}]}'
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
            lambda: nova_client.invoke_model(
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
            result = {}
            for item in parsed.get('classifications', []):
                groups = [g for g in item.get('groups', MBTI_GROUPS) if g in MBTI_GROUPS]
                result[item['id']] = groups or list(MBTI_GROUPS)
            return result

    except Exception as e:
        logger.warning(f"Nova classification failed (falling back to all groups): {e}")

    # Fallback: all articles suitable for all groups
    return {a['news_id']: list(MBTI_GROUPS) for a in articles}


# ── Main logic ───────────────────────────────────────────────────────────────

async def _classify_articles(event_body: Dict[str, Any]) -> Dict[str, Any]:
    start = time.time()

    date_str = event_body['date']
    articles = event_body['selected_articles']
    logger.info(f"Step 2: Classifying {len(articles)} articles for {date_str}")

    # Group by category
    by_category: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for a in articles:
        by_category[a.get('category', 'news')].append(a)

    # Select top N per category (by recency — articles arrive sorted already)
    to_classify = []
    per_category_counts = {}
    for cat, cat_articles in by_category.items():
        limit = ALLOCATION_PER_CATEGORY.get(cat, DEFAULT_ALLOCATION)
        selected = cat_articles[:limit]
        to_classify.extend(selected)
        per_category_counts[cat] = len(selected)

    logger.info(f"Category allocation: {per_category_counts} → {len(to_classify)} total")

    # Run Nova classification on selected articles
    classification_map: Dict[str, List[str]] = {}
    if to_classify:
        nova = _get_nova_client()
        classification_map = await _classify_batch_nova(to_classify, nova)

    # Ensure every selected article has a classification
    for a in to_classify:
        if a['news_id'] not in classification_map:
            classification_map[a['news_id']] = list(MBTI_GROUPS)

    # Build output: articles enriched with target_groups
    classified = []
    for a in to_classify:
        enriched = dict(a)
        enriched['target_groups'] = classification_map.get(a['news_id'], list(MBTI_GROUPS))
        classified.append(enriched)

    elapsed = int((time.time() - start) * 1000)
    logger.info(
        f"Step 2 complete: {len(classified)} classified from {len(articles)} input "
        f"in {elapsed}ms"
    )

    return {
        'step': 2,
        'date': date_str,
        'classified_articles': classified,
        'classification_map': classification_map,
        'metrics': {
            'input_count': len(articles),
            'classified_count': len(classified),
            'skipped_count': len(articles) - len(classified),
            'per_category': per_category_counts,
            'duration_ms': elapsed,
        },
    }


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """Step 2 Lambda: MBTI Classification."""
    # Accept either direct body or Step Functions wrapper
    body = event.get('body', event)

    if body.get('step') != 1:
        logger.warning(f"Expected step 1 input, got step {body.get('step')}")

    result = await _classify_articles(body)

    return {
        'statusCode': 200,
        'body': result,
    }
