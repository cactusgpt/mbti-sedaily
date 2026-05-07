"""Core 1.5 Selector Lambda — score raw articles per MBTI and flag top-N selected.

Pipeline position
-----------------
``Core 1 Collector`` (3h) → **this Lambda (3h)** → ``Core 2 Transform`` (5min)
                                                  → ``Core 3 Feed API``

Where Core 1 dumps every fetched article into ``articles (status='raw')``
this Lambda picks the day's candidates, scores each on 4 MBTI dimensions
via Bedrock Nova Lite, and writes/updates ``article_selections`` rows.
After scoring, ``rerank_selections`` flips the top-20 ``selected=TRUE``
per MBTI for the day. Core 2 polls ``selected=TRUE AND transformed_at IS
NULL`` to know which (article, mbti) pairs to actually transform.

Per fire
--------
1. Compute today's KST date (or override from event ``date``).
2. ``find_unscored_articles(sel_date, limit=BATCH_SIZE)`` — only raw rows
   created today AND not yet in ``article_selections``. Q4=(B): scored
   once is scored forever for that day.
3. Filter out articles with empty ``content_preview`` (Q5=(A): pre-TASK-
   4-A backlog skipped — natural roll-off as fresh collections fill in).
4. Score the remaining articles via ``score_articles`` (Nova Lite,
   batched 20, max 5 parallel).
5. For each article × each MBTI group: compute composite_score and
   ``upsert_selection_score``.
6. For each MBTI group: ``rerank_selections(top_n=TOP_N_PER_MBTI)``.

What this Lambda intentionally does NOT do
------------------------------------------
* No category quota (Q1=(B)). Pure composite_score top-20 per MBTI.
* No score refresh — once today's row exists, never re-score it (Q4).
* No transform trigger — Core 2 polls on its own EventBridge schedule.
* No deadline-guard wave loop — Selector is much lighter than Transform
  (one Nova Lite call per ~20 articles vs 4 Opus calls per article),
  so the whole batch fits comfortably in a 5-minute Lambda budget.

Observability (JSON log events)
-------------------------------
* ``selector_run_complete`` — batch totals per fire
* ``selector_empty_batch``  — no unscored raws
* ``selector_skipped_no_preview`` — articles missing content_preview
* ``selector_rerank_complete`` — per MBTI group selected count
* ``selector_error`` — fatal exception (caller marks Lambda failed)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from common import feature_flag
from config.constants import CORS_HEADERS
from core.decorators import lambda_handler as handler_decorator
from core.response import success_response
from services.prompt_loader import load_prompt

from v2.clients.pgvector_v2_client import PgVectorV2Client
from v2.clients.selector_service import (
    composite_score,
    make_nova_client,
    score_articles,
)


logger = logging.getLogger(__name__)
logging.getLogger().setLevel(logging.INFO)


# ── Sizing constants ──────────────────────────────────────────────────────────

# Articles fetched per fire. Plenty for the typical KST-day raw count.
# Selector is idempotent on re-run (Q4=(B)) so a too-small batch just
# means today's tail gets scored on a later fire.
BATCH_SIZE = 200

# Top N selected per MBTI per day (Q1 product decision, TASKS.md Phase 2.5).
# v1 used 30 across NT/NF/ST/SF; v2 trims to 20 to keep Transform Bedrock
# spend in check (20 × 4 = 80 articles × 4 Opus calls/article ≈ 320 Opus
# calls/day, well under the 3M-token-per-min cross-region budget).
TOP_N_PER_MBTI = 20

# Concurrent Nova Lite batches. 5 × 20 articles/batch = 100 articles
# scored in parallel. v1 step1_select default.
SCORING_CONCURRENCY = 5

_KST = timezone(timedelta(hours=9))
_MBTI_GROUPS = ("NT", "NF", "ST", "SF")


# ── Pure helpers (unit-testable) ──────────────────────────────────────────────


def _today_kst_iso() -> str:
    """Today in KST as ISO-8601 (YYYY-MM-DD). Isolated for monkeypatching."""
    return datetime.now(_KST).date().isoformat()


def _resolve_selection_date(event: Dict[str, Any]):
    """Resolve the selection_date from event with fallback to today KST.

    Date precedence (matches Core 1 Collector):
      * Manual invoke: ``{"date": "2026-04-25"}`` (ISO) or ``"20260425"``
      * EventBridge w/ input transformer: ``event.detail.date``
      * Default: today KST

    Returns a ``datetime.date``.
    """
    from datetime import date as _date  # local to keep top imports tidy

    raw = (
        event.get("date")
        or (event.get("detail") or {}).get("date")
        or _today_kst_iso()
    )
    raw = str(raw)
    # Accept both YYYY-MM-DD and YYYYMMDD.
    if len(raw) == 8 and raw.isdigit():
        return _date(int(raw[0:4]), int(raw[4:6]), int(raw[6:8]))
    return _date.fromisoformat(raw)


async def _diag_paper_metadata(event: Dict[str, Any]) -> Dict[str, Any]:
    """Diagnostic-only — return recent ``articles`` rows with their
    paper-related metadata fields, for verifying that Phase 4-A's
    Collector ``_build_metadata`` actually promotes ``paper_number`` into
    the JSONB column.

    Read-only (one SELECT). Routed via ``event['_diag'] == 'paper_metadata'``
    in the lambda_handler dispatch. Kept committed (not a one-shot)
    because the same shape is reusable for any future "is this metadata
    field actually getting written?" question.

    Payload
    -------
    ``{"_diag": "paper_metadata", "hours": 30, "limit": 50}``

    The ``hours`` cutoff is computed in Python rather than via SQL
    ``interval`` concatenation — avoids any pg8000.native parameter-
    binding quirks around text-cast intervals.
    """
    hours = int(event.get("hours") or 30)
    limit = int(event.get("limit") or 50)

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    pg = PgVectorV2Client()
    rows = pg.conn.run(
        """
        SELECT
            a.news_id,
            a.status,
            a.created_at,
            a.metadata->>'paper_number'    AS paper_number,
            a.metadata->>'paper_date'      AS paper_date,
            a.metadata->>'paper_paragraph' AS paper_paragraph,
            a.category                     AS category,
            substring(a.title, 1, 60)      AS title_preview,
            (a.metadata ? 'paper_number')  AS has_paper_number_key
        FROM articles a
        WHERE a.created_at >= :cutoff
        ORDER BY a.created_at DESC
        LIMIT :lim
        """,
        cutoff=cutoff,
        lim=limit,
    )

    samples: List[Dict[str, Any]] = []
    paper_present = 0
    paper_absent = 0
    for r in rows:
        has_key = bool(r[8])
        d = {
            "news_id": r[0],
            "status": r[1],
            "created_at": r[2].isoformat() if r[2] else None,
            "paper_number": r[3],
            "paper_date": r[4],
            "paper_paragraph": r[5],
            "category": r[6],
            "title_preview": r[7],
            "has_paper_number_key": has_key,
        }
        if has_key:
            paper_present += 1
        else:
            paper_absent += 1
        samples.append(d)

    from collections import Counter
    pn_counter = Counter(
        (s.get("paper_number") or "<empty>")
        for s in samples
        if s.get("has_paper_number_key")
    )

    summary = {
        "total_rows": len(samples),
        "with_paper_number_key": paper_present,
        "without_paper_number_key": paper_absent,
        "paper_number_distribution": dict(pn_counter.most_common(20)),
        "cutoff_utc": cutoff.isoformat(),
    }

    logger.info(
        json.dumps(
            {
                "event": "selector_diag_paper_metadata",
                "hours": hours,
                "limit": limit,
                "summary": summary,
            },
            ensure_ascii=False,
        )
    )

    return success_response(
        {
            "diag": "paper_metadata",
            "hours": hours,
            "limit": limit,
            "summary": summary,
            "samples": samples,
        }
    )


def _filter_articles_with_preview(
    articles: List[Dict[str, Any]],
) -> tuple[List[Dict[str, Any]], List[str]]:
    """Split (eligible, skipped_ids) by presence of content_preview.

    Q5=(A): pre-TASK-4-A backlog has empty preview. Skip silently;
    they get filtered out forever (their selection_date passes, no
    re-fetch). Acceptable since (a) backlog is small, (b) by the time
    Selector goes live the daily-fresh stream dominates.
    """
    eligible: List[Dict[str, Any]] = []
    skipped: List[str] = []
    for a in articles:
        if (a.get("content_preview") or "").strip():
            eligible.append(a)
        else:
            skipped.append(a.get("news_id") or "")
    return eligible, skipped


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

    # Diagnostic dispatch — read-only, single SELECT, no upserts.
    # See _diag_paper_metadata docstring for the payload shape.
    if event.get("_diag") == "paper_metadata":
        return await _diag_paper_metadata(event)

    sel_date = _resolve_selection_date(event)

    pg = PgVectorV2Client()
    raw = pg.find_unscored_articles(sel_date, limit=BATCH_SIZE)

    if not raw:
        logger.info(
            json.dumps({"event": "selector_empty_batch", "date": sel_date.isoformat()})
        )
        return success_response(
            {"processed": 0, "empty": True, "date": sel_date.isoformat()}
        )

    eligible, skipped = _filter_articles_with_preview(raw)
    if skipped:
        logger.info(
            json.dumps(
                {
                    "event": "selector_skipped_no_preview",
                    "count": len(skipped),
                    "ids": skipped[:50],  # cap for log volume
                }
            )
        )

    if not eligible:
        return success_response(
            {
                "processed": 0,
                "skipped_no_preview": len(skipped),
                "date": sel_date.isoformat(),
            }
        )

    endpoint_url = os.getenv("BEDROCK_RUNTIME_ENDPOINT_URL", "") or None
    nova = make_nova_client(endpoint_url=endpoint_url)

    system_prompt = load_prompt("selection", "article_scorer")
    scores_by_id = await score_articles(
        nova,
        eligible,
        system_prompt,
        max_concurrency=SCORING_CONCURRENCY,
    )

    # Upsert one row per (article × MBTI group). 4N inserts where N is
    # batch size — not heavy, but cheap and idempotent (ON CONFLICT
    # DO UPDATE preserves selected/transformed_at across re-runs).
    upsert_count = 0
    boost_max_page = feature_flag.get_threshold("selector-paper-boost-max-page", 1)
    boosted_articles = 0
    for article in eligible:
        nid = article["news_id"]
        scores = scores_by_id.get(nid)
        if scores is None:
            # score_articles always returns every article (default
            # 5.0 on Nova failure), so this should never trigger —
            # defensive guard for future contributors.
            continue
        # Phase 4-A: paper_number 추출 (metadata JSONB 의 string 형태) → int 변환.
        # collector 가 _build_metadata 에서 promote 한 paper_number 만 사용 — 정수
        # 가 아니거나 부재 시 None 으로 fall-through (boost 0).
        meta = article.get("metadata") or {}
        pn_str = str(meta.get("paper_number") or "").strip()
        paper_number_int: Optional[int] = int(pn_str) if pn_str.isdigit() else None
        if paper_number_int is not None and paper_number_int <= boost_max_page:
            boosted_articles += 1
        quality = float(scores.get("quality", 5.0))
        for group in _MBTI_GROUPS:
            mbti_val = float(scores.get(f"{group.lower()}_score", 5.0))
            comp = composite_score(scores, group, paper_number=paper_number_int)
            pg.upsert_selection_score(
                news_id=nid,
                mbti_type=group,
                selection_date=sel_date,
                mbti_score=mbti_val,
                composite_score=comp,
                quality_score=quality,
            )
            upsert_count += 1

    # Re-rank top-20 per MBTI for the day. Each call is one SQL
    # statement with a CTE — operates over the (date, mbti) partition
    # which after this run includes both today's freshly-scored rows
    # and any rows from earlier fires (Q4=(B) preserves them).
    rerank_results: Dict[str, int] = {}
    for group in _MBTI_GROUPS:
        selected_count = pg.rerank_selections(
            sel_date, group, top_n=TOP_N_PER_MBTI
        )
        rerank_results[group] = selected_count
        logger.info(
            json.dumps(
                {
                    "event": "selector_rerank_complete",
                    "date": sel_date.isoformat(),
                    "mbti": group,
                    "selected_count": selected_count,
                    "top_n": TOP_N_PER_MBTI,
                }
            )
        )

    metrics = {
        "event": "selector_run_complete",
        "date": sel_date.isoformat(),
        "fetched": len(raw),
        "eligible": len(eligible),
        "skipped_no_preview": len(skipped),
        "scored": len(scores_by_id),
        "upserts": upsert_count,
        "rerank": rerank_results,
        "top_n_per_mbti": TOP_N_PER_MBTI,
        "boosted_articles": boosted_articles,
        "boost_max_page": boost_max_page,
    }
    logger.info(json.dumps(metrics, ensure_ascii=False))
    return success_response(metrics)
