"""
Step 1: Article Selection (Per-MBTI-Type)
==========================================
Loads articles from S3 XML, applies rule-based pre-filtering, scores each
candidate with Amazon Nova Lite on 4 MBTI-specific dimensions, and selects
the top 30 per MBTI type (NT, NF, ST, SF) honoring per-category minimums.

Full article data is stored in S3 to keep the Step Functions payload under
the 256 KB inter-state limit; only lightweight metadata passes through.

Flow:
  1. Rule-based pre-filter (_quick_filter)    — drops deleted / too short /
     인사/부고/속보 / routine market closings. Typically 286 → ~200 survivors.
  2. AI scoring via Nova Lite (_ai_score_nova) — each survivor is scored
     1-10 on 4 MBTI-type dimensions (NT/NF/ST/SF aptitude) plus quality,
     in batches of 20. Batches run in parallel under a small semaphore.
     If ALL batches fail, falls back to recency-based selection.
  3. Per-type top-30 selection (_select_per_type) — for each MBTI type,
     ranks by composite score (0.7 × type_score + 0.3 × quality), applies
     category diversity minimums, then selects top 30.
  4. S3 offload — full article data for all unique selected articles is
     uploaded to S3; only lightweight metadata and type assignments pass
     through the Step Functions state.

Input (Lambda event):
  {
    "date": "20260413",         # optional, defaults to today KST
    "source": "schedule" | "manual"
  }

Output (passed to Step 2):
  {
    "step": 1,
    "date": "20260413",
    "selected_articles_s3_uri": "s3://...",
    "selected_article_ids": ["id1", "id2", ...],
    "selected_articles_summary": [
      {"news_id": "...", "title": "...", "category": "경제", "published_at": "..."}
    ],
    "type_assignments": {
      "NT": ["id1", "id5", ...],
      "NF": ["id2", "id5", ...],
      "ST": ["id3", "id6", ...],
      "SF": ["id4", "id7", ...]
    },
    "metrics": {
      "total_in_xml": 286,
      "excluded_deleted": 12,
      "excluded_rules": 73,
      "scored": 201,
      "selected": 85,
      "total_unique_selected": 85,
      "per_type": {"NT": 30, "NF": 30, "ST": 30, "SF": 30},
      "overlap_count": 35,
      "fallback_used": false,
      "scoring_duration_ms": 8500,
      "duration_ms": 9200
    }
  }
"""
# Pipeline Schedule: EventBridge triggers every 3 hours (8 runs/day)
# Rule: sedaily-mbti-pipeline-schedule-dev
# Expression: rate(3 hours)
# Previous: cron(0 22 * * ? *) — once daily at 07:00 KST
# Deduplication: Already-processed articles are skipped via DynamoDB lookup

import asyncio
import json
import logging
import re
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Set, Tuple

import boto3
from botocore.config import Config

from clients.s3_xml_client import S3XMLClient
from config.constants import (
    BEDROCK_MODEL_ID_NOVA,
    BEDROCK_REGION,
    DYNAMODB_TABLE_ARTICLES_DEV,
    S3_ARTICLE_BODY_BUCKET_DEV,
)
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ── Rule-based filter constants ──────────────────────────────────────────────

MIN_CONTENT_LENGTH = 300

EXCLUSION_TITLE_PATTERNS = [
    r'^\[인사\]',
    r'^\[부고\]',
    r'^\[속보\]',
    r'^\[\d보\]',
    r'증시.*마감',
    r'환율.*마감',
    r'유가.*마감',
]

EXCLUSION_TITLE_KEYWORDS = ['인사', '부고', '속보', '발령']


def _quick_filter(title: str, content: str) -> Tuple[bool, str]:
    """Return (should_exclude, reason)."""
    if len(content) < MIN_CONTENT_LENGTH:
        return True, 'too_short'

    for pattern in EXCLUSION_TITLE_PATTERNS:
        if re.search(pattern, title):
            return True, f'title_pattern:{pattern}'

    title_lower = title.lower()
    for kw in EXCLUSION_TITLE_KEYWORDS:
        if kw in title_lower:
            return True, f'title_keyword:{kw}'

    return False, ''


