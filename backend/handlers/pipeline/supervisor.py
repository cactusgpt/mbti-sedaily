"""
MBTI Supervisor — Final quality gate, storage, and vector indexing
===================================================================
Receives validated articles from Step 4, performs a final cross-version
consistency check using Amazon Nova, then:
  1. Stores approved articles via split storage (S3 body + DynamoDB pointer)
  2. Generates embeddings and indexes in OpenSearch + pgvector

Vector indexing failures are non-fatal — articles are always stored in
Article DB first, and vector failures are logged for later retry.

Input (from Step 4):
  {
    "step": 4,
    "date": "20260408",
    "validated_articles": [
      {
        "news_id", "title", "content_clean", "content_raw", "content_blocks",
        "category", "published_at", "author_name", "author_email",
        "images", "url", "related_news", "is_breaking_news",
        "versions": { "NT": {...}, "NF": {...}, "ST": {...}, "SF": {...} },
        "transform_usage": {...},
        "validation": { "status": "passed"|"flagged", "issues": [...] }
      }
    ],
    "flagged_articles": [...],
    "failed_articles": [...],
    "metrics": {...}
  }

Output:
  {
    "step": "supervisor",
    "date": "20260408",
    "stored_articles": [ { "news_id", "s3_body_uri", "status": "stored" } ],
    "rejected_articles": [ { "news_id", "title", "reason" } ],
    "failed_articles": [...],
    "vector_failures": [ { "news_id", "service", "error" } ],
    "collection_log_id": "collection_log_20260408_143022",
    "metrics": {
      "input_count": 10,
      "approved_count": 9,
      "rejected_count": 1,
      "stored_count": 9,
      "store_failed_count": 0,
      "opensearch_indexed": 9,
      "pgvector_indexed": 9,
      "vector_failed_count": 0,
      "total_pipeline_articles": 11,
      "duration_ms": 6200
    }
  }
"""
import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple, Optional

import boto3
from botocore.config import Config

from clients.s3_article_client import S3ArticleClient
from clients.dynamodb_client import DynamoDBClient
from clients.embedding_client import EmbeddingClient, EmbeddingError
from config import settings
from config.constants import (
    BEDROCK_MODEL_ID_NOVA,
    BEDROCK_REGION,
    MBTI_GROUPS,
)
from utils.hash_utils import hash_content
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

KST = timezone(timedelta(hours=9))

# Expected tone keywords per group — used for quick sanity check
EXPECTED_TONES = {
    'NT': '분석적',
    'NF': '성찰적',
    'ST': '간결한',
    'SF': '친근한',
}

_BEDROCK_CONFIG = Config(
    read_timeout=120,
    connect_timeout=30,
    retries={'max_attempts': 2},
)


def _get_nova_client():
    return boto3.client(
        'bedrock-runtime',
        region_name=BEDROCK_REGION,
        config=_BEDROCK_CONFIG,
    )


# ── Cross-version consistency check (Nova) ───────────────────────────────────

