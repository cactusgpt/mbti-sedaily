"""
Podcast data model for audio/podcast metadata.

Stored in the Podcast DB table (sedaily-mbti-podcast-dev), separate from
articles and personal data.

Table design:
  PK: podcast_id (String) — format: podcast_{news_id}_{mbti_group}_{timestamp}
  GSI: date-index (PK: created_date, SK: podcast_id) — list by date

Each podcast represents one MBTI-styled audio version of an article.
A single article can have up to 4 podcasts (one per MBTI group).
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta


KST = timezone(timedelta(hours=9))


def _now_kst_iso() -> str:
    return datetime.now(KST).isoformat()


def _today_kst() -> str:
    return datetime.now(KST).strftime('%Y-%m-%d')


@dataclass
class Podcast:
    """
    Podcast metadata for a single MBTI-styled audio version of an article.

    Lifecycle:
      1. Created with status='creating' when pipeline starts
      2. script_body filled after Bedrock generates the podcast script
      3. s3_audio_uri + duration_seconds filled after Polly TTS completes
      4. status updated to 'completed' (or 'failed' on error)

    Stored with:
      PK: podcast_id
      GSI date-index: PK=created_date, SK=podcast_id
    """
    podcast_id: str                    # podcast_{news_id}_{mbti_group}_{timestamp}
    article_id: str                    # source article news_id
    mbti_group: str                    # NT, NF, ST, SF
    title: str                         # podcast episode title
    script_body: str = ''              # generated podcast script text
    duration_seconds: int = 0          # audio length in seconds
    s3_audio_uri: str = ''             # s3://bucket/key.mp3
    status: str = 'creating'           # creating | completed | failed
    created_at: str = ''               # ISO 8601
    created_date: str = ''             # YYYY-MM-DD (GSI partition key)
    voice_id: str = 'Seoyeon'          # AWS Polly voice ID
    voice_style: str = ''              # MBTI-specific speaking style descriptor
    error_message: str = ''            # failure reason (only when status=failed)

    def __post_init__(self):
        if not self.created_at:
            self.created_at = _now_kst_iso()
        if not self.created_date:
            self.created_date = self.created_at[:10]

    @staticmethod
    def build_id(article_id: str, mbti_group: str) -> str:
        """Generate a podcast_id from article ID and MBTI group."""
        ts = datetime.now(KST).strftime('%Y%m%d%H%M%S')
        return f"podcast_{article_id}_{mbti_group}_{ts}"

    def to_item(self) -> Dict[str, Any]:
        """Convert to DynamoDB item dict."""
        item = {
            'podcast_id': self.podcast_id,
            'article_id': self.article_id,
            'mbti_group': self.mbti_group,
            'title': self.title,
            'script_body': self.script_body,
            'duration_seconds': self.duration_seconds,
            's3_audio_uri': self.s3_audio_uri,
            'status': self.status,
            'created_at': self.created_at,
            'created_date': self.created_date,
            'voice_id': self.voice_id,
            'voice_style': self.voice_style,
            'item_type': 'podcast',
        }
        if self.error_message:
            item['error_message'] = self.error_message
        return {k: v for k, v in item.items() if v is not None}

    @classmethod
    def from_item(cls, item: Dict[str, Any]) -> 'Podcast':
        """Create from DynamoDB item dict."""
        dur = item.get('duration_seconds', 0)
        return cls(
            podcast_id=item.get('podcast_id', ''),
            article_id=item.get('article_id', ''),
            mbti_group=item.get('mbti_group', ''),
            title=item.get('title', ''),
            script_body=item.get('script_body', ''),
            duration_seconds=int(dur),
            s3_audio_uri=item.get('s3_audio_uri', ''),
            status=item.get('status', 'creating'),
            created_at=item.get('created_at', ''),
            created_date=item.get('created_date', ''),
            voice_id=item.get('voice_id', 'Seoyeon'),
            voice_style=item.get('voice_style', ''),
            error_message=item.get('error_message', ''),
        )

    def to_api(self) -> Dict[str, Any]:
        """Convert to API response format (excludes large script_body)."""
        resp = {
            'podcast_id': self.podcast_id,
            'article_id': self.article_id,
            'mbti_group': self.mbti_group,
            'title': self.title,
            'duration_seconds': self.duration_seconds,
            's3_audio_uri': self.s3_audio_uri,
            'status': self.status,
            'created_at': self.created_at,
            'voice_id': self.voice_id,
            'voice_style': self.voice_style,
        }
        if self.error_message:
            resp['error_message'] = self.error_message
        return resp
