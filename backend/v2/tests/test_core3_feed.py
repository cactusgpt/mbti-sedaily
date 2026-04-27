"""Unit tests for v2.handlers.core3_feed.

Strategy: mock PgVectorV2Client so handler's request/response shape and
parameter validation are tested without DB. Live integration is exercised
post-deploy via curl.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from v2.handlers import core3_feed
from v2.handlers.core3_feed import (
    BODY_PREVIEW_CHARS,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    _build_feed_item,
    _isoformat_or_none,
    _parse_limit,
    _parse_since_date,
    _validate_mbti,
    lambda_handler,
)


# =============================================================================
# Pure helpers
# =============================================================================


def test_validate_mbti_accepts_2char() -> None:
    assert _validate_mbti("NT") == "NT"
    assert _validate_mbti("NF") == "NF"
    assert _validate_mbti("ST") == "ST"
    assert _validate_mbti("SF") == "SF"


def test_validate_mbti_accepts_4char_full_mbti() -> None:
    """Frontend may pass the user's stored 4-char mbti_type directly."""
    assert _validate_mbti("INTJ") == "NT"
    assert _validate_mbti("ENFP") == "NF"
    assert _validate_mbti("ISTP") == "ST"
    assert _validate_mbti("ESFJ") == "SF"


def test_validate_mbti_lowercases_and_strips() -> None:
    assert _validate_mbti("  nt  ") == "NT"
    assert _validate_mbti("intj") == "NT"


def test_validate_mbti_returns_none_on_invalid() -> None:
    assert _validate_mbti(None) is None
    assert _validate_mbti("") is None
    assert _validate_mbti("XX") is None
    assert _validate_mbti("INVALID") is None
    assert _validate_mbti("ABCDE") is None  # 5-char


def test_parse_limit_default_when_missing() -> None:
    assert _parse_limit(None) == DEFAULT_LIMIT
    assert _parse_limit("") == DEFAULT_LIMIT


def test_parse_limit_default_on_invalid() -> None:
    assert _parse_limit("abc") == DEFAULT_LIMIT
    assert _parse_limit("0") == DEFAULT_LIMIT  # zero treated as fallback
    assert _parse_limit("-5") == DEFAULT_LIMIT


def test_parse_limit_caps_at_max() -> None:
    assert _parse_limit("9999") == MAX_LIMIT
    assert _parse_limit(str(MAX_LIMIT + 1)) == MAX_LIMIT


def test_parse_limit_passes_through_in_range() -> None:
    assert _parse_limit("5") == 5
    assert _parse_limit(str(MAX_LIMIT)) == MAX_LIMIT


def test_parse_since_date_iso() -> None:
    assert _parse_since_date("2026-04-20") == date(2026, 4, 20)


def test_parse_since_date_invalid_returns_none() -> None:
    assert _parse_since_date(None) is None
    assert _parse_since_date("") is None
    assert _parse_since_date("not a date") is None
    assert _parse_since_date("2026/04/20") is None  # wrong separator


def test_isoformat_or_none_handles_date() -> None:
    assert _isoformat_or_none(date(2026, 4, 27)) == "2026-04-27"


def test_isoformat_or_none_handles_datetime() -> None:
    dt = datetime(2026, 4, 27, 1, 30, tzinfo=timezone.utc)
    assert _isoformat_or_none(dt).startswith("2026-04-27T01:30")


def test_isoformat_or_none_passthrough_string() -> None:
    """If pg client gives back an already-stringified value, don't crash."""
    assert _isoformat_or_none("2026-04-27T00:00:00+09:00") == "2026-04-27T00:00:00+09:00"


def test_isoformat_or_none_handles_none() -> None:
    assert _isoformat_or_none(None) is None


def test_build_feed_item_truncates_body() -> None:
    long_body = "한" * 500
    row = {
        "news_id": "n1",
        "category": "경제",
        "published_at": date(2026, 4, 26),
        "selection_date": date(2026, 4, 27),
        "transformed_at": datetime(2026, 4, 27, 1, 0, tzinfo=timezone.utc),
        "version_title": "T",
        "version_body": long_body,
    }
    item = _build_feed_item(row)
    assert len(item["body_preview"]) == BODY_PREVIEW_CHARS
    assert item["body_preview"] == "한" * BODY_PREVIEW_CHARS


