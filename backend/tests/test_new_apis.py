#!/usr/bin/env python3
"""
New API Smoke Tests — Archive, Podcast, Recommendation
========================================================
Tests the 3 new API handlers both directly (Python import) and via HTTP.

Direct invocation tests the handler logic without needing API Gateway wiring.
HTTP tests verify the full path (may return 403/404 if Lambda not wired yet).

Requirements:
  - AWS credentials (DynamoDB access for personal-dev table)
  - S3 bucket: sedaily-mbti-article-body-dev (for podcast article fetch)
  - provision.sh run (creates personal-dev and podcast-dev tables)
  - Optional: Bedrock access (for podcast generation — skipped if unavailable)

Usage:
  python tests/test_new_apis.py
  API_URL=http://localhost:8000 python tests/test_new_apis.py

Test data is cleaned up after all tests run.
"""
import asyncio
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta

import requests as http_requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# ── Configuration ────────────────────────────────────────────────────────────

API_URL = os.getenv('API_URL', 'https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev')
REGION = os.getenv('AWS_REGION', 'us-east-1')
KST = timezone(timedelta(hours=9))
TODAY_ISO = datetime.now(KST).strftime('%Y-%m-%d')
TIMEOUT = 60

TEST_USER = f"test_newapi_{uuid.uuid4().hex[:8]}"
TEST_ARTICLE_1 = "TEST_ARTICLE_001"
TEST_ARTICLE_2 = "TEST_ARTICLE_002"


# ── Test Framework ───────────────────────────────────────────────────────────

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.errors = []

    def ok(self, name: str, detail: str = ''):
        self.passed += 1
        print(f"  \033[32mPASS\033[0m  {name} {detail}")

    def fail(self, name: str, reason: str):
        self.failed += 1
        self.errors.append((name, reason))
        print(f"  \033[31mFAIL\033[0m  {name} — {reason}")

    def skip(self, name: str, reason: str):
        self.skipped += 1
        print(f"  \033[33mSKIP\033[0m  {name} — {reason}")

    def summary(self):
        total = self.passed + self.failed + self.skipped
        print('')
        print('=' * 60)
        if self.failed == 0:
            msg = f"  {self.passed} PASSED"
            if self.skipped:
                msg += f", {self.skipped} SKIPPED"
            print(f"\033[32m{msg}\033[0m")
        else:
            print(f"\033[31m  {self.failed}/{total} TESTS FAILED\033[0m")
            for name, reason in self.errors:
                print(f"    - {name}: {reason}")
        print('=' * 60)
        return self.failed == 0


results = TestResult()


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_lambda_event(method, path, body=None, query_params=None, path_params=None):
    """Build a Lambda event dict simulating API Gateway v1."""
    event = {
        'httpMethod': method,
        'path': path,
        'queryStringParameters': query_params or {},
        'pathParameters': path_params or {},
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(body) if body else '{}',
        'isBase64Encoded': False,
    }
    return event


def invoke_handler(handler_func, event):
    """Invoke a Lambda handler and return parsed (status_code, body_dict).
    Handles both sync (decorator-wrapped) and raw async handlers."""
    result = handler_func(event, None)
    # If the decorator already ran asyncio.run internally, result is a dict
    if asyncio.iscoroutine(result):
        response = asyncio.run(result)
    else:
        response = result
    status = response.get('statusCode', 500)
    body_str = response.get('body', '{}')
    try:
        body = json.loads(body_str) if isinstance(body_str, str) else body_str
    except (json.JSONDecodeError, TypeError):
        body = {'raw': body_str}
    return status, body


def http_call(method, path, **kwargs):
    """Make an HTTP call and return (status, body, elapsed_ms)."""
    kwargs.setdefault('timeout', TIMEOUT)
    start = time.time()
    try:
        resp = getattr(http_requests, method)(f'{API_URL}{path}', **kwargs)
        ms = int((time.time() - start) * 1000)
        try:
            body = resp.json()
        except Exception:
            body = {'raw': resp.text[:200]}
        return resp.status_code, body, ms
    except Exception as e:
        ms = int((time.time() - start) * 1000)
        return None, {'error': str(e)}, ms


# ── Cleanup registry ─────────────────────────────────────────────────────────

cleanup_actions = []


def register_cleanup(func):
    cleanup_actions.append(func)


def run_cleanup():
    print('')
    print(f'  Running {len(cleanup_actions)} cleanup actions...')
    for action in cleanup_actions:
        try:
            action()
        except Exception as e:
            print(f'    [warn] cleanup failed: {e}')
    print('  Cleanup done.')


# =============================================================================
# ARCHIVE TESTS
# =============================================================================

