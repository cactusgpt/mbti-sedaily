"""
Collaborative Filtering Service — MBTI-based article recommendations
======================================================================
Simpler alternative to Amazon Personalize for the PoC timeline.

Strategy: "Users with your MBTI group also read these articles"

How it works:
  1. Find users in the same MBTI group (from Personal DB profiles)
  2. Aggregate their reading patterns by article
  3. Rank articles by read count within the group
  4. Exclude articles the target user already read
  5. Return top N as "people like you also read" recommendations

This replaces Personalize for the PoC. When Personalize is ready,
the recommendation_handler switches strategy based on whether the
Personalize campaign ARN is configured.

Data sources:
  - Personal DB: PROFILE items (user_id → mbti_group)
  - Personal DB: READING#{article_id} items (user reading history)
  - Articles DB: article metadata (title, category, published_at)
"""
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Set

import boto3
from boto3.dynamodb.conditions import Key, Attr

from config import settings
from config.constants import AWS_REGION_DEFAULT, MBTI_GROUPS

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))

# Limits to keep scan costs manageable
MAX_COHORT_USERS = 50
MAX_READINGS_PER_USER = 30


class CollaborativeFilterService:
    """
    MBTI group-based collaborative filtering.

    Finds popular articles among users sharing the same MBTI group,
    excluding articles the target user has already read.
    """

    def __init__(self, region: str = AWS_REGION_DEFAULT):
        self._region = region
        self._personal_table = None
        self._articles_table = None

    @property
    def personal_table(self):
        if self._personal_table is None:
            dynamodb = boto3.resource('dynamodb', region_name=self._region)
            self._personal_table = dynamodb.Table(settings.dynamodb_table_personal)
        return self._personal_table

    @property
    def articles_table(self):
        if self._articles_table is None:
            dynamodb = boto3.resource('dynamodb', region_name=self._region)
            self._articles_table = dynamodb.Table(settings.dynamodb_table_articles)
        return self._articles_table

    async def get_collaborative_recommendations(
        self,
        user_id: str,
        mbti_group: str,
        read_ids: Set[str],
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Get articles popular among users with the same MBTI group.

        Args:
            user_id: Target user (excluded from cohort)
            mbti_group: Target user's MBTI group (NT/NF/ST/SF)
            read_ids: Articles the target user already read (to exclude)
            limit: Max recommendations to return

        Returns:
            List of article dicts with collaborative_score and read_by_count
        """
        if mbti_group not in MBTI_GROUPS:
            return []

        # 1. Find cohort users (same MBTI group)
        cohort_ids = await self._find_cohort_users(mbti_group, user_id)
        if not cohort_ids:
            return []

        logger.info(f"Collaborative filter: {len(cohort_ids)} cohort users for {mbti_group}")

        # 2. Aggregate reading patterns across cohort
        article_scores = await self._aggregate_cohort_readings(cohort_ids, read_ids)
        if not article_scores:
            return []

        # 3. Sort by score (read count × recency bonus)
        ranked = sorted(article_scores.items(), key=lambda x: x[1]['score'], reverse=True)

        # 4. Fetch article metadata for top results
        top_ids = [aid for aid, _ in ranked[:limit * 2]]
        metadata = await self._batch_get_article_metadata(top_ids)

        # 5. Build recommendation list
        recommendations = []
        for article_id, score_info in ranked:
            if len(recommendations) >= limit:
                break

            meta = metadata.get(article_id)
            if not meta:
                continue

            recommendations.append({
                'news_id': article_id,
                'title': meta.get('title_ko', ''),
                'category': meta.get('category', ''),
                'published_at': meta.get('published_at', ''),
                'image_url': self._extract_image(meta),
                'byline': meta.get('byline', '서울경제'),
                '_score': round(score_info['score'], 2),
                '_source': 'collaborative',
                '_read_by_count': score_info['count'],
                '_mbti_group': mbti_group,
            })

        logger.info(
            f"Collaborative filter: {len(recommendations)} recommendations "
            f"from {len(article_scores)} candidate articles"
        )

        return recommendations

    async def _find_cohort_users(self, mbti_group: str, exclude_user: str) -> List[str]:
        """Find users in the same MBTI group via Personal DB scan."""
        try:
            response = self.personal_table.scan(
                FilterExpression=(
                    Attr('sk').eq('PROFILE') &
                    Attr('mbti_group').eq(mbti_group)
                ),
                ProjectionExpression='user_id',
                Limit=MAX_COHORT_USERS * 3,
            )

            users = []
            for item in response.get('Items', []):
                uid = item.get('user_id', '')
                if uid and uid != exclude_user:
                    users.append(uid)

            return users[:MAX_COHORT_USERS]

        except Exception as e:
            logger.warning(f"Cohort scan failed: {e}")
            return []

    async def _aggregate_cohort_readings(
        self,
        cohort_ids: List[str],
        exclude_ids: Set[str],
    ) -> Dict[str, Dict[str, Any]]:
        """
        Aggregate reading patterns across cohort users.
        Returns {article_id: {count, latest_read, score}}.
        """
        article_counts: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {'count': 0, 'latest_read': '', 'score': 0}
        )

        now = datetime.now(KST)

        for uid in cohort_ids:
            try:
                response = self.personal_table.query(
                    KeyConditionExpression=(
                        Key('user_id').eq(uid) &
                        Key('sk').begins_with('READING#')
                    ),
                    Limit=MAX_READINGS_PER_USER,
                    ScanIndexForward=False,
                )

                for item in response.get('Items', []):
                    article_id = item.get('article_id', '')
                    if not article_id or article_id in exclude_ids:
                        continue

                    read_at = item.get('read_at', '')
                    entry = article_counts[article_id]
                    entry['count'] += 1

                    if read_at > entry['latest_read']:
                        entry['latest_read'] = read_at

            except Exception as e:
                logger.debug(f"Failed to query readings for {uid}: {e}")

        # Score: count × recency bonus
        for article_id, info in article_counts.items():
            count = info['count']
            latest = info['latest_read']

            # Recency bonus: articles read in the last 3 days get 2x, last 7 days 1.5x
            recency_bonus = 1.0
            if latest:
                try:
                    read_dt = datetime.fromisoformat(latest)
                    if hasattr(read_dt, 'tzinfo') and read_dt.tzinfo is None:
                        read_dt = read_dt.replace(tzinfo=KST)
                    days_ago = (now - read_dt).days
                    if days_ago <= 3:
                        recency_bonus = 2.0
                    elif days_ago <= 7:
                        recency_bonus = 1.5
                except (ValueError, TypeError):
                    pass

            info['score'] = count * recency_bonus

        return dict(article_counts)

    async def _batch_get_article_metadata(
        self,
        article_ids: List[str],
    ) -> Dict[str, Dict[str, Any]]:
        """Batch-fetch article metadata from DynamoDB."""
        if not article_ids:
            return {}

        result: Dict[str, Dict[str, Any]] = {}
        dynamodb = boto3.resource('dynamodb', region_name=self._region)
        table_name = settings.dynamodb_table_articles

        batch_size = 100
        for i in range(0, len(article_ids), batch_size):
            batch = article_ids[i:i + batch_size]
            keys = [{'news_id': aid} for aid in batch]

            try:
                response = dynamodb.batch_get_item(
                    RequestItems={
                        table_name: {
                            'Keys': keys,
                            'ProjectionExpression': 'news_id, title_ko, category, published_at, byline, images',
                        }
                    }
                )
                for item in response.get('Responses', {}).get(table_name, []):
                    result[item['news_id']] = item
            except Exception as e:
                logger.warning(f"Batch get metadata failed: {e}")

        return result

    @staticmethod
    def _extract_image(item: Dict[str, Any]) -> Optional[str]:
        images = item.get('images', [])
        if images and isinstance(images, list) and len(images) > 0:
            first = images[0]
            if isinstance(first, dict):
                return first.get('url', '')
        return None


# Singleton
_service: Optional[CollaborativeFilterService] = None


def get_collaborative_filter_service() -> CollaborativeFilterService:
    global _service
    if _service is None:
        _service = CollaborativeFilterService()
    return _service
