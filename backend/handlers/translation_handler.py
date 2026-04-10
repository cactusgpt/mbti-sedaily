"""
Translation Handler — English article retrieval API for en.sedaily.com
=======================================================================
Serves translated English versions of MBTI articles.

Routes:
  GET /api/article/{news_id}/en      — English version of an article
  GET /api/article/{news_id}/en/{group}  — English version of specific MBTI group

Storage:
  S3: articles/{news_id}/body_en.json
  DynamoDB: s3_body_en_uri field on Article Pointer

Falls back to Korean if English version is not available.
"""
import json
import logging
from typing import Dict, Any, Optional

import boto3

from config import settings
from config.constants import CORS_HEADERS, S3_ARTICLE_BODY_PREFIX, MBTI_GROUPS
from clients.dynamodb_client import DynamoDBClient
from clients.s3_article_client import S3ArticleClient
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _get_db() -> DynamoDBClient:
    s3_client = S3ArticleClient(
        bucket_name=settings.s3_article_body_bucket,
        region=settings.s3_article_body_region,
    )
    return DynamoDBClient(
        table_name=settings.dynamodb_table_articles,
        region=settings.region,
        s3_article_client=s3_client,
    )


def _get_english_body(news_id: str) -> Optional[Dict[str, Any]]:
    """Fetch English body from S3."""
    try:
        s3 = boto3.client('s3', region_name=settings.s3_article_body_region)
        key = f"{S3_ARTICLE_BODY_PREFIX}/{news_id}/body_en.json"

        response = s3.get_object(
            Bucket=settings.s3_article_body_bucket,
            Key=key,
        )
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)

    except s3.exceptions.NoSuchKey:
        return None
    except Exception as e:
        logger.warning(f"Failed to fetch English body for {news_id}: {e}")
        return None


async def _handle_get_english(news_id: str, mbti_group: Optional[str] = None) -> Dict:
    """
    GET /api/article/{news_id}/en

    Returns the English translation with metadata from DynamoDB.
    Falls back to Korean content if English is not available.
    """
    if not news_id:
        return _error(400, 'news_id is required')

    db = _get_db()

    # Get metadata from DynamoDB
    metadata = await db.get_article_metadata(news_id)
    if not metadata:
        return _error(404, 'Article not found')

    # Check for English version
    en_uri = metadata.get('s3_body_en_uri')
    en_body = None

    if en_uri:
        en_body = _get_english_body(news_id)

    if en_body:
        # Build English response
        response_data: Dict[str, Any] = {
            'news_id': news_id,
            'language': 'en',
            'title': en_body.get('title_en', metadata.get('title_ko', '')),
            'sub_title': en_body.get('sub_title_en', ''),
            'content': en_body.get('content_en', ''),
            'category': metadata.get('category', ''),
            'published_at': metadata.get('published_at', ''),
            'byline': metadata.get('byline', 'Seoul Economic Daily'),
            'original_link': metadata.get('original_link', ''),
            'images': metadata.get('images', []),
            'translated_at': metadata.get('translated_en_at', ''),
        }

        # Add MBTI versions (English)
        if mbti_group and mbti_group in MBTI_GROUPS:
            version = en_body.get(f'version_{mbti_group}', {})
            if version:
                response_data['version'] = version
                response_data['mbti_group'] = mbti_group
        else:
            # Include all versions
            versions = {}
            for g in MBTI_GROUPS:
                v = en_body.get(f'version_{g}')
                if v:
                    versions[g] = v
            if versions:
                response_data['versions'] = versions

        return _success(response_data)

    else:
        # No English version — return Korean with flag
        full_article = await db.get_article(news_id)
        if not full_article:
            return _error(404, 'Article not found')

        return _success({
            'news_id': news_id,
            'language': 'ko',
            'language_note': 'English translation not yet available',
            'title': full_article.get('title_ko', ''),
            'content': full_article.get('content_ko', ''),
            'category': full_article.get('category', ''),
            'published_at': full_article.get('published_at', ''),
        })


# ── Response helpers ─────────────────────────────────────────────────────────

def _success(data: Dict[str, Any]) -> Dict:
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps(data, ensure_ascii=False, default=str),
    }


def _error(status_code: int, message: str) -> Dict:
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'error': {'code': 'TRANSLATION_ERROR', 'message': message}
        }, ensure_ascii=False),
    }


def _parse_event(event: dict):
    rc = event.get('requestContext', {})
    if 'http' in rc:
        method = rc['http'].get('method', 'GET')
        path = rc['http'].get('path', '')
    else:
        method = event.get('httpMethod', 'GET')
        path = event.get('path', '')

    path_params = event.get('pathParameters', {}) or {}
    return method, path, path_params


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """
    Translation API Lambda handler.

    Routes:
      GET /api/article/{news_id}/en           — Full English article
      GET /api/article/{news_id}/en/{group}   — English MBTI version
    """
    method, path, path_params = _parse_event(event)

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    if method != 'GET':
        return _error(405, 'Method not allowed')

    news_id = path_params.get('news_id', '')
    mbti_group = path_params.get('group')

    # Also try parsing from path
    if not news_id:
        parts = path.rstrip('/').split('/')
        # /api/article/{news_id}/en or /api/article/{news_id}/en/{group}
        for i, part in enumerate(parts):
            if part == 'en' and i > 0:
                news_id = parts[i - 1]
                if i + 1 < len(parts) and parts[i + 1] in MBTI_GROUPS:
                    mbti_group = parts[i + 1]
                break

    return await _handle_get_english(news_id, mbti_group)