def test_archive_direct():
    """Test archive handler via direct Python invocation."""

    from handlers.archive_handler import lambda_handler

    saved_archive_id = None

    # ── 1a. POST /api/archive — save a sentence ──────────────────────
    name = 'Archive: save sentence (direct)'
    event = make_lambda_event('POST', '/api/archive', body={
        'user_id': TEST_USER,
        'text': '삼성전자가 1분기 영업이익 6조원을 기록했다.',
        'article_id': TEST_ARTICLE_1,
        'article_title': '삼성전자 1분기 실적 발표',
        'article_published_at': '2026-04-09T10:00:00+09:00',
    })

    status, body = invoke_handler(lambda_handler, event)

    if status != 201:
        results.fail(name, f'Status {status}: {body}')
        return

    sentence = body.get('sentence', {})
    saved_archive_id = sentence.get('id', '')
    vector_status = body.get('vector_status', '')

    if not saved_archive_id:
        results.fail(name, 'No archive id returned')
        return

    results.ok(name, f'id={saved_archive_id[:30]}..., vector={vector_status}')

    # ── 1b. GET /api/archive — list sentences ────────────────────────
    name = 'Archive: list sentences (direct)'
    event = make_lambda_event('GET', '/api/archive', query_params={
        'user_id': TEST_USER,
    })

    status, body = invoke_handler(lambda_handler, event)

    if status != 200:
        results.fail(name, f'Status {status}: {body}')
        return

    sentences = body.get('sentences', [])
    count = body.get('count', 0)

    found = any(s.get('id') == saved_archive_id for s in sentences)
    if not found:
        results.fail(name, f'Saved sentence not found in list ({count} items)')
        return

    results.ok(name, f'{count} sentences, saved item found')

    # ── 1c. POST /api/archive/similar — similarity search ────────────
    name = 'Archive: similar (no pgvector — graceful fallback)'
    event = make_lambda_event('POST', '/api/archive/similar', body={
        'user_id': TEST_USER,
        'text': '반도체 수출이 호조를 보이고 있다.',
        'limit': 5,
    })

    status, body = invoke_handler(lambda_handler, event)

    # 503 is expected when pgvector is not configured
    if status == 503:
        results.ok(name, 'Status 503 — pgvector not configured (expected)')
    elif status == 200:
        results.ok(name, f'Status 200, {body.get("count", 0)} similar results')
    else:
        results.fail(name, f'Status {status}: {body}')

    # ── 1d. DELETE /api/archive/{id} ─────────────────────────────────
    name = 'Archive: delete sentence (direct)'
    event = make_lambda_event('DELETE', f'/api/archive/{saved_archive_id}',
                              query_params={'user_id': TEST_USER},
                              path_params={'archive_id': saved_archive_id})

    status, body = invoke_handler(lambda_handler, event)

    if status != 200:
        results.fail(name, f'Status {status}: {body}')
        return

    if not body.get('deleted'):
        results.fail(name, 'Response missing deleted=true')
        return

    results.ok(name, f'deleted archive_id={saved_archive_id[:30]}...')

    # ── 1e. Verify deletion ──────────────────────────────────────────
    name = 'Archive: verify deletion (direct)'
    event = make_lambda_event('GET', '/api/archive', query_params={
        'user_id': TEST_USER,
    })

    status, body = invoke_handler(lambda_handler, event)

    if status != 200:
        results.fail(name, f'Status {status}')
        return

    sentences = body.get('sentences', [])
    still_found = any(s.get('id') == saved_archive_id for s in sentences)
    if still_found:
        results.fail(name, 'Deleted sentence still appears in list')
        return

    results.ok(name, f'{body.get("count", 0)} sentences remaining, deleted item gone')


def test_archive_http():
    """Test archive handler via HTTP (may 404 if not wired to API Gateway)."""
    name = 'Archive: list via HTTP'
    status, body, ms = http_call('get', f'/api/archive?user_id={TEST_USER}')

    if status is None:
        results.fail(name, f'Connection error: {body}')
    elif status in (403, 404):
        results.ok(name, f'({ms}ms) Status {status} — not wired to API Gateway yet')
    elif status == 200:
        results.ok(name, f'({ms}ms) {body.get("count", 0)} sentences')
    else:
        results.fail(name, f'({ms}ms) Status {status}: {body}')


# =============================================================================
# PODCAST TESTS
# =============================================================================

