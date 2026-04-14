"""
News Briefing Generator Lambda Function
Generates MBTI-styled daily news briefings and caches them for the chatbot.

Runs independently from article_collector — can be triggered by:
  - EventBridge schedule (e.g., every 1-2 hours)
  - EventBridge rule chained after article_collector completes
  - Manual invocation

Reads the latest transformed articles from DynamoDB across ALL categories,
generates 4 MBTI-styled briefings via Claude Haiku, and stores them as a
single cached item (news_briefing_latest) for the chatbot to read.
"""
import logging
import json
import asyncio
from datetime import datetime, timezone, timedelta

import boto3
from boto3.dynamodb.conditions import Key

from clients.dynamodb_client import DynamoDBClient
from services.briefing_generator import BriefingGenerator
from config.constants import (
    CORS_HEADERS,
    DYNAMODB_TABLE_ARTICLES_DEV,
    ALL_CATEGORIES,
    CATEGORY_SEARCH_ALIASES,
    GSI_CATEGORY_DATE,
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def fetch_recent_transformed_articles(limit_per_category: int = 3) -> list:
    """
    Fetch recent articles with MBTI versions from DynamoDB across all categories.
    Only includes articles that have at least one MBTI version (version_NT etc.).
    """
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.Table(DYNAMODB_TABLE_ARTICLES_DEV)

    all_articles = []
    seen_ids = set()

    for category in ALL_CATEGORIES:
        # Query all aliases for this category (e.g., 경제 → [경제, 금융, 증권, 부동산])
        aliases = CATEGORY_SEARCH_ALIASES.get(category, [category])

        for alias in aliases:
            try:
                response = table.query(
                    IndexName=GSI_CATEGORY_DATE,
                    KeyConditionExpression=Key('category').eq(alias),
                    ScanIndexForward=False,
                    Limit=limit_per_category * 2,  # Fetch extra in case some lack MBTI versions
                )

                for item in response.get('Items', []):
                    news_id = item.get('news_id', '')
                    if news_id in seen_ids:
                        continue

                    # Only include articles with at least one MBTI version
                    has_version = any(
                        isinstance(item.get(f'version_{g}'), dict) and item.get(f'version_{g}', {}).get('body')
                        for g in ['NT', 'NF', 'ST', 'SF']
                    )
                    if not has_version:
                        continue

                    seen_ids.add(news_id)
                    all_articles.append(item)

                    if len([a for a in all_articles if a.get('category') == category]) >= limit_per_category:
                        break

            except Exception as e:
                logger.warning(f"Failed to query category '{alias}': {e}")

    logger.info(f"Fetched {len(all_articles)} transformed articles across {len(ALL_CATEGORIES)} categories")
    return all_articles


async def generate_and_save_briefing() -> dict:
    """Main logic: fetch articles, generate briefing, save to DynamoDB."""
    articles = fetch_recent_transformed_articles(limit_per_category=3)

    if not articles:
        return {
            'generated': False,
            'reason': 'No transformed articles found',
        }

    briefing_gen = BriefingGenerator(region='us-east-1')
    briefing_data = await briefing_gen.generate_briefing(articles)

    dynamodb_client = DynamoDBClient()
    saved = await dynamodb_client.save_news_briefing(briefing_data)

    return {
        'generated': saved,
        'articles_count': len(articles),
        'categories': briefing_data.get('categories_covered', []),
        'generated_at': briefing_data.get('generated_at', ''),
        'usage': briefing_data.get('generation_usage', {}),
    }


def lambda_handler(event: dict, context) -> dict:
    """
    Lambda handler for news briefing generation.

    Can be invoked by:
      - EventBridge scheduled rule
      - EventBridge event from article_collector completion
      - Direct invocation (for testing)

    Response:
    {
        "status": "success",
        "generated": true,
        "articles_count": 11,
        "categories": ["경제", "IT_과학", ...],
        "generated_at": "2026-04-06T14:30:00+09:00"
    }
    """
    try:
        # Handle HTTP API (if exposed as API endpoint)
        request_context = event.get('requestContext', {})
        if 'http' in request_context:
            http_method = request_context['http'].get('method', 'GET')
        else:
            http_method = event.get('httpMethod', None)

        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': '',
            }

        logger.info("Starting news briefing generation")

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(generate_and_save_briefing())
        finally:
            loop.close()

        response_body = {
            'status': 'success',
            **result,
        }

        logger.info(f"Briefing generation complete: {result}")

        # If called via HTTP API, return HTTP response
        if http_method:
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps(response_body, ensure_ascii=False),
            }

        # If called by EventBridge/direct invocation, return plain dict
        return response_body

    except Exception as e:
        logger.error(f"Briefing generation failed: {e}", exc_info=True)

        error_body = {
            'status': 'error',
            'error': str(e)[:300],
        }

        if event.get('httpMethod') or 'http' in event.get('requestContext', {}):
            return {
                'statusCode': 500,
                'headers': CORS_HEADERS,
                'body': json.dumps(error_body, ensure_ascii=False),
            }

        return error_body
