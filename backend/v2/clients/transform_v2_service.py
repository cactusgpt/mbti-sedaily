"""Transform V2 Service — AI LENS v2 Core 2 wrapper.

Thin composition wrapper around v1 ``MbtiTransformService`` that:

1. Injects an ``endpoint_url`` so VPC-bound v2 Lambdas can route Bedrock
   traffic through the v2 Interface VPC Endpoint
   (``vpce-08cbef4cbd9f0c830``). v1 ``MbtiTransformService.__init__`` does
   not accept ``endpoint_url``, so we construct a boto3 client here and
   swap it into the v1 instance's ``bedrock_client`` attribute. The three
   regression tests in ``test_transform_v2_service.py`` guard that this
   swap remains valid if v1 refactors its internals.

2. Overrides the Opus model ID. v1 ``config/constants.py`` pins
   ``BEDROCK_MODEL_ID_OPUS = 'us.anthropic.claude-opus-4-6-v1:0'`` but
   Bedrock's actual inference profile for Opus 4.6 is
   ``us.anthropic.claude-opus-4-6-v1`` (no ``:0`` suffix — AWS changed the
   naming convention for Opus 4.6+). v1's stale constant makes Bedrock
   reply ``ValidationException: The provided model identifier is invalid``,
   confirmed during TASK-2.3 verify_opus_baseline runs. We pass the
   correct ID explicitly here so v2 works regardless of v1's fix status;
   .clauderules #1 forbids editing v1 files in this session.

Design: composition, not subclass
---------------------------------
v1 ``MbtiTransformService`` stays untouched (per ``.clauderules`` #1).
This class owns a v1 instance (``self._svc``) and forwards
``transform_article`` to it. All the heavy lifting — 4-parallel Opus
calls, prompt-caching, retry, JSON parsing, graceful degradation — lives
in v1 and is re-used without modification.

Cache TTL
---------
v1 hardcodes ``cache_control: {"type": "ephemeral"}`` (5min default).
Applying 1h TTL would require editing v1's ``transform_single_group``
body construction — forbidden per ``.clauderules`` #1. Deferred to a
future TASK (Option Z per the Phase A2 design discussion); current v2
Transform Lambda accepts the ``rate(5min)`` trigger × 5min TTL race as
observable via the ``cache_hit`` metric in handler JSON logs.
"""
from __future__ import annotations

from typing import Any, Optional

import boto3
from botocore.config import Config

from clients.mbti_transform_service import MbtiTransformService


# Matches v1 ``BEDROCK_CONFIG`` (mbti_transform_service.py line 24-28) so
# behaviour parity is preserved when we swap the client.
_BEDROCK_CONFIG = Config(
    read_timeout=600,
    connect_timeout=60,
    retries={"max_attempts": 3},
)

# Correct Opus 4.6 inference profile ID (see module docstring for rationale).
# v1 constant is stale; we pass this explicitly to bypass the v1 default.
_OPUS_4_6_MODEL_ID = "us.anthropic.claude-opus-4-6-v1"


class TransformV2Service:
    """v2 wrapper around v1 ``MbtiTransformService``.

    See module docstring for the endpoint_url and model_id override rationale.
    """

    def __init__(
        self,
        endpoint_url: Optional[str] = None,
        model_id: Optional[str] = None,
        region: str = "us-east-1",
    ) -> None:
        # Pass explicit model_id to bypass v1 constants.BEDROCK_MODEL_ID_OPUS,
        # which is stale ('...-v1:0' vs actual '...-v1').
        effective_model_id = model_id or _OPUS_4_6_MODEL_ID
        self._svc = MbtiTransformService(
            model_id=effective_model_id,
            region=region,
        )
        # Swap the v1 instance's bedrock_client for one configured with our
        # VPC endpoint. Same pattern as EmbeddingV2Client (composition, not
        # subclass) — see module docstring.
        if endpoint_url:
            self._svc.bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=region,
                endpoint_url=endpoint_url,
                config=_BEDROCK_CONFIG,
            )

    async def transform_article(self, *args: Any, **kwargs: Any) -> Any:
        """Forward to v1 ``transform_article``. See v1 docstring for contract.

        Returns dict with ``versions`` (``{NT/NF/ST/SF: version_dict}``) and
        ``usage`` (aggregated token counts including cache breakdown).
        Raises ``TransformError`` if all 4 groups fail.
        """
        return await self._svc.transform_article(*args, **kwargs)

    async def close(self) -> None:
        """Close the wrapped v1 service (no-op in v1 — Bedrock client needs no tear-down)."""
        await self._svc.close()
