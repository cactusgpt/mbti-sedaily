"""Unit + integration + performance tests for ``PgVectorV2Client``.

Three tiers, each runnable independently:

* **Unit**   — MagicMock-backed, no DB. Verify SQL shape, parameter binding,
  parsed return shapes, error-swallowing behaviour. Default selection.
* **Integration** — ``@pytest.mark.integration``; requires ``PG_V2_HOST`` +
  ``PG_V2_PASSWORD``. Auto-skipped when env vars are unset. Covers
  round-trips, ON CONFLICT semantics, FK cascades.
* **Performance** — ``@pytest.mark.slow`` (also ``integration``). Opt-in only
  (``-m slow``) because it seeds 1000 rows. Validates correctness of the
  ``find_feed_candidates`` code path, *not* production latency — see the
  fixture docstring for scale caveats.

Run from ``backend/``::

    python3 -m pytest v2/tests/test_pgvector_v2_client.py -v -m 'not integration and not slow'
    python3 -m pytest v2/tests/test_pgvector_v2_client.py -v -m integration    # integration only
    python3 -m pytest v2/tests/test_pgvector_v2_client.py -v -m slow           # perf only
"""
from __future__ import annotations

import json
import os
import statistics
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from v2.clients.pgvector_v2_client import (
    PgVectorV2Client,
    _json_default,
    _normalize_mbti_group,
    _vec_literal,
)

# Convenience: a correctly-sized embedding for unit tests that need to pass
# dimension validation. Real Titan V2 vectors are 1024-dim.
_DIM = 1024


def _e(seed: float = 0.0) -> list[float]:
    """Synthetic 1024-dim vector. Seed picks the constant value."""
    return [seed] * _DIM


# =============================================================================
# Module-level helpers
# =============================================================================

@pytest.mark.parametrize(
    "mbti,expected",
    [
        ("INTJ", "NT"), ("INTP", "NT"), ("ENTJ", "NT"), ("ENTP", "NT"),
        ("INFJ", "NF"), ("INFP", "NF"), ("ENFJ", "NF"), ("ENFP", "NF"),
        ("ISTJ", "ST"), ("ISTP", "ST"), ("ESTJ", "ST"), ("ESTP", "ST"),
        ("ISFJ", "SF"), ("ISFP", "SF"), ("ESFJ", "SF"), ("ESFP", "SF"),
        ("NT", "NT"), ("NF", "NF"), ("ST", "ST"), ("SF", "SF"),
    ],
)
def test_normalize_mbti_group_valid(mbti: str, expected: str) -> None:
    assert _normalize_mbti_group(mbti) == expected


@pytest.mark.parametrize(
    "bad",
    ["", "X", "XY", "ABCD", "INTJX", "intj", "nt"],
)
def test_normalize_mbti_group_rejects_bad_strings(bad: str) -> None:
    with pytest.raises(ValueError):
        _normalize_mbti_group(bad)


@pytest.mark.parametrize("bad", [None, 123, object(), ["NT"]])
def test_normalize_mbti_group_rejects_non_strings(bad) -> None:
    with pytest.raises(ValueError):
        _normalize_mbti_group(bad)  # type: ignore[arg-type]


def test_vec_literal_formats_list() -> None:
    assert _vec_literal([0.1, 0.2, 0.3]) == "[0.1,0.2,0.3]"


def test_vec_literal_handles_empty() -> None:
    assert _vec_literal([]) == "[]"


def test_vec_literal_handles_negative_and_zero() -> None:
    assert _vec_literal([-0.5, 0.0, 1.5]) == "[-0.5,0.0,1.5]"


# =============================================================================
# __init__ / connection management
# =============================================================================

def _clear_v2_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "PG_V2_HOST",
        "PG_V2_PORT",
        "PG_V2_DATABASE",
        "PG_V2_USER",
        "PG_V2_PASSWORD",
    ):
        monkeypatch.delenv(name, raising=False)