async def _supervisor_review(
    articles: List[Dict[str, Any]],
    nova_client,
) -> Dict[str, Dict[str, Any]]:
    """
    Final Nova review: cross-version consistency, tone verification,
    and factual preservation across all 4 MBTI versions.

    Returns {news_id: {"approved": bool, "reason": str}}.
    """
    if not articles:
        return {}

    summaries = []
    for a in articles:
        versions = a.get('versions', {})
        lines = [f"[{a['news_id']}] 원본: {a.get('title', '')}"]
        for g in MBTI_GROUPS:
            v = versions.get(g, {})
            title = v.get('title', '(없음)')
            body = v.get('body', '')
            body_text = body if isinstance(body, str) else '\n'.join(body) if isinstance(body, list) else ''
            preview = body_text[:150].replace('\n', ' ')
            lines.append(f"  {g}({EXPECTED_TONES[g]}): {title} | {preview}...")
        summaries.append('\n'.join(lines))

    prompt = (
        "당신은 MBTI 뉴스 서비스의 최종 품질 관리자입니다.\n"
        "다음 기사들의 4개 MBTI 버전을 검토하세요.\n\n"
        "검토 기준:\n"
        "1. 톤 일관성: NT=분석적/논리적, NF=성찰적/따뜻한, "
        "ST=간결한/팩트중심, SF=친근한/공감적 톤이 각각 유지되는가\n"
        "2. 버전 간 차이: 4개 버전이 실제로 서로 다른 관점/톤을 제공하는가 "
        "(복사본이 아닌가)\n"
        "3. 핵심 팩트 보존: 원본 제목의 핵심 사실이 4개 버전 모두에 보존되는가\n\n"
        f"기사 목록:\n{chr(10).join(summaries)}\n\n"
        "문제가 있는 기사만 보고하세요. JSON으로 출력:\n"
        '{"reviews": [{"id": "뉴스ID", "approved": false, '
        '"reason": "사유"}]}\n'
        '모두 통과: {"reviews": []}'
    )

    try:
        body = json.dumps({
            "inputText": prompt,
            "textGenerationConfig": {
                "maxTokenCount": 2048,
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
        text = ''
        if 'results' in resp:
            text = resp['results'][0].get('outputText', '')
        elif 'output' in resp:
            text = resp['output'].get('message', {}).get('content', [{}])[0].get('text', '')

        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            parsed = json.loads(match.group(0))
            result = {}
            for r in parsed.get('reviews', []):
                result[r['id']] = {
                    'approved': r.get('approved', True),
                    'reason': r.get('reason', ''),
                }
            return result

    except Exception as e:
        logger.warning(f"Nova supervisor review failed (approving all): {e}")

    return {}


# ── Map pipeline article to DynamoDB save format ─────────────────────────────

def _to_storage_format(article: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map pipeline article fields to the format expected by
    DynamoDBClient.save_article().

    Pipeline uses: title, content_clean, content_raw, sub_title
    DynamoDB uses: title_ko, content_ko, content_raw, sub_title_ko
    """
    versions = article.get('versions', {})
    now = datetime.now(KST).isoformat()

    return {
        # Core
        'news_id': article['news_id'],
        'item_type': 'article',
        'press': '서울경제',

        # Korean content (body fields — will go to S3)
        'title_ko': article.get('title', ''),
        'sub_title_ko': article.get('sub_title', ''),
        'content_ko': article.get('content_clean', ''),
        'content_raw': article.get('content_raw', ''),
        'content_blocks': article.get('content_blocks', []),

        # MBTI versions (body fields — will go to S3)
        'version_NT': versions.get('NT', {}),
        'version_NF': versions.get('NF', {}),
        'version_ST': versions.get('ST', {}),
        'version_SF': versions.get('SF', {}),

        # Metadata (stays in DynamoDB)
        'author_name': article.get('author_name', ''),
        'author_email': article.get('author_email', ''),
        'byline': article.get('author_name', '') or '서울경제',
        'published_at': article.get('published_at', ''),
        'category': article.get('category', ''),
        'url': article.get('url', ''),
        'original_link': article.get('url', ''),
        'images': article.get('images', []),
        'related_news': article.get('related_news', []),
        'is_breaking_news': article.get('is_breaking_news', False),
        'content_hash': hash_content(article.get('content_clean', '')),
        'transform_usage': article.get('transform_usage', {}),
        'transformed_at': now,
    }


# ── Storage ──────────────────────────────────────────────────────────────────

def _init_storage() -> DynamoDBClient:
    """Create DynamoDBClient wired to S3ArticleClient for split storage."""
    s3_client = S3ArticleClient(
        bucket_name=settings.s3_article_body_bucket,
        region=settings.s3_article_body_region,
    )
    return DynamoDBClient(
        table_name=settings.dynamodb_table_articles,
        region=settings.region,
        s3_article_client=s3_client,
    )


# ── Collection log ───────────────────────────────────────────────────────────

async def _save_collection_log(
    db: DynamoDBClient,
    date_str: str,
    metrics: Dict[str, Any],
    stored: List[Dict[str, Any]],
    rejected: List[Dict[str, Any]],
    failed: List[Dict[str, Any]],
) -> str:
    """Save a pipeline collection log. Returns the log ID."""
    now = datetime.now(KST)
    log_id = f"collection_log_{now.strftime('%Y%m%d_%H%M%S')}"

    log_data = {
        'status': 'completed',
        'total_found': metrics.get('total_pipeline_articles', 0),
        'new_articles': metrics.get('stored_count', 0),
        'updated_articles': 0,
        'failed_articles': metrics.get('store_failed_count', 0) + len(failed),
        'skipped_unchanged': metrics.get('rejected_count', 0),
        'article_details': [
            *[{'news_id': s['news_id'], 'action': 'stored'} for s in stored],
            *[{'news_id': r['news_id'], 'action': 'rejected', 'reason': r.get('reason', '')} for r in rejected],
            *[{'news_id': f.get('news_id', ''), 'action': 'failed', 'reason': f.get('error', '')} for f in failed],
        ],
    }

    await db.save_collection_log(log_data)
    return log_id


# ── Vector indexing ───────────────────────────────────────────────────────────

def _build_embed_text(title: str, body: Any) -> str:
    """Concatenate title + body into a single string for embedding."""
    body_text = body if isinstance(body, str) else '\n'.join(body) if isinstance(body, list) else ''
    return f"{title}\n\n{body_text}" if body_text else title


def _init_opensearch():
    """Create OpenSearch client if endpoint is configured."""
    if not settings.opensearch_endpoint:
        logger.info("OpenSearch endpoint not configured — skipping OS indexing")
        return None
    from clients.opensearch_client import OpenSearchClient
    return OpenSearchClient(
        endpoint=settings.opensearch_endpoint,
        index_name=settings.opensearch_index,
        region=settings.region,
    )


def _init_pgvector():
    """Create pgvector client if password is configured."""
    if not settings.pg_password:
        logger.info("PostgreSQL password not configured — skipping pgvector indexing")
        return None
    from clients.pgvector_client import PgVectorClient
    return PgVectorClient(
        host=settings.pg_host,
        port=settings.pg_port,
        database=settings.pg_database,
        user=settings.pg_user,
        password=settings.pg_password,
    )


async def _index_vectors(
    articles: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Generate embeddings and index articles in OpenSearch + pgvector.

    For each article, embeds 5 texts:
      - Original (title + content_clean)
      - NT version (title + body)
      - NF version (title + body)
      - ST version (title + body)
      - SF version (title + body)

    Failures are collected but never block Article DB storage.

    Returns:
        {
            'opensearch_indexed': int,
            'pgvector_indexed': int,
            'failures': [{'news_id': str, 'service': str, 'error': str}]
        }
    """
    failures: List[Dict[str, str]] = []
    opensearch_count = 0
    pgvector_count = 0

    embed_client = EmbeddingClient()
    os_client = _init_opensearch()
    pg_client = _init_pgvector()

    if not os_client and not pg_client:
        logger.info("No vector DBs configured — skipping all vector indexing")
        return {'opensearch_indexed': 0, 'pgvector_indexed': 0, 'failures': []}

    # ── Optimization: collect all texts across articles, batch embed ──
    # Instead of embed_batch per article, collect all texts and call
    # Bedrock once per text (same API, but structured for future
    # native batching when Titan supports it).

    # Collect per-article embedding tasks
    all_tasks: List[Tuple[Dict, List[Tuple[str, str, str]]]] = []  # (article, embed_items)

    for article in articles:
        versions = article.get('versions', {})
        embed_items: List[Tuple[str, str, str]] = []

        original_text = _build_embed_text(
            article.get('title', ''),
            article.get('content_clean', ''),
        )
        if original_text.strip():
            embed_items.append(('', original_text, article.get('title', '')))

        for group in MBTI_GROUPS:
            v = versions.get(group, {})
            v_title = v.get('title', '')
            v_body = v.get('body', '')
            v_text = _build_embed_text(v_title, v_body)
            if v_text.strip():
                embed_items.append((group, v_text, v_title))

        if embed_items:
            all_tasks.append((article, embed_items))

    # Generate all embeddings (per-article batching)
    for article, embed_items in all_tasks:
        news_id = article['news_id']
        texts_to_embed = [item[1] for item in embed_items]

        try:
            embeddings = embed_client.embed_batch(texts_to_embed)
        except Exception as e:
            logger.error(f"Embedding failed for {news_id}: {e}")
            failures.append({
                'news_id': news_id,
                'service': 'bedrock_embedding',
                'error': str(e)[:200],
            })
            continue

        # ── Optimization: batch OpenSearch indexing ───────────────────
        if os_client:
            batch_articles = []
            batch_embeddings = []
            batch_groups = []

            for (group, text, title), embedding in zip(embed_items, embeddings):
                batch_articles.append({
                    'news_id': news_id,
                    'title': title,
                    'content': text,
                    'category': article.get('category', ''),
                    'published_at': article.get('published_at', ''),
                })
                batch_embeddings.append(embedding)
                batch_groups.append(group)

            try:
                count = os_client.bulk_index_articles(batch_articles, batch_embeddings, batch_groups)
                opensearch_count += count
            except Exception as e:
                logger.error(f"OpenSearch bulk index failed for {news_id}: {e}")
                failures.append({
                    'news_id': news_id,
                    'service': 'opensearch_bulk',
                    'error': str(e)[:200],
                })

        # pgvector (sequential — pg8000 doesn't support batch)
        if pg_client:
            for (group, text, _title), embedding in zip(embed_items, embeddings):
                try:
                    pg_client.insert_article_vector(
                        news_id=news_id,
                        mbti_group=group,
                        chunk_text=text[:5000],
                        embedding=embedding,
                    )
                    pgvector_count += 1
                except Exception as e:
                    logger.error(f"pgvector insert failed for {news_id}/{group}: {e}")
                    failures.append({
                        'news_id': news_id,
                        'service': f'pgvector_{group or "original"}',
                        'error': str(e)[:200],
                    })

    if pg_client:
        try:
            pg_client.close()
        except Exception:
            pass

    logger.info(
        f"Vector indexing: OpenSearch={opensearch_count}, "
        f"pgvector={pgvector_count}, failures={len(failures)}"
    )

    return {
        'opensearch_indexed': opensearch_count,
        'pgvector_indexed': pgvector_count,
        'failures': failures,
    }


# ── Main logic ───────────────────────────────────────────────────────────────

async def _supervise_and_store(event_body: Dict[str, Any]) -> Dict[str, Any]:
    start = time.time()

    date_str = event_body['date']
    articles = event_body.get('validated_articles', [])
    step4_flagged = event_body.get('flagged_articles', [])
    step_failed = event_body.get('failed_articles', [])

    logger.info(
        f"Supervisor: {len(articles)} articles, "
        f"{len(step4_flagged)} flagged, {len(step_failed)} failed from pipeline"
    )

    # ── Phase 1: Nova cross-version review ──────────────────────────────────

    # Only review articles that passed step 4 validation
    passed_articles = [a for a in articles if a.get('validation', {}).get('status') == 'passed']
    flagged_ids = {f['news_id'] for f in step4_flagged}

    nova_rejections: Dict[str, Dict[str, Any]] = {}
    if passed_articles:
        nova = _get_nova_client()
        nova_rejections = await _supervisor_review(passed_articles, nova)

    # ── Phase 2: Decide which articles to store ─────────────────────────────

    to_store: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []

    for article in articles:
        news_id = article['news_id']
        validation = article.get('validation', {})

        # Already flagged by step 4 with critical issues → reject
        if validation.get('status') == 'flagged':
            rejected.append({
                'news_id': news_id,
                'title': article.get('title', '')[:80],
                'reason': 'step4_flagged',
            })
            continue

        # Rejected by supervisor Nova review → reject
        nova_result = nova_rejections.get(news_id)
        if nova_result and not nova_result.get('approved', True):
            rejected.append({
                'news_id': news_id,
                'title': article.get('title', '')[:80],
                'reason': f"supervisor: {nova_result.get('reason', 'quality')}",
            })
            continue

        to_store.append(article)

    logger.info(f"Supervisor approved {len(to_store)}, rejected {len(rejected)}")

    # ── Phase 3: Store approved articles in Article DB ────────────────────

    db = _init_storage()

    stored: List[Dict[str, Any]] = []
    stored_articles_for_indexing: List[Dict[str, Any]] = []
    store_failed_count = 0

    for article in to_store:
        news_id = article['news_id']
        try:
            storage_dict = _to_storage_format(article)
            success = await db.save_article(storage_dict)

            if success:
                meta = await db.get_article_metadata(news_id)
                stored.append({
                    'news_id': news_id,
                    's3_body_uri': meta.get('s3_body_uri', '') if meta else '',
                    'status': 'stored',
                })
                # Keep the original pipeline article for vector indexing
                stored_articles_for_indexing.append(article)
                logger.info(f"Stored article {news_id}")
            else:
                store_failed_count += 1
                logger.error(f"Storage returned False for {news_id}")

        except Exception as e:
            store_failed_count += 1
            logger.error(f"Failed to store {news_id}: {e}", exc_info=True)

    # ── Phase 4: Vector indexing (non-fatal) ───────────────────────────────

    vector_failures: List[Dict[str, str]] = []
    opensearch_indexed = 0
    pgvector_indexed = 0

    if stored_articles_for_indexing:
        vector_results = await _index_vectors(stored_articles_for_indexing)
        opensearch_indexed = vector_results['opensearch_indexed']
        pgvector_indexed = vector_results['pgvector_indexed']
        vector_failures = vector_results['failures']

    # ── Phase 5: Collection log ─────────────────────────────────────────────

    total_pipeline = len(articles) + len(step_failed)
    metrics = {
        'input_count': len(articles),
        'approved_count': len(to_store),
        'rejected_count': len(rejected),
        'stored_count': len(stored),
        'store_failed_count': store_failed_count,
        'opensearch_indexed': opensearch_indexed,
        'pgvector_indexed': pgvector_indexed,
        'vector_failed_count': len(vector_failures),
        'total_pipeline_articles': total_pipeline,
        'duration_ms': int((time.time() - start) * 1000),
    }

    log_id = await _save_collection_log(
        db, date_str, metrics, stored, rejected, step_failed,
    )

    elapsed = metrics['duration_ms']
    logger.info(
        f"Supervisor complete: {len(stored)} stored, {len(rejected)} rejected, "
        f"{store_failed_count} store failures, "
        f"vectors: {opensearch_indexed} OS/{pgvector_indexed} PG "
        f"({len(vector_failures)} vector failures), "
        f"log={log_id}, {elapsed}ms"
    )

    return {
        'step': 'supervisor',
        'date': date_str,
        'stored_articles': stored,
        'rejected_articles': rejected,
        'failed_articles': step_failed,
        'vector_failures': vector_failures,
        'collection_log_id': log_id,
        'metrics': metrics,
    }


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """Supervisor Lambda: Final quality gate + storage."""
    body = event.get('body', event)

    if body.get('step') != 4:
        logger.warning(f"Expected step 4 input, got step {body.get('step')}")

    result = await _supervise_and_store(body)

    return {
        'statusCode': 200,
        'body': result,
    }
