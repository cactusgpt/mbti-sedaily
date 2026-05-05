"""HTTP API v2 응답 builder.

⚠️ CORS 헤더는 API Gateway HTTP API 가 API-level 에서 자동 처리 (sedaily-mbti-api-dev
의 CorsConfiguration: AllowOrigins=*, AllowMethods=GET/POST/OPTIONS,
AllowHeaders=content-type/authorization). Lambda response 에 Access-Control-*
헤더를 추가하면 conflict 가능성 → body + status 만 반환.
"""

import json
from typing import Any


def _serialize(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def ok(body: Any, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json; charset=utf-8"},
        "body": _serialize(body),
    }


def err(message: str, status: int = 400, **extra: Any) -> dict:
    payload = {"message": message}
    payload.update(extra)
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json; charset=utf-8"},
        "body": _serialize(payload),
    }