# ── Nova client ──────────────────────────────────────────────────────────────

NOVA_CONFIG = Config(
    read_timeout=60,
    connect_timeout=30,
    retries={'max_attempts': 2},
)


def _get_nova_client():
    return boto3.client(
        'bedrock-runtime',
        region_name=BEDROCK_REGION,
        config=NOVA_CONFIG,
    )


# ── AI-based scoring (Nova) ──────────────────────────────────────────────────

from services.prompt_loader import load_prompt

# Admin-3: prompt loaded inside `_score_one_batch` (call site below) instead of
# at module-import time. Module-level reads happen once at cold start and then
# never refresh, defeating the 5-min TTL cache that backs DDB-sourced prompts.
# The cache makes repeated calls per Lambda invocation effectively free.

SCORING_BATCH_SIZE = 20
SCORING_MAX_CONCURRENCY = 5
CONTENT_PREVIEW_CHARS = 200

DEFAULT_SCORES: Dict[str, float] = {
    'nt_score': 5.0,
    'nf_score': 5.0,
    'st_score': 5.0,
    'sf_score': 5.0,
    'quality': 5.0,
}
SCORE_KEYS = list(DEFAULT_SCORES.keys())


async def _score_one_batch(
    nova_client,
    batch: List[Any],
    batch_index: int,
) -> Tuple[Dict[str, Dict[str, float]], bool]:
    """
    Score one batch of up to SCORING_BATCH_SIZE articles on 4 MBTI
    dimensions plus quality.

    Returns (scores_map, success).
      scores_map: {news_id: {nt_score, nf_score, st_score, sf_score, quality}}
                  Articles Nova didn't return scores for keep DEFAULT_SCORES
                  so they remain eligible.
      success:    True iff Nova returned a parseable JSON array.
    """
    items = []
    for i, a in enumerate(batch):
        preview = (a.content_clean or '')[:CONTENT_PREVIEW_CHARS]
        items.append(
            f"{i+1}. [{a.nsid}] ({a.main_category or '기타'}) {a.title}\n"
            f"   {preview}..."
        )

    user_content = (
        f"{load_prompt('selection', 'article_scorer')}\n\n"
        f"## 후보 기사 ({len(batch)}건)\n\n"
        + "\n\n".join(items)
        + "\n\nJSON 배열만 출력하세요. 다른 텍스트는 포함하지 마세요."
    )

    # Default: every article in this batch gets DEFAULT_SCORES.
    # Successful Nova entries overwrite these defaults below.
    scores: Dict[str, Dict[str, float]] = {
        a.nsid: dict(DEFAULT_SCORES) for a in batch
    }

    try:
        body = json.dumps({
            "schemaVersion": "messages-v1",
            "messages": [
                {"role": "user", "content": [{"text": user_content}]}
            ],
            "inferenceConfig": {
                "maxTokens": 3072,
                "temperature": 0.1,
            },
        })

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: nova_client.invoke_model(
                modelId=BEDROCK_MODEL_ID_NOVA,
                contentType='application/json',
                accept='application/json',
                body=body,
            ),
        )

        resp = json.loads(response['body'].read())
        text = (
            resp.get('output', {})
                .get('message', {})
                .get('content', [{}])[0]
                .get('text', '')
        )

        # Greedy match — captures the full array even if reasoning fields
        # contain braces or Nova wraps the output in markdown fences.
        match = re.search(r'\[\s*\{[\s\S]*\}\s*\]', text)
        if not match:
            logger.warning(
                f"Batch {batch_index}: no JSON array in Nova response; "
                f"using default scores"
            )
            return scores, False

        parsed = json.loads(match.group(0))
        if not isinstance(parsed, list):
            logger.warning(
                f"Batch {batch_index}: Nova returned non-list; "
                f"using default scores"
            )
            return scores, False

        parsed_count = 0
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            nid = entry.get('news_id') or ''
            if nid not in scores:
                continue
            any_parsed = False
            for key in SCORE_KEYS:
                val = entry.get(key)
                if val is not None:
                    try:
                        scores[nid][key] = float(val)
                        any_parsed = True
                    except (ValueError, TypeError):
                        continue
            if any_parsed:
                parsed_count += 1

        logger.info(
            f"Batch {batch_index}: Nova scored {parsed_count}/{len(batch)} articles"
        )
        return scores, True

    except Exception as e:
        logger.warning(
            f"Batch {batch_index}: Nova scoring failed (non-fatal): {e}"
        )
        return scores, False


