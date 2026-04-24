"""
Podcast repository for audio/podcast metadata operations.

Provides business-level methods on top of PodcastDBClient for:
  - Podcast CRUD (save, get, delete)
  - Listing by date (via GSI)
  - Listing by article (via scan+filter)
  - Status lifecycle management

Follows the same patterns as PersonalRepository and SettingsRepository.
"""

import logging
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from clients.podcast_db_client import PodcastDBClient
from models.podcast import Podcast
from config.constants import AWS_REGION_DEFAULT

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))


class PodcastRepository:
    """
    Repository for Podcast DB operations.

    Uses PodcastDBClient (PK=podcast_id, GSI date-index) for all storage.
    """

    def __init__(
        self,
        table_name: Optional[str] = None,
        region: str = AWS_REGION_DEFAULT,
    ):
        self._client = PodcastDBClient(
            table_name=table_name,
            region=region,
        )

    # =========================================================================
    # Core CRUD
    # =========================================================================

    async def save_podcast(self, podcast: Podcast) -> bool:
        """
        Save a podcast record.

        Args:
            podcast: Podcast model

        Returns:
            True if saved successfully
        """
        item = podcast.to_item()
        success = await self._client.put_item(item)
        if success:
            logger.info(
                f"Podcast saved: {podcast.podcast_id} "
                f"(article={podcast.article_id}, group={podcast.mbti_group}, "
                f"status={podcast.status})"
            )
        return success

    async def get_podcast(self, podcast_id: str) -> Optional[Podcast]:
        """
        Get a podcast by ID.

        Args:
            podcast_id: Podcast ID

        Returns:
            Podcast model or None
        """
        item = await self._client.get_item(podcast_id)
        if item:
            return Podcast.from_item(item)
        return None

    async def delete_podcast(self, podcast_id: str) -> bool:
        """
        Delete a podcast by ID.

        Args:
            podcast_id: Podcast ID

        Returns:
            True if deleted
        """
        success = await self._client.delete_item(podcast_id)
        if success:
            logger.info(f"Podcast deleted: {podcast_id}")
        return success

    # =========================================================================
    # Listing
    # =========================================================================

    async def list_podcasts_by_date(
        self,
        date: str,
        limit: int = 50,
    ) -> List[Podcast]:
        """
        List podcasts created on a specific date, newest first.

        Uses the date-index GSI (PK=created_date, SK=podcast_id).

        Args:
            date: Date string YYYY-MM-DD
            limit: Maximum results

        Returns:
            List of Podcast models
        """
        items = await self._client.query_by_date(
            created_date=date,
            limit=limit,
            scan_forward=False,
        )
        return [Podcast.from_item(item) for item in items]

    async def list_podcasts_by_article(
        self,
        article_id: str,
        limit: int = 10,
    ) -> List[Podcast]:
        """
        List podcasts for a specific article, newest first.

        Args:
            article_id: Source article news_id
            limit: Maximum results

        Returns:
            List of Podcast models
        """
        items = await self._client.query_by_article(
            article_id=article_id,
            limit=limit,
        )
        return [Podcast.from_item(item) for item in items]

    # =========================================================================
    # Status Management
    # =========================================================================

    async def update_podcast_status(
        self,
        podcast_id: str,
        status: str,
        error_message: str = '',
        s3_audio_uri: str = '',
        duration_seconds: int = 0,
    ) -> Optional[Podcast]:
        """
        Update podcast status and related fields.

        Typical transitions:
          creating → completed  (with s3_audio_uri, duration_seconds)
          creating → failed     (with error_message)

        Args:
            podcast_id: Podcast ID
            status: New status (creating, completed, failed)
            error_message: Failure reason (only for failed)
            s3_audio_uri: S3 URI of the generated audio (only for completed)
            duration_seconds: Audio length (only for completed)

        Returns:
            Updated Podcast model, or None on failure
        """
        updates = {'status': status}

        if status == 'completed':
            if s3_audio_uri:
                updates['s3_audio_uri'] = s3_audio_uri
            if duration_seconds:
                updates['duration_seconds'] = duration_seconds
        elif status == 'failed' and error_message:
            updates['error_message'] = error_message

        updated = await self._client.update_item(podcast_id, updates)
        if updated:
            logger.info(f"Podcast {podcast_id} status updated to '{status}'")
            return Podcast.from_item(updated)

        logger.warning(f"Failed to update podcast {podcast_id} status to '{status}'")
        return None


# Singleton
_podcast_repository: Optional[PodcastRepository] = None


def get_podcast_repository() -> PodcastRepository:
    """Get or create singleton PodcastRepository instance."""
    global _podcast_repository
    if _podcast_repository is None:
        _podcast_repository = PodcastRepository()
    return _podcast_repository
