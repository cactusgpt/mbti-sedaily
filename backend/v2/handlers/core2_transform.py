"""Core 2 Transform Lambda — turn ``status='raw'`` articles into 4 MBTI versions.

Wire-up
-------
Triggered every 5 minutes by EventBridge rule
``sedaily-mbti-v2-transform-trigger`` (wired in Phase E).

Per fire:

1. Poll pgvector for up to ``BATCH_SIZE`` raw articles (FIFO).
2. Empty batch → fast return (skip Bedrock/embed client init).
3. Otherwise, process articles in waves of ``ARTICLE_CONCURRENCY`` using
   ``asyncio.gather`` inside a single Lambda invocation:

   * Within each article, 4 parallel Opus 4.6 calls via v1's
     ``MbtiTransformService.transform_article()`` (already-parallel + cached
     system prompt + retry).
   * 4 parallel Titan V2 embeddings on the output versions.
   * 4 S3 ``version_<MBTI>.json`` puts.
   * 4 ``insert_article_version`` rows (serialised through a single
     ``db_lock`` because ``pg8000.native.Connection`` is not thread-safe).
   * Final ``update_article_status('transformed')``.

4. Between waves, check ``context.get_remaining_time_in_millis()``. If the
   next wave's worst-case (``WAVE_DEADLINE_BUFFER_S``) won't fit, bail
   gracefully — remaining articles stay ``status='raw'`` and get picked up
   on the next fire (Reserved concurrency=1 prevents double-pick races).

Failure policy — strict
-----------------------
v1 ``transform_article`` returns partial results when some MBTI groups
fail (graceful degradation). This handler treats anything less than 4
versions as failure: mark ``status='failed'`` and insert no versions.
Reason: Core 3 feed joins ``article_versions`` with
``articles.status='transformed'``, so missing a group means a whole
user-MBTI-group sees nothing for that article. Re-transform is cheaper
than fairness skew. Failed rows can be reset to ``'raw'`` via the retry
job (out of TASK-2.3 scope per TASKS.md).

Observability (JSON log events)
-------------------------------
* ``transform_run_complete`` — batch totals per fire
* ``transform_empty_batch`` — no raw articles
* ``transform_complete`` — per article × per MBTI group (includes cache
  hit rate via ``cache_read_input_tokens``)
* ``transform_partial_failure`` — article produced fewer than 4 versions
* ``transform_error`` — per-article exception (incl. S3 read miss)
* ``transform_deadline_skip`` — wave-level early stop

CloudWatch Insights can aggregate these to measure cache hit rate, per-
group latency, and failure distribution without re-processing payloads.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

from config.constants import CORS_HEADERS, MBTI_GROUPS
from core.decorators import lambda_handler as handler_decorator
from core.response import success_response

from v2.clients.embedding_v2_client import EmbeddingV2Client
from v2.clients.pgvector_v2_client import PgVectorV2Client
from v2.clients.s3_article_v2_client import S3ArticleV2Client
from v2.clients.transform_v2_service import TransformV2Service


logger = logging.getLogger(__name__)
# AWS Lambda Python runtime's root logger defaults to WARNING, which silently
# drops ``logger.info(json.dumps({...}))`` emissions used by this handler for
# per-article and per-run observability. Phase D live invoke (2026-04-24,
# RequestId 9688e130) confirmed ``[ERROR]`` and ``[WARNING]`` reach CloudWatch
# but ``[INFO]`` events (``transform_complete``, ``transform_run_complete``,
# ``transform_empty_batch``) did not. Raise the root level so CloudWatch
# Insights can aggregate them. v1 handlers have the same latent issue; we
# only fix v2 here per ``.clauderules`` #1 (no v1 edits).
logging.getLogger().setLevel(logging.INFO)


# ── Sizing constants ──────────────────────────────────────────────────────────

# Batch pulled from pgvector per fire. TPM budget (3M Opus 4.6 cross-region)
# easily absorbs 20 articles/fire × 4 calls × ~5500 tokens ≈ 440k tokens —
# well under the per-minute cap. Real limit is Lambda wall-clock + deadline
# guard below; see Phase A2 Section 3 design notes.
BATCH_SIZE = 20

# Articles processed concurrently within a single Lambda invocation. 5 ×
# 4 parallel Opus calls per article = 20 peak concurrent Bedrock requests.
ARTICLE_CONCURRENCY = 5

# Deadline guard between waves. Skip next wave if remaining Lambda time
# is less than this. Sized from measured Opus 4.6 latency
# (verify_opus_baseline.py, article 2KB8R3LJ9D = max 3,982 chars):
#
#   p99 single-group call   ≈ 28.73s (n=5, tight variance ~1.1s)
#   wave of 5 articles      ≈ max of 5 parallel article latencies ≈ 35s p99
#   embed + S3 + DB overhead ≈ 1-2s per article (parallelised)
#   one Bedrock retry (exp backoff 30s) covered: 35 + 30 = 65s worst case
#   + 25s safety margin     = 90s
#
# Adjust in Phase D if production Lambda (inside VPCE, network leg removed)
# shows materially different p99.
#
# Too low  → risk Lambda timeout mid-wave (partial writes; next fire
#            re-processes via ON CONFLICT DO UPDATE — not corrupt but wasteful)
# Too high → unnecessary skips, slower backlog clear
WAVE_DEADLINE_BUFFER_S = 90


# ── Handler ────────────────────────────────────────────────────────────────────


@handler_decorator
async def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = (
        event.get("httpMethod")
        or (event.get("requestContext") or {}).get("http", {}).get("method")
        or "GET"
    )
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    pg = PgVectorV2Client()
    raw = pg.get_articles_by_status("raw", limit=BATCH_SIZE)
    if not raw:
        logger.info(json.dumps({"event": "transform_empty_batch"}))
        return success_response({"processed": 0, "empty": True})

    endpoint_url = os.getenv("BEDROCK_RUNTIME_ENDPOINT_URL", "") or None
    transform_svc = TransformV2Service(endpoint_url=endpoint_url)
    embedder = EmbeddingV2Client(endpoint_url=endpoint_url)
    s3_v2 = S3ArticleV2Client()

    semaphore = asyncio.Semaphore(ARTICLE_CONCURRENCY)
    db_lock = asyncio.Lock()

    completed, failed, skipped = await _run_with_deadline(
        raw, context, transform_svc, embedder, pg, s3_v2, semaphore, db_lock
    )

    metrics = {
        "event": "transform_run_complete",
        "batch_size": len(raw),
        "completed": len(completed),
        "failed": len(failed),
        "skipped": len(skipped),
        "completed_ids": completed,
        "failed_ids": failed,
        "skipped_ids": skipped,
    }
    logger.info(json.dumps(metrics, ensure_ascii=False))
    return success_response(metrics)


# ── Wave loop with deadline guard ─────────────────────────────────────────────


async def _run_with_deadline(
    articles: List[Dict[str, Any]],
    context: Any,
    transform_svc: TransformV2Service,
    embedder: EmbeddingV2Client,
    pg: PgVectorV2Client,
    s3_v2: S3ArticleV2Client,
    semaphore: asyncio.Semaphore,
    db_lock: asyncio.Lock,
) -> Tuple[List[str], List[str], List[str]]:
    """Process ``articles`` in waves; bail between waves if time is low.

    Returns ``(completed_ids, failed_ids, skipped_ids)``.
    Skipped = articles that never started (stays status='raw', picked on
    next fire). Split wave boundaries so in-flight Bedrock calls are never
    aborted mid-flight — cleanup of half-posted versions would be fragile.
    """
    waves = [
        articles[i : i + ARTICLE_CONCURRENCY]
        for i in range(0, len(articles), ARTICLE_CONCURRENCY)
    ]
    completed: List[str] = []
    failed: List[str] = []
    skipped: List[str] = []

    for wave_idx, wave in enumerate(waves):
        remaining_s = (
            context.get_remaining_time_in_millis() / 1000
            if context is not None
            else float("inf")
        )
        if remaining_s < WAVE_DEADLINE_BUFFER_S:
            skipped_ids = [a["news_id"] for w in waves[wave_idx:] for a in w]
            skipped.extend(skipped_ids)
            logger.warning(
                json.dumps(
                    {
                        "event": "transform_deadline_skip",
                        "wave_idx": wave_idx,
                        "remaining_s": round(remaining_s, 2),
                        "buffer_s": WAVE_DEADLINE_BUFFER_S,
                        "skipped_count": len(skipped_ids),
                    }
                )
            )
            break

        wave_results = await asyncio.gather(
            *(
                _process_one_article(
                    article, transform_svc, embedder, pg, s3_v2, semaphore, db_lock
                )
                for article in wave
            ),
            return_exceptions=True,
        )
        for article, res in zip(wave, wave_results):
            nid = article["news_id"]
            if isinstance(res, Exception) or res is None:
                failed.append(nid)
            else:
                completed.append(nid)

    return completed, failed, skipped


# ── Per-article processing ────────────────────────────────────────────────────


async def _process_one_article(
    article: Dict[str, Any],
    transform_svc: TransformV2Service,
    embedder: EmbeddingV2Client,
    pg: PgVectorV2Client,
    s3_v2: S3ArticleV2Client,
    semaphore: asyncio.Semaphore,
    db_lock: asyncio.Lock,
) -> Optional[str]:
    """Transform one article end-to-end. Returns news_id on success, None on fail.

    Swallows per-article exceptions so a single bad article cannot poison
    the batch (the outer ``asyncio.gather(..., return_exceptions=True)``
    would receive the exception anyway, but handling here lets us mark
    ``status='failed'`` atomically at the same code path).
    """
    news_id = article["news_id"]
    async with semaphore:
        start = time.time()
        try:
            original = await asyncio.to_thread(
                s3_v2.get_article_file, news_id, "original.json"
            )
            if not original:
                raise RuntimeError(f"original.json missing for {news_id}")

            # Field mapping — v1 article_to_dict() renames Python dataclass
            # fields to Korean-suffixed JSON keys at the S3 boundary:
            #   title         → title_ko
            #   sub_title     → sub_title_ko
            #   content_clean → content_ko
            # See backend/clients/s3_xml_client.py line 809-826.
            result = await transform_svc.transform_article(
                title=original.get("title_ko", ""),
                subtitle=original.get("sub_title_ko", "") or "",
                content=original.get("content_ko", ""),
                category=original.get("category", ""),
            )

            versions = result["versions"]
            usage = result["usage"]

            # Strict policy: all 4 versions required, otherwise mark failed.
            if len(versions) < 4:
                async with db_lock:
                    await asyncio.to_thread(
                        pg.update_article_status, news_id, "failed"
                    )
                logger.error(
                    json.dumps(
                        {
                            "event": "transform_partial_failure",
                            "news_id": news_id,
                            "succeeded_groups": list(versions.keys()),
                            "failed_groups": [
                                g for g in MBTI_GROUPS if g not in versions
                            ],
                            "usage": usage,
                        },
                        ensure_ascii=False,
                    )
                )
                return None

            # Store all 4 versions in parallel (each does embed + S3 put +
            # pg insert; pg insert takes db_lock).
            await asyncio.gather(
                *(
                    _store_one_version(
                        news_id, group, version_dict, embedder, pg, s3_v2, db_lock
                    )
                    for group, version_dict in versions.items()
                )
            )

            async with db_lock:
                await asyncio.to_thread(
                    pg.update_article_status, news_id, "transformed"
                )

            latency_ms = int((time.time() - start) * 1000)
            # Emit one transform_complete event per group so CloudWatch
            # Insights can aggregate cache hit rate by group.
            for group in versions.keys():
                logger.info(
                    json.dumps(
                        {
                            "event": "transform_complete",
                            "news_id": news_id,
                            "mbti_group": group,
                            "input_tokens": usage.get("input_tokens", 0),
                            "output_tokens": usage.get("output_tokens", 0),
                            "cache_creation_input_tokens": usage.get(
                                "cache_creation_input_tokens", 0
                            ),
                            "cache_read_input_tokens": usage.get(
                                "cache_read_input_tokens", 0
                            ),
                            "cache_hit": usage.get("cache_read_input_tokens", 0) > 0,
                            "latency_ms": latency_ms,
                        }
                    )
                )
            return news_id

        except Exception as exc:
            async with db_lock:
                try:
                    await asyncio.to_thread(
                        pg.update_article_status, news_id, "failed"
                    )
                except Exception:
                    # If even the status update fails, log and continue —
                    # the next fire will pick it up with stale status='raw'
                    # and retry (ON CONFLICT DO UPDATE idempotent).
                    logger.exception(
                        f"update_article_status({news_id!r}, 'failed') also failed"
                    )
            logger.error(
                json.dumps(
                    {
                        "event": "transform_error",
                        "news_id": news_id,
                        "error_type": type(exc).__name__,
                        "error_message": str(exc),
                        "latency_ms": int((time.time() - start) * 1000),
                    },
                    ensure_ascii=False,
                ),
                exc_info=True,
            )
            return None


async def _store_one_version(
    news_id: str,
    group: str,
    version_dict: Dict[str, Any],
    embedder: EmbeddingV2Client,
    pg: PgVectorV2Client,
    s3_v2: S3ArticleV2Client,
    db_lock: asyncio.Lock,
) -> None:
    """Embed + S3 put + pg insert for one MBTI version.

    Version keys (``title``, ``subtitle``, ``body``, ``key_points``,
    ``closing_line``) come from Opus via v1's output-format spec
    (see ``_build_group_system_prompt`` line 131-138 of v1
    ``mbti_transform_service.py``). ``title`` and ``body`` are promoted to
    pgvector columns; the rest land in ``metadata`` JSONB.
    """
    body_text = f"{version_dict.get('title','')}\n\n{version_dict.get('body','')}"
    embedding = await asyncio.to_thread(embedder.embed_text, body_text)

    await asyncio.to_thread(
        s3_v2.put_article_file, news_id, f"version_{group}.json", version_dict
    )

    metadata = {
        "title": version_dict.get("title", ""),
        "body": version_dict.get("body", ""),
        "subtitle": version_dict.get("subtitle", ""),
        "key_points": version_dict.get("key_points", []),
        "closing_line": version_dict.get("closing_line", ""),
    }
    async with db_lock:
        await asyncio.to_thread(
            pg.insert_article_version, news_id, group, metadata, embedding
        )