async def _ai_score_nova(
    articles: List[Any],
    nova_client,
) -> Tuple[Dict[str, Dict[str, float]], bool]:
    """
    Score all candidates using Nova Lite in parallel batches of
    SCORING_BATCH_SIZE, capped at SCORING_MAX_CONCURRENCY concurrent calls.

    Returns (scores_map, any_success).
      scores_map:  {news_id: {nt_score, nf_score, st_score, sf_score, quality}}
      any_success: False iff EVERY batch failed — signals the caller to
                   fall back to recency-based selection.
    """
    if not articles:
        return {}, True

    batches = [
        articles[i:i + SCORING_BATCH_SIZE]
        for i in range(0, len(articles), SCORING_BATCH_SIZE)
    ]
    semaphore = asyncio.Semaphore(SCORING_MAX_CONCURRENCY)

    async def _run(batch, idx):
        async with semaphore:
            return await _score_one_batch(nova_client, batch, idx)

    results = await asyncio.gather(
        *(_run(batch, i) for i, batch in enumerate(batches))
    )

    all_scores: Dict[str, Dict[str, float]] = {}
    any_success = False
    for batch_scores, batch_ok in results:
        all_scores.update(batch_scores)
        if batch_ok:
            any_success = True

    return all_scores, any_success


# ── Per-type top-30 selection ────────────────────────────────────────────────

# Minimum per-category counts for each type's 30. The seven standard
# categories sum to 25; the remaining 5 slots go to the highest-scored
# unclaimed articles regardless of category. A category with fewer
# candidates than its minimum contributes what it has; the gap is filled
# by the remainder phase.
CATEGORY_MINIMUMS: Dict[str, int] = {
    '경제':    5,
    'IT_과학': 4,
    '정치':    3,
    '사회':    4,
    '문화':    3,
    '스포츠':  3,
    '국제':    3,
}
TOTAL_TARGET = 30
MBTI_TYPES = ['NT', 'NF', 'ST', 'SF']


def _select_per_type(
    scored_articles: List[Dict[str, Any]],
) -> Dict[str, List[str]]:
    """Select top 30 articles for each MBTI type based on type-specific scores.

    Each article dict must contain: news_id, category, nt_score, nf_score,
    st_score, sf_score, quality.

    For each type:
      Phase 1 — fill per-category minimums (up to 25 slots) from articles
                sorted by that type's composite score.
      Phase 2 — fill remaining slots (up to 30) with highest composite
                scores regardless of category.
    """
    type_assignments: Dict[str, List[str]] = {}

    for mbti_type in MBTI_TYPES:
        score_key = f"{mbti_type.lower()}_score"

        # Sort by composite score: 0.7 × type_score + 0.3 × quality
        candidates = sorted(
            scored_articles,
            key=lambda a, sk=score_key: (
                a.get(sk, 0) * 0.7 + a.get('quality', 0) * 0.3
            ),
            reverse=True,
        )

        selected: List[str] = []
        selected_set: set = set()
        category_counts: Dict[str, int] = {}

        # Phase 1: fill category minimums (up to 25 slots)
        for article in candidates:
            cat = article.get('category', '')
            min_needed = CATEGORY_MINIMUMS.get(cat, 1)
            if category_counts.get(cat, 0) < min_needed:
                nid = article['news_id']
                if nid not in selected_set:
                    selected.append(nid)
                    selected_set.add(nid)
                    category_counts[cat] = category_counts.get(cat, 0) + 1
            if len(selected) >= 25:
                break

        # Phase 2: fill remaining slots with highest composite scores
        for article in candidates:
            nid = article['news_id']
            if nid not in selected_set:
                selected.append(nid)
                selected_set.add(nid)
            if len(selected) >= TOTAL_TARGET:
                break

        type_assignments[mbti_type] = selected[:TOTAL_TARGET]

    return type_assignments