def test_build_feed_item_omits_internal_fields() -> None:
    """composite_score and version_metadata must NOT leak to the public payload."""
    row = {
        "news_id": "n1",
        "category": "경제",
        "published_at": None,
        "selection_date": date(2026, 4, 27),
        "composite_score": 8.7,  # internal — must not appear
        "transformed_at": None,
        "version_title": "T",
        "version_body": "B",
        "version_metadata": {"key_points": ["secret"]},  # also internal
    }
    item = _build_feed_item(row)
    assert "composite_score" not in item
    assert "version_metadata" not in item
    assert "key_points" not in item


def test_build_feed_item_handles_short_body() -> None:
    row = {
        "news_id": "n1",
        "category": "경제",
        "published_at": None,
        "selection_date": None,
        "transformed_at": None,
        "version_title": "T",
        "version_body": "short body",
    }
    item = _build_feed_item(row)
    assert item["body_preview"] == "short body"  # not padded


def test_build_feed_item_handles_none_body() -> None:
    """Defensive against unexpected NULL body in DB (shouldn't happen but)."""
    row = {
        "news_id": "n1",
        "category": "경제",
        "published_at": None,
        "selection_date": None,
        "transformed_at": None,
        "version_title": "T",
        "version_body": None,
    }
    item = _build_feed_item(row)
    assert item["body_preview"] == ""


# =============================================================================
# lambda_handler — end-to-end with mocks
# =============================================================================


def _invoke(event: dict) -> dict:
    """Run the @handler_decorator-wrapped sync handler."""
    return lambda_handler(event, MagicMock(name="lambda_context"))


def test_handler_options_request_short_circuits() -> None:
    response = _invoke({"httpMethod": "OPTIONS"})
    assert response["statusCode"] == 200
    assert "Access-Control-Allow-Origin" in response["headers"]


def test_handler_missing_mbti_returns_400() -> None:
    pg = MagicMock()
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        response = _invoke({"httpMethod": "GET"})
    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    # error_response shape: {'error': 'message string', 'code': '...', ...}
    assert "mbti" in body.get("error", "").lower()
    pg.get_feed.assert_not_called()


def test_handler_invalid_mbti_returns_400() -> None:
    pg = MagicMock()
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        response = _invoke({
            "httpMethod": "GET",
            "queryStringParameters": {"mbti": "XX"},
        })
    assert response["statusCode"] == 400
    pg.get_feed.assert_not_called()


def test_handler_valid_mbti_returns_200_with_items() -> None:
    pg = MagicMock()
    pg.get_feed.return_value = [
        {
            "news_id": "n1",
            "mbti_type": "NT",
            "selection_date": date(2026, 4, 27),
            "composite_score": 8.5,
            "transformed_at": datetime(2026, 4, 27, 1, 0, tzinfo=timezone.utc),
            "category": "경제",
            "published_at": date(2026, 4, 26),
            "article_metadata": {"press": "서울경제"},
            "version_title": "NT 톤 제목",
            "version_body": "NT 본문 " * 50,  # > 200 chars
            "version_metadata": {"key_points": ["p1"]},
        },
        {
            "news_id": "n2",
            "mbti_type": "NT",
            "selection_date": date(2026, 4, 27),
            "composite_score": 7.8,
            "transformed_at": datetime(2026, 4, 27, 1, 0, tzinfo=timezone.utc),
            "category": "사회",
            "published_at": date(2026, 4, 26),
            "article_metadata": {},
            "version_title": "NT 제목 2",
            "version_body": "짧은 본문",
            "version_metadata": {},
        },
    ]
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        response = _invoke({
            "httpMethod": "GET",
            "queryStringParameters": {"mbti": "NT"},
        })
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["mbti_type"] == "NT"
    assert body["count"] == 2
    assert len(body["items"]) == 2
    assert body["items"][0]["news_id"] == "n1"
    assert body["items"][0]["title"] == "NT 톤 제목"
    assert len(body["items"][0]["body_preview"]) == BODY_PREVIEW_CHARS
    assert "composite_score" not in body["items"][0]