def test_init_enabled_when_password_set(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_v2_env(monkeypatch)
    c = PgVectorV2Client(password="x")
    assert c._enabled is True
    assert c._password == "x"


def test_init_disabled_when_password_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_v2_env(monkeypatch)
    c = PgVectorV2Client(password="")
    assert c._enabled is False


def test_init_reads_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_v2_env(monkeypatch)
    monkeypatch.setenv("PG_V2_HOST", "h.example.com")
    monkeypatch.setenv("PG_V2_PORT", "6543")
    monkeypatch.setenv("PG_V2_DATABASE", "db_x")
    monkeypatch.setenv("PG_V2_USER", "user_x")
    monkeypatch.setenv("PG_V2_PASSWORD", "pw")
    c = PgVectorV2Client()
    assert c._host == "h.example.com"
    assert c._port == 6543
    assert c._database == "db_x"
    assert c._user == "user_x"
    assert c._password == "pw"
    assert c._enabled is True


def test_init_defaults_when_env_absent(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_v2_env(monkeypatch)
    c = PgVectorV2Client(password="pw")
    assert c._port == 5432
    assert c._database == "ailens_v2"
    assert c._user == "ailens"


def test_init_constructor_args_override_env(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_v2_env(monkeypatch)
    monkeypatch.setenv("PG_V2_HOST", "env-host")
    c = PgVectorV2Client(host="ctor-host", password="pw")
    assert c._host == "ctor-host"


def test_close_resets_connection() -> None:
    c = PgVectorV2Client(password="x")
    fake = MagicMock()
    c._conn = fake
    c.close()
    fake.close.assert_called_once()
    assert c._conn is None


def test_close_safe_when_conn_none() -> None:
    c = PgVectorV2Client(password="x")
    c.close()  # must not raise


# =============================================================================
# Disabled-mode no-op behaviour
# =============================================================================

def _disabled() -> PgVectorV2Client:
    return PgVectorV2Client(password="")


def test_disabled_insert_article_noop() -> None:
    # Disabled client still runs dimension validation first — use _e() (1024-dim).
    _disabled().insert_article("n", {"title": "t"}, _e())


def test_disabled_update_article_status_noop() -> None:
    _disabled().update_article_status("n", "transformed")


def test_disabled_get_articles_by_status_returns_empty() -> None:
    assert _disabled().get_articles_by_status("raw") == []


def test_disabled_insert_article_version_returns_empty_string() -> None:
    assert _disabled().insert_article_version("n", "NT", {}, _e()) == ""


def test_disabled_get_article_versions_returns_empty_dict() -> None:
    assert _disabled().get_article_versions("n") == {}


def test_disabled_upsert_user_profile_noop() -> None:
    _disabled().upsert_user_profile("u", "INTJ", {}, None)


def test_disabled_get_user_profile_returns_none() -> None:
    assert _disabled().get_user_profile("u") is None


def test_disabled_record_interaction_noop() -> None:
    _disabled().record_interaction("u", "n", "NT", "click")


def test_disabled_get_user_interactions_returns_empty() -> None:
    assert _disabled().get_user_interactions("u") == []


def test_disabled_find_feed_candidates_returns_empty() -> None:
    assert _disabled().find_feed_candidates("INTJ", None, [], 10) == []


def test_disabled_find_similar_articles_returns_empty() -> None:
    assert _disabled().find_similar_articles(_e()) == []


# =============================================================================
# SQL binding — articles
# =============================================================================

def _enabled(dim: int = 2) -> PgVectorV2Client:
    """Enabled client with a MagicMock connection preloaded.

    Default ``dim=2`` so SQL binding tests can pass short embeddings like
    ``[0.1, 0.2]`` without tripping ``_validate_embedding``. Tests that
    specifically exercise dimension validation pass ``dim=1024`` (or any
    other value that mismatches the test input).
    """
    c = PgVectorV2Client(password="x", dimension=dim)
    c._conn = MagicMock()
    return c


def test_insert_article_binds_params_and_extracts_known_fields() -> None:
    c = _enabled()
    meta = {
        "title": "T",
        "category": "IT_과학",
        "published_at": "2026-04-01T00:00:00+09:00",
        "source": "xml",
        "reporter": "lee",
    }
    c.insert_article("n1", meta, [0.1, 0.2])
    c._conn.run.assert_called_once()
    sql = c._conn.run.call_args.args[0]
    kwargs = c._conn.run.call_args.kwargs
    assert "INSERT INTO articles" in sql
    assert "ON CONFLICT (news_id) DO NOTHING" in sql
    assert kwargs["news_id"] == "n1"
    assert kwargs["title"] == "T"
    assert kwargs["category"] == "IT_과학"
    assert kwargs["published_at"] == "2026-04-01T00:00:00+09:00"
    assert kwargs["embedding"] == "[0.1,0.2]"
    stored = json.loads(kwargs["metadata"])
    assert stored == {"source": "xml", "reporter": "lee"}


def test_insert_article_defaults_missing_optional_fields() -> None:
    c = _enabled()
    c.insert_article("n1", {"title": "t"}, [0.1, 0.2])
    kwargs = c._conn.run.call_args.kwargs
    assert kwargs["category"] is None
    assert kwargs["published_at"] is None
    assert json.loads(kwargs["metadata"]) == {}


def test_insert_article_swallows_exception() -> None:
    c = _enabled()
    c._conn.run.side_effect = RuntimeError("db down")
    c.insert_article("n", {"title": "t"}, [0.1, 0.2])  # must not raise


def test_insert_article_rejects_wrong_dimension() -> None:
    c = _enabled(dim=1024)
    with pytest.raises(ValueError, match="length mismatch"):
        c.insert_article("n", {"title": "t"}, [0.1, 0.2])


def test_update_article_status_binds_params() -> None:
    c = _enabled()
    c.update_article_status("n", "transformed")
    sql = c._conn.run.call_args.args[0]
    kwargs = c._conn.run.call_args.kwargs
    assert "UPDATE articles" in sql
    assert "updated_at = now()" in sql
    assert kwargs == {"status": "transformed", "nid": "n"}


def test_update_article_status_rejects_bad_value() -> None:
    c = _enabled()
    with pytest.raises(ValueError):
        c.update_article_status("n", "weird")


def test_update_article_status_logs_error_but_does_not_raise(
    caplog: pytest.LogCaptureFixture,
) -> None:
    c = _enabled()
    c._conn.run.side_effect = RuntimeError("conn reset")
    c.update_article_status("n", "failed")  # must not raise
    assert any("update_article_status" in rec.message for rec in caplog.records)


def test_get_articles_by_status_parses_rows() -> None:
    c = _enabled()
    c._conn.run.return_value = [
        ["n1", "raw", "T1", "IT_과학", "pub1", {"a": 1}, "c1", "u1"],
        ["n2", "raw", "T2", None, None, {}, "c2", "u2"],
    ]
    res = c.get_articles_by_status("raw", limit=5)
    assert len(res) == 2
    assert res[0]["news_id"] == "n1"
    assert res[0]["metadata"] == {"a": 1}
    assert res[1]["category"] is None


def test_get_articles_by_status_orders_by_created_at_asc() -> None:
    c = _enabled()
    c._conn.run.return_value = []
    c.get_articles_by_status("raw")
    sql = c._conn.run.call_args.args[0]
    assert "ORDER BY created_at ASC" in sql


def test_get_articles_by_status_swallows_exception() -> None:
    c = _enabled()
    c._conn.run.side_effect = RuntimeError("x")
    assert c.get_articles_by_status("raw") == []


def test_find_similar_articles_filters_transformed_and_orders_by_distance() -> None:
    c = _enabled()
    c._conn.run.return_value = [
        ["n1", "T", "IT_과학", "p", {}, 0.15],
    ]
    res = c.find_similar_articles([0.1, 0.2], limit=5)
    sql = c._conn.run.call_args.args[0]
    assert "status = 'transformed'" in sql
    assert "ORDER BY embedding <=> :q::vector" in sql
    assert len(res) == 1
    assert res[0]["distance"] == 0.15


def test_find_similar_articles_swallows_exception() -> None:
    c = _enabled()
    c._conn.run.side_effect = RuntimeError("x")
    assert c.find_similar_articles([0.1, 0.2]) == []


def test_find_similar_articles_rejects_wrong_dimension() -> None:
    c = _enabled(dim=1024)
    with pytest.raises(ValueError, match="length mismatch"):
        c.find_similar_articles([0.1, 0.2])


# =============================================================================
# SQL binding — article_versions
# =============================================================================

def test_insert_article_version_upserts_and_returns_uuid() -> None:
    c = _enabled()
    expected_id = str(uuid.uuid4())
    c._conn.run.return_value = [[expected_id]]
    ret = c.insert_article_version(
        "n1", "NT",
        {"title": "T", "body": "B", "extra": 1},
        [0.1, 0.2],
    )
    sql = c._conn.run.call_args.args[0]
    kwargs = c._conn.run.call_args.kwargs
    assert "INSERT INTO article_versions" in sql
    assert "ON CONFLICT (news_id, mbti_type) DO UPDATE" in sql
    assert "RETURNING version_id" in sql
    assert kwargs["news_id"] == "n1"
    assert kwargs["mbti_type"] == "NT"
    assert kwargs["title"] == "T"
    assert kwargs["body"] == "B"
    assert json.loads(kwargs["metadata"]) == {"extra": 1}
    assert ret == expected_id


def test_insert_article_version_normalizes_full_mbti() -> None:
    c = _enabled()
    c._conn.run.return_value = [["id"]]
    c.insert_article_version("n", "INTJ", {}, [0.1, 0.2])
    assert c._conn.run.call_args.kwargs["mbti_type"] == "NT"


def test_insert_article_version_rejects_bad_mbti() -> None:
    c = _enabled()
    with pytest.raises(ValueError):
        # mbti check fires before dimension — any embedding length is fine here
        c.insert_article_version("n", "ZZ", {}, [0.1, 0.2])


def test_insert_article_version_rejects_wrong_dimension() -> None:
    c = _enabled(dim=1024)
    with pytest.raises(ValueError, match="length mismatch"):
        c.insert_article_version("n", "NT", {}, [0.1, 0.2])


def test_insert_article_version_returns_empty_on_exception() -> None:
    c = _enabled()
    c._conn.run.side_effect = RuntimeError("x")
    assert c.insert_article_version("n", "NT", {}, [0.1, 0.2]) == ""


def test_get_article_versions_returns_keyed_dict() -> None:
    c = _enabled()
    c._conn.run.return_value = [
        ["id1", "NT", "T_NT", "B_NT", {"m": 1}, "c1"],
        ["id2", "NF", "T_NF", "B_NF", {}, "c2"],
    ]
    res = c.get_article_versions("n1")
    assert set(res.keys()) == {"NT", "NF"}
    assert res["NT"]["title"] == "T_NT"
    assert res["NT"]["version_id"] == "id1"
    assert res["NT"]["metadata"] == {"m": 1}


def test_get_article_versions_returns_empty_on_exception() -> None:
    c = _enabled()
    c._conn.run.side_effect = RuntimeError("x")
    assert c.get_article_versions("n") == {}


# =============================================================================
# SQL binding — user_profiles
# =============================================================================

def test_upsert_user_profile_with_embedding() -> None:
    c = _enabled()
    c.upsert_user_profile("u1", "INTJ", {"IT_과학": 0.7}, [0.1, 0.2])
    sql = c._conn.run.call_args.args[0]
    kwargs = c._conn.run.call_args.kwargs
    assert "INSERT INTO user_profiles" in sql
    assert "ON CONFLICT (user_id) DO UPDATE" in sql
    assert kwargs["uid"] == "u1"
    assert kwargs["mbti"] == "INTJ"
    assert json.loads(kwargs["weights"]) == {"IT_과학": 0.7}
    assert kwargs["vec"] == "[0.1,0.2]"


def test_upsert_user_profile_without_embedding() -> None:
    c = _enabled()
    c.upsert_user_profile("u1", "INTJ", {}, None)
    assert c._conn.run.call_args.kwargs["vec"] is None


def test_upsert_user_profile_allows_null_mbti_and_weights() -> None:
    c = _enabled()
    c.upsert_user_profile("u1", None, None, None)
    kwargs = c._conn.run.call_args.kwargs
    assert kwargs["mbti"] is None
    assert json.loads(kwargs["weights"]) == {}


def test_upsert_user_profile_rejects_wrong_dimension_when_given() -> None:
    c = _enabled(dim=1024)
    with pytest.raises(ValueError, match="length mismatch"):
        c.upsert_user_profile("u1", "INTJ", {}, [0.1, 0.2])


def test_upsert_user_profile_skips_validation_when_embedding_none() -> None:
    """None embedding bypasses dimension check (cold-start path)."""
    c = _enabled(dim=1024)
    c.upsert_user_profile("u1", "INTJ", {}, None)  # must not raise


def test_get_user_profile_returns_none_when_missing() -> None:
    c = _enabled()
    c._conn.run.return_value = []
    assert c.get_user_profile("u1") is None


def test_get_user_profile_returns_dict() -> None:
    c = _enabled()
    c._conn.run.return_value = [["u1", "INTJ", {"x": 1}, "c", "u"]]
    res = c.get_user_profile("u1")
    assert res == {
        "user_id": "u1",
        "mbti_type": "INTJ",
        "category_weights": {"x": 1},
        "created_at": "c",
        "updated_at": "u",
    }


def test_get_user_profile_returns_none_on_exception() -> None:
    c = _enabled()
    c._conn.run.side_effect = RuntimeError("x")
    assert c.get_user_profile("u1") is None


# =============================================================================
# SQL binding — user_interactions
# =============================================================================

def test_record_interaction_extracts_known_columns_and_puts_rest_in_metadata() -> None:
    c = _enabled()
    c.record_interaction(
        "u1", "n1", "NT", "dwell",
        dwell_ms=5000,
        scroll_pct=80,
        source="feed",
        position=3,
    )
    kwargs = c._conn.run.call_args.kwargs
    assert kwargs["dwell_ms"] == 5000
    assert kwargs["scroll_pct"] == 80
    assert kwargs["rating"] is None
    assert kwargs["reaction_type"] is None
    assert json.loads(kwargs["metadata"]) == {"source": "feed", "position": 3}


def test_record_interaction_allows_null_mbti() -> None:
    c = _enabled()
    c.record_interaction("u", "n", None, "skip")
    assert c._conn.run.call_args.kwargs["mbti"] is None


def test_record_interaction_normalizes_full_mbti() -> None:
    c = _enabled()
    c.record_interaction("u", "n", "ENFP", "click")
    assert c._conn.run.call_args.kwargs["mbti"] == "NF"


def test_record_interaction_rejects_bad_type() -> None:
    c = _enabled()
    with pytest.raises(ValueError):
        c.record_interaction("u", "n", "NT", "weirdtype")


def test_record_interaction_rejects_bad_mbti() -> None:
    c = _enabled()
    with pytest.raises(ValueError):
        c.record_interaction("u", "n", "ZZ", "click")


def test_record_interaction_swallows_db_exception() -> None:
    c = _enabled()
    c._conn.run.side_effect = RuntimeError("x")
    c.record_interaction("u", "n", "NT", "click")  # must not raise


def test_get_user_interactions_without_since_uses_simpler_query() -> None:
    c = _enabled()
    c._conn.run.return_value = []
    c.get_user_interactions("u", limit=50)
    sql = c._conn.run.call_args.args[0]
    assert ":since" not in sql
    assert "ORDER BY created_at DESC" in sql


def test_get_user_interactions_with_since_adds_filter() -> None:
    c = _enabled()
    c._conn.run.return_value = []
    since = datetime.now(timezone.utc) - timedelta(days=7)
    c.get_user_interactions("u", limit=50, since=since)
    sql = c._conn.run.call_args.args[0]
    kwargs = c._conn.run.call_args.kwargs
    assert "created_at >= :since" in sql
    assert kwargs["since"] == since


def test_get_user_interactions_parses_rows() -> None:
    c = _enabled()
    c._conn.run.return_value = [
        [1, "u", "n", "NT", "dwell", 3000, 50, None, None, {"s": "f"}, "c1"],
    ]
    res = c.get_user_interactions("u")
    assert len(res) == 1
    assert res[0]["id"] == 1
    assert res[0]["interaction_type"] == "dwell"
    assert res[0]["dwell_ms"] == 3000
    assert res[0]["metadata"] == {"s": "f"}


def test_get_user_interactions_returns_empty_on_exception() -> None:
    c = _enabled()
    c._conn.run.side_effect = RuntimeError("x")
    assert c.get_user_interactions("u") == []


# =============================================================================
# SQL binding — find_feed_candidates
# =============================================================================

def test_find_feed_candidates_with_embedding_orders_by_distance() -> None:
    c = _enabled()
    c._conn.run.return_value = []
    c.find_feed_candidates("INTJ", [0.1, 0.2], ["seen1"], limit=20)
    sql = c._conn.run.call_args.args[0]
    kwargs = c._conn.run.call_args.kwargs
    assert "ORDER BY av.embedding <=> :pref::vector" in sql
    assert ":excl::text[]" in sql
    assert kwargs["grp"] == "NT"
    assert kwargs["pref"] == "[0.1,0.2]"
    assert kwargs["excl"] == ["seen1"]


def test_find_feed_candidates_cold_start_falls_back_to_recency() -> None:
    c = _enabled()
    c._conn.run.return_value = []
    c.find_feed_candidates("NT", None, [], limit=20)
    sql = c._conn.run.call_args.args[0]
    kwargs = c._conn.run.call_args.kwargs
    assert "ORDER BY a.published_at DESC" in sql
    assert ":pref::vector" not in sql
    assert ":excl" not in sql
    assert "pref" not in kwargs
    assert "excl" not in kwargs


def test_find_feed_candidates_empty_exclude_omits_clause() -> None:
    c = _enabled()
    c._conn.run.return_value = []
    c.find_feed_candidates("NT", [0.1, 0.2], [], limit=5)
    sql = c._conn.run.call_args.args[0]
    assert ":excl::text[]" not in sql
    assert "NULL::float8" not in sql  # distance column still bound to vector


def test_find_feed_candidates_rejects_wrong_dimension_when_given() -> None:
    c = _enabled(dim=1024)
    with pytest.raises(ValueError, match="length mismatch"):
        c.find_feed_candidates("NT", [0.1, 0.2], [], limit=5)


def test_find_feed_candidates_cold_start_ignores_dimension() -> None:
    """``preference_embedding=None`` skips dimension validation entirely."""
    c = _enabled(dim=1024)
    c._conn.run.return_value = []
    c.find_feed_candidates("NT", None, [], limit=5)  # must not raise


def test_find_feed_candidates_joins_articles_and_filters_transformed() -> None:
    c = _enabled()
    c._conn.run.return_value = []
    c.find_feed_candidates("NT", [0.1, 0.2], [], 10)
    sql = c._conn.run.call_args.args[0]
    assert "JOIN articles a" in sql
    assert "a.status = 'transformed'" in sql


def test_find_feed_candidates_rejects_bad_mbti() -> None:
    c = _enabled()
    with pytest.raises(ValueError):
        # mbti fires before dimension
        c.find_feed_candidates("ZZ", [0.1, 0.2], [], 10)


def test_find_feed_candidates_parses_rows() -> None:
    c = _enabled()
    c._conn.run.return_value = [
        ["n1", "NT", "T1", "B1", {}, "c1", "IT_과학", "p1", 0.1],
        ["n2", "NT", "T2", "B2", {}, "c2", "경제", "p2", 0.3],
    ]
    res = c.find_feed_candidates("INTJ", [0.1, 0.2], [], 10)
    assert len(res) == 2
    assert res[0]["news_id"] == "n1"
    assert res[0]["distance"] == 0.1
    assert res[0]["category"] == "IT_과학"


def test_find_feed_candidates_parses_null_distance_on_cold_start() -> None:
    c = _enabled()
    c._conn.run.return_value = [
        ["n1", "NT", "T", "B", {}, "c", "IT_과학", "p", None],
    ]
    res = c.find_feed_candidates("NT", None, [], 10)
    assert res[0]["distance"] is None


def test_find_feed_candidates_returns_empty_on_exception() -> None:
    c = _enabled()
    c._conn.run.side_effect = RuntimeError("x")
    assert c.find_feed_candidates("NT", [0.1, 0.2], [], 10) == []


# =============================================================================
# _validate_embedding (instance-level, cares about self._dimension)
# =============================================================================

def test_validate_embedding_accepts_exact_length() -> None:
    c = PgVectorV2Client(password="x", dimension=4)
    c._validate_embedding([0.1, 0.2, 0.3, 0.4])  # must not raise


def test_validate_embedding_rejects_short() -> None:
    c = PgVectorV2Client(password="x", dimension=1024)
    with pytest.raises(ValueError, match="length mismatch"):
        c._validate_embedding([0.1] * 512)


def test_validate_embedding_rejects_long() -> None:
    c = PgVectorV2Client(password="x", dimension=1024)
    with pytest.raises(ValueError, match="length mismatch"):
        c._validate_embedding([0.1] * 2048)


def test_validate_embedding_rejects_empty() -> None:
    c = PgVectorV2Client(password="x", dimension=1024)
    with pytest.raises(ValueError, match="length mismatch"):
        c._validate_embedding([])


def test_validate_embedding_runs_in_disabled_mode() -> None:
    """Dimension validation fires even when the client is in no-op mode."""
    c = PgVectorV2Client(password="", dimension=1024)
    with pytest.raises(ValueError, match="length mismatch"):
        c.insert_article("n", {"title": "t"}, [0.1, 0.2])


# =============================================================================
# _json_default — metadata JSONB serializer
# =============================================================================

def test_json_default_serializes_datetime() -> None:
    t = datetime(2026, 4, 19, 12, 0, 0, tzinfo=timezone.utc)
    assert _json_default(t) == "2026-04-19T12:00:00+00:00"


def test_json_default_serializes_date() -> None:
    assert _json_default(date(2026, 4, 19)) == "2026-04-19"


def test_json_default_serializes_whole_decimal_as_int() -> None:
    assert _json_default(Decimal("5")) == 5
    assert isinstance(_json_default(Decimal("5")), int)


def test_json_default_serializes_fractional_decimal_as_float() -> None:
    assert _json_default(Decimal("3.14")) == pytest.approx(3.14)
    assert isinstance(_json_default(Decimal("3.14")), float)


def test_json_default_serializes_set() -> None:
    result = _json_default({"a", "b"})
    assert isinstance(result, list)
    assert sorted(result) == ["a", "b"]


def test_json_default_serializes_frozenset() -> None:
    result = _json_default(frozenset({1, 2}))
    assert isinstance(result, list)
    assert sorted(result) == [1, 2]


def test_json_default_rejects_unsupported_type() -> None:
    class Custom:
        pass

    with pytest.raises(TypeError, match="not JSON serializable"):
        _json_default(Custom())


def test_json_default_is_wired_into_metadata_dumps() -> None:
    """End-to-end: record_interaction with a datetime kwarg must serialize."""
    c = _enabled()
    when = datetime(2026, 4, 19, 12, 0, 0, tzinfo=timezone.utc)
    c.record_interaction(
        "u", "n", "NT", "dwell",
        dwell_ms=3000, first_seen_at=when, tags={"x", "y"},
    )
    stored = json.loads(c._conn.run.call_args.kwargs["metadata"])
    assert stored["first_seen_at"] == "2026-04-19T12:00:00+00:00"
    assert sorted(stored["tags"]) == ["x", "y"]


def test_insert_article_metadata_serializes_decimal() -> None:
    c = _enabled()
    c.insert_article(
        "n1",
        {"title": "T", "score": Decimal("4.5"), "views": Decimal("100")},
        [0.1, 0.2],
    )
    stored = json.loads(c._conn.run.call_args.kwargs["metadata"])
    assert stored["score"] == pytest.approx(4.5)
    assert stored["views"] == 100


def test_insert_article_metadata_rejects_unsupported_type() -> None:
    """Unknown types in metadata surface as TypeError — silent-drop is worse."""
    class Custom:
        pass

    c = _enabled()
    # The exception is caught by the try/except and logged as a warning; the
    # method returns without raising. Verify by asserting the mock was called
    # but the logger captured a warning.
    c.insert_article("n", {"title": "t", "obj": Custom()}, [0.1, 0.2])
    # json.dumps raises TypeError → caught → no conn.run call
    c._conn.run.assert_not_called()


# =============================================================================
# Integration tests  (require live PG_V2_HOST + PG_V2_PASSWORD)
# =============================================================================

_PG_V2_LIVE = bool(os.getenv("PG_V2_HOST")) and bool(os.getenv("PG_V2_PASSWORD"))

#: Prefix for per-test integration data — cleaned in ``pg_client`` teardown.
IT_PREFIX = "test_v2_1_3_it_"

#: Prefix for perf-seed data — cleaned in ``seeded_feed_candidates`` teardown.
#: Distinct from ``IT_PREFIX`` so per-test teardown never wipes the session seed.
PERF_PREFIX = "test_v2_1_3_perf_"


def _embedding(seed: float = 0.1) -> list[float]:
    """1024-dim synthetic vector. Value is deliberately simple so ORDER BY
    distance is deterministic in small fixtures."""
    return [seed] * 1024


def _wipe_prefix(client: PgVectorV2Client, prefix: str) -> None:
    """Delete every test-prefix row across the four v2 tables.

    Called from both setup and teardown so a previously-crashed run (SIGKILL,
    network drop before teardown could execute) does not leak rows into
    the next test invocation.

    Order: FK-dependent tables first — user_interactions and article_versions
    reference news_ids in articles, so we delete them before articles.
    user_profiles is independent of any FK.

    SAFETY: prefix is a module-level constant (IT_PREFIX or PERF_PREFIX);
    no user input reaches the f-string.
    """
    client.conn.run(
        f"DELETE FROM user_interactions WHERE news_id LIKE '{prefix}%'"
    )
    client.conn.run(
        f"DELETE FROM user_profiles WHERE user_id LIKE '{prefix}%'"
    )
    client.conn.run(
        f"DELETE FROM article_versions WHERE news_id LIKE '{prefix}%'"
    )
    client.conn.run(
        f"DELETE FROM articles WHERE news_id LIKE '{prefix}%'"
    )


@pytest.fixture()
def pg_client():
    """Function-scoped client connected to the real v2 DB.

    Pre-setup and teardown both wipe ``IT_PREFIX`` rows so any cruft from
    an aborted prior run is cleared before the test body runs. Perf rows
    (``PERF_PREFIX``) are untouched — distinct prefix, different fixture.
    """
    if not _PG_V2_LIVE:
        pytest.skip("PG_V2_HOST / PG_V2_PASSWORD not set")
    client = PgVectorV2Client()
    try:
        _wipe_prefix(client, IT_PREFIX)
        yield client
    finally:
        try:
            _wipe_prefix(client, IT_PREFIX)
        finally:
            client.close()


@pytest.mark.integration
def test_integration_article_roundtrip(pg_client: PgVectorV2Client) -> None:
    nid = f"{IT_PREFIX}roundtrip"
    pg_client.insert_article(
        nid, {"title": "T", "category": "IT_과학"}, _embedding()
    )
    rows = pg_client.get_articles_by_status("raw", limit=500)
    assert nid in [r["news_id"] for r in rows]


@pytest.mark.integration
def test_integration_insert_article_is_idempotent(pg_client: PgVectorV2Client) -> None:
    nid = f"{IT_PREFIX}idempotent"
    pg_client.insert_article(
        nid, {"title": "T1", "category": "IT_과학"}, _embedding(0.1)
    )
    pg_client.update_article_status(nid, "transformed")
    # second insert — DO NOTHING must keep the transformed status
    pg_client.insert_article(
        nid, {"title": "T2", "category": "경제"}, _embedding(0.9)
    )
    raw_ids = {r["news_id"] for r in pg_client.get_articles_by_status("raw", 500)}
    transformed_ids = {
        r["news_id"] for r in pg_client.get_articles_by_status("transformed", 500)
    }
    assert nid not in raw_ids
    assert nid in transformed_ids


@pytest.mark.integration
def test_integration_article_version_upsert_overwrites(
    pg_client: PgVectorV2Client,
) -> None:
    nid = f"{IT_PREFIX}version"
    pg_client.insert_article(
        nid, {"title": "orig", "category": "IT_과학"}, _embedding()
    )
    id1 = pg_client.insert_article_version(
        nid, "NT", {"title": "v1", "body": "body1"}, _embedding(0.1)
    )
    id2 = pg_client.insert_article_version(
        nid, "NT", {"title": "v2", "body": "body2"}, _embedding(0.2)
    )
    # ON CONFLICT DO UPDATE: same row → version_id stable across upserts
    assert id1 == id2
    versions = pg_client.get_article_versions(nid)
    assert "NT" in versions
    assert versions["NT"]["title"] == "v2"
    assert versions["NT"]["body"] == "body2"


@pytest.mark.integration
def test_integration_article_version_fk_cascade(
    pg_client: PgVectorV2Client,
) -> None:
    nid = f"{IT_PREFIX}cascade"
    pg_client.insert_article(nid, {"title": "t", "category": "x"}, _embedding())
    for g in ("NT", "NF"):
        pg_client.insert_article_version(
            nid, g, {"title": "t", "body": "b"}, _embedding()
        )
    pg_client.conn.run("DELETE FROM articles WHERE news_id = :n", n=nid)
    assert pg_client.get_article_versions(nid) == {}


@pytest.mark.integration
def test_integration_user_profile_upsert(pg_client: PgVectorV2Client) -> None:
    uid = f"{IT_PREFIX}user1"
    pg_client.upsert_user_profile(uid, "INTJ", {"IT_과학": 0.7}, _embedding())
    first = pg_client.get_user_profile(uid)
    assert first is not None
    assert first["mbti_type"] == "INTJ"

    pg_client.upsert_user_profile(uid, "ENFP", {"문화": 0.9}, _embedding(0.5))
    second = pg_client.get_user_profile(uid)
    assert second is not None
    assert second["mbti_type"] == "ENFP"
    assert second["category_weights"]["문화"] == 0.9


@pytest.mark.integration
def test_integration_record_interaction(pg_client: PgVectorV2Client) -> None:
    uid = f"{IT_PREFIX}user2"
    nid = f"{IT_PREFIX}int"
    pg_client.insert_article(nid, {"title": "t"}, _embedding())
    pg_client.record_interaction(uid, nid, "NT", "click")
    pg_client.record_interaction(
        uid, nid, "NT", "dwell", dwell_ms=3000, source="feed"
    )
    rows = pg_client.get_user_interactions(uid, limit=10)
    assert len(rows) == 2
    dwell = next(r for r in rows if r["interaction_type"] == "dwell")
    assert dwell["dwell_ms"] == 3000
    assert dwell["metadata"].get("source") == "feed"


@pytest.mark.integration
def test_integration_user_interactions_since_filter(
    pg_client: PgVectorV2Client,
) -> None:
    uid = f"{IT_PREFIX}user_since"
    nid = f"{IT_PREFIX}since"
    pg_client.insert_article(nid, {"title": "t"}, _embedding())
    pg_client.record_interaction(uid, nid, "NT", "click")
    # since = 1 hour in the future → no rows
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    assert pg_client.get_user_interactions(uid, since=future) == []
    # since = 1 hour ago → the event
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    assert len(pg_client.get_user_interactions(uid, since=past)) == 1


@pytest.mark.integration
def test_integration_find_similar_articles(pg_client: PgVectorV2Client) -> None:
    for i in range(3):
        nid = f"{IT_PREFIX}sim_{i}"
        pg_client.insert_article(nid, {"title": f"T{i}"}, _embedding(0.1 * i))
        pg_client.update_article_status(nid, "transformed")
    hits = pg_client.find_similar_articles(_embedding(0.0), limit=2)
    assert len(hits) == 2
    # ordered ascending by distance
    assert hits[0]["distance"] <= hits[1]["distance"]


@pytest.mark.integration
def test_integration_find_feed_candidates_excludes_seen(
    pg_client: PgVectorV2Client,
) -> None:
    nid1, nid2 = f"{IT_PREFIX}feed1", f"{IT_PREFIX}feed2"
    for nid in (nid1, nid2):
        pg_client.insert_article(
            nid, {"title": "t", "category": "IT_과학"}, _embedding()
        )
        pg_client.update_article_status(nid, "transformed")
        pg_client.insert_article_version(
            nid, "NT", {"title": "t", "body": "b"}, _embedding(0.1)
        )
    results = pg_client.find_feed_candidates(
        "NT", _embedding(0.0), [nid1], limit=50
    )
    ids = [r["news_id"] for r in results]
    assert nid2 in ids
    assert nid1 not in ids


@pytest.mark.integration
def test_integration_find_feed_candidates_cold_start(
    pg_client: PgVectorV2Client,
) -> None:
    nid = f"{IT_PREFIX}cold"
    pg_client.insert_article(
        nid, {"title": "t", "category": "IT_과학"}, _embedding()
    )
    pg_client.update_article_status(nid, "transformed")
    pg_client.insert_article_version(
        nid, "NT", {"title": "t", "body": "b"}, _embedding()
    )
    results = pg_client.find_feed_candidates("INTJ", None, [], limit=5)
    assert nid in [r["news_id"] for r in results]


# =============================================================================
# Performance — opt-in via `-m slow`
# =============================================================================

@pytest.fixture(scope="session")
def pg_session_client():
    if not _PG_V2_LIVE:
        pytest.skip("PG_V2_HOST / PG_V2_PASSWORD not set")
    client = PgVectorV2Client()
    try:
        yield client
    finally:
        client.close()


@pytest.fixture(scope="session")
def seeded_feed_candidates(pg_session_client: PgVectorV2Client):
    """Seed 1000 transformed articles with NT versions for a perf benchmark.

    NOTE: This benchmark uses 1000 rows which does not reflect production
    scale. Re-evaluate with 100K+ rows in Phase 3.
    ivfflat lists=100 is tuned for ~100K rows; at 1K rows a full scan may
    outperform the index.
    This test validates query correctness, not realistic latency.

    Pre-seed cleanup clears any PERF_PREFIX rows left by a previously
    aborted perf run — without it a crash mid-benchmark would leave
    cruft and the second run's INSERT ... DO NOTHING would silently
    skip fresh vectors, making the benchmark stale.
    """
    _wipe_prefix(pg_session_client, PERF_PREFIX)
    for i in range(1000):
        nid = f"{PERF_PREFIX}{i:04d}"
        seed = (i % 100) / 100.0
        pg_session_client.insert_article(
            nid,
            {"title": f"T{i}", "category": "IT_과학"},
            _embedding(seed),
        )
        pg_session_client.update_article_status(nid, "transformed")
        pg_session_client.insert_article_version(
            nid, "NT",
            {"title": f"T{i}_NT", "body": f"B{i}"},
            _embedding(seed + 0.01),
        )
    try:
        yield PERF_PREFIX
    finally:
        _wipe_prefix(pg_session_client, PERF_PREFIX)


@pytest.mark.integration
@pytest.mark.slow
def test_perf_find_feed_candidates_p95_under_200ms(
    pg_session_client: PgVectorV2Client,
    seeded_feed_candidates: str,
) -> None:
    """``find_feed_candidates`` p95 latency — see ``seeded_feed_candidates``
    fixture for scale caveats."""
    query = _embedding(0.42)
    # warm-up: connection pool, plan cache
    for _ in range(3):
        pg_session_client.find_feed_candidates("NT", query, [], limit=50)
    latencies = []
    for _ in range(20):
        start = time.perf_counter()
        pg_session_client.find_feed_candidates("NT", query, [], limit=50)
        latencies.append(time.perf_counter() - start)
    # statistics.quantiles(n=20)[-1] = the 19th cut point ≈ 95th percentile
    p95 = statistics.quantiles(latencies, n=20)[-1]
    assert p95 < 0.200, (
        f"p95={p95 * 1000:.1f}ms exceeds 200ms target. "
        f"all latencies (ms): {[round(x * 1000, 1) for x in latencies]}"
    )
