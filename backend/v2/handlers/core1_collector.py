"""Core 1 Collector Lambda — fetch sedaily XML, dedup, embed, persist.

EventBridge triggers every 3 hours (rule configured in TASK-2.2). For a
given date (default: today KST), this Lambda pulls every article from the
v1 source XML feed, filters duplicates against pgvector v2, embeds each
new article with Titan V2, writes ``articles/{news_id}/original.json`` to
the v2 S3 bucket, and inserts a ``status='raw'`` row into pgvector v2 for
Core 2 Transform to pick up.

Intentionally simpler than v1 ``handlers/pipeline/step1_select.py``: no
Nova-based scoring, no per-category quota, no "best 30" selection.
Core 1 is pure ingest — selection happens at Core 3 personalization time.

Concurrency
-----------
Article processing fans out via ``asyncio.gather`` with two guards:

* ``asyncio.Semaphore(10)`` bounds concurrent Bedrock Titan V2 calls so
  we stay under the per-minute on-demand quota. 10 × ~400ms latency per
  call = ~25 batches/sec headroom, far under the documented ~2000 RPM
  Titan V2 limit for us-east-1.
* ``asyncio.Lock`` serializes pgvector inserts because
  ``pg8000.native.Connection`` is **not** thread-safe — a single
  connection instance cannot service concurrent ``run()`` calls. Since
  the Bedrock call dominates wall-clock (~400ms) and pg inserts take
  ~10ms, serializing writes is cheap.
* S3 ``put_object`` runs unlocked; boto3 low-level clients are documented
  thread-safe.

Partial failures are swallowed per-article: a bad article (malformed
XML field, Bedrock throttling, transient S3 error) never aborts the
rest of the batch. The response payload lists ``failed_ids`` for
post-mortem; CloudWatch records full stack traces via
``logger.exception``.

Action handling
---------------
The v1 sedaily XML feed marks each row with ``action = 'I' | 'U' | 'D'``
(Insert / Update / Delete). Currently only ``'I'`` rows are persisted;
``'U'`` and ``'D'`` are counted but skipped. See ``backend/v2/TASKS.md``
Phase 2 TODO for the Phase 5 review of this policy.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from clients.s3_xml_client import S3Article, S3XMLClient
from config.constants import CORS_HEADERS
from core.decorators import lambda_handler as handler_decorator
from core.response import success_response

from v2.clients.embedding_v2_client import EmbeddingV2Client
from v2.clients.pgvector_v2_client import PgVectorV2Client
from v2.clients.s3_article_v2_client import S3ArticleV2Client

logger = logging.getLogger(__name__)

_KST = timezone(timedelta(hours=9))

# Titan V2 accepts up to 8192 tokens. 6000 chars leaves headroom for Korean
# (~1.5 char/token typical) and matches the v1 EMBEDDING_CHARS_PER_CHUNK
# constant so single-call no-chunk embedding is guaranteed.
_EMBED_MAX_BODY_CHARS = 6000

# Garbage filter: articles shorter than this are typically breaking-news
# snippets that get replaced by a longer follow-up, or raw-feed stubs.
_MIN_BODY_LENGTH = 300

# Body preview stored in metadata for the Selector Lambda. 200 chars is the
# v1 step1_select.CONTENT_PREVIEW_CHARS value — preserves the prompt-token
# budget Nova Lite was tuned against. Longer previews don't help selection
# accuracy and inflate Bedrock cost linearly.
_CONTENT_PREVIEW_CHARS = 200

# Korean newspaper convention: personnel announcements ([인사]) and
# obituaries ([부고]) are news items by XML format but not news to read.
_GARBAGE_TITLE_MARKERS = ("[인사]", "[부고]")

# Concurrent Bedrock Titan V2 calls. Raising past 10 risks on-demand
# throttling on large-batch runs. See module docstring.
_EMBED_CONCURRENCY = 10


# ── Pure helpers (unit-testable) ─────────────────────────────────────────────


def _today_kst() -> str:
    """Today in KST as YYYYMMDD. Isolated for monkeypatching in tests."""
    return datetime.now(_KST).strftime("%Y%m%d")


def _extract_date(event: Dict[str, Any]) -> str:
    """Date precedence: ``event.date`` > ``event.detail.date`` > today KST.

    * Manual invoke: ``{"date": "20260419"}``.
    * EventBridge rule with input transformer: ``{"detail": {"date": ...}}``.
    * EventBridge default (no transformer): neither key — falls back to today.

    Treats ``event.detail = None`` identically to ``event.detail = {}`` so a
    minimal EventBridge payload doesn't raise AttributeError.
    """
    return (
        event.get("date")
        or (event.get("detail") or {}).get("date")
        or _today_kst()
    )


def _is_collectible(article: S3Article) -> bool:
    """Garbage filter per TASK-2.1 spec.

    Rejects body shorter than ``_MIN_BODY_LENGTH`` or a title containing
    ``[인사]`` / ``[부고]``. Intentionally cheap — Nova-based scoring
    lives in Core 3, not here.
    """
    if len(article.content_clean) < _MIN_BODY_LENGTH:
        return False
    return not any(m in article.title for m in _GARBAGE_TITLE_MARKERS)


def _build_embedding_text(article: S3Article) -> str:
    """``title + "\\n\\n" + body[:6000]``. Deterministic so tests can assert it."""
    body = article.content_clean[:_EMBED_MAX_BODY_CHARS]
    return f"{article.title}\n\n{body}"


def _build_metadata(article: S3Article) -> Dict[str, Any]:
    """Map ``S3Article`` → metadata dict for ``insert_article``.

    ``title``, ``category``, ``published_at`` are promoted to top-level
    columns by ``PgVectorV2Client.insert_article``; everything else lands
    in the ``metadata`` JSONB column for later ad-hoc queries.

    Note: image_url is intentionally NOT captured here (Path 2 design).
    Image extraction happens at Transform time so we only do the work
    for articles that actually surface to users (~13% of raw ingest).
    See core2_transform._extract_image_url.
    """
    return {
        "title": article.title,
        "category": article.main_category,
        "published_at": article.published_at,
        "url": article.url,
        "author_name": article.author_name,
        "author_email": article.author_email,
        "press": article.press,
        "sub_title": article.sub_title or "",
        "content_preview": article.content_clean[:_CONTENT_PREVIEW_CHARS],
    }


def _is_zero_vector(embedding: List[float], tol: float = 1e-9) -> bool:
    """True when every component is within ``tol`` of zero.

    ``EmbeddingV2Client.embed_text`` returns an all-zero vector when the
    Bedrock call fails (see its except block). Storing those in pgvector
    would poison cosine-distance ranking — NaN distances on zero-
    magnitude vectors (the same trap documented in the test fixture
    ``_embedding``). Treat zero as failure at this layer.
    """
    return all(abs(v) < tol for v in embedding)


# ── Per-article processing (called from asyncio.gather) ──────────────────────


async def _process_one(
    article: S3Article,
    *,
    s3_xml: S3XMLClient,
    embedder: EmbeddingV2Client,
    pg: PgVectorV2Client,
    s3_v2: S3ArticleV2Client,
    embed_semaphore: asyncio.Semaphore,
    db_lock: asyncio.Lock,
) -> Optional[str]:
    """Embed + S3 put + pg insert for one article.

    Returns ``article.nsid`` on success, ``None`` on any failure (logged
    at exception level with full traceback). See module docstring for the
    semaphore/lock rationale.
    """
    try:
        text = _build_embedding_text(article)

        async with embed_semaphore:
            embedding = await asyncio.to_thread(embedder.embed_text, text)

        if _is_zero_vector(embedding):
            # Upstream silently returned zero-vec → Bedrock failed.
            # Raise so the outer except counts this as a failure.
            raise RuntimeError(
                f"Titan V2 returned zero vector for {article.nsid!r} — "
                "Bedrock likely throttled or errored"
            )

        # article_to_dict is pure CPU work — no offload needed.
        article_dict = s3_xml.article_to_dict(article)
        await asyncio.to_thread(
            s3_v2.put_article_file, article.nsid, "original.json", article_dict
        )

        metadata = _build_metadata(article)
        async with db_lock:
            await asyncio.to_thread(
                pg.insert_article, article.nsid, metadata, embedding
            )

        return article.nsid
    except Exception:
        logger.exception(f"Collector failed on article {article.nsid}")
        return None


# ── Handler ──────────────────────────────────────────────────────────────────


@handler_decorator
async def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    method = (
        event.get("httpMethod")
        or (event.get("requestContext") or {}).get("http", {}).get("method")
        or "GET"
    )
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    date_str = _extract_date(event)
    logger.info(f"Collector run started for date={date_str}")

    s3_xml = S3XMLClient()
    embedder = EmbeddingV2Client(
        endpoint_url=os.getenv("BEDROCK_RUNTIME_ENDPOINT_URL", "")
    )
    pg = PgVectorV2Client()
    s3_v2 = S3ArticleV2Client()

    all_articles = await s3_xml.get_articles_by_date(date_str)

    action_counts: Dict[str, int] = {"I": 0, "U": 0, "D": 0}
    for a in all_articles:
        action_counts[a.action] = action_counts.get(a.action, 0) + 1

    inserts = [a for a in all_articles if a.action == "I"]
    after_garbage = [a for a in inserts if _is_collectible(a)]
    garbage_count = len(inserts) - len(after_garbage)

    candidate_ids = [a.nsid for a in after_garbage]
    existing = pg.filter_existing_news_ids(candidate_ids)
    new_articles = [a for a in after_garbage if a.nsid not in existing]
    duplicate_count = len(after_garbage) - len(new_articles)

    embed_semaphore = asyncio.Semaphore(_EMBED_CONCURRENCY)
    db_lock = asyncio.Lock()

    results = await asyncio.gather(
        *(
            _process_one(
                a,
                s3_xml=s3_xml,
                embedder=embedder,
                pg=pg,
                s3_v2=s3_v2,
                embed_semaphore=embed_semaphore,
                db_lock=db_lock,
            )
            for a in new_articles
        )
    )

    collected_ids = [r for r in results if r is not None]
    failed_ids = [
        a.nsid for a, r in zip(new_articles, results) if r is None
    ]

    metrics = {
        "date": date_str,
        "total_in_xml": len(all_articles),
        "action_i": action_counts["I"],
        "action_u": action_counts["U"],
        "action_d": action_counts["D"],
        "garbage": garbage_count,
        "duplicates": duplicate_count,
        "attempted": len(new_articles),
        "collected": len(collected_ids),
        "failed": len(failed_ids),
        "failed_ids": failed_ids,
    }
    logger.info(
        f"Collector run complete: {metrics['collected']} collected, "
        f"{metrics['duplicates']} duplicates, "
        f"{metrics['garbage']} garbage, "
        f"{metrics['failed']} failed (date={date_str})"
    )
    return success_response(metrics)
