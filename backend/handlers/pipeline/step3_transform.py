"""
Step 3: Tone & Manner Transformation
=====================================
Calls Claude (via Bedrock) to rewrite each article into 4 MBTI versions.
ONE model call per article generates ALL 4 versions simultaneously, using
the combined prompt built from /prompts/nt.md, nf.md, st.md, sf.md.

Uses Claude (NOT Nova) — Korean rewriting is a complex task.

Article content is loaded from the S3 temp file uploaded by Step 1
(selected_articles_s3_uri) rather than from the Step Functions payload,
which carries only lightweight metadata to stay under the 256 KB limit.
Falls back to reading content_clean from the payload for backward
compatibility with older pipeline runs.

Input (from Step 2 via ProcessArticlesMap):
  {
    "step": 2,
    "date": "20260413",
    "selected_articles_s3_uri": "s3://...",         # optional, preferred
    "classified_articles": [
      { "news_id": "...", "title": "...", "category": "...",
        "published_at": "...", "target_groups": ["NT","ST"] }
    ],
    "classification_map": {},
    "metrics": {}
  }

Output (passed to Step 4):
  {
    "step": 3,
    "date": "20260413",
    "transformed_articles": [
      {
        ...article metadata...,
        "versions": {
          "NT": { "title": "...", "body": "..." },
          "NF": { "title": "...", "body": "..." },
          "ST": { "title": "...", "body": "..." },
          "SF": { "title": "...", "body": "..." }
        },
        "transform_usage": { "input_tokens": ..., "output_tokens": ... }
      }
    ],
    "failed_articles": [
      { "news_id": "...", "title": "...", "error": "..." }
    ],
    "metrics": {
      "input_count": 1,
      "transformed_count": 1,
      "failed_count": 0,
      "total_input_tokens": ...,
      "total_output_tokens": ...,
      "duration_ms": 28000
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
    BEDROCK_MODEL_ID_HAIKU,
    BEDROCK_REGION,
    MBTI_GROUPS,
)
from clients.mbti_transform_service import MbtiTransformService, TransformError
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ── S3 article content loader ────────────────────────────────────────────────

def _load_articles_from_s3(s3_uri: str) -> Dict[str, Dict[str, Any]]:
    """Load full article data from S3 temp file. Returns {news_id: article_data}."""
    parts = s3_uri.replace('s3://', '').split('/', 1)
    bucket, key = parts[0], parts[1]

    s3 = boto3.client('s3', region_name='us-east-1')
    response = s3.get_object(Bucket=bucket, Key=key)
    articles = json.loads(response['Body'].read().decode('utf-8'))

    return {a['news_id']: a for a in articles}


# ── Main logic ───────────────────────────────────────────────────────────────

async def _transform_articles(event_body: Dict[str, Any]) -> Dict[str, Any]:
    start = time.time()

    date_str = event_body['date']
    articles = event_body['classified_articles']
    logger.info(f"Step 3: Transforming {len(articles)} articles for {date_str}")

    # Load full article content from S3 if URI is available.
    # Step 1 uploads full content to S3 to stay under the 256 KB Step Functions
    # payload limit. Falls back to reading content_clean from the payload for
    # backward compatibility with older pipeline runs.
    s3_uri = event_body.get('selected_articles_s3_uri', '')
    s3_lookup: Dict[str, Dict[str, Any]] = {}
    if s3_uri:
        try:
            s3_lookup = _load_articles_from_s3(s3_uri)
            logger.info(f"Loaded {len(s3_lookup)} articles from S3: {s3_uri}")
        except Exception as e:
            logger.warning(
                f"Failed to load articles from S3 ({s3_uri}), "
                f"falling back to payload: {e}"
            )

    transform_service = MbtiTransformService(region=BEDROCK_REGION)

    transformed = []
    failed = []
    total_input_tokens = 0
    total_output_tokens = 0

    for idx, article in enumerate(articles):
        news_id = article['news_id']

        # Enrich article with full content from S3 lookup.
        # Payload has lightweight metadata + target_groups from Step 2;
        # S3 has content_clean, sub_title, author_name, images, url, etc.
        s3_data = s3_lookup.get(news_id, {})
        for key, val in s3_data.items():
            if key not in article:
                article[key] = val

        title = article.get('title', '')
        content = article.get('content_clean', '')

        if not content or not content.strip():
            logger.warning(f"Skipping {news_id}: empty content")
            failed.append({
                'news_id': news_id,
                'title': title[:80],
                'error': 'empty_content',
            })
            continue

        logger.info(
            f"Transforming [{idx+1}/{len(articles)}] {news_id}: "
            f"{title[:50]}..."
        )

        try:
            result = await transform_service.transform_article(
                title=title,
                subtitle=article.get('sub_title', ''),
                content=content,
                category=article.get('category', '경제'),
            )

            versions = result['versions']
            usage = result['usage']
            total_input_tokens += usage.get('input_tokens', 0)
            total_output_tokens += usage.get('output_tokens', 0)

            # Build output article with metadata + versions
            out = {
                'news_id': news_id,
                'title': title,
                'sub_title': article.get('sub_title', ''),
                'content_clean': content,
                'content_raw': article.get('content_raw', ''),
                'content_blocks': article.get('content_blocks', []),
                'category': article.get('category', ''),
                'published_at': article.get('published_at', ''),
                'author_name': article.get('author_name', ''),
                'author_email': article.get('author_email', ''),
                'images': article.get('images', []),
                'url': article.get('url', ''),
                'related_news': article.get('related_news', []),
                'is_breaking_news': article.get('is_breaking_news', False),
                'target_groups': article.get('target_groups', list(MBTI_GROUPS)),
                'versions': versions,
                'transform_usage': usage,
            }
            transformed.append(out)

            logger.info(f"Transformed {news_id} successfully")

        except TransformError as e:
            logger.error(f"Transform failed for {news_id}: {e}")
            failed.append({
                'news_id': news_id,
                'title': title[:80],
                'error': str(e)[:200],
            })

        except Exception as e:
            logger.error(f"Unexpected error transforming {news_id}: {e}", exc_info=True)
            failed.append({
                'news_id': news_id,
                'title': title[:80],
                'error': str(e)[:200],
            })

    elapsed = int((time.time() - start) * 1000)
    logger.info(
        f"Step 3 complete: {len(transformed)} transformed, "
        f"{len(failed)} failed, "
        f"tokens={total_input_tokens}in/{total_output_tokens}out, "
        f"{elapsed}ms"
    )

    return {
        'step': 3,
        'date': date_str,
        'transformed_articles': transformed,
        'failed_articles': failed,
        'metrics': {
            'input_count': len(articles),
            'transformed_count': len(transformed),
            'failed_count': len(failed),
            'total_input_tokens': total_input_tokens,
            'total_output_tokens': total_output_tokens,
            'duration_ms': elapsed,
        },
    }


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """Step 3 Lambda: Tone & Manner Transformation (Claude)."""
    body = event.get('body', event)

    if body.get('step') != 2:
        logger.warning(f"Expected step 2 input, got step {body.get('step')}")

    result = await _transform_articles(body)

    return {
        'statusCode': 200,
        'body': result,
    }
