"""
Recommendation Handler — Personalized article recommendations + reading analysis
==================================================================================
Multi-strategy recommendation engine:
  1. Amazon Personalize (if campaign ARN configured)
  2. MBTI collaborative filtering ("users like you also read")
  3. Category-based interest matching (reading history)
  4. pgvector similarity (archived sentences)

Falls back through strategies in order. Response includes recommendation_source
to indicate which strategy produced the results.

Routes:
  GET /api/recommend?user_id={id}&limit=10          — Personalized recommendations
  GET /api/recommend/analysis?user_id={id}           — Reading pattern analysis (뉴스 DNA)

Replaces the frontend's hardcoded interest values in DnaTab.
"""
import base64
import json
import logging
import math
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

import boto3
from boto3.dynamodb.conditions import Key

from config import settings
from config.constants import (
    CORS_HEADERS,
    CATEGORIES_KOREAN,
    CATEGORY_KOREAN_TO_ENGLISH,
    CATEGORY_SEARCH_ALIASES,
    MBTI_GROUPS,
)
from repositories.personal_repository import get_personal_repository
from models.personal import ReadingRecord
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

KST = timezone(timedelta(hours=9))

# Category weights for the DNA radar chart (English keys matching frontend)
CATEGORY_TO_DNA_KEY = {
    '경제': 'economy',
    'IT_과학': 'tech',
    '국제': 'world',
    '사회': 'society',
    '문화': 'culture',
    '정치': 'politics',
    '스포츠': 'sports',
}

# All DNA keys with default 0
DNA_KEYS = ['economy', 'tech', 'world', 'society', 'culture', 'politics', 'sports']


# ── Article DB (category lookups) ────────────────────────────────────────────

def _get_articles_table():
    dynamodb = boto3.resource('dynamodb', region_name=settings.region)
    return dynamodb.Table(settings.dynamodb_table_articles)


async def _batch_get_article_categories(
    article_ids: List[str],
) -> Dict[str, str]:
    """
    Batch-fetch article categories from DynamoDB.
    Returns {article_id: category}.
    """
    if not article_ids:
        return {}

    dynamodb = boto3.resource('dynamodb', region_name=settings.region)
    table_name = settings.dynamodb_table_articles
    result: Dict[str, str] = {}

    batch_size = 100
    for i in range(0, len(article_ids), batch_size):
        batch = article_ids[i:i + batch_size]
        keys = [{'news_id': aid} for aid in batch]

        try:
            response = dynamodb.batch_get_item(
                RequestItems={
                    table_name: {
                        'Keys': keys,
                        'ProjectionExpression': 'news_id, category',
                    }
                }
            )
            for item in response.get('Responses', {}).get(table_name, []):
                result[item['news_id']] = item.get('category', '')
        except Exception as e:
            logger.warning(f"Batch get categories failed: {e}")

    return result


async def _fetch_recent_articles_by_categories(
    categories: List[str],
    days: int = 3,
    per_category: int = 5,
    exclude_ids: set = None,
) -> List[Dict[str, Any]]:
    """
    Fetch recent articles from target categories using the GSI.
    Returns a flat list of article metadata dicts.
    """
    if not categories:
        return []

    table = _get_articles_table()
    now = datetime.now(KST)
    date_from = (now - timedelta(days=days)).isoformat()
    date_until = now.isoformat()
    exclude_ids = exclude_ids or set()

    articles: List[Dict[str, Any]] = []

    for cat in categories:
        # Expand to aliases
        aliases = CATEGORY_SEARCH_ALIASES.get(cat, [cat])

        for alias in aliases:
            try:
                response = table.query(
                    IndexName='category-published_at-index',
                    KeyConditionExpression=(
                        Key('category').eq(alias) &
                        Key('published_at').between(date_from, date_until)
                    ),
                    ScanIndexForward=False,
                    Limit=per_category * 2,
                )

                for item in response.get('Items', []):
                    nid = item.get('news_id', '')
                    if nid and nid not in exclude_ids:
                        articles.append({
                            'news_id': nid,
                            'title': item.get('title_ko', ''),
                            'category': item.get('category', ''),
                            'published_at': item.get('published_at', ''),
                            'image_url': _extract_image(item),
                            'byline': item.get('byline', '서울경제'),
                        })
                        exclude_ids.add(nid)

                    if len(articles) >= per_category * len(categories) * 2:
                        break

            except Exception as e:
                logger.warning(f"GSI query failed for {alias}: {e}")

    return articles


def _extract_image(item: Dict[str, Any]) -> Optional[str]:
    images = item.get('images', [])
    if images and isinstance(images, list) and len(images) > 0:
        first = images[0]
        if isinstance(first, dict):
            return first.get('url', '')
        if isinstance(first, str):
            return first
    return None


