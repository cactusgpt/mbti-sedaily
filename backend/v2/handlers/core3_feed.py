"""Core 3 Feed API — GET /api/v2/feed?mbti=NT&limit=20&since=YYYY-MM-DD&user_id=...

Phase 2.5 / TASK-6 endpoint — what the frontend hits to render the main
feed. Returns the curated MBTI-rewritten article list for a given group.

Pipeline position
-----------------
Collector (3h) → Selector (3h) → Transform (5min) → **Feed API (this)** →
                                                   front-end render

Selection layer
---------------
Reads ``article_selections`` rows where ``selected=TRUE`` (rerank top-N
per MBTI per day) AND ``transformed_at IS NOT NULL`` (Transform Lambda
finished writing the per-MBTI version). Joined to ``articles`` for source
metadata and ``article_versions`` for the rewritten title/body.

Sorted newest selection_date first, then highest composite_score within
the date — so a slow news day surfaces yesterday's top articles before
last-week's tail.

Why composite_score is NOT in the response (Q5 = A)
---------------------------------------------------
The score is internal ranking signal from Bedrock Nova Lite. Exposing it
would let users reverse-engineer the algorithm and is meaningless to
non-debug consumers. Server-side ordering already encodes the score's
intent.

body_preview, not full body (Q1 = C)
------------------------------------
Each item in the feed carries a 200-char body preview. The full body
lives behind ``GET /api/v2/article/{id}?mbti=...`` to keep the feed
payload small (a 20-item feed is ~6 KB of metadata vs ~60 KB with
embedded full bodies). Mobile-first decision — matches frontend's
"click-to-expand" UX.

Auth (Q2 = NONE, v1 parity)
---------------------------
Wired with ``AuthorizationType: NONE`` at API Gateway, mirroring v1's
HTTP API. Optional ``user_id`` query parameter is accepted but unused
in Phase 2.5 — Phase 3 personalization will read from
``user_profiles.preference_embedding`` to re-rank within the MBTI feed.
"""
from __future__ import annotations

import logging
from datetime import date as _date
from typing import Any, Dict, Optional

from config.constants import CORS_HEADERS
from core.decorators import lambda_handler as handler_decorator
from core.response import error_response, success_response

from v2.clients.pgvector_v2_client import PgVectorV2Client


logger = logging.getLogger(__name__)
logging.getLogger().setLevel(logging.INFO)


# ── Sizing constants ──────────────────────────────────────────────────────────

# Default feed length when caller omits ``limit``. Matches Selector's
# TOP_N_PER_MBTI so the maximum selectable depth is preserved.
DEFAULT_LIMIT = 20

# Hard cap on caller-specified ``limit``. Even if the frontend asks for
# 1000, we clamp here — protects DB from accidental scans.
MAX_LIMIT = 50

# Body preview length in characters. Matches v1
# step1_select.CONTENT_PREVIEW_CHARS so the preview length is consistent
# across raw → selected → feed surfaces.
BODY_PREVIEW_CHARS = 200

# Valid MBTI groups — short list, easier to validate inline than to import.
_VALID_MBTI = {"NT", "NF", "ST", "SF"}


# ── Pure helpers (unit-testable) ──────────────────────────────────────────────


def _extract_query_params(event: Dict[str, Any]) -> Dict[str, str]:
    """API Gateway gives us queryStringParameters as a dict (or None) for
    REST-style events; HTTP API v2 events use the same shape under the
    same key. Normalize to a plain dict so callers don't need ``or {}`` everywhere."""
    return event.get("queryStringParameters") or {}


def _validate_mbti(raw: Optional[str]) -> Optional[str]:
    """Return the canonical 2-char MBTI group or None if invalid.

    Accepts both 2-char ('NT') and 4-char ('INTJ') input, uppercased and
    stripped. Returns None on any failure so the handler can return a
    400 with a uniform message.
    """
    if not raw:
        return None
    cleaned = raw.strip().upper()
    if len(cleaned) == 4:
        cleaned = cleaned[1:3]
    if cleaned in _VALID_MBTI:
        return cleaned
    return None


def _parse_limit(raw: Optional[str]) -> int:
    """Parse ``limit`` query param. Out-of-range / non-numeric falls back
    to ``DEFAULT_LIMIT``. Caps at ``MAX_LIMIT``. Never raises — feed
    requests should not 400 on a bad limit, just silently clamp."""
    if not raw:
        return DEFAULT_LIMIT
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_LIMIT
    if n < 1:
        return DEFAULT_LIMIT
    return min(n, MAX_LIMIT)


def _parse_since_date(raw: Optional[str]) -> Optional[_date]:
    """Parse ``since`` query param (ISO ``YYYY-MM-DD``). Returns None on
    missing or invalid input — pgvector_v2_client.get_feed will use its
    own default (today KST minus 7 days)."""
    if not raw:
        return None
    try:
        return _date.fromisoformat(raw.strip())
    except (TypeError, ValueError):
        return None


def _build_feed_item(row: Dict[str, Any]) -> Dict[str, Any]:
    """Map one ``get_feed`` row to a public feed item.

    Strips internal fields (composite_score, version_metadata's body etc.)
    and truncates ``version_body`` to ``BODY_PREVIEW_CHARS``. The output
    is what the API contract exposes; nothing else escapes.

    article_metadata (a.metadata JSONB from articles table) is included
    flat at the top level — Collector writes ``url``, ``press``,
    ``sub_title``, ``author_name``, ``author_email``, ``content_preview``
    keys here. Frontend uses them for card rendering (byline, source
    link, subtitle). ``image_url`` is NOT in this metadata today —
    Collector doesn't capture it from the source. Frontend handles
    that via category-based placeholder, not via this field.
    """
    body = row.get("version_body") or ""
    preview = body[:BODY_PREVIEW_CHARS]
    selection_date = row.get("selection_date")
    article_metadata = row.get("article_metadata") or {}
    return {
        "news_id": row.get("news_id"),
        "category": row.get("category"),
        "published_at": _isoformat_or_none(row.get("published_at")),
        "selection_date": _isoformat_or_none(selection_date),
        "transformed_at": _isoformat_or_none(row.get("transformed_at")),
        "title": row.get("version_title"),
        "body_preview": preview,
        "press": article_metadata.get("press"),
        "sub_title": article_metadata.get("sub_title"),
        "url": article_metadata.get("url"),
        "byline": article_metadata.get("author_name"),
    }


def _isoformat_or_none(value: Any) -> Optional[str]:
    """Accept date / datetime / str / None. Always emit JSON-safe ISO
    string or None. The pgvector client returns native datetime objects
    which json.dumps cannot serialize — this is the boundary."""
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


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

    qs = _extract_query_params(event)

    mbti = _validate_mbti(qs.get("mbti"))
    if mbti is None:
        return error_response(
            "mbti query parameter is required and must be one of NT/NF/ST/SF (or full 4-char MBTI like INTJ)",
            status_code=400,
            code="invalid_mbti",
        )

    limit = _parse_limit(qs.get("limit"))
    since = _parse_since_date(qs.get("since"))

    pg = PgVectorV2Client()
    rows = pg.get_feed(mbti, limit=limit, since_date=since)

    items = [_build_feed_item(r) for r in rows]
    response_data = {
        "mbti_type": mbti,
        "count": len(items),
        "items": items,
    }
    logger.info(
        f"feed: mbti={mbti} limit={limit} since={since} returned={len(items)}"
    )
    return success_response(response_data)
