"""
Step 2: MBTI Classification (Pass-Through)
============================================
With Step 1 now performing per-MBTI-type scoring and selection via
type_assignments, Step 2 no longer needs Nova-based classification.

This step:
  1. Derives target_groups for each article from Step 1's type_assignments.
  2. Builds classified_articles for the ProcessArticlesMap to iterate over.
  3. Validates that each MBTI type has a reasonable article count.
  4. Forwards selected_articles_s3_uri for downstream steps to read full
     article content (content_clean is NOT in classified_articles — it
     lives in S3 to stay under the 256 KB Step Functions state limit).

Input (from Step 1):
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
    "metrics": {...}
  }

Output (passed to ProcessArticlesMap → Step 3):
  {
    "step": 2,
    "date": "20260413",
    "selected_articles_s3_uri": "s3://...",
    "type_assignments": {"NT": [...], "NF": [...], "ST": [...], "SF": [...]},
    "classified_articles": [
      {
        "news_id": "...",
        "title": "...",
        "category": "경제",
        "published_at": "...",
        "target_groups": ["NT", "ST"]
      }
    ],
    "classification_map": {"news_id": ["NT", "ST"], ...},
    "metrics": {
      "input_count": 85,
      "classified_count": 85,
      "skipped_count": 0,
      "per_type": {"NT": 30, "NF": 30, "ST": 30, "SF": 30},
      "duration_ms": 12
    }
  }
"""
import logging
import time
from typing import Dict, Any, List

from config.constants import MBTI_GROUPS
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ── Derive classification from type_assignments ─────────────────────────────

def _derive_classification_map(
    type_assignments: Dict[str, List[str]],
) -> Dict[str, List[str]]:
    """Invert type_assignments {type: [ids]} → {news_id: [types]}."""
    classification_map: Dict[str, List[str]] = {}
    for mbti_type in MBTI_GROUPS:
        for nid in type_assignments.get(mbti_type, []):
            if nid not in classification_map:
                classification_map[nid] = []
            classification_map[nid].append(mbti_type)
    return classification_map


def _validate_type_assignments(
    type_assignments: Dict[str, List[str]],
) -> Dict[str, int]:
    """Log warnings for types with unexpectedly few articles. Returns counts."""
    per_type: Dict[str, int] = {}
    for mbti_type in MBTI_GROUPS:
        count = len(type_assignments.get(mbti_type, []))
        per_type[mbti_type] = count
        if count == 0:
            logger.error(f"Type {mbti_type} has 0 articles assigned")
        elif count < 20:
            logger.warning(
                f"Type {mbti_type} has only {count} articles (expected ~30)"
            )
    return per_type


# ── Main logic ───────────────────────────────────────────────────────────────

async def _classify_articles(event_body: Dict[str, Any]) -> Dict[str, Any]:
    start = time.time()

    date_str = event_body['date']
    type_assignments = event_body.get('type_assignments', {})
    s3_uri = event_body.get('selected_articles_s3_uri', '')
    selected_article_ids = event_body.get('selected_article_ids', [])
    articles_summary = event_body.get('selected_articles_summary', [])

    logger.info(
        f"Step 2: Pass-through classification for "
        f"{len(selected_article_ids)} articles, date={date_str}"
    )

    # Validate type_assignments
    per_type = _validate_type_assignments(type_assignments)

    # Derive classification_map: {news_id: [target_groups]}
    classification_map = _derive_classification_map(type_assignments)

    # Build classified_articles from summary + target_groups.
    # content_clean is NOT included here — it lives in S3 at
    # selected_articles_s3_uri. Downstream steps (Step 3) must load
    # full content from S3 using the URI.
    classified: List[Dict[str, Any]] = []
    for article in articles_summary:
        nid = article['news_id']
        classified.append({
            **article,
            'target_groups': classification_map.get(nid, list(MBTI_GROUPS)),
        })

    elapsed = int((time.time() - start) * 1000)
    logger.info(
        f"Step 2 complete: {len(classified)} classified, "
        f"per_type={per_type} in {elapsed}ms"
    )

    return {
        'step': 2,
        'date': date_str,
        'selected_articles_s3_uri': s3_uri,
        'type_assignments': type_assignments,
        'classified_articles': classified,
        'classification_map': classification_map,
        'metrics': {
            'input_count': len(selected_article_ids),
            'classified_count': len(classified),
            'skipped_count': 0,
            'per_type': per_type,
            'duration_ms': elapsed,
        },
    }


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """Step 2 Lambda: MBTI Classification (pass-through from Step 1 type_assignments)."""
    # Accept either direct body or Step Functions wrapper
    body = event.get('body', event)

    if body.get('step') != 1:
        logger.warning(f"Expected step 1 input, got step {body.get('step')}")

    result = await _classify_articles(body)

    return {
        'statusCode': 200,
        'body': result,
    }
