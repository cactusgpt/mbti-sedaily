"""
MBTI Article Collector Lambda Function
Collects Seoul Economic articles from S3 XML and transforms them into 4 MBTI styles.

Data Source: S3 XML (s3://sedaily-news-xml-storage/daily-xml/)
Transform: Korean article → 4 MBTI styles (NT, NF, ST, SF) in Korean
"""
import logging
import asyncio
import json
import re
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

from clients.s3_xml_client import S3XMLClient, S3Article
from clients.mbti_transform_service import MbtiTransformService
from clients.dynamodb_client import DynamoDBClient
from config import settings
from config.constants import MBTI_GROUPS
from utils.hash_utils import hash_content, content_changed

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Batch size limit to prevent Lambda timeout (15 min max)
# Each article takes ~30-60 seconds for Bedrock transformation
# Increased timeout (5min read) allows processing more articles
BATCH_SIZE = 10


def _empty_usage():
    """Return empty token usage dict."""
    return {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_input_tokens": 0,
        "cache_creation_input_tokens": 0,
    }


def _accumulate_usage(total: dict, usage: dict):
    """Accumulate token usage into total."""
    for key in ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"):
        total[key] = total.get(key, 0) + usage.get(key, 0)


def _calculate_cost(usage: dict) -> str:
    """Calculate cost in USD from token usage (Sonnet 4.5 pricing). Returns string for DynamoDB."""
    cost = (
        usage.get("input_tokens", 0) * 3
        + usage.get("output_tokens", 0) * 15
        + usage.get("cache_read_input_tokens", 0) * 0.30
        + usage.get("cache_creation_input_tokens", 0) * 3.75
    ) / 1_000_000
    return str(round(cost, 6))


