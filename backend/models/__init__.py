"""
Data models module for the backend application.
"""

from .article import (
    Article,
    ArticleVersion,
    CollectionLog,
    ContentBlock,
    RelatedNews,
    PushInfo,
    PaperInfo,
)

from .personal import (
    ArchivedSentence,
    UserProfile,
    ReadingRecord,
)

from .podcast import Podcast

__all__ = [
    'Article',
    'ArticleVersion',
    'CollectionLog',
    'ContentBlock',
    'RelatedNews',
    'PushInfo',
    'PaperInfo',
    'ArchivedSentence',
    'UserProfile',
    'ReadingRecord',
    'Podcast',
]