# ── Timezone ─────────────────────────────────────────────────────────────────

KST = timezone(timedelta(hours=9))


# ── S3 temp storage ──────────────────────────────────────────────────────────

S3_PIPELINE_TEMP_PREFIX = 'pipeline-temp'


def _upload_selected_to_s3(
    s3_client,
    date_str: str,
    articles_data: List[Dict[str, Any]],
) -> str:
    """Upload full article data to S3 temp location. Returns the S3 URI."""
    key = f"{S3_PIPELINE_TEMP_PREFIX}/{date_str}/selected_articles.json"
    bucket = S3_ARTICLE_BODY_BUCKET_DEV

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(articles_data, ensure_ascii=False, default=str),
        ContentType='application/json',
    )

    uri = f"s3://{bucket}/{key}"
    logger.info(f"Uploaded {len(articles_data)} articles to {uri}")
    return uri


# ── Type assignments storage ─────────────────────────────────────────────────


def _store_type_assignments(
    date_str: str,
    type_assignments: Dict[str, List[str]],
    metrics: Dict[str, Any],
    scores_map: Dict[str, Dict[str, float]] = None,
) -> None:
    """
    Merge MBTI type→article mapping with any existing assignments for today.

    On the first run of the day this simply writes. On subsequent runs it:
      1. Reads existing NT/NF/ST/SF lists from the __type_assignments__ item
      2. Unions new IDs into each list
      3. Re-ranks by composite score and keeps only the top 30 per type
      4. Increments run_count and updates last_run_at
    """
    scores_map = scores_map or {}
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.Table(DYNAMODB_TABLE_ARTICLES_DEV)
    key = f'__type_assignments__{date_str}'

    # Read existing assignments (if any)
    existing_item = {}
    run_count = 0
    try:
        resp = table.get_item(Key={'news_id': key})
        existing_item = resp.get('Item', {})
        run_count = int(existing_item.get('run_count', 0))
    except Exception as e:
        logger.warning(f"Could not read existing type_assignments: {e}")

    # Merge per type: union existing + new, re-rank, keep top 30
    merged: Dict[str, List[str]] = {}
    for group in ['NT', 'NF', 'ST', 'SF']:
        existing_ids = existing_item.get(group, [])
        if not isinstance(existing_ids, list):
            existing_ids = []
        new_ids = type_assignments.get(group, [])

        # Union preserving order (existing first, then new)
        seen: set = set()
        union: List[str] = []
        for nid in existing_ids + new_ids:
            if nid not in seen:
                union.append(nid)
                seen.add(nid)

        # Re-rank by composite score if scores available
        score_key = f"{group.lower()}_score"
        # Existing IDs without scores in this run get 7.0 (already vetted)
        EXISTING_DEFAULT_SCORE = 7.0

        def _composite(nid: str) -> float:
            s = scores_map.get(nid, {})
            ts = s.get(score_key, EXISTING_DEFAULT_SCORE)
            qs = s.get('quality', EXISTING_DEFAULT_SCORE)
            return ts * 0.7 + qs * 0.3

        union.sort(key=_composite, reverse=True)
        merged[group] = union[:TOTAL_TARGET]

    run_count += 1
    now = datetime.now(KST).isoformat()

    merged_unique: set = set()
    for ids in merged.values():
        merged_unique.update(ids)

    table.put_item(Item={
        'news_id': key,
        'item_type': 'type_assignment',
        'date': date_str,
        'NT': merged['NT'],
        'NF': merged['NF'],
        'ST': merged['ST'],
        'SF': merged['SF'],
        'metrics': {
            'total_unique': len(merged_unique),
            'overlap_count': sum(len(v) for v in merged.values()) - len(merged_unique),
            'per_type': {t: len(ids) for t, ids in merged.items()},
        },
        'run_count': run_count,
        'last_run_at': now,
        'created_at': existing_item.get('created_at', now),
    })

    logger.info(
        f"Stored type_assignments for {date_str} "
        f"(run #{run_count}, {len(merged_unique)} unique articles)"
    )


