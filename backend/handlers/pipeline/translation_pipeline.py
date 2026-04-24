"""
Translation Pipeline — Korean → English for en.sedaily.com
============================================================
Translates MBTI-transformed articles into English using:
  Step 1: AWS Translate (base translation with economic terminology)
  Step 2: Nova enhancement (cultural adaptation, natural phrasing)
  Step 3: Store English body alongside Korean body in S3

Runs after the main transform pipeline completes.
Only translates articles that have all 4 MBTI versions.

Storage:
  S3: articles/{news_id}/body_en.json
  DynamoDB: adds s3_body_en_uri to Article Pointer

Input (from Supervisor or manual trigger):
  {
    "source": "pipeline" | "manual",
    "article_ids": ["2K78...", ...],   # specific articles
    "date": "20260410"                 # or all articles from a date
  }

Output:
  {
    "translated_count": 5,
    "failed_count": 1,
    "articles": [{ "news_id": "...", "status": "translated" | "failed" }]
  }
"""
import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

import boto3
from botocore.config import Config

from clients.s3_article_client import S3ArticleClient
from clients.dynamodb_client import DynamoDBClient
from clients.translate_client import TranslateClient
from config import settings
from config.constants import (
    BEDROCK_MODEL_ID_NOVA,
    BEDROCK_REGION,
    MBTI_GROUPS,
    S3_ARTICLE_BODY_PREFIX,
)
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

KST = timezone(timedelta(hours=9))

_BEDROCK_CONFIG = Config(read_timeout=120, connect_timeout=30, retries={'max_attempts': 2})

# ── S3 English body key ─────────────────────────────────────────────────────

def _en_body_key(news_id: str) -> str:
    return f"{S3_ARTICLE_BODY_PREFIX}/{news_id}/body_en.json"

def _en_body_uri(bucket: str, news_id: str) -> str:
    return f"s3://{bucket}/{_en_body_key(news_id)}"


# ── Fetch articles to translate ──────────────────────────────────────────────

async def _get_articles_to_translate(
    db: DynamoDBClient,
    article_ids: Optional[List[str]] = None,
    date_str: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch articles that have all 4 MBTI versions (ready for translation)."""
    articles = []

    if article_ids:
        for aid in article_ids:
            article = await db.get_article(aid)
            if article and _has_all_versions(article):
                articles.append(article)

    elif date_str:
        # Query by date from GSI
        from boto3.dynamodb.conditions import Key
        date_iso = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"

        for cat in ['경제', 'IT_과학', '정치', '사회', '문화']:
            try:
                resp = db.table.query(
                    IndexName='category-published_at-index',
                    KeyConditionExpression=Key('category').eq(cat) & Key('published_at').begins_with(date_iso),
                    ScanIndexForward=False,
                    Limit=5,
                )
                for item in resp.get('Items', []):
                    nid = item.get('news_id', '')
                    # Need full article (with body from S3)
                    full = await db.get_article(nid)
                    if full and _has_all_versions(full):
                        articles.append(full)
            except Exception as e:
                logger.warning(f"Query failed for {cat}: {e}")

    return articles


def _has_all_versions(article: Dict) -> bool:
    """Check if article has all 4 MBTI versions with content."""
    for g in MBTI_GROUPS:
        v = article.get(f'version_{g}', {})
        if not v or not v.get('title') or not v.get('body'):
            return False
    return True


# ── Translation step 1: AWS Translate ────────────────────────────────────────

def _translate_article(
    translator: TranslateClient,
    article: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Translate all text fields of an article from Korean to English.

    Returns a body_en dict with the same structure as body.json:
      content_en, version_NT_en, version_NF_en, version_ST_en, version_SF_en
    """
    body_en: Dict[str, Any] = {}

    # Translate original content
    content_ko = article.get('content_ko', '')
    if content_ko:
        body_en['content_en'] = translator.translate_text(content_ko)

    # Translate title
    title_ko = article.get('title_ko', '')
    if title_ko:
        body_en['title_en'] = translator.translate_text(title_ko)

    sub_title_ko = article.get('sub_title_ko', '')
    if sub_title_ko:
        body_en['sub_title_en'] = translator.translate_text(sub_title_ko)

    # Translate MBTI versions
    for group in MBTI_GROUPS:
        version = article.get(f'version_{group}', {})
        if not version:
            continue

        v_en: Dict[str, Any] = {}

        v_title = version.get('title', '')
        if v_title:
            v_en['title'] = translator.translate_text(v_title)

        v_body = version.get('body', '')
        if v_body:
            if isinstance(v_body, list):
                v_en['body'] = translator.translate_paragraphs(v_body)
            else:
                v_en['body'] = translator.translate_text(v_body)

        v_points = version.get('key_points', [])
        if v_points:
            v_en['key_points'] = [translator.translate_text(p) for p in v_points if p]

        v_closing = version.get('closing_line', '')
        if v_closing:
            v_en['closing_line'] = translator.translate_text(v_closing)

        v_en['tone'] = version.get('tone', '')

        body_en[f'version_{group}'] = v_en

    return body_en


# ── Translation step 2: Nova enhancement ────────────────────────────────────

async def _enhance_translation(
    body_en: Dict[str, Any],
    title_ko: str,
) -> Dict[str, Any]:
    """
    Use Nova to improve the machine translation:
    - Natural English phrasing
    - Korean cultural context footnotes
    - Economic terminology consistency
    """
    # Only enhance the main content and titles (not every field)
    content = body_en.get('content_en', '')
    title = body_en.get('title_en', '')

    if not content:
        return body_en

    prompt = (
        "You are a professional English editor for Seoul Economic Daily (서울경제신문).\n"
        "Review and improve this machine translation of a Korean economic news article.\n\n"
        "Guidelines:\n"
        "1. Fix awkward phrasing — make it read like native English journalism\n"
        "2. Keep Korean names romanized (e.g., Lee Jae-myung, Samsung)\n"
        "3. Add brief context where Korean-specific concepts need explanation\n"
        "4. Preserve all facts and numbers exactly\n"
        "5. Keep the tone professional and journalistic\n\n"
        f"Original Korean title: {title_ko}\n"
        f"Machine-translated title: {title}\n\n"
        f"Machine-translated content:\n{content[:3000]}\n\n"
        "Return the improved version in this JSON format:\n"
        '{"title": "improved title", "content": "improved content"}'
    )

    try:
        client = boto3.client('bedrock-runtime', region_name=BEDROCK_REGION, config=_BEDROCK_CONFIG)

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.converse(
                modelId=BEDROCK_MODEL_ID_NOVA,
                system=[{'text': 'You are a professional English editor for a Korean financial newspaper.'}],
                messages=[{'role': 'user', 'content': [{'text': prompt}]}],
                inferenceConfig={'maxTokens': 4096, 'temperature': 0.2},
            ),
        )

        text = response.get('output', {}).get('message', {}).get('content', [{}])[0].get('text', '')

        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            improved = json.loads(match.group(0))
            if improved.get('title'):
                body_en['title_en'] = improved['title']
            if improved.get('content'):
                body_en['content_en'] = improved['content']

        logger.info("Nova enhancement applied to translation")

    except Exception as e:
        logger.warning(f"Nova enhancement failed (keeping machine translation): {e}")

    return body_en