def test_handler_4char_mbti_normalized_to_2char() -> None:
    """User passes 'INTJ' (their stored mbti_type) → handler reduces to 'NT'."""
    pg = MagicMock()
    pg.get_feed.return_value = []
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        response = _invoke({
            "httpMethod": "GET",
            "queryStringParameters": {"mbti": "INTJ"},
        })
    body = json.loads(response["body"])
    assert body["mbti_type"] == "NT"
    pg.get_feed.assert_called_once()
    # Verify pg.get_feed received NT, not INTJ
    call_args = pg.get_feed.call_args
    assert call_args.args[0] == "NT" or call_args.kwargs.get("mbti_type") == "NT"


def test_handler_limit_clamps_to_max() -> None:
    pg = MagicMock()
    pg.get_feed.return_value = []
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        _invoke({
            "httpMethod": "GET",
            "queryStringParameters": {"mbti": "NT", "limit": "9999"},
        })
    call_args = pg.get_feed.call_args
    assert call_args.kwargs.get("limit") == MAX_LIMIT


def test_handler_limit_default_when_missing() -> None:
    pg = MagicMock()
    pg.get_feed.return_value = []
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        _invoke({
            "httpMethod": "GET",
            "queryStringParameters": {"mbti": "NT"},
        })
    assert pg.get_feed.call_args.kwargs.get("limit") == DEFAULT_LIMIT


def test_handler_since_date_passed_through() -> None:
    pg = MagicMock()
    pg.get_feed.return_value = []
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        _invoke({
            "httpMethod": "GET",
            "queryStringParameters": {"mbti": "NT", "since": "2026-04-20"},
        })
    assert pg.get_feed.call_args.kwargs.get("since_date") == date(2026, 4, 20)


def test_handler_invalid_since_date_passes_none() -> None:
    """Bad since= falls through to client default (silent — feed should still
    work even with a malformed date)."""
    pg = MagicMock()
    pg.get_feed.return_value = []
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        _invoke({
            "httpMethod": "GET",
            "queryStringParameters": {"mbti": "NT", "since": "not-a-date"},
        })
    assert pg.get_feed.call_args.kwargs.get("since_date") is None


def test_handler_user_id_accepted_but_unused() -> None:
    """Phase 2.5: user_id is optional and currently ignored.
    Handler must accept it without 400-ing."""
    pg = MagicMock()
    pg.get_feed.return_value = []
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        response = _invoke({
            "httpMethod": "GET",
            "queryStringParameters": {"mbti": "NT", "user_id": "user-abc"},
        })
    assert response["statusCode"] == 200
    # pg.get_feed was called with no user filter (Phase 2.5 = no personalization)
    pg.get_feed.assert_called_once()


def test_handler_empty_feed_returns_200_with_empty_items() -> None:
    """No selected+transformed rows yet → 200 + count=0 (NOT 404)."""
    pg = MagicMock()
    pg.get_feed.return_value = []
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        response = _invoke({
            "httpMethod": "GET",
            "queryStringParameters": {"mbti": "NT"},
        })
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["count"] == 0
    assert body["items"] == []


def test_handler_response_body_is_json_serializable() -> None:
    """Datetime objects in pg client output must be ISO-stringified before json.dumps."""
    pg = MagicMock()
    pg.get_feed.return_value = [
        {
            "news_id": "n1",
            "selection_date": date(2026, 4, 27),
            "transformed_at": datetime(2026, 4, 27, 1, 0, tzinfo=timezone.utc),
            "published_at": datetime(2026, 4, 26, 13, 0, tzinfo=timezone.utc),
            "category": "경제",
            "version_title": "T",
            "version_body": "B",
        }
    ]
    with patch.object(core3_feed, "PgVectorV2Client", return_value=pg):
        response = _invoke({
            "httpMethod": "GET",
            "queryStringParameters": {"mbti": "NT"},
        })
    # If date/datetime objects leaked, json.loads(response["body"]) would have
    # raised in error or shown them as Python repr. This assertion validates
    # success_response's json.dumps round-trips successfully.
    body = json.loads(response["body"])
    assert body["items"][0]["selection_date"] == "2026-04-27"
    assert "T" in body["items"][0]["transformed_at"]  # ISO format includes 'T'