# ── pgvector similarity (optional) ───────────────────────────────────────────

def _get_pgvector():
    if not settings.pg_password:
        return None
    from clients.pgvector_client import PgVectorClient
    return PgVectorClient(
        host=settings.pg_host,
        port=settings.pg_port,
        database=settings.pg_database,
        user=settings.pg_user,
        password=settings.pg_password,
    )


async def _similarity_recommendations(
    user_id: str,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """
    Use archived sentences to find similar articles via pgvector.
    Returns article pointers from similarity search.
    """
    pg = _get_pgvector()
    if not pg:
        return []

    try:
        from clients.embedding_client import EmbeddingClient

        # Get user's most recent archived sentences
        repo = get_personal_repository()
        sentences = await repo.list_archived_sentences(user_id=user_id, limit=5)

        if not sentences:
            return []

        # Embed the most recent sentence as query
        embed_client = EmbeddingClient()
        query_text = sentences[0].text
        embedding = embed_client.embed_text(query_text)

        results = pg.search_similar_articles(embedding=embedding, limit=limit)
        return results

    except Exception as e:
        logger.warning(f"Similarity recommendations failed (non-fatal): {e}")
        return []

    finally:
        if pg:
            try:
                pg.close()
            except Exception:
                pass


# ── Interest scoring ─────────────────────────────────────────────────────────

def _compute_interest_scores(
    category_counts: Dict[str, int],
    total_reads: int,
) -> Dict[str, int]:
    """
    Convert raw category read counts into 0-100 interest scores.

    Uses normalized percentages, scaled so the top category = 100.
    Minimum score is 5 for any category with at least 1 read.

    Returns dict with DNA keys: {economy: 75, tech: 60, ...}
    """
    scores: Dict[str, int] = {k: 0 for k in DNA_KEYS}

    if total_reads == 0:
        return scores

    # Map Korean categories to DNA keys and sum counts
    dna_counts: Dict[str, int] = defaultdict(int)
    for cat, count in category_counts.items():
        dna_key = CATEGORY_TO_DNA_KEY.get(cat)
        if dna_key:
            dna_counts[dna_key] += count

    if not dna_counts:
        return scores

    max_count = max(dna_counts.values())
    if max_count == 0:
        return scores

    for key in DNA_KEYS:
        count = dna_counts.get(key, 0)
        if count > 0:
            # Scale relative to max, minimum 5
            scores[key] = max(5, round(count / max_count * 100))

    return scores


def _rank_categories(
    scores: Dict[str, int],
) -> List[str]:
    """
    Return Korean category names ranked by interest score (highest first).
    Only includes categories with score > 0.
    """
    # Reverse map: DNA key → Korean category
    dna_to_korean = {v: k for k, v in CATEGORY_TO_DNA_KEY.items()}

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [dna_to_korean[key] for key, score in ranked if score > 0 and key in dna_to_korean]


# ── Personalize integration ──────────────────────────────────────────────────

async def _try_personalize_recommendations(
    user_id: str,
    mbti_group: str,
    read_id_set: set,
    limit: int,
) -> Optional[List[Dict[str, Any]]]:
    """
    Try to get recommendations from Amazon Personalize.
    Returns None if Personalize is not configured or fails.
    """
    try:
        from clients.personalize_client import is_personalize_available, get_personalize_client

        if not is_personalize_available():
            return None

        client = get_personalize_client()
        items = client.get_recommendations(
            user_id=user_id,
            num_results=limit * 2,
            context={'MBTI_GROUP': mbti_group} if mbti_group else None,
        )

        if not items:
            return None

        # Filter out already-read articles
        filtered = [i for i in items if i['article_id'] not in read_id_set][:limit]

        if not filtered:
            return None

        # Fetch metadata
        article_ids = [i['article_id'] for i in filtered]
        metadata = await _batch_get_article_categories(article_ids)

        # Build response — metadata lookup is lightweight (just category)
        # Full metadata fetched below
        table = _get_articles_table()
        dynamodb = boto3.resource('dynamodb', region_name=settings.region)
        table_name = settings.dynamodb_table_articles

        meta_items = {}
        for batch_start in range(0, len(article_ids), 100):
            batch = article_ids[batch_start:batch_start+100]
            keys = [{'news_id': aid} for aid in batch]
            try:
                resp = dynamodb.batch_get_item(RequestItems={
                    table_name: {'Keys': keys, 'ProjectionExpression': 'news_id,title_ko,category,published_at,byline,images'}
                })
                for item in resp.get('Responses', {}).get(table_name, []):
                    meta_items[item['news_id']] = item
            except Exception:
                pass

        results = []
        for item in filtered:
            aid = item['article_id']
            meta = meta_items.get(aid, {})
            results.append({
                'news_id': aid,
                'title': meta.get('title_ko', ''),
                'category': meta.get('category', ''),
                'published_at': meta.get('published_at', ''),
                'image_url': _extract_image(meta),
                'byline': meta.get('byline', '서울경제'),
                '_score': round(item['score'] * 100, 2),
                '_source': 'personalize',
            })

        logger.info(f"Personalize returned {len(results)} recommendations for {user_id}")
        return results

    except Exception as e:
        logger.warning(f"Personalize failed (non-fatal): {e}")
        return None


# ── Collaborative filtering ─────────────────────────────────────────────────

async def _try_collaborative_recommendations(
    user_id: str,
    mbti_group: str,
    read_id_set: set,
    limit: int,
) -> List[Dict[str, Any]]:
    """Get recommendations from MBTI-based collaborative filtering."""
    try:
        from services.collaborative_filter_service import get_collaborative_filter_service

        service = get_collaborative_filter_service()
        return await service.get_collaborative_recommendations(
            user_id=user_id,
            mbti_group=mbti_group,
            read_ids=read_id_set,
            limit=limit,
        )
    except Exception as e:
        logger.warning(f"Collaborative filter failed (non-fatal): {e}")
        return []


# ── Route: recommendations ───────────────────────────────────────────────────

async def _handle_recommend(params: Dict[str, str]) -> Dict:
    """
    GET /api/recommend?user_id={id}&limit=10

    Multi-strategy recommendation:
      1. Amazon Personalize (if campaign configured)
      2. MBTI collaborative filtering ("users like you")
      3. Category-based interest matching
      4. pgvector similarity (archived sentences)
      5. Cold start (recent popular articles)
    """
    user_id = params.get('user_id', '').strip()
    if not user_id:
        return _error(400, 'user_id is required')

    limit = min(int(params.get('limit', '10')), 50)

    repo = get_personal_repository()

    # Get user profile for MBTI group
    profile = await repo.get_user_profile(user_id)
    mbti_group = profile.mbti_group if profile else 'SF'

    # Get reading history
    history = await repo.list_reading_history(user_id=user_id, limit=100)

    if not history:
        # Cold start: recent articles from top categories
        articles = await _fetch_recent_articles_by_categories(
            categories=CATEGORIES_KOREAN[:4],
            days=3,
            per_category=limit,
        )
        return _success({
            'recommendations': articles[:limit],
            'count': min(len(articles), limit),
            'strategy': 'cold_start',
            'recommendation_source': 'cold_start',
            'user_id': user_id,
        })

    read_ids = [r.article_id for r in history]
    read_id_set = set(read_ids)

    # ── Strategy 1: Personalize ──────────────────────────────────────
    personalize_results = await _try_personalize_recommendations(
        user_id, mbti_group, read_id_set, limit,
    )

    if personalize_results:
        return _success({
            'recommendations': personalize_results[:limit],
            'count': len(personalize_results[:limit]),
            'strategy': 'personalized',
            'recommendation_source': 'personalize',
            'mbti_group': mbti_group,
            'user_id': user_id,
        })

    # ── Strategy 2: Collaborative filtering ──────────────────────────
    collaborative_results = await _try_collaborative_recommendations(
        user_id, mbti_group, read_id_set, limit,
    )

    # ── Strategy 3: Category-based interest matching ─────────────────
    categories_map = await _batch_get_article_categories(read_ids)

    category_counts: Dict[str, int] = defaultdict(int)
    for record in history:
        cat = categories_map.get(record.article_id, '')
        if cat:
            category_counts[cat] += record.read_count

    total_reads = sum(category_counts.values())
    scores = _compute_interest_scores(category_counts, total_reads)
    ranked_categories = _rank_categories(scores)

    if not ranked_categories:
        ranked_categories = CATEGORIES_KOREAN[:3]

    category_articles = await _fetch_recent_articles_by_categories(
        categories=ranked_categories[:5],
        days=7,
        per_category=limit,
        exclude_ids=read_id_set,
    )

    # ── Strategy 4: pgvector similarity ──────────────────────────────
    similarity_articles = await _similarity_recommendations(user_id, limit=5)

    # ── Merge all sources ────────────────────────────────────────────
    scored: Dict[str, Tuple[float, Dict[str, Any]]] = {}

    # Collaborative results get highest base score (trusted signal)
    for idx, art in enumerate(collaborative_results):
        nid = art['news_id']
        score = art.get('_score', 50) + 30  # collaborative bonus
        art['_score'] = round(score, 2)
        if nid not in scored or scored[nid][0] < score:
            scored[nid] = (score, art)

    # Category-based results
    for idx, art in enumerate(category_articles):
        nid = art['news_id']
        cat = art.get('category', '')
        dna_key = CATEGORY_TO_DNA_KEY.get(cat, '')
        cat_score = scores.get(dna_key, 10)
        position_decay = 1.0 / (1 + idx * 0.1)
        score = cat_score * position_decay

        if nid not in scored or scored[nid][0] < score:
            art['_score'] = round(score, 2)
            art['_source'] = 'category'
            scored[nid] = (score, art)

    # Similarity results
    for sa in similarity_articles:
        nid = sa.get('news_id', '')
        if nid and nid not in read_id_set:
            distance = sa.get('distance', 1.0)
            sim_score = max(0, (1 - distance) * 80) + 20
            existing_score = scored.get(nid, (0,))[0]

            if sim_score > existing_score:
                art = {
                    'news_id': nid,
                    'title': sa.get('chunk_text', '')[:80],
                    'category': '',
                    'published_at': sa.get('created_at', ''),
                    '_score': round(sim_score, 2),
                    '_source': 'similarity',
                }
                scored[nid] = (sim_score, art)

    ranked = sorted(scored.values(), key=lambda x: x[0], reverse=True)
    recommendations = [art for _, art in ranked[:limit]]

    # Determine primary source
    has_collaborative = any(r.get('_source') == 'collaborative' for r in recommendations)
    source = 'collaborative' if has_collaborative else 'rule_based'

    return _success({
        'recommendations': recommendations,
        'count': len(recommendations),
        'strategy': 'personalized',
        'recommendation_source': source,
        'interest_categories': ranked_categories[:5],
        'mbti_group': mbti_group,
        'user_id': user_id,
    })


# ── Route: analysis ──────────────────────────────────────────────────────────

async def _handle_analysis(params: Dict[str, str]) -> Dict:
    """
    GET /api/recommend/analysis?user_id={id}

    Returns reading pattern analysis formatted for the 뉴스 DNA radar chart.
    """
    user_id = params.get('user_id', '').strip()
    if not user_id:
        return _error(400, 'user_id is required')

    repo = get_personal_repository()

    # Fetch full reading history
    history = await repo.list_reading_history(user_id=user_id, limit=200)

    if not history:
        return _success({
            'interest_scores': {k: 0 for k in DNA_KEYS},
            'total_articles_read': 0,
            'category_breakdown': {},
            'reading_streak': 0,
            'mbti_group_distribution': {},
            'user_id': user_id,
        })

    # Look up categories
    read_ids = [r.article_id for r in history]
    categories_map = await _batch_get_article_categories(read_ids)

    # Aggregate by category
    category_counts: Dict[str, int] = defaultdict(int)
    for record in history:
        cat = categories_map.get(record.article_id, '')
        if cat:
            category_counts[cat] += record.read_count

    total_reads = sum(r.read_count for r in history)

    # Interest scores
    scores = _compute_interest_scores(category_counts, total_reads)

    # Category breakdown (Korean names, raw counts)
    breakdown = {cat: count for cat, count in category_counts.items() if count > 0}

    # Reading streak (consecutive days with reads)
    streak = _calculate_streak(history)

    # Fetch user profile for MBTI group
    profile = await repo.get_user_profile(user_id)
    mbti_group = profile.mbti_group if profile else 'SF'

    # MBTI group reading distribution (if we have version data — placeholder)
    # For now, just return the user's current group
    mbti_dist = {mbti_group: total_reads}

    return _success({
        'interest_scores': scores,
        'total_articles_read': total_reads,
        'unique_articles': len(set(read_ids)),
        'category_breakdown': breakdown,
        'top_categories': _rank_categories(scores)[:3],
        'reading_streak': streak,
        'mbti_group': mbti_group,
        'mbti_group_distribution': mbti_dist,
        'user_id': user_id,
    })


def _calculate_streak(history: List[ReadingRecord]) -> int:
    """Calculate consecutive days with at least one read."""
    if not history:
        return 0

    read_dates = set()
    for r in history:
        if r.read_at:
            read_dates.add(r.read_at[:10])

    today = datetime.now(KST).strftime('%Y-%m-%d')
    streak = 0
    check_date = datetime.now(KST)

    for _ in range(365):
        date_str = check_date.strftime('%Y-%m-%d')
        if date_str in read_dates:
            streak += 1
        else:
            break
        check_date -= timedelta(days=1)

    return streak


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
            'error': {'code': 'RECOMMEND_ERROR', 'message': message}
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
    return method, path, params


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """
    Recommendation API Lambda handler.

    Routes:
      GET /api/recommend             — Personalized recommendations
      GET /api/recommend/analysis    — Reading pattern analysis (뉴스 DNA)
    """
    method, path, params = _parse_event(event)

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    logger.info(f"Recommend request: {method} {path}")

    if method != 'GET':
        return _error(405, 'Method not allowed')

    if '/analysis' in path:
        return await _handle_analysis(params)

    return await _handle_recommend(params)