# ── Deduplication ────────────────────────────────────────────────────────────


def _get_already_processed_ids(date_str: str) -> Set[str]:
    """
    Return news_ids already transformed and stored by earlier pipeline runs today.

    Strategy (two targeted queries, no table scan):
      1. Read the __type_assignments__{date} item — its NT/NF/ST/SF lists
         contain all IDs selected in previous runs.
      2. This is sufficient because _store_type_assignments merges across runs,
         so the item always reflects the cumulative set.
    """
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.Table(DYNAMODB_TABLE_ARTICLES_DEV)

    try:
        response = table.get_item(
            Key={'news_id': f'__type_assignments__{date_str}'},
            ProjectionExpression='NT, NF, ST, SF',
        )
        item = response.get('Item')
        if not item:
            return set()

        processed: Set[str] = set()
        for group in ['NT', 'NF', 'ST', 'SF']:
            ids = item.get(group, [])
            if isinstance(ids, list):
                processed.update(ids)

        logger.info(f"Dedup: {len(processed)} articles already processed for {date_str}")
        return processed

    except Exception as e:
        logger.warning(f"Dedup lookup failed (non-fatal, proceeding without dedup): {e}")
        return set()


# ── Main logic ───────────────────────────────────────────────────────────────

async def _select_articles(date_str: str) -> Dict[str, Any]:
    start = time.time()

    s3_client = S3XMLClient(
        bucket_name='sedaily-news-xml-storage',
        prefix='daily-xml',
        region='ap-northeast-2',
    )

    all_articles = await s3_client.get_articles_by_date(date_str)
    total_in_xml = len(all_articles)
    logger.info(f"Step 1: Loaded {total_in_xml} articles from XML for {date_str}")

    # Phase A: remove deleted
    active = [a for a in all_articles if a.action != 'D']
    excluded_deleted = total_in_xml - len(active)

    # Phase B: rule-based pre-filter
    candidates: List[Any] = []
    excluded_rules = 0
    for article in active:
        should_exclude, reason = _quick_filter(article.title, article.content_clean or '')
        if should_exclude:
            excluded_rules += 1
            logger.debug(f"Rule excluded {article.nsid}: {reason}")
        else:
            candidates.append(article)

    logger.info(
        f"Pre-filter: {len(candidates)} candidates "
        f"(deleted=-{excluded_deleted}, rules=-{excluded_rules})"
    )

    # Phase B2: deduplication — skip articles already processed in earlier runs today
    already_processed = _get_already_processed_ids(date_str)
    pre_dedup_count = len(candidates)
    if already_processed:
        candidates = [a for a in candidates if a.nsid not in already_processed]
        logger.info(
            f"After dedup: {len(candidates)} new candidates "
            f"({len(already_processed)} already processed)"
        )

    # If too few new articles, skip AI scoring
    if len(candidates) < 5:
        elapsed = int((time.time() - start) * 1000)
        logger.info(f"Only {len(candidates)} new articles — skipping pipeline run")
        return {
            'step': 1,
            'date': date_str,
            'selected_articles_s3_uri': '',
            'selected_article_ids': [],
            'selected_articles_summary': [],
            'type_assignments': {},
            'metrics': {
                'total_in_xml': total_in_xml,
                'excluded_deleted': excluded_deleted,
                'excluded_rules': excluded_rules,
                'already_processed': len(already_processed),
                'new_candidates': len(candidates),
                'selected': 0,
                'total_unique_selected': 0,
                'per_type': {},
                'reason': 'insufficient_new_articles',
                'duration_ms': elapsed,
            },
        }

    # Phase C: AI scoring (Nova Lite) — 4 MBTI dimensions + quality
    fallback_used = False
    scores_map: Dict[str, Dict[str, float]] = {}
    scoring_start = time.time()

    if candidates:
        nova = _get_nova_client()
        scores_map, any_success = await _ai_score_nova(candidates, nova)
        if not any_success:
            logger.warning(
                "All Nova scoring batches failed; "
                "falling back to recency-based selection"
            )
            fallback_used = True

    scoring_duration_ms = int((time.time() - scoring_start) * 1000)

    # Phase D: per-type top-30 selection
    def _recency_key(article) -> str:
        return article.published_at or ''

    if fallback_used:
        # Pure recency — same 30 for all types
        recency_sorted = sorted(
            candidates, key=_recency_key, reverse=True
        )[:TOTAL_TARGET]
        ids = [a.nsid for a in recency_sorted]
        type_assignments = {t: list(ids) for t in MBTI_TYPES}
    else:
        # Build scored article dicts for per-type selection
        scored_articles = []
        for a in candidates:
            article_scores = scores_map.get(a.nsid, DEFAULT_SCORES)
            scored_articles.append({
                'news_id': a.nsid,
                'category': a.main_category or '',
                **article_scores,
            })
        type_assignments = _select_per_type(scored_articles)

    # Collect all unique selected article IDs
    unique_ids: set = set()
    for ids in type_assignments.values():
        unique_ids.update(ids)

    # Build lookup for quick article access
    candidate_map = {a.nsid: a for a in candidates}

    # Phase E: upload full article data to S3
    full_articles_data: List[Dict[str, Any]] = []
    for nid in sorted(unique_ids):
        a = candidate_map.get(nid)
        if not a:
            continue
        images: List[Dict[str, str]] = []
        if a.images:
            images = [{'url': a.images[0].url}]
        full_articles_data.append({
            'news_id': a.nsid,
            'title': a.title,
            'sub_title': a.sub_title or '',
            'content_clean': a.content_clean or '',
            'category': a.main_category or '',
            'published_at': a.published_at or '',
            'author_name': a.author_name or '',
            'images': images,
            'url': a.url or '',
        })

    s3_boto = boto3.client('s3', region_name='us-east-1')
    s3_uri = _upload_selected_to_s3(s3_boto, date_str, full_articles_data)

    # Phase F: build lightweight output payload
    selected_article_ids = sorted(unique_ids)
    selected_articles_summary = []
    for nid in selected_article_ids:
        a = candidate_map.get(nid)
        if a:
            selected_articles_summary.append({
                'news_id': a.nsid,
                'title': a.title,
                'category': a.main_category or '',
                'published_at': a.published_at or '',
            })

    per_type_counts = {t: len(ids) for t, ids in type_assignments.items()}
    total_unique = len(unique_ids)
    total_assigned = sum(per_type_counts.values())
    overlap_count = total_assigned - total_unique

    # Phase G: store type_assignments in DynamoDB (merges with earlier runs)
    try:
        _store_type_assignments(date_str, type_assignments, {
            'total_unique_selected': total_unique,
            'overlap_count': overlap_count,
            'per_type': per_type_counts,
        }, scores_map=scores_map)
    except Exception as e:
        logger.error(f"Failed to store type_assignments (non-fatal): {e}")

    elapsed = int((time.time() - start) * 1000)
    logger.info(
        f"Step 1 complete: {total_unique} unique articles selected "
        f"(per_type={per_type_counts}, overlap={overlap_count}) "
        f"from {total_in_xml} in {elapsed}ms"
    )

    return {
        'step': 1,
        'date': date_str,
        'selected_articles_s3_uri': s3_uri,
        'selected_article_ids': selected_article_ids,
        'selected_articles_summary': selected_articles_summary,
        'type_assignments': type_assignments,
        'metrics': {
            'total_in_xml': total_in_xml,
            'excluded_deleted': excluded_deleted,
            'excluded_rules': excluded_rules,
            'scored': len(candidates),
            'selected': total_unique,
            'total_unique_selected': total_unique,
            'per_type': per_type_counts,
            'overlap_count': overlap_count,
            'fallback_used': fallback_used,
            'scoring_duration_ms': scoring_duration_ms,
            'duration_ms': elapsed,
        },
    }


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """Step 1 Lambda: Article Selection (Per-MBTI-Type)."""
    date_str = event.get('date')
    if not date_str:
        kst = timezone(timedelta(hours=9))
        date_str = datetime.now(kst).strftime('%Y%m%d')

    result = await _select_articles(date_str)

    return {
        'statusCode': 200,
        'body': result,
    }
