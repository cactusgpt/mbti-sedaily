"""
Merge Transform Results
========================
Lightweight Lambda that merges parallel step3 batch outputs into a single
step3 result. Used by the Step Functions Map state.

Input:
  {
    "date": "20260408",
    "batches": [
      { "body": { "step": 3, "transformed_articles": [...], "failed_articles": [...], "metrics": {...} } },
      { "body": { "step": 3, "transformed_articles": [...], "failed_articles": [...], "metrics": {...} } }
    ]
  }

Output:
  {
    "body": {
      "step": 3,
      "date": "20260408",
      "transformed_articles": [ ...merged... ],
      "failed_articles": [ ...merged... ],
      "metrics": { ...aggregated... }
    }
  }
"""
import logging
from typing import Dict, Any, List

from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@handler_decorator
def lambda_handler(event: dict, context) -> dict:
    """Merge parallel step3 batch results."""
    date_str = event.get('date', '')
    batches: List[Dict[str, Any]] = event.get('batches', [])

    all_transformed: List[Dict[str, Any]] = []
    all_failed: List[Dict[str, Any]] = []
    total_input = 0
    total_input_tokens = 0
    total_output_tokens = 0
    total_duration = 0

    for batch in batches:
        body = batch.get('body', batch)
        all_transformed.extend(body.get('transformed_articles', []))
        all_failed.extend(body.get('failed_articles', []))

        metrics = body.get('metrics', {})
        total_input += metrics.get('input_count', 0)
        total_input_tokens += metrics.get('total_input_tokens', 0)
        total_output_tokens += metrics.get('total_output_tokens', 0)
        total_duration = max(total_duration, metrics.get('duration_ms', 0))

    logger.info(
        f"Merged {len(batches)} batches: "
        f"{len(all_transformed)} transformed, {len(all_failed)} failed"
    )

    return {
        'statusCode': 200,
        'body': {
            'step': 3,
            'date': date_str,
            'transformed_articles': all_transformed,
            'failed_articles': all_failed,
            'metrics': {
                'input_count': total_input,
                'transformed_count': len(all_transformed),
                'failed_count': len(all_failed),
                'total_input_tokens': total_input_tokens,
                'total_output_tokens': total_output_tokens,
                'duration_ms': total_duration,
                'batch_count': len(batches),
            },
        },
    }
