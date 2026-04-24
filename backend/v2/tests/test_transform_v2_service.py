"""Unit tests for TransformV2Service (TASK-2.3).

Six tests, all unit (no Bedrock, no AWS). Three are **regression guards**
for implicit contracts the wrapper depends on — if v1 ever drops the
``bedrock_client`` mutable attribute or renames ``MbtiTransformService``,
these fail before production sees the bug.

Run from ``backend/``::

    python3 -m pytest v2/tests/test_transform_v2_service.py -v
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from clients.mbti_transform_service import MbtiTransformService

from v2.clients.transform_v2_service import TransformV2Service


# =============================================================================
# Regression guards (user-specified — see Phase A2 Section 4 discussion)
# =============================================================================


def test_v2_2_3_v1_exposes_bedrock_client_attribute() -> None:
    """v1 ``MbtiTransformService`` must keep ``bedrock_client`` as a swappable
    attribute. The wrapper replaces this attribute post-construction to inject
    a VPC endpoint; if v1 refactors to ``__init__``-only client creation or
    renames the attribute, this test fires before production sees the bug
    (wrapper silently uses the default public endpoint, which is
    unreachable from the VPC).
    """
    svc = MbtiTransformService(region="us-east-1")
    assert hasattr(svc, "bedrock_client"), (
        "v1 MbtiTransformService no longer exposes bedrock_client as a "
        "mutable attribute. TransformV2Service wrapper needs rework — "
        "see backend/v2/clients/transform_v2_service.py module docstring."
    )


def test_v2_2_3_wrapper_swaps_bedrock_client_with_endpoint_url() -> None:
    """Verify endpoint_url propagates to the underlying boto3 client."""
    wrapper = TransformV2Service(endpoint_url="https://test-vpce.example.com")
    assert (
        wrapper._svc.bedrock_client.meta.endpoint_url
        == "https://test-vpce.example.com"
    )


def test_v2_2_3_wrapper_without_endpoint_url_leaves_v1_default() -> None:
    """Without endpoint_url, v1's default boto3 client is preserved.

    boto3 default Bedrock endpoint is the public
    ``bedrock-runtime.us-east-1.amazonaws.com`` hostname (or ``None`` until
    the first request resolves it on some boto3 versions). We assert
    either — the point is that no VPC endpoint has been injected.
    """
    wrapper = TransformV2Service()
    endpoint = wrapper._svc.bedrock_client.meta.endpoint_url
    assert (
        endpoint is None
        or "bedrock-runtime.us-east-1.amazonaws.com" in endpoint
    ), f"Expected default public endpoint, got: {endpoint!r}"


# =============================================================================
# Additional wrapper contract tests
# =============================================================================


def test_v2_2_3_model_id_override_applied() -> None:
    """Wrapper must pass the correct Opus 4.6 inference profile ID, bypassing
    v1 ``config/constants.BEDROCK_MODEL_ID_OPUS`` which is stale
    (``'...-v1:0'``; Bedrock actual is ``'...-v1'`` with no ``:0`` suffix).

    This guard fires if the override is ever removed from
    ``transform_v2_service.py`` — Bedrock would otherwise reject the call
    with ValidationException and v2 Transform would silently 500.
    """
    wrapper = TransformV2Service()
    assert wrapper._svc.model_id == "us.anthropic.claude-opus-4-6-v1", (
        f"Expected Opus 4.6 inference profile ID (no ':0' suffix), "
        f"got: {wrapper._svc.model_id!r}. See transform_v2_service.py "
        f"module docstring for the v1 constants.py discrepancy."
    )


def test_v2_2_3_model_id_explicit_override_respected() -> None:
    """Caller-supplied ``model_id`` overrides the built-in Opus 4.6 ID."""
    wrapper = TransformV2Service(model_id="us.anthropic.claude-sonnet-4-6")
    assert wrapper._svc.model_id == "us.anthropic.claude-sonnet-4-6"


def test_v2_2_3_close_propagates_to_v1() -> None:
    """``await wrapper.close()`` must call v1's ``close()``. v1 ``close`` is
    a documented no-op (line 522-524 of mbti_transform_service.py), but the
    wrapper still delegates so a future v1 adding teardown logic works."""
    wrapper = TransformV2Service()
    with patch.object(
        MbtiTransformService, "close", new=AsyncMock(return_value=None)
    ) as mock_close:
        asyncio.run(wrapper.close())
        mock_close.assert_awaited_once()


def test_v2_2_3_transform_article_delegates_to_v1() -> None:
    """Smoke test: kwargs and return value pass through without modification."""
    expected_result = {
        "versions": {"NT": {"title": "t", "body": "b"}},
        "usage": {
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_input_tokens": 0,
            "cache_creation_input_tokens": 0,
        },
    }
    with patch.object(
        MbtiTransformService,
        "transform_article",
        new=AsyncMock(return_value=expected_result),
    ) as mock_transform:
        wrapper = TransformV2Service()
        result = asyncio.run(
            wrapper.transform_article(
                title="테스트 제목",
                subtitle="부제",
                content="본문",
                category="경제",
            )
        )
        assert result == expected_result
        mock_transform.assert_awaited_once_with(
            title="테스트 제목",
            subtitle="부제",
            content="본문",
            category="경제",
        )
