"""Feature flag 조회 with 5-minute TTL cache.

사용 예:
    from common.feature_flag import is_enabled

    if not is_enabled('chatbot'):
        return {"statusCode": 503, "body": '{"error":"disabled"}'}

DDB layout (sedaily-mbti-admin-config-dev):
    pk: 'CONFIG'
    sk: 'feature-flag/<name>'
    value: {"enabled": true/false}

핵심 설계:
- DDB get_item per Lambda invoke (cached 5분) — Lambda warm 시 +1ms, cold 시 +20ms
- DDB error 시 stale cache → default fallback. fail-open (admin 이 의도 disable 안 했으면 enabled 유지)
- v1/v2/admin Lambda 모두 import 가능 (boto3 만 의존)
"""
import logging
import os
import time
from typing import Optional

import boto3

logger = logging.getLogger(__name__)

_TABLE_NAME = os.environ.get("ADMIN_CONFIG_TABLE", "sedaily-mbti-admin-config-dev")
_REGION = os.environ.get("AWS_REGION", "us-east-1")
_TTL_SECONDS = 300  # 5분
_DEFAULT_ON_MISSING = True  # row 없으면 enabled (안전 default — admin 이 명시 disable 만 차단)

# 모듈 레벨 cache: {flag_name: (enabled: bool, fetched_at: float)}
_cache: dict = {}
_table = None


def _get_table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb", region_name=_REGION).Table(_TABLE_NAME)
    return _table


def is_enabled(name: str) -> bool:
    """Feature flag 조회. 5분 TTL cache. row 없으면 default True."""
    now = time.time()
    cached = _cache.get(name)
    if cached and (now - cached[1]) < _TTL_SECONDS:
        return cached[0]

    try:
        response = _get_table().get_item(Key={
            "pk": "CONFIG",
            "sk": f"feature-flag/{name}",
        })
        item = response.get("Item")
        if item is None:
            enabled = _DEFAULT_ON_MISSING
        else:
            enabled = bool(item.get("value", {}).get("enabled", _DEFAULT_ON_MISSING))
    except Exception as e:
        # DDB error 시 stale cache 우선, 없으면 fail-open
        if cached:
            return cached[0]
        logger.warning(f"feature_flag DDB error for {name}: {type(e).__name__}: {e}, using default {_DEFAULT_ON_MISSING}")
        return _DEFAULT_ON_MISSING

    _cache[name] = (enabled, now)
    return enabled


def invalidate(name: Optional[str] = None) -> None:
    """수동 cache invalidate (테스트 / 즉시 반영 강제용)."""
    if name is None:
        _cache.clear()
    else:
        _cache.pop(name, None)