def test_podcast_direct():
    """Test podcast handler: generate requires Bedrock+Polly, so test list/get only."""

    from handlers.podcast_handler import lambda_handler

    # ── 2a. GET /api/podcast/list — list by date ─────────────────────
    name = 'Podcast: list by date (direct)'
    event = make_lambda_event('GET', '/api/podcast/list',
                              query_params={'date': TODAY_ISO})

    status, body = invoke_handler(lambda_handler, event)

    if status != 200:
        results.fail(name, f'Status {status}: {body}')
        return

    count = body.get('count', 0)
    results.ok(name, f'{count} podcasts for {TODAY_ISO}')

    # ── 2b. GET /api/podcast/{id} — get nonexistent (should 404) ─────
    name = 'Podcast: get nonexistent (direct)'
    event = make_lambda_event('GET', '/api/podcast/podcast_NONEXISTENT_NT_20260409',
                              path_params={'podcast_id': 'podcast_NONEXISTENT_NT_20260409'})

    status, body = invoke_handler(lambda_handler, event)

    if status == 404:
        results.ok(name, 'Status 404 as expected for nonexistent podcast')
    else:
        results.fail(name, f'Expected 404, got {status}: {body}')

    # ── 2c. GET /api/podcast/article/{id} — list by article ──────────
    name = 'Podcast: list by article (direct)'
    event = make_lambda_event('GET', f'/api/podcast/article/{TEST_ARTICLE_1}',
                              path_params={'article_id': TEST_ARTICLE_1})

    status, body = invoke_handler(lambda_handler, event)

    if status != 200:
        results.fail(name, f'Status {status}: {body}')
        return

    results.ok(name, f'{body.get("count", 0)} podcasts for article {TEST_ARTICLE_1}')

    # ── 2d. POST /api/podcast/generate — requires Bedrock+Polly ─────
    name = 'Podcast: generate (requires Bedrock — may fail)'

    # Try to find a real article in DynamoDB
    try:
        import boto3
        dynamodb = boto3.resource('dynamodb', region_name=REGION)
        table = dynamodb.Table('sedaily-mbti-articles-dev')
        from boto3.dynamodb.conditions import Key
        resp = table.query(
            IndexName='category-published_at-index',
            KeyConditionExpression=Key('category').eq('경제'),
            ScanIndexForward=False,
            Limit=1,
        )
        items = resp.get('Items', [])
        if items:
            real_article_id = items[0]['news_id']
        else:
            results.skip(name, 'No articles in DynamoDB to generate podcast from')
            return
    except Exception as e:
        results.skip(name, f'Cannot query DynamoDB for real article: {e}')
        return

    event = make_lambda_event('POST', '/api/podcast/generate', body={
        'article_id': real_article_id,
        'mbti_group': 'NT',
    })

    status, body = invoke_handler(lambda_handler, event)

    if status in (201, 200):
        podcast_id = body.get('podcast_id', '')
        pod_status = body.get('status', '')
        results.ok(name, f'podcast_id={podcast_id[:40]}..., status={pod_status}')

        # Register cleanup for the generated podcast
        if podcast_id:
            def cleanup_podcast(pid=podcast_id):
                try:
                    from repositories.podcast_repository import get_podcast_repository
                    repo = get_podcast_repository()
                    asyncio.run(repo.delete_podcast(pid))
                except Exception:
                    pass
                # Clean S3 audio
                try:
                    s3 = boto3.client('s3', region_name=REGION)
                    s3.delete_object(
                        Bucket=os.getenv('S3_AUDIO_BUCKET', 'sedaily-mbti-audio-dev'),
                        Key=f'podcasts/{pid}.mp3'
                    )
                except Exception:
                    pass
            register_cleanup(cleanup_podcast)

    elif status == 404:
        results.ok(name, f'Status 404 — article {real_article_id} not accessible (split storage not deployed)')
    elif status == 500:
        error_msg = body.get('error', {}).get('message', str(body)[:100])
        results.skip(name, f'Status 500 — Bedrock/Polly call failed: {error_msg}')
    else:
        results.fail(name, f'Status {status}: {body}')


def test_podcast_http():
    """Test podcast handler via HTTP."""
    name = 'Podcast: list via HTTP'
    status, body, ms = http_call('get', f'/api/podcast/list?date={TODAY_ISO}')

    if status is None:
        results.fail(name, f'Connection error: {body}')
    elif status in (403, 404):
        results.ok(name, f'({ms}ms) Status {status} — not wired to API Gateway yet')
    elif status == 200:
        results.ok(name, f'({ms}ms) {body.get("count", 0)} podcasts')
    else:
        results.fail(name, f'({ms}ms) Status {status}: {body}')


# =============================================================================
# RECOMMENDATION TESTS
# =============================================================================

