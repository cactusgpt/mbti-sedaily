"""Core 3 Article Detail API — GET /api/v2/article/{news_id}?mbti=NT&user_id=...

Phase 2.5 / TASK-6 endpoint — what the frontend hits when a user clicks
a feed card. Returns the single article + the requested MBTI variant in
one JSON document, with the full transformed body (vs the 200-char
preview returned by the Feed API).

Two-tier API contract (matches Q1=C decision)
---------------------------------------------
* Feed API: list of items with body_preview only (~200 chars each)
* Article Detail API (this): single item with full body + variant
  metadata (key_points, closing_line, subtitle)

Critical invariant — MBTI determines which body
-----------------------------------------------
A single article can be selected for multiple MBTI groups (e.g. NT and
NF both choose article A). Each MBTI gets its own row in
``article_versions`` with its own transformed title/body. This handler
takes ``mbti`` as a required query param so the response always returns
the variant the user asked for. If the requested article was NOT
selected for the requested MBTI (or transform failed for that pair),
the handler returns 404 with a clear "no version available for this
MBTI" message — it does NOT fall back to a different MBTI's body.

Auth (Q2 = NONE, v1 parity)
---------------------------
``AuthorizationType: NONE`` at API Gateway. Optional ``user_id`` query
parameter accepted but unused — Phase 3 will use it to record reads in
``user_interactions``.

Path parameter extraction
-------------------------
API Gateway HTTP API v2 puts path parameters at
``event.pathParameters.{key}`` for routes declared with
``/api/v2/article/{news_id}``. This handler reads from that location
with a fallback to ``event.path`` parsing for direct invocations.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from config.constants import CORS_HEADERS
from core.decorators import lambda_handler as handler_decorator
from core.response import error_response, success_response

from v2.clients.pgvector_v2_client import PgVectorV2Client


logger = logging.getLogger(__name__)
logging.getLogger().setLevel(logging.INFO)


# Valid MBTI groups — short list, easier to validate inline than to import.
_VALID_MBTI = {"NT", "NF", "ST", "SF"}


# ── Pure helpers (unit-testable) ──────────────────────────────────────────────


def _extract_news_id(event: Dict[str, Any]) -> Optional[str]:
    """Extract news_id from path. Supports both API Gateway HTTP API v2
    (pathParameters dict) and direct invocations (path string)."""
    path_params = event.get("pathParameters") or {}
    if path_params.get("news_id"):
        return path_params["news_id"].strip() or None
    # Fallback: parse from raw path. e.g. /api/v2/article/2KBA6I5K9J
    raw_path = (
        event.get("path")
        or (event.get("requestContext") or {}).get("http", {}).get("path")
        or ""
    )
    if "/article/" in raw_path:
        tail = raw_path.split("/article/", 1)[1]
        # Strip any trailing slash or query (shouldn't be in path but defensive)
        tail = tail.split("?")[0].rstrip("/")
        return tail or None
    return None


def _extract_query_params(event: Dict[str, Any]) -> Dict[str, str]:
    return event.get("queryStringParameters") or {}


def _validate_mbti(raw: Optional[str]) -> Optional[str]:
    """Same contract as core3_feed._validate_mbti — kept independent (no
    cross-import) so the two handlers stay decoupled. Accepts 2- or
    4-char MBTI, returns canonical 2-char group or None on invalid."""
    if not raw:
        return None
    cleaned = raw.strip().upper()
    if len(cleaned) == 4:
        cleaned = cleaned[1:3]
    if cleaned in _VALID_MBTI:
        return cleaned
    return None


def _isoformat_or_none(value: Any) -> Optional[str]:
    """JSON-safe boundary for date/datetime values from pg client."""
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _build_article_response(row: Dict[str, Any]) -> Dict[str, Any]:
    """Map ``get_article_with_version`` row to the public article detail
    payload.

    Public shape (matches Q4=B v2 schema):
      news_id, mbti_type, category, published_at, press, url, byline,
      image_url, original_title, original_sub_title,
      version: {title, subtitle, body, key_points, closing_line},
      transformed_at

    Internal fields explicitly excluded:
      composite_score, embedding, raw metadata blobs from the JSONB
      columns that aren't part of the contract.

    Note on ``image_url``: lives in per-version ``version_metadata``
    (Path 2 — Transform extracts it from S3 ``original.json`` only for
    articles that actually transform, avoiding wasted work on the 87%
    of raw articles that never surface). Same value across all 4 MBTI
    variants of an article. Versions written before the Path 2 fix
    have None; frontend renders a category-based placeholder.
    """
    article_meta = row.get("article_metadata") or {}
    version_meta = row.get("version_metadata") or {}

    return {
        "news_id": row.get("news_id"),
        "mbti_type": row.get("mbti_type"),
        "category": row.get("category"),
        "published_at": _isoformat_or_none(row.get("published_at")),
        "press": article_meta.get("press"),
        "url": article_meta.get("url"),
        "byline": article_meta.get("author_name"),
        "image_url": version_meta.get("image_url"),
        "original_title": row.get("original_title"),
        "original_sub_title": article_meta.get("sub_title"),
        "version": {
            "title": row.get("version_title"),
            "subtitle": version_meta.get("subtitle", ""),
            "body": row.get("version_body"),
            "key_points": version_meta.get("key_points", []),
            "closing_line": version_meta.get("closing_line", ""),
        },
        "transformed_at": _isoformat_or_none(row.get("version_created_at")),
    }


# ── Handler ───────────────────────────────────────────────────────────────────


@handler_decorator
async def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = (
        event.get("httpMethod")
        or (event.get("requestContext") or {}).get("http", {}).get("method")
        or "GET"
    )
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    news_id = _extract_news_id(event)
    if not news_id:
        return error_response(
            "news_id path parameter is required",
            status_code=400,
            code="missing_news_id",
        )

    qs = _extract_query_params(event)
    mbti = _validate_mbti(qs.get("mbti"))
    if mbti is None:
        return error_response(
            "mbti query parameter is required and must be one of NT/NF/ST/SF (or full 4-char MBTI like INTJ)",
            status_code=400,
            code="invalid_mbti",
        )

    pg = PgVectorV2Client()
    row = pg.get_article_with_version(news_id, mbti)

    if row is None:
        # 404 covers two cases (caller doesn't need to distinguish):
        #   * article doesn't exist
        #   * article exists but no version for this MBTI (Selector didn't
        #     pick it for that group, OR transform failed for that group only)
        # Frontend shows "this article isn't available for your MBTI" or
        # similar. The handler does NOT fall back to a different MBTI's
        # body — that would violate the per-MBTI variant contract.
        logger.info(
            f"article_not_found: news_id={news_id} mbti={mbti}"
        )
        return error_response(
            f"No version of article {news_id} available for MBTI {mbti}",
            status_code=404,
            code="version_not_found",
        )

    payload = _build_article_response(row)
    logger.info(
        f"article: news_id={news_id} mbti={mbti} returned"
    )
    return success_response(payload)
