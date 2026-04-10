"""
Step 1: Article Selection
=========================
Loads articles from S3 XML, applies rule-based filtering, then uses
Amazon Nova for AI-based filtering of borderline cases.

Input (Lambda event):
  {
    "date": "20260408",          # optional, defaults to today KST
    "source": "schedule" | "manual"
  }

Output (passed to Step 2):
  {
    "step": 1,
    "date": "20260408",
    "selected_articles": [
      {
        "news_id": "2K78XY958Z",
        "title": "...",
        "sub_title": "...",
        "content_clean": "...",
        "category": "경제",
        "published_at": "...",
        "author_name": "...",
        "images": [...],
        "url": "..."
      }
    ],
    "metrics": {
      "total_in_xml": 250,
      "excluded_deleted": 12,
      "excluded_rules": 35,
      "excluded_ai": 8,
      "selected": 195,
      "duration_ms": 4523
    }
  }
"""
import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple

import boto3
from botocore.config import Config

from clients.s3_xml_client import S3XMLClient
from config import settings
from config.constants import (
    BEDROCK_MODEL_ID_NOVA,
    BEDROCK_REGION,
)
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ── Rule-based filter constants ──────────────────────────────────────────────

MIN_CONTENT_LENGTH = 300

EXCLUSION_TITLE_PATTERNS = [
    r'^\[인사\]',
    r'^\[부고\]',
    r'^\[속보\]',
    r'^\[\d보\]',
    r'증시.*마감',
    r'환율.*마감',
    r'유가.*마감',
]

EXCLUSION_TITLE_KEYWORDS = ['인사', '부고', '속보', '발령']

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


# ── Rule-based filter ────────────────────────────────────────────────────────

def _quick_filter(title: str, content: str) -> Tuple[bool, str]:
    """Return (should_exclude, reason)."""
    if len(content) < MIN_CONTENT_LENGTH:
        return True, 'too_short'

    for pattern in EXCLUSION_TITLE_PATTERNS:
        if re.search(pattern, title):
            return True, f'title_pattern:{pattern}'

    title_lower = title.lower()
    for kw in EXCLUSION_TITLE_KEYWORDS:
        if kw in title_lower:
            return True, f'title_keyword:{kw}'

    return False, ''


# ── AI-based filter (Nova) ───────────────────────────────────────────────────

