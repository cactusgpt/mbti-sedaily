"""
A/B Test Handler — Compare original vs MBTI-transformed articles
=================================================================
Simple A/B testing framework for measuring the impact of MBTI
personalization on reader engagement.

Routes:
  POST /api/ab-test/assign       — Assign user to A/B group
  POST /api/ab-test/event        — Record engagement event
  GET  /api/ab-test/results      — Get experiment results
  POST /api/ab-test/experiment   — Create/update experiment (admin)

Storage: Personal DB (sedaily-mbti-personal-dev)
  PK=__experiment__  SK=AB_META#{id}        — experiment config
  PK={user_id}       SK=AB_ASSIGN#{id}      — group assignment
  PK={user_id}       SK=AB_EVENT#{id}#{ts}  — tracked events

Group assignment is deterministic: hash(user_id + experiment_id) % 2.
Same user always gets the same group for the same experiment.
"""
import base64
import json
import logging
from collections import defaultdict
from typing import Dict, Any, List, Optional

from config.constants import CORS_HEADERS
from clients.personal_db_client import PersonalDBClient
from models.ab_test import (
    Experiment, Assignment, ABEvent,
    assign_group, EXPERIMENT_USER,
)
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _get_db() -> PersonalDBClient:
    return PersonalDBClient()


# ── Assign ───────────────────────────────────────────────────────────────────

async def _handle_assign(body: Dict[str, Any]) -> Dict:
    """
    POST /api/ab-test/assign
    Body: { user_id, experiment_id }

    Returns the user's group assignment (deterministic, idempotent).
    """
    user_id = body.get('user_id', '').strip()
    experiment_id = body.get('experiment_id', '').strip()

    if not user_id or not experiment_id:
        return _error(400, 'user_id and experiment_id are required')

    db = _get_db()

    # Check if experiment exists
    exp_item = await db.get_item(EXPERIMENT_USER, f'AB_META#{experiment_id}')
    if not exp_item:
        return _error(404, f'Experiment {experiment_id} not found')

    experiment = Experiment.from_item(exp_item)
    if experiment.status != 'active':
        return _error(400, f'Experiment {experiment_id} is {experiment.status}')

    # Check existing assignment
    existing = await db.get_item(user_id, f'AB_ASSIGN#{experiment_id}')
    if existing:
        assignment = Assignment.from_item(existing)
        return _success({
            'user_id': user_id,
            'experiment_id': experiment_id,
            'group': assignment.group,
            'group_label': experiment.group_a_label if assignment.group == 'A' else experiment.group_b_label,
            'assigned_at': assignment.assigned_at,
            'is_new': False,
        })

    # Deterministic assignment
    group = assign_group(user_id, experiment_id)

    assignment = Assignment(
        user_id=user_id,
        experiment_id=experiment_id,
        group=group,
    )

    await db.put_item(assignment.to_item())

    logger.info(f"AB assign: {user_id} → group {group} for {experiment_id}")

    return _success({
        'user_id': user_id,
        'experiment_id': experiment_id,
        'group': group,
        'group_label': experiment.group_a_label if group == 'A' else experiment.group_b_label,
        'assigned_at': assignment.assigned_at,
        'is_new': True,
    })


# ── Event ────────────────────────────────────────────────────────────────────

async def _handle_event(body: Dict[str, Any]) -> Dict:
    """
    POST /api/ab-test/event
    Body: {
      user_id, experiment_id, event_type, article_id,
      metadata: { read_time_seconds, scroll_depth_percent, ... }
    }
    """
    user_id = body.get('user_id', '').strip()
    experiment_id = body.get('experiment_id', '').strip()
    event_type = body.get('event_type', '').strip()

    if not user_id or not experiment_id or not event_type:
        return _error(400, 'user_id, experiment_id, and event_type are required')

    db = _get_db()

    # Get user's group assignment
    assign_item = await db.get_item(user_id, f'AB_ASSIGN#{experiment_id}')
    group = 'unknown'
    if assign_item:
        group = assign_item.get('group', 'unknown')

    # Build metadata with group included
    metadata = body.get('metadata', {})
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except (json.JSONDecodeError, TypeError):
            metadata = {}

    metadata['group'] = group

    event = ABEvent(
        user_id=user_id,
        experiment_id=experiment_id,
        event_type=event_type,
        article_id=body.get('article_id', ''),
        metadata=metadata,
    )

    success = await db.put_item(event.to_item())

    if not success:
        return _error(500, 'Failed to record event')

    return _success({
        'recorded': True,
        'event_type': event_type,
        'group': group,
    })


