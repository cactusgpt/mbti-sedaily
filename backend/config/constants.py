"""
Centralized constants for the MBTI news style transformation backend.
All hardcoded values should be defined here.
"""

# =============================================================================
# AWS Configuration
# =============================================================================

# DynamoDB Tables
DYNAMODB_TABLE_ARTICLES_DEV = 'sedaily-mbti-articles-dev'
DYNAMODB_TABLE_ARTICLES_PROD = 'sedaily-mbti-articles'
DYNAMODB_TABLE_PERSONAL_DEV = 'sedaily-mbti-personal-dev'
DYNAMODB_TABLE_PODCAST_DEV = 'sedaily-mbti-podcast-dev'

# S3 Article Body Storage (separated from DynamoDB for large text)
S3_ARTICLE_BODY_BUCKET_DEV = 'sedaily-mbti-article-body-dev'
S3_ARTICLE_BODY_PREFIX = 'articles'

# S3 Audio Storage (podcast/TTS audio files)
S3_AUDIO_BUCKET_DEV = 'sedaily-mbti-audio-dev'

# AWS Regions
AWS_REGION_DEFAULT = 'us-east-1'
AWS_REGION_S3 = 'ap-northeast-2'

# GSI Names
GSI_CATEGORY_DATE = 'category-published_at-index'
GSI_SLUG = 'slug-index'

# Fields stored in S3 body JSON (moved out of DynamoDB to reduce item size)
S3_BODY_FIELDS = [
    'content_ko',
    'content_raw',
    'content_blocks',
    'version_NT',
    'version_NF',
    'version_ST',
    'version_SF',
]

# =============================================================================
# HTTP Timeouts (seconds)
# =============================================================================

HTTP_TIMEOUT_SHORT = 10      # For quick operations (revalidation, health checks)
HTTP_TIMEOUT_MEDIUM = 30     # For API calls (BigKinds, search)
HTTP_TIMEOUT_LONG = 60       # For heavy operations (translation)
HTTP_TIMEOUT_SCRAPER = 10    # For web scraping (byline, time)

# =============================================================================
# Redis Cache
# =============================================================================

CACHE_TTL_DEFAULT = 604800          # 7 days in seconds
CACHE_TTL_VIDEO_SCHEDULES = 300     # 5 minutes
REDIS_SOCKET_TIMEOUT = 2            # seconds

# =============================================================================
# URLs
# =============================================================================

# Frontend
FRONTEND_URL_DEFAULT = 'https://mbti.sedaily.com'

# External APIs
BIGKINDS_API_URL_DEFAULT = 'https://tools.kinds.or.kr'
ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

# Default Video URL
NAVER_TV_DEFAULT_URL = 'https://tv.naver.com/v/90963232?playlistNo=998605'
NAVER_TV_URL_DEFAULT = NAVER_TV_DEFAULT_URL  # Alias for consistency

# =============================================================================
# AI Model Configuration
# =============================================================================

# AWS Bedrock Claude Models
# Haiku 3.5 — Cost-effective for transformations & chatbot
# Cost: $0.25/$1.25 per 1M tokens (input/output)
BEDROCK_MODEL_ID_DEFAULT = 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
BEDROCK_MODEL_ID_HAIKU = 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
# Sonnet 4 — Higher quality for complex rewriting (optional upgrade)
BEDROCK_MODEL_ID_SONNET = 'us.anthropic.claude-sonnet-4-20250514-v1:0'
# Opus 4.6 — Highest quality for MBTI article transformation (parallel per-group calls).
# Inference-profile IDs for Opus 4.6 do NOT take a ":0" version suffix (verified
# via prod CloudWatch on sedaily-mbti-pipeline-step3-dev: every call with the
# old ":0" suffix returned ValidationException "The provided model identifier
# is invalid"). The v2 transform service had already worked around this by
# hardcoding the suffix-less form; this constant is now consistent with v2.
BEDROCK_MODEL_ID_OPUS = 'us.anthropic.claude-opus-4-6-v1'

# AWS Bedrock Nova Models
# Nova Lite — Low-cost for simple classification/filtering (Steps 1, 2, 4, Supervisor)
BEDROCK_MODEL_ID_NOVA_LITE = 'amazon.nova-lite-v1:0'
# Nova Pro — Higher quality for complex classification
BEDROCK_MODEL_ID_NOVA_PRO = 'amazon.nova-pro-v1:0'
# Default Nova model (used by pipeline steps)
BEDROCK_MODEL_ID_NOVA = BEDROCK_MODEL_ID_NOVA_LITE

# AWS Bedrock Embedding Models
# Titan Text Embeddings V2 — 1024-dim, up to 8192 tokens input
# Cost: $0.00002 per 1K input tokens
BEDROCK_EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0'
BEDROCK_EMBEDDING_DIMENSION = 1024
BEDROCK_EMBEDDING_MAX_TOKENS = 8192
# Approximate char-to-token ratio for Korean text (conservative)
EMBEDDING_CHARS_PER_CHUNK = 6000

BEDROCK_REGION = 'us-east-1'

# =============================================================================
# OpenSearch
# =============================================================================

OPENSEARCH_INDEX_DEFAULT = 'sedaily-articles'

# =============================================================================
# Categories
# =============================================================================

# Korean category names - Standard categories for the English site
# PHASE 72: Updated 2026-01-15 to include all categories from S3 XML
CATEGORIES_KOREAN = [
    '경제',
    'IT_과학',
    '정치',
    '사회',
    '문화',
    '스포츠',
    '국제'
]
ALL_CATEGORIES = CATEGORIES_KOREAN  # Alias for convenience

