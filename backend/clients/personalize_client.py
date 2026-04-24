"""
Amazon Personalize Client — Adapter for real-time recommendations
==================================================================
Wraps the Amazon Personalize Runtime API for fetching recommendations.

This adapter is used when a Personalize campaign is available (env var
PERSONALIZE_CAMPAIGN_ARN is set). Otherwise, the recommendation handler
falls back to the collaborative filter service.

Setup guide (for when Personalize is ready):
  1. Create dataset group: sedaily-mbti-recommendations
  2. Create schemas + datasets:
     - Users: user_id (string), mbti_group (string)
     - Items: article_id (string), category (string), published_at (long/timestamp)
     - Interactions: user_id, article_id, event_type, timestamp
  3. Create solution: aws-user-personalization recipe
  4. Create campaign from the solution version
  5. Set PERSONALIZE_CAMPAIGN_ARN env var on Lambda functions

Sync service (personalize_sync_service.py) handles data ingestion.

Env vars:
  PERSONALIZE_CAMPAIGN_ARN — campaign ARN (empty = use collaborative filter)
"""
import logging
import os
from typing import Dict, Any, List, Optional

import boto3

from config.constants import AWS_REGION_DEFAULT

logger = logging.getLogger(__name__)

CAMPAIGN_ARN = os.getenv('PERSONALIZE_CAMPAIGN_ARN', '')


def is_personalize_available() -> bool:
    """Check if Personalize campaign is configured."""
    return bool(CAMPAIGN_ARN)


class PersonalizeClient:
    """
    Client for Amazon Personalize real-time recommendations.

    Only usable when PERSONALIZE_CAMPAIGN_ARN is set.
    """

    def __init__(self, campaign_arn: str = '', region: str = AWS_REGION_DEFAULT):
        self._campaign_arn = campaign_arn or CAMPAIGN_ARN
        self._client = boto3.client('personalize-runtime', region_name=region)

    def get_recommendations(
        self,
        user_id: str,
        num_results: int = 10,
        filter_arn: Optional[str] = None,
        context: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get personalized recommendations for a user.

        Args:
            user_id: User ID
            num_results: Number of recommendations
            filter_arn: Optional filter ARN (e.g., exclude already-read)
            context: Optional context (e.g., {'MBTI_GROUP': 'NT'})

        Returns:
            List of {article_id, score} dicts
        """
        if not self._campaign_arn:
            return []

        try:
            kwargs: Dict[str, Any] = {
                'campaignArn': self._campaign_arn,
                'userId': user_id,
                'numResults': num_results,
            }

            if filter_arn:
                kwargs['filterArn'] = filter_arn
            if context:
                kwargs['context'] = context

            response = self._client.get_recommendations(**kwargs)

            items = []
            for item in response.get('itemList', []):
                items.append({
                    'article_id': item.get('itemId', ''),
                    'score': float(item.get('score', 0)),
                })

            logger.info(f"Personalize returned {len(items)} recommendations for {user_id}")
            return items

        except Exception as e:
            logger.error(f"Personalize recommendation failed: {e}")
            return []

    def record_event(
        self,
        user_id: str,
        article_id: str,
        event_type: str = 'read',
    ) -> bool:
        """
        Record a real-time interaction event for Personalize.

        Call this when a user reads, archives, or shares an article.
        Events update the model in real-time (no retraining needed).

        Args:
            user_id: User ID
            article_id: Article ID
            event_type: 'read', 'archive', 'share'
        """
        if not self._campaign_arn:
            return False

        try:
            import time
            tracker_arn = os.getenv('PERSONALIZE_TRACKER_ARN', '')
            if not tracker_arn:
                return False

            events_client = boto3.client('personalize-events', region_name=AWS_REGION_DEFAULT)

            events_client.put_events(
                trackingId=tracker_arn,
                userId=user_id,
                sessionId=f'{user_id}-session',
                eventList=[{
                    'sentAt': int(time.time()),
                    'eventType': event_type,
                    'itemId': article_id,
                }],
            )

            return True

        except Exception as e:
            logger.warning(f"Personalize event recording failed: {e}")
            return False


# Singleton
_client: Optional[PersonalizeClient] = None


def get_personalize_client() -> PersonalizeClient:
    global _client
    if _client is None:
        _client = PersonalizeClient()
    return _client