# ── Results ──────────────────────────────────────────────────────────────────

async def _handle_results(params: Dict[str, str]) -> Dict:
    """
    GET /api/ab-test/results?experiment_id=...

    Aggregates events by group and computes metrics.
    """
    experiment_id = params.get('experiment_id', '').strip()
    if not experiment_id:
        return _error(400, 'experiment_id is required')

    db = _get_db()

    # Get experiment metadata
    exp_item = await db.get_item(EXPERIMENT_USER, f'AB_META#{experiment_id}')
    if not exp_item:
        return _error(404, f'Experiment {experiment_id} not found')
    experiment = Experiment.from_item(exp_item)

    # Scan all events for this experiment (across all users)
    # This is a table scan — acceptable for small-scale A/B tests
    from boto3.dynamodb.conditions import Attr
    try:
        response = db.table.scan(
            FilterExpression=(
                Attr('item_type').eq('ab_event') &
                Attr('experiment_id').eq(experiment_id)
            ),
            Limit=10000,
        )
        events = response.get('Items', [])

        while 'LastEvaluatedKey' in response and len(events) < 10000:
            response = db.table.scan(
                FilterExpression=(
                    Attr('item_type').eq('ab_event') &
                    Attr('experiment_id').eq(experiment_id)
                ),
                ExclusiveStartKey=response['LastEvaluatedKey'],
                Limit=10000,
            )
            events.extend(response.get('Items', []))

    except Exception as e:
        logger.error(f"Event scan failed: {e}")
        return _error(500, 'Failed to fetch events')

    # Also get assignment counts
    try:
        assign_response = db.table.scan(
            FilterExpression=(
                Attr('item_type').eq('ab_assignment') &
                Attr('experiment_id').eq(experiment_id)
            ),
            Limit=10000,
        )
        assignments = assign_response.get('Items', [])
    except Exception:
        assignments = []

    # Aggregate
    group_a_users = set()
    group_b_users = set()
    for a in assignments:
        if a.get('group') == 'A':
            group_a_users.add(a.get('user_id'))
        else:
            group_b_users.add(a.get('user_id'))

    metrics_a = _compute_metrics([e for e in events if e.get('metadata', {}).get('group') == 'A'])
    metrics_b = _compute_metrics([e for e in events if e.get('metadata', {}).get('group') == 'B'])

    return _success({
        'experiment': {
            'id': experiment.experiment_id,
            'name': experiment.name,
            'status': experiment.status,
            'group_a_label': experiment.group_a_label,
            'group_b_label': experiment.group_b_label,
        },
        'participants': {
            'total': len(group_a_users) + len(group_b_users),
            'group_a': len(group_a_users),
            'group_b': len(group_b_users),
        },
        'total_events': len(events),
        'group_a': metrics_a,
        'group_b': metrics_b,
        'comparison': _compare(metrics_a, metrics_b),
    })


def _compute_metrics(events: List[Dict]) -> Dict[str, Any]:
    """Compute engagement metrics from a list of events."""
    if not events:
        return {
            'event_count': 0,
            'unique_users': 0,
            'avg_read_time_seconds': 0,
            'avg_scroll_depth_percent': 0,
            'archive_count': 0,
            'archive_rate': 0,
            'share_count': 0,
            'return_count': 0,
            'return_rate': 0,
        }

    users = set()
    read_times = []
    scroll_depths = []
    archive_count = 0
    share_count = 0
    return_count = 0
    read_users = set()

    for event in events:
        uid = event.get('user_id', '')
        users.add(uid)
        etype = event.get('event_type', '')
        meta = event.get('metadata', {})

        if etype == 'read':
            read_users.add(uid)
            rt = meta.get('read_time_seconds')
            if rt is not None:
                try:
                    read_times.append(float(rt))
                except (ValueError, TypeError):
                    pass

        if etype == 'scroll':
            sd = meta.get('scroll_depth_percent')
            if sd is not None:
                try:
                    scroll_depths.append(float(sd))
                except (ValueError, TypeError):
                    pass

        if etype == 'archive':
            archive_count += 1
        if etype == 'share':
            share_count += 1
        if etype == 'return':
            return_count += 1

    unique = len(users)
    reads = len(read_users)

    return {
        'event_count': len(events),
        'unique_users': unique,
        'avg_read_time_seconds': round(sum(read_times) / len(read_times), 1) if read_times else 0,
        'avg_scroll_depth_percent': round(sum(scroll_depths) / len(scroll_depths), 1) if scroll_depths else 0,
        'archive_count': archive_count,
        'archive_rate': round(archive_count / max(reads, 1) * 100, 1),
        'share_count': share_count,
        'return_count': return_count,
        'return_rate': round(return_count / max(unique, 1) * 100, 1),
    }