# Additional raw categories from S3 XML that need to be queried
# These are mapped to standard categories via normalize_category()
CATEGORIES_RAW_FROM_XML = [
    # Finance/Economy related
    '금융',
    '증권',
    '부동산',
    '산업',
    # Culture related (new naming)
    '문화·라이프',
    # Region
    '지역',
]

# English to Korean category mapping
CATEGORY_ENGLISH_TO_KOREAN = {
    'finance': '경제',
    'technology': 'IT_과학',
    'politics': '정치',
    'society': '사회',
    'culture': '문화',
    'sports': '스포츠',
    'international': '국제',
    'news': 'news'
}

# Korean to English category mapping
CATEGORY_KOREAN_TO_ENGLISH = {v: k for k, v in CATEGORY_ENGLISH_TO_KOREAN.items()}

# Valid English categories for API
VALID_CATEGORIES_ENGLISH = list(CATEGORY_ENGLISH_TO_KOREAN.keys())

# =============================================================================
# Category Normalization (for search queries)
# =============================================================================
# When searching, we need to query both old and new category names
# to get all articles regardless of when they were collected.

CATEGORY_SEARCH_ALIASES = {
    '경제': ['경제', '금융', '증권', '부동산'],
    'IT_과학': ['IT_과학', '산업', 'IT·과학'],  # 산업 (legacy) + IT·과학 (new since 2026-01-23)
    '정치': ['정치'],
    '사회': ['사회', '지역'],
    '문화': ['문화', '문화·라이프'],
    '스포츠': ['스포츠'],
    '국제': ['국제'],
}

# =============================================================================
# Pagination
# =============================================================================

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
BATCH_SIZE_DYNAMODB = 100  # DynamoDB batch operations limit

# =============================================================================
# Slug Configuration
# =============================================================================

SLUG_MAX_LENGTH = 60
SLUG_MIN_LENGTH = 3
SLUG_VALIDATION_MAX_LENGTH = 100
SLUG_COLLISION_MAX_ATTEMPTS = 10

# =============================================================================
# MBTI Groups
# =============================================================================

MBTI_GROUPS = ['NT', 'NF', 'ST', 'SF']

MBTI_GROUP_INFO = {
    'NT': {'label': '전략형 분석가', 'style': '애널리스트 리포트', 'icon': '📊'},
    'NF': {'label': '가치형 해석자', 'style': '칼럼/에세이', 'icon': '💡'},
    'ST': {'label': '실용형 실무자', 'style': '팩트시트', 'icon': '📋'},
    'SF': {'label': '공감형 소통가', 'style': '친구 톡', 'icon': '💬'},
}

# =============================================================================
# Podcast Configuration
# =============================================================================

# Polly Neural engine limit per call (characters)
POLLY_MAX_CHARS = 2800

# Maximum podcast script length (characters)
PODCAST_MAX_SCRIPT_LENGTH = 3000

# MBTI voice styles for podcast/TTS (Polly SSML prosody)
PODCAST_VOICE_STYLES = {
    'NT': {
        'rate': '100%',
        'pitch': 'medium',
        'desc': '전문적이고 차분한',
        'voice_id': 'Seoyeon',
    },
    'NF': {
        'rate': '95%',
        'pitch': 'medium',
        'desc': '따뜻하고 사려 깊은',
        'voice_id': 'Seoyeon',
    },
    'ST': {
        'rate': '105%',
        'pitch': 'low',
        'desc': '명확하고 간결한',
        'voice_id': 'Seoyeon',
    },
    'SF': {
        'rate': '95%',
        'pitch': 'high',
        'desc': '친근하고 공감하는',
        'voice_id': 'Seoyeon',
    },
}

# =============================================================================
# Default Values
# =============================================================================

DEFAULT_PRESS_NAME = '서울경제'
DEFAULT_BYLINE_KOREAN = '서울경제신문'
EDITORIAL_BYLINE = '서울경제 편집부'

# =============================================================================
# Item Types (DynamoDB)
# =============================================================================

ITEM_TYPE_ARTICLE = 'article'
ITEM_TYPE_SETTINGS = 'settings_config'
ITEM_TYPE_COLLECTION_LOG = 'collection_log'
ITEM_TYPE_ARTICLE_VERSION = 'article_version'
ITEM_TYPE_USER_PROFILE = 'user_profile'
ITEM_TYPE_ARCHIVED_SENTENCE = 'archived_sentence'
ITEM_TYPE_READING_RECORD = 'reading_record'
ITEM_TYPE_PODCAST = 'podcast'
ITEM_TYPE_NEWS_BRIEFING = 'news_briefing'

# =============================================================================
# News Briefing (Chatbot Context Cache)
# =============================================================================

NEWS_BRIEFING_ID = 'news_briefing_latest'
NEWS_BRIEFING_MAX_AGE_HOURS = 36  # 하루 1회 갱신 기준, 여유 12시간 포함

# =============================================================================
# Settings Keys
# =============================================================================

SETTINGS_KEY_VIDEO_SCHEDULES = 'video_schedules'
SETTINGS_KEY_TRANSLATION_PROMPT = 'translation_prompt'
SETTINGS_KEY_PROMPT_HISTORY = 'prompt_history'

# =============================================================================
# CORS Headers
# =============================================================================

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
}