async def collect_and_transform_articles(hours: int = 24) -> Dict[str, Any]:
    """
    Collect articles from S3 XML and transform into 4 MBTI styles.

    Flow:
    1. Retry previously failed articles
    2. Fetch today's XML from S3
    3. Filter new/updated articles
    4. Transform each article into NT/NF/ST/SF styles via Bedrock Claude
    5. Save to DynamoDB (sedaily-mbti-articles-dev)
    """
    dynamodb_client = None

    try:
        # Initialize clients
        s3_xml_client = S3XMLClient(
            bucket_name="sedaily-news-xml-storage",
            prefix="daily-xml",
            region="ap-northeast-2"
        )

        transform_service = MbtiTransformService()

        dynamodb_client = DynamoDBClient(
            table_name=settings.dynamodb_table_articles,
            region=settings.region
        )

        # ==================== Process Failed Articles Queue ====================
        failed_queue = await dynamodb_client.get_failed_articles(limit=20)
        retried_success = 0
        retried_failed = 0

        if failed_queue:
            logger.info(f"Found {len(failed_queue)} failed articles in queue. Processing...")

            for failed_item in failed_queue:
                original_news_id = failed_item.get('original_news_id')
                retry_count = failed_item.get('retry_count', 1)

                if retry_count > 10:
                    logger.warning(f"Article {original_news_id} exceeded max retries. Removing.")
                    await dynamodb_client.delete_failed_article(original_news_id)
                    continue

                article_data = failed_item.get('article_data', {})

                try:
                    # Transform article
                    result = await transform_service.transform_article(
                        title=article_data.get('title', ''),
                        subtitle=article_data.get('sub_title', ''),
                        content=article_data.get('content_clean', ''),
                        category=article_data.get('main_category', ''),
                    )

                    versions = result['versions']

                    # Build saved article
                    saved_article = {
                        'news_id': original_news_id,
                        'item_type': 'article',
                        'action': article_data.get('action', 'I'),
                        'press': article_data.get('press', '서울경제'),
                        'title_ko': article_data.get('title', ''),
                        'sub_title_ko': article_data.get('sub_title', ''),
                        'content_ko': article_data.get('content_clean', ''),
                        'content_raw': article_data.get('content_raw', ''),
                        'version_NT': versions.get('NT', {}),
                        'version_NF': versions.get('NF', {}),
                        'version_ST': versions.get('ST', {}),
                        'version_SF': versions.get('SF', {}),
                        'date': article_data.get('date', ''),
                        'time': article_data.get('time', ''),
                        'published_at': article_data.get('published_at', ''),
                        'category': article_data.get('main_category', 'news'),
                        'transformed_at': datetime.now().isoformat(),
                    }

                    saved = await dynamodb_client.save_article(saved_article)
                    if saved:
                        await dynamodb_client.delete_failed_article(original_news_id)
                        retried_success += 1
                    else:
                        retried_failed += 1

                except Exception as e:
                    retried_failed += 1
                    logger.error(f"Retry failed for {original_news_id}: {e}")
                    article_data['retry_count'] = retry_count + 1
                    await dynamodb_client.save_failed_article(article_data, str(e)[:200])

        # ==================== Process Today's Articles ====================
        kst = timezone(timedelta(hours=9))
        today_kst = datetime.now(kst).strftime("%Y%m%d")

        logger.info(f"Fetching articles from S3 XML for date: {today_kst}")

        articles_by_action = await s3_xml_client.get_articles_to_process(today_kst)

        new_articles_xml = articles_by_action['new']
        updated_articles_xml = articles_by_action['updated']
        deleted_articles_xml = articles_by_action['deleted']

        total_found = len(new_articles_xml) + len(updated_articles_xml) + len(deleted_articles_xml)
        logger.info(f"S3 XML - New: {len(new_articles_xml)}, Updated: {len(updated_articles_xml)}, Deleted: {len(deleted_articles_xml)}")

        if total_found == 0:
            return {
                "status": "success", "total_found": 0,
                "new_articles": 0, "updated_articles": 0, "failed_articles": 0,
                "collection_time": datetime.now().isoformat()
            }

        # Check duplicates
        new_article_ids = [a.nsid for a in new_articles_xml]
        existing_ids = await dynamodb_client.batch_check_exists(new_article_ids)
        articles_to_transform = [a for a in new_articles_xml if a.nsid not in existing_ids]

        # Check updated articles for content changes
        updated_ids = [a.nsid for a in updated_articles_xml]
        actually_changed_count = 0
        skipped_unchanged_count = 0
        original_published_at = {}
        existing_articles = {}

        if updated_ids:
            existing_articles = await dynamodb_client.batch_get_articles_with_hash(updated_ids)

            for article in updated_articles_xml:
                existing = existing_articles.get(article.nsid)
                if existing and existing.get('published_at'):
                    original_published_at[article.nsid] = existing.get('published_at')

                if existing:
                    old_hash = existing.get('content_hash')
                    if content_changed(old_hash, article.content_clean or ''):
                        articles_to_transform.append(article)
                        actually_changed_count += 1
                    else:
                        skipped_unchanged_count += 1
                else:
                    articles_to_transform.append(article)
                    actually_changed_count += 1

        # Limit batch size to prevent timeout
        total_pending = len(articles_to_transform)
        if total_pending > BATCH_SIZE:
            logger.info(f"Limiting batch from {total_pending} to {BATCH_SIZE} articles")
            articles_to_transform = articles_to_transform[:BATCH_SIZE]

        logger.info(f"Processing {len(articles_to_transform)} articles for MBTI transformation (pending: {total_pending - len(articles_to_transform)})")

        if not articles_to_transform:
            return {
                "status": "success", "total_found": total_found,
                "new_articles": 0, "updated_articles": 0,
                "cached_articles": len(existing_ids), "failed_articles": 0,
                "collection_time": datetime.now().isoformat(),
                "message": "No new or changed articles to process"
            }

        # Counters
        new_articles_count = 0
        updated_articles_count = 0
        failed_articles = 0
        total_collection_usage = _empty_usage()
        total_bedrock_calls = 0
        article_details = []
        updated_ids_set = set(a.nsid for a in updated_articles_xml)

        # Process each article
        for article in articles_to_transform:
            try:
                if not article.content_clean or not article.content_clean.strip():
                    logger.info(f"Skipping article {article.nsid} - no content")
                    continue

                logger.info(f"Transforming article {article.nsid}: {article.title[:50]}...")

                # MBTI 4-style transformation
                result = await transform_service.transform_article(
                    title=article.title,
                    subtitle=article.sub_title or '',
                    content=article.content_clean,
                    category=article.main_category or '',
                )

                versions = result['versions']
                article_usage = result['usage']
                total_bedrock_calls += 1
                _accumulate_usage(total_collection_usage, article_usage)

                category = article.main_category or 'news'

                # Build article data for DynamoDB
                article_data = {
                    # IDs
                    'news_id': article.nsid,
                    'item_type': 'article',
                    'action': article.action,
                    'press': article.press,

                    # Original content
                    'title_ko': article.title,
                    'sub_title_ko': article.sub_title or '',
                    'content_ko': article.content_clean,
                    'content_raw': article.content_raw,

                    # MBTI versions
                    'version_NT': versions.get('NT', {}),
                    'version_NF': versions.get('NF', {}),
                    'version_ST': versions.get('ST', {}),
                    'version_SF': versions.get('SF', {}),

                    # Author
                    'author': article.author,
                    'author_name': article.author_name,
                    'author_email': article.author_email,
                    'byline': article.author_name or '서울경제',

                    # Date/Time
                    'date': article.date,
                    'time': article.time,
                    'published_at': original_published_at.get(article.nsid, article.published_at),
                    'updated_at': article.published_at if article.nsid in original_published_at else None,

                    # Category
                    'category': category,
                    'categories': [
                        {'code': c.code, 'name': c.name, 'main': c.main_category,
                         'sub': c.sub_category, 'detail': c.detail_category}
                        for c in article.categories
                    ],

                    # URL
                    'url': article.url,
                    'original_link': article.url,

                    # Images
                    'images': [
                        {'url': img.url, 'width': img.width, 'height': img.height,
                         'caption_title': img.caption_title, 'caption_content': img.caption_content}
                        for img in article.images
                    ],

                    # Content blocks (original structure preserved)
                    'content_blocks': [
                        {
                            'type': 'text',
                            'text_ko': block.text_ko,
                            'style': block.style
                        } if block.block_type == "text" else
                        {
                            'type': 'image',
                            'url': block.image_url,
                            'alt': block.image_alt,
                            'width': block.image_width,
                            'caption': block.image_caption,
                        }
                        for block in article.content_blocks
                    ],

                    # Related news
                    'related_news': [
                        {'title': rel.title, 'url': rel.url, 'nsid': rel.nsid}
                        for rel in article.related_news
                    ],

                    # Breaking news
                    'is_breaking_news': article.is_breaking_news,

                    # Content hash for change detection
                    'content_hash': hash_content(article.content_clean),

                    # Token usage tracking
                    'transform_usage': {
                        **article_usage,
                        'total_cost': _calculate_cost(article_usage),
                        'bedrock_calls': 1,
                        'transformed_at': datetime.now().isoformat()
                    },

                    'transformed_at': datetime.now().isoformat(),
                }

                # Save to DynamoDB
                saved = await dynamodb_client.save_article(article_data)

                if saved:
                    if article.nsid in updated_ids_set:
                        updated_articles_count += 1
                        article_details.append({
                            'news_id': article.nsid,
                            'title': article.title[:50],
                            'action': 'updated',
                            'category': category
                        })
                    else:
                        new_articles_count += 1
                        article_details.append({
                            'news_id': article.nsid,
                            'title': article.title[:50],
                            'action': 'new',
                            'category': category
                        })
                    logger.info(f"Saved MBTI article {article.nsid} with 4 versions")
                else:
                    failed_articles += 1
                    article_details.append({
                        'news_id': article.nsid,
                        'title': article.title[:50],
                        'action': 'failed',
                        'reason': 'db_save_failed'
                    })

            except Exception as e:
                failed_articles += 1
                logger.error(f"Failed to transform article {article.nsid}: {e}", exc_info=True)
                article_details.append({
                    'news_id': article.nsid,
                    'title': article.title[:50] if article.title else '',
                    'action': 'failed',
                    'reason': str(e)[:100]
                })

                # Queue for retry
                try:
                    failed_article_data = {
                        'nsid': article.nsid,
                        'title': article.title,
                        'sub_title': article.sub_title,
                        'content_raw': article.content_raw,
                        'content_clean': article.content_clean,
                        'author': article.author,
                        'author_name': article.author_name,
                        'author_email': article.author_email,
                        'date': article.date,
                        'time': article.time,
                        'published_at': article.published_at,
                        'url': article.url,
                        'main_category': article.main_category,
                        'press': article.press,
                        'action': article.action,
                        'is_breaking_news': article.is_breaking_news,
                        'retry_count': 0
                    }
                    await dynamodb_client.save_failed_article(failed_article_data, str(e)[:200])
                except Exception as queue_error:
                    logger.error(f"Failed to queue article {article.nsid}: {queue_error}")
                continue

        pending_remaining = total_pending - len(articles_to_transform) if 'total_pending' in dir() else 0

        result = {
            "status": "success",
            "total_found": total_found,
            "new_articles": new_articles_count,
            "updated_articles": updated_articles_count,
            "skipped_unchanged": skipped_unchanged_count,
            "cached_articles": len(existing_ids),
            "failed_articles": failed_articles,
            "pending_remaining": pending_remaining,
            "batch_size": BATCH_SIZE,
            "retried_success": retried_success,
            "retried_failed": retried_failed,
            "collection_time": datetime.now().isoformat(),
            "article_details": article_details,
            "total_usage": {
                **total_collection_usage,
                "total_cost": _calculate_cost(total_collection_usage),
                "bedrock_calls": total_bedrock_calls
            }
        }

        # Save collection log
        try:
            await dynamodb_client.save_collection_log(result)
        except Exception as e:
            logger.error(f"Failed to save collection log: {e}")

        logger.info(f"MBTI collection complete: {result}")
        return result

    except Exception as e:
        logger.error(f"Collection failed: {e}", exc_info=True)
        error_result = {
            "status": "error",
            "error": str(e),
            "collection_time": datetime.now().isoformat()
        }
        if dynamodb_client:
            try:
                await dynamodb_client.save_collection_log(error_result)
            except Exception as log_e:
                logger.error(f"Failed to save error log: {log_e}")
        return error_result


def lambda_handler(event: dict, context) -> dict:
    """
    AWS Lambda handler for scheduled MBTI article collection.
    Triggered by EventBridge on schedule.
    """
    logger.info(f"MBTI article collection triggered: {event}")
    result = asyncio.run(collect_and_transform_articles(24))
    return {
        "statusCode": 200,
        "body": result
    }
