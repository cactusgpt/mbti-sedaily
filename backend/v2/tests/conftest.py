"""Pytest configuration for AI LENS v2 tests.

Registers v2-specific markers here (not in a backend-wide pytest.ini /
pyproject.toml) so v1 tests are untouched — per `.clauderules` #1, v1
configuration files must not be modified.

Also provides a session-scoped autouse fixture that wipes stale
test-prefix rows from pgvector v2 at session start and end. Per-test
fixtures still do their own pre/post wipe; this is belt-and-suspenders
against aborts (SIGKILL, network drop) that prevent per-test teardown
from running.

pytest auto-discovers this file because it lives in a test directory
(``backend/v2/tests/``). When running from ``backend/`` with
``python3 -m pytest v2/tests/...``, the hook below fires before test
collection and silences ``PytestUnknownMarkWarning`` for ``integration``
and ``slow``.
"""
from __future__ import annotations

import os

import pytest


# Test-data prefixes used by v2 test modules. Each new test file that
# inserts live rows should add its prefix here so the session-autouse
# cleanup covers it. Convention: ``test_v2_<task>_<scope>_``.
_TEST_PREFIXES: tuple[str, ...] = (
    "test_v2_1_3_",  # test_pgvector_v2_client.py — TASK-1.3
    "test_v2_2_1_",  # test_core1_collector.py — TASK-2.1 (pg rows only; S3 cleanup is per-test)
    "test_v2_2_3_",  # test_core2_transform.py, test_transform_v2_service.py — TASK-2.3
    "test_v2_2_4_",  # test_validator.py — TASK-2.4
    "test_v2_2_5_",  # test_backfill_from_v1.py — TASK-2.5
    "test_v2_2_6_",  # test_pgvector_v2_client.py article_selections methods — TASK-2.6
    "test_v2_3_1_",  # test_memory_manager.py — TASK-3.1 (Round 5-A)
    "test_v2_3_2_",  # test_context_broker.py — TASK-3.2 (Round 5-A)
)


def pytest_configure(config) -> None:
    """Register v2 markers so ``@pytest.mark.integration`` / ``slow`` work."""
    config.addinivalue_line(
        "markers",
        "integration: test requires live AWS resources "
        "(e.g. PG_V2_HOST, PG_V2_PASSWORD). Auto-skipped when env vars are unset.",
    )
    config.addinivalue_line(
        "markers",
        "slow: long-running test (e.g. multi-row perf benchmarks). "
        "Excluded by default; opt-in via ``-m slow``.",
    )


@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_prefixes():
    """Session-wide belt-and-suspenders cleanup for v2 pgvector tests.

    Runs once at session setup and once at teardown, regardless of test
    outcomes. Silently no-ops when PG_V2_* env vars are missing
    (pure-unit runs) or when the DB is unreachable (e.g. SG not yet
    opened) — unit tests must be runnable without any live infra.

    Per-test fixtures (``pg_client`` in test_pgvector_v2_client.py) still
    do their own pre/post wipe. This session-scope fixture exists only to
    catch rows left by a SIGKILL'd or network-dropped previous session
    where per-test teardown couldn't run.
    """
    if not (os.getenv("PG_V2_HOST") and os.getenv("PG_V2_PASSWORD")):
        yield
        return

    # Lazy import so unit-only runs (no env vars) skip pg8000 entirely.
    from v2.clients.pgvector_v2_client import PgVectorV2Client

    def _wipe_safe() -> None:
        """Best-effort session cleanup — swallow every error so a cleanup
        glitch never fails the session. Per-test fixtures will still catch
        any residue that slips through here.

        SAFETY: prefix values come from the ``_TEST_PREFIXES`` constant
        above; they are never user- or test-body-controlled. The f-string
        composition below therefore has no injection surface.
        """
        try:
            client = PgVectorV2Client()
            for prefix in _TEST_PREFIXES:
                for sql in (
                    f"DELETE FROM user_interactions WHERE news_id LIKE '{prefix}%'",
                    f"DELETE FROM user_profiles WHERE user_id LIKE '{prefix}%'",
                    f"DELETE FROM article_selections WHERE news_id LIKE '{prefix}%'",
                    f"DELETE FROM article_versions WHERE news_id LIKE '{prefix}%'",
                    f"DELETE FROM articles WHERE news_id LIKE '{prefix}%'",
                ):
                    try:
                        client.conn.run(sql)
                    except Exception:
                        pass
            client.close()
        except Exception:
            pass

    _wipe_safe()
    try:
        yield
    finally:
        _wipe_safe()
