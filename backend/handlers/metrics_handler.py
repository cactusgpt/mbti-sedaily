"""
Metrics Handler — Demo dashboard API
=======================================
Serves aggregated operational metrics for the demo presentation.

Routes:
  GET /api/metrics/dashboard  — all metrics combined
  GET /api/metrics/pipeline   — pipeline performance
  GET /api/metrics/costs      — cost breakdown by service
"""
import json
import logging

from config.constants import CORS_HEADERS
from services.metrics_service import get_metrics_service
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _success(data, status_code=200):
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(data, ensure_ascii=False, default=str),
    }


def _error(status_code, message):
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps({'error': {'code': 'METRICS_ERROR', 'message': message}}, ensure_ascii=False),
    }


def _parse_event(event):
    rc = event.get('requestContext', {})
    method = rc.get('http', {}).get('method', event.get('httpMethod', 'GET'))
    path = rc.get('http', {}).get('path', event.get('path', ''))
    params = event.get('queryStringParameters', {}) or {}
    return method, path, params


@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    method, path, params = _parse_event(event)

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    if method != 'GET':
        return _error(405, 'Method not allowed')

    days = int(params.get('days', '7'))
    svc = get_metrics_service()

    if '/dashboard' in path:
        data = await svc.get_dashboard(days)
        return _success(data)

    if '/pipeline' in path:
        data = await svc.get_pipeline_metrics(days)
        return _success(data)

    if '/costs' in path:
        data = await svc.get_cost_breakdown(days)
        return _success(data)

    return _error(404, 'Not found')
