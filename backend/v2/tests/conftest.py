"""Pytest configuration for AI LENS v2 tests.

Registers v2-specific markers here (not in a backend-wide pytest.ini /
pyproject.toml) so v1 tests are untouched — per `.clauderules` #1, v1
configuration files must not be modified.

pytest auto-discovers this file because it lives in a test directory
(``backend/v2/tests/``). When running from ``backend/`` with
``python3 -m pytest v2/tests/...``, the hook below fires before test
collection and silences ``PytestUnknownMarkWarning`` for ``integration``
and ``slow``.
"""
from __future__ import annotations


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
