"""
Enhanced Settings class for centralized configuration management.
Replaces scattered os.getenv() calls throughout the codebase.
"""

import os
from dataclasses import dataclass, field
from typing import Optional
from functools import lru_cache

from .constants import (
    AWS_REGION_DEFAULT,
    AWS_REGION_S3,
    DYNAMODB_TABLE_ARTICLES_DEV,
    BIGKINDS_API_URL_DEFAULT,
    BEDROCK_MODEL_ID_DEFAULT,
    FRONTEND_URL_DEFAULT,
    CACHE_TTL_DEFAULT,
)


@dataclass
class Settings:
    """Application settings loaded from environment variables."""

    # BigKinds API
    bigkinds_api_key: str = ''
    bigkinds_api_url: str = BIGKINDS_API_URL_DEFAULT

    # Anthropic API
    anthropic_api_key: str = ''
    anthropic_model_id: str = BEDROCK_MODEL_ID_DEFAULT

    # AWS Configuration
    region: str = AWS_REGION_DEFAULT
    s3_region: str = AWS_REGION_S3
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None

    # DynamoDB
    dynamodb_table_articles: str = DYNAMODB_TABLE_ARTICLES_DEV

    # Redis Cache
    redis_host: str = 'localhost'
    redis_port: int = 6379
    redis_password: Optional[str] = None
    redis_db: int = 0
    cache_ttl: int = CACHE_TTL_DEFAULT

    # API Server
    api_host: str = '0.0.0.0'
    api_port: int = 8000
    log_level: str = 'INFO'

    # Frontend
    frontend_url: str = FRONTEND_URL_DEFAULT
    revalidate_secret: Optional[str] = None

    # Google Analytics
    ga4_property_id: Optional[str] = None
    search_console_site_url: Optional[str] = None
    adsense_account_id: Optional[str] = None
    google_credentials_json: Optional[str] = None

    @classmethod
    def from_env(cls) -> 'Settings':
        """Create Settings instance from environment variables."""
        return cls(
            # BigKinds
            bigkinds_api_key=os.getenv('BIGKINDS_API_KEY', ''),
            bigkinds_api_url=os.getenv('BIGKINDS_API_URL', BIGKINDS_API_URL_DEFAULT),

            # Anthropic
            anthropic_api_key=os.getenv('ANTHROPIC_API_KEY', ''),
            anthropic_model_id=os.getenv('ANTHROPIC_MODEL_ID', BEDROCK_MODEL_ID_DEFAULT),

            # AWS
            region=os.getenv('AWS_REGION', os.getenv('REGION', AWS_REGION_DEFAULT)),
            s3_region=os.getenv('S3_REGION', AWS_REGION_S3),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),

            # DynamoDB
            dynamodb_table_articles=os.getenv('DYNAMODB_TABLE_ARTICLES', DYNAMODB_TABLE_ARTICLES_DEV),

            # Redis
            redis_host=os.getenv('REDIS_HOST', 'localhost'),
            redis_port=int(os.getenv('REDIS_PORT', '6379')),
            redis_password=os.getenv('REDIS_PASSWORD'),
            redis_db=int(os.getenv('REDIS_DB', '0')),
            cache_ttl=int(os.getenv('CACHE_TTL', str(CACHE_TTL_DEFAULT))),

            # API
            api_host=os.getenv('API_HOST', '0.0.0.0'),
            api_port=int(os.getenv('API_PORT', '8000')),
            log_level=os.getenv('LOG_LEVEL', 'INFO'),

            # Frontend
            frontend_url=os.getenv('FRONTEND_URL', FRONTEND_URL_DEFAULT),
            revalidate_secret=os.getenv('REVALIDATE_SECRET'),

            # Google Analytics
            ga4_property_id=os.getenv('GA4_PROPERTY_ID'),
            search_console_site_url=os.getenv('SEARCH_CONSOLE_SITE_URL'),
            adsense_account_id=os.getenv('ADSENSE_ACCOUNT_ID'),
            google_credentials_json=os.getenv('GOOGLE_CREDENTIALS_JSON'),
        )

    def is_production(self) -> bool:
        """Check if running in production environment."""
        return 'prod' in self.dynamodb_table_articles.lower()

    def get_dynamodb_table(self) -> str:
        """Get DynamoDB table name."""
        return self.dynamodb_table_articles


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached Settings instance.
    Uses lru_cache to ensure settings are loaded only once.
    """
    return Settings.from_env()


# Global settings instance for backward compatibility
settings = get_settings()
