"""
Podcast DB Client
Low-level DynamoDB operations for the Podcast DB table (sedaily-mbti-podcast-dev).

Separate table from articles and personal data, dedicated to podcast/audio metadata.

Table design:
  PK: podcast_id (String) — format: podcast_{news_id}_{mbti_group}_{timestamp}
  GSI: date-index
    PK: created_date (String, YYYY-MM-DD)
    SK: podcast_id (String)
"""
import os
import logging
from typing import Optional, Dict, Any, List
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from config.constants import AWS_REGION_DEFAULT
from models.podcast import Podcast

logger = logging.getLogger(__name__)

PODCAST_TABLE_DEFAULT = 'sedaily-mbti-podcast-dev'
PODCAST_DATE_INDEX = 'date-index'


def _sanitize_for_dynamodb(obj):
    """Recursively convert float values to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: _sanitize_for_dynamodb(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_for_dynamodb(v) for v in obj]
    return obj


class PodcastDBClient:
    """
    Low-level client for the Podcast DB DynamoDB table.

    Provides get/put/query/delete/update against the podcast_id key,
    plus GSI queries by created_date. Higher-level business logic
    lives in PodcastRepository.
    """

    def __init__(
        self,
        table_name: Optional[str] = None,
        region: str = AWS_REGION_DEFAULT,
    ):
        self.table_name = table_name or os.getenv(
            'DYNAMODB_TABLE_PODCAST', PODCAST_TABLE_DEFAULT
        )
        self.region = region
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.table = self.dynamodb.Table(self.table_name)

    async def get_item(self, podcast_id: str) -> Optional[Dict[str, Any]]:
        """Get a single podcast by podcast_id."""
        try:
            response = self.table.get_item(Key={'podcast_id': podcast_id})
            return response.get('Item')
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                logger.warning(f"Podcast DB table {self.table_name} does not exist yet")
                return None
            logger.error(f"Failed to get podcast {podcast_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to get podcast {podcast_id}: {e}")
            return None

    async def put_item(self, item: Dict[str, Any]) -> bool:
        """Put a podcast item. Must contain podcast_id."""
        try:
            clean = {k: v for k, v in item.items() if v is not None}
            clean = _sanitize_for_dynamodb(clean)
            self.table.put_item(Item=clean)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                logger.warning(f"Podcast DB table {self.table_name} does not exist yet")
                return False
            logger.error(f"Failed to put podcast: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"Failed to put podcast: {e}", exc_info=True)
            return False

    async def delete_item(self, podcast_id: str) -> bool:
        """Delete a podcast by podcast_id."""
        try:
            self.table.delete_item(Key={'podcast_id': podcast_id})
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                logger.warning(f"Podcast DB table {self.table_name} does not exist yet")
                return False
            logger.error(f"Failed to delete podcast {podcast_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to delete podcast {podcast_id}: {e}")
            return False

    async def update_item(
        self,
        podcast_id: str,
        updates: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Partially update a podcast item.

        Args:
            podcast_id: Partition key
            updates: Dict of attribute_name -> new_value

        Returns:
            Updated item dict, or None on failure
        """
        if not updates:
            return await self.get_item(podcast_id)

        try:
            set_parts = []
            expr_values = {}
            expr_names = {}

            for idx, (attr, value) in enumerate(updates.items()):
                if value is None:
                    continue
                placeholder = f":v{idx}"
                name_ph = f"#a{idx}"
                set_parts.append(f"{name_ph} = {placeholder}")
                expr_values[placeholder] = value
                expr_names[name_ph] = attr

            if not set_parts:
                return await self.get_item(podcast_id)

            expr_values = _sanitize_for_dynamodb(expr_values)

            response = self.table.update_item(
                Key={'podcast_id': podcast_id},
                UpdateExpression='SET ' + ', '.join(set_parts),
                ExpressionAttributeValues=expr_values,
                ExpressionAttributeNames=expr_names,
                ReturnValues='ALL_NEW',
            )
            return response.get('Attributes')

        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                logger.warning(f"Podcast DB table {self.table_name} does not exist yet")
                return None
            logger.error(f"Failed to update podcast {podcast_id}: {e}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"Failed to update podcast {podcast_id}: {e}", exc_info=True)
            return None

    async def query_by_date(
        self,
        created_date: str,
        limit: Optional[int] = None,
        scan_forward: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Query podcasts by created_date using the date-index GSI.

        Args:
            created_date: Date string YYYY-MM-DD
            limit: Max items
            scan_forward: True=ascending, False=descending (newest first)

        Returns:
            List of podcast items
        """
        try:
            kwargs: Dict[str, Any] = {
                'IndexName': PODCAST_DATE_INDEX,
                'KeyConditionExpression': Key('created_date').eq(created_date),
                'ScanIndexForward': scan_forward,
            }
            if limit:
                kwargs['Limit'] = limit

            response = self.table.query(**kwargs)
            items = response.get('Items', [])

            while 'LastEvaluatedKey' in response:
                if limit and len(items) >= limit:
                    break
                kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
                response = self.table.query(**kwargs)
                items.extend(response.get('Items', []))

            if limit:
                items = items[:limit]

            return items

        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                logger.warning(f"Podcast DB table {self.table_name} does not exist yet")
                return []
            logger.error(f"Failed to query podcasts for date {created_date}: {e}", exc_info=True)
            return []
        except Exception as e:
            logger.error(f"Failed to query podcasts for date {created_date}: {e}", exc_info=True)
            return []

    async def query_by_article(
        self,
        article_id: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Find podcasts for a specific article.

        Uses scan with filter since article_id is not a key attribute.
        Results are sorted by created_at descending.

        Args:
            article_id: Source article news_id
            limit: Max items

        Returns:
            List of podcast items
        """
        try:
            response = self.table.scan(
                FilterExpression=Attr('article_id').eq(article_id),
                Limit=limit * 3,
            )
            items = response.get('Items', [])

            while 'LastEvaluatedKey' in response and len(items) < limit:
                response = self.table.scan(
                    FilterExpression=Attr('article_id').eq(article_id),
                    ExclusiveStartKey=response['LastEvaluatedKey'],
                    Limit=limit * 3,
                )
                items.extend(response.get('Items', []))

            items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            return items[:limit]

        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                logger.warning(f"Podcast DB table {self.table_name} does not exist yet")
                return []
            logger.error(f"Failed to query podcasts for article {article_id}: {e}", exc_info=True)
            return []
        except Exception as e:
            logger.error(f"Failed to query podcasts for article {article_id}: {e}", exc_info=True)
            return []

    # ── Domain methods ───────────────────────────────────────────────────

    async def put_podcast(self, podcast: Podcast) -> Dict[str, Any]:
        """Save a podcast. Returns the item dict."""
        item = podcast.to_item()
        await self.put_item(item)
        return item

    async def get_podcast(self, podcast_id: str) -> Optional[Dict[str, Any]]:
        """Get a single podcast by ID, or None if not found."""
        return await self.get_item(podcast_id)

    async def update_podcast_status(
        self,
        podcast_id: str,
        status: str,
        updates: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update podcast status and optional extra fields."""
        all_updates = {'status': status}
        if updates:
            all_updates.update(updates)
        return await self.update_item(podcast_id, all_updates)

    async def get_podcasts_by_date(self, date: str) -> List[Dict[str, Any]]:
        """Get all podcasts for a date (YYYY-MM-DD) via GSI."""
        return await self.query_by_date(date)

    async def get_podcasts_by_article(self, article_id: str) -> List[Dict[str, Any]]:
        """Get all podcasts generated from a specific article."""
        return await self.query_by_article(article_id)