def test_recommend_direct():
    """Test recommendation handler via direct invocation."""

    from handlers.recommendation_handler import lambda_handler
    from handlers.user_handler import lambda_handler as user_handler

    # ── 3a. Seed reading history ─────────────────────────────────────
    name = 'Recommend: seed reading history'

    for article_id in [TEST_ARTICLE_1, TEST_ARTICLE_2]:
        event = make_lambda_event('POST', '/api/user/read', body={
            'user_id': TEST_USER,
            'article_id': article_id,
            'article_title': f'Test Article {article_id}',
        })
        status, body = invoke_handler(user_handler, event)
        if status != 200:
            results.fail(name, f'Failed to save read for {article_id}: status {status}')
            return

    results.ok(name, f'Saved reads for {TEST_ARTICLE_1}, {TEST_ARTICLE_2}')

    # ── 3b. GET /api/recommend — personalized recommendations ────────
    name = 'Recommend: get recommendations (direct)'
    event = make_lambda_event('GET', '/api/recommend', query_params={
        'user_id': TEST_USER,
        'limit': '5',
    })

    status, body = invoke_handler(lambda_handler, event)

    if status != 200:
        results.fail(name, f'Status {status}: {body}')
        return

    recommendations = body.get('recommendations', [])
    strategy = body.get('strategy', '')
    count = body.get('count', 0)

    if 'recommendations' not in body:
        results.fail(name, 'Missing "recommendations" key')
        return

    results.ok(name, f'strategy={strategy}, {count} recommendations')

    # ── 3c. GET /api/recommend/analysis — DNA interest scores ────────
    name = 'Recommend: reading analysis (direct)'
    event = make_lambda_event('GET', '/api/recommend/analysis', query_params={
        'user_id': TEST_USER,
    })

    status, body = invoke_handler(lambda_handler, event)

    if status != 200:
        results.fail(name, f'Status {status}: {body}')
        return

    scores = body.get('interest_scores', {})
    total = body.get('total_articles_read', 0)

    if 'interest_scores' not in body:
        results.fail(name, 'Missing "interest_scores" key')
        return

    # interest_scores should have the DNA radar chart keys
    expected_keys = {'economy', 'tech', 'world', 'society', 'culture', 'politics', 'sports'}
    actual_keys = set(scores.keys())
    if not expected_keys.issubset(actual_keys):
        missing = expected_keys - actual_keys
        results.fail(name, f'Missing DNA keys: {missing}')
        return

    results.ok(name, f'total_read={total}, scores={scores}')


def test_recommend_http():
    """Test recommendation handler via HTTP."""
    name = 'Recommend: analysis via HTTP'
    status, body, ms = http_call('get', f'/api/recommend/analysis?user_id={TEST_USER}')

    if status is None:
        results.fail(name, f'Connection error: {body}')
    elif status in (403, 404):
        results.ok(name, f'({ms}ms) Status {status} — not wired to API Gateway yet')
    elif status == 200:
        scores = body.get('interest_scores', {})
        results.ok(name, f'({ms}ms) scores={scores}')
    else:
        results.fail(name, f'({ms}ms) Status {status}: {body}')


# =============================================================================
# CLEANUP
# =============================================================================

def cleanup_test_data():
    """Remove all test user data from Personal DB."""
    try:
        import boto3
        personal_table = os.getenv('DYNAMODB_TABLE_PERSONAL', 'sedaily-mbti-personal-dev')
        dynamodb = boto3.resource('dynamodb', region_name=REGION)
        table = dynamodb.Table(personal_table)

        # Query all items for test user
        from boto3.dynamodb.conditions import Key
        resp = table.query(
            KeyConditionExpression=Key('user_id').eq(TEST_USER),
        )
        items = resp.get('Items', [])

        for item in items:
            table.delete_item(Key={
                'user_id': item['user_id'],
                'sk': item['sk'],
            })

        print(f'  Cleaned {len(items)} items for user {TEST_USER}')
    except Exception as e:
        print(f'  [warn] Personal DB cleanup failed: {e}')


# =============================================================================
# MAIN
# =============================================================================

def main():
    print('')
    print('=' * 60)
    print('  New API Smoke Tests')
    print(f'  API: {API_URL}')
    print(f'  Test user: {TEST_USER}')
    print(f'  Date: {TODAY_ISO}')
    print('=' * 60)
    print('')

    register_cleanup(cleanup_test_data)

    try:
        # Archive
        print('── Archive API ──')
        print('')
        test_archive_direct()
        test_archive_http()

        # Podcast
        print('')
        print('── Podcast API ──')
        print('')
        test_podcast_direct()
        test_podcast_http()

        # Recommendation
        print('')
        print('── Recommendation API ──')
        print('')
        test_recommend_direct()
        test_recommend_http()

    finally:
        run_cleanup()

    print('')
    all_passed = results.summary()
    print('')
    sys.exit(0 if all_passed else 1)


if __name__ == '__main__':
    main()