def _compare(a: Dict, b: Dict) -> Dict[str, Any]:
    """Compare group A vs B metrics, compute lift percentages."""
    def lift(val_a: float, val_b: float) -> Optional[float]:
        if val_a == 0:
            return None
        return round((val_b - val_a) / val_a * 100, 1)

    return {
        'read_time_lift_percent': lift(a['avg_read_time_seconds'], b['avg_read_time_seconds']),
        'scroll_depth_lift_percent': lift(a['avg_scroll_depth_percent'], b['avg_scroll_depth_percent']),
        'archive_rate_lift_percent': lift(a['archive_rate'], b['archive_rate']),
        'return_rate_lift_percent': lift(a['return_rate'], b['return_rate']),
        'note': 'Positive values = Group B (MBTI) outperforms Group A (original)',
    }


# ── Create experiment (admin) ────────────────────────────────────────────────

async def _handle_create_experiment(body: Dict[str, Any]) -> Dict:
    """
    POST /api/ab-test/experiment
    Body: { experiment_id, name, description?, start_date?, end_date? }
    """
    experiment_id = body.get('experiment_id', '').strip()
    name = body.get('name', '').strip()

    if not experiment_id or not name:
        return _error(400, 'experiment_id and name are required')

    db = _get_db()

    experiment = Experiment(
        experiment_id=experiment_id,
        name=name,
        description=body.get('description', ''),
        start_date=body.get('start_date', ''),
        end_date=body.get('end_date', ''),
    )

    success = await db.put_item(experiment.to_item())
    if not success:
        return _error(500, 'Failed to create experiment')

    return _success({
        'experiment_id': experiment_id,
        'name': name,
        'status': 'active',
        'created_at': experiment.created_at,
    }, status_code=201)


# ── Response helpers ─────────────────────────────────────────────────────────

def _success(data: Dict[str, Any], status_code: int = 200) -> Dict:
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(data, ensure_ascii=False, default=str),
    }


def _error(status_code: int, message: str) -> Dict:
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'error': {'code': 'AB_TEST_ERROR', 'message': message}
        }, ensure_ascii=False),
    }


def _parse_event(event: dict):
    rc = event.get('requestContext', {})
    if 'http' in rc:
        method = rc['http'].get('method', 'GET')
        path = rc['http'].get('path', '')
    else:
        method = event.get('httpMethod', 'GET')
        path = event.get('path', '')

    params = event.get('queryStringParameters', {}) or {}

    raw = event.get('body', '{}')
    if raw and event.get('isBase64Encoded', False):
        raw = base64.b64decode(raw).decode('utf-8')
    if isinstance(raw, str) and raw:
        body = json.loads(raw)
    elif isinstance(raw, dict):
        body = raw
    else:
        body = {}

    return method, path, params, body


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """
    A/B Test API Lambda handler.

    Routes:
      POST /api/ab-test/assign       — Assign user to group
      POST /api/ab-test/event        — Record engagement event
      GET  /api/ab-test/results      — Get experiment results
      POST /api/ab-test/experiment   — Create experiment (admin)
    """
    method, path, params, body = _parse_event(event)

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    logger.info(f"AB test request: {method} {path}")

    if '/assign' in path and method == 'POST':
        return await _handle_assign(body)

    if '/event' in path and method == 'POST':
        return await _handle_event(body)

    if '/results' in path and method == 'GET':
        return await _handle_results(params)

    if '/experiment' in path and method == 'POST':
        return await _handle_create_experiment(body)

    return _error(404, 'Not found')