async def _ai_filter_nova(
    articles: List[Dict[str, Any]],
    nova_client,
) -> Dict[str, str]:
    """
    Use Amazon Nova to identify articles unsuitable for MBTI rewriting.
    Returns {news_id: exclusion_reason} for excluded articles.
    """
    summaries = []
    for i, a in enumerate(articles):
        preview = a.get('content_clean', '')[:200]
        summaries.append(f"{i+1}. [{a['news_id']}] {a['title']}\n   {preview}...")

    prompt = (
        "다음 경제 뉴스 기사 목록을 검토하고, MBTI 스타일 리라이팅에 적합하지 않은 기사를 식별하세요.\n\n"
        "제외 기준:\n"
        "- 속보/단신: 단순 사실 전달만 있는 기사\n"
        "- 사건/사고: 교통사고, 화재, 범죄 등\n"
        "- 인사/발령: 임명, 승진, 사퇴 등\n"
        "- 부고/동정: 사망, 조문 등\n"
        "- 반복성: 매일 반복되는 시황 기사\n"
        "- 홍보성: 광고성 기사, 기업 보도자료\n\n"
        f"기사 목록:\n{chr(10).join(summaries)}\n\n"
        'JSON 형식으로 제외할 기사만 출력하세요:\n'
        '{"excluded": [{"id": "뉴스ID", "reason": "사유"}]}\n'
        '제외할 기사가 없으면: {"excluded": []}'
    )

    try:
        body = json.dumps({
            "inputText": prompt,
            "textGenerationConfig": {
                "maxTokenCount": 1024,
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
        # Nova response format
        if 'results' in resp:
            text = resp['results'][0].get('outputText', '')
        elif 'output' in resp:
            text = resp['output'].get('message', {}).get('content', [{}])[0].get('text', '')

        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            result = json.loads(match.group(0))
            return {e['id']: e['reason'] for e in result.get('excluded', [])}

    except Exception as e:
        logger.warning(f"Nova AI filter failed (non-fatal): {e}")

    return {}


# ── Main logic ───────────────────────────────────────────────────────────────

async def _select_articles(date_str: str) -> Dict[str, Any]:
    start = time.time()

    s3_client = S3XMLClient(
        bucket_name='sedaily-news-xml-storage',
        prefix='daily-xml',
        region='ap-northeast-2',
    )

    all_articles = await s3_client.get_articles_by_date(date_str)
    total_in_xml = len(all_articles)
    logger.info(f"Step 1: Loaded {total_in_xml} articles from XML for {date_str}")

    # Remove deleted articles
    active = [a for a in all_articles if a.action != 'D']
    excluded_deleted = total_in_xml - len(active)

    # Rule-based filtering
    candidates = []
    excluded_rules = 0
    for article in active:
        should_exclude, reason = _quick_filter(article.title, article.content_clean or '')
        if should_exclude:
            excluded_rules += 1
            logger.debug(f"Rule excluded {article.nsid}: {reason}")
        else:
            candidates.append(article)

    # AI-based filtering (only when enough candidates)
    excluded_ai = 0
    if len(candidates) > 5:
        candidate_dicts = [
            {'news_id': a.nsid, 'title': a.title, 'content_clean': a.content_clean or ''}
            for a in candidates
        ]
        nova = _get_nova_client()
        ai_excluded = await _ai_filter_nova(candidate_dicts, nova)

        if ai_excluded:
            excluded_ai = len(ai_excluded)
            candidates = [a for a in candidates if a.nsid not in ai_excluded]
            logger.info(f"AI filter excluded {excluded_ai} articles")

    # Build serialisable output
    selected = []
    for a in candidates:
        image_url = None
        if a.images:
            image_url = a.images[0].url
        elif a.content_images:
            image_url = a.content_images[0].url

        selected.append({
            'news_id': a.nsid,
            'title': a.title,
            'sub_title': a.sub_title or '',
            'content_clean': a.content_clean,
            'category': a.main_category,
            'published_at': a.published_at,
            'author_name': a.author_name,
            'author_email': a.author_email,
            'images': [
                {'url': img.url, 'caption_content': img.caption_content}
                for img in a.images
            ],
            'url': a.url,
            'content_raw': a.content_raw,
            'content_blocks': [
                {
                    'type': 'text',
                    'text_ko': b.text_ko,
                    'style': b.style,
                } if b.block_type == 'text' else {
                    'type': 'image',
                    'url': b.image_url,
                    'alt': b.image_alt,
                    'width': b.image_width,
                    'caption': b.image_caption,
                }
                for b in a.content_blocks
            ],
            'related_news': [
                {'title': r.title, 'url': r.url, 'nsid': r.nsid}
                for r in a.related_news
            ],
            'is_breaking_news': a.is_breaking_news,
        })

    elapsed = int((time.time() - start) * 1000)
    logger.info(
        f"Step 1 complete: {len(selected)} selected from {total_in_xml} "
        f"(rules=-{excluded_rules}, AI=-{excluded_ai}, deleted=-{excluded_deleted}) "
        f"in {elapsed}ms"
    )

    return {
        'step': 1,
        'date': date_str,
        'selected_articles': selected,
        'metrics': {
            'total_in_xml': total_in_xml,
            'excluded_deleted': excluded_deleted,
            'excluded_rules': excluded_rules,
            'excluded_ai': excluded_ai,
            'selected': len(selected),
            'duration_ms': elapsed,
        },
    }


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """Step 1 Lambda: Article Selection."""
    date_str = event.get('date')
    if not date_str:
        kst = timezone(timedelta(hours=9))
        date_str = datetime.now(kst).strftime('%Y%m%d')

    result = await _select_articles(date_str)

    return {
        'statusCode': 200,
        'body': result,
    }