# ── Storage ──────────────────────────────────────────────────────────────────

def _store_english_body(
    s3_client: boto3.client,
    bucket: str,
    news_id: str,
    body_en: Dict[str, Any],
) -> str:
    """Store English body JSON in S3 and return URI."""
    key = _en_body_key(news_id)

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(body_en, ensure_ascii=False),
        ContentType='application/json',
    )

    uri = _en_body_uri(bucket, news_id)
    logger.info(f"English body stored: {uri}")
    return uri


def _update_article_pointer(
    db: DynamoDBClient,
    news_id: str,
    s3_en_uri: str,
):
    """Add s3_body_en_uri to the DynamoDB Article Pointer."""
    try:
        db.table.update_item(
            Key={'news_id': news_id},
            UpdateExpression='SET s3_body_en_uri = :uri, translated_en_at = :ts',
            ExpressionAttributeValues={
                ':uri': s3_en_uri,
                ':ts': datetime.now(KST).isoformat(),
            },
        )
    except Exception as e:
        logger.error(f"Failed to update DynamoDB pointer for {news_id}: {e}")


# ── Main pipeline ────────────────────────────────────────────────────────────

async def _run_translation_pipeline(event_body: Dict[str, Any]) -> Dict[str, Any]:
    start = time.time()

    article_ids = event_body.get('article_ids')
    date_str = event_body.get('date')

    # Init clients
    s3_body_client = S3ArticleClient(
        bucket_name=settings.s3_article_body_bucket,
        region=settings.s3_article_body_region,
    )
    db = DynamoDBClient(
        table_name=settings.dynamodb_table_articles,
        region=settings.region,
        s3_article_client=s3_body_client,
    )
    translator = TranslateClient(region=settings.region)
    s3 = boto3.client('s3', region_name=settings.s3_article_body_region)

    # Register custom terminology (non-fatal)
    translator.register_terminology()

    # Fetch articles to translate
    articles = await _get_articles_to_translate(db, article_ids, date_str)
    logger.info(f"Translation pipeline: {len(articles)} articles to translate")

    results = []
    translated_count = 0
    failed_count = 0

    for article in articles:
        news_id = article['news_id']
        title_ko = article.get('title_ko', '')

        try:
            # Step 1: AWS Translate
            logger.info(f"Translating {news_id}: {title_ko[:40]}...")
            body_en = _translate_article(translator, article)

            # Step 2: Nova enhancement
            body_en = await _enhance_translation(body_en, title_ko)

            # Step 3: Store
            bucket = settings.s3_article_body_bucket
            en_uri = _store_english_body(s3, bucket, news_id, body_en)
            _update_article_pointer(db, news_id, en_uri)

            translated_count += 1
            results.append({'news_id': news_id, 'status': 'translated', 's3_body_en_uri': en_uri})
            logger.info(f"Translated {news_id}: {body_en.get('title_en', '')[:40]}...")

        except Exception as e:
            failed_count += 1
            results.append({'news_id': news_id, 'status': 'failed', 'error': str(e)[:200]})
            logger.error(f"Translation failed for {news_id}: {e}")

    elapsed = int((time.time() - start) * 1000)

    return {
        'translated_count': translated_count,
        'failed_count': failed_count,
        'total_articles': len(articles),
        'duration_ms': elapsed,
        'articles': results,
    }


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """Translation Pipeline Lambda handler."""
    body = event.get('body', event)

    result = await _run_translation_pipeline(body)

    return {
        'statusCode': 200,
        'body': result,
    }
