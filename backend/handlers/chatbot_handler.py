"""
MBTI Chatbot Handler Lambda Function
Provides AI-powered chat responses styled for each MBTI group (NT, NF, ST, SF).
Uses Claude API via AWS Bedrock.

RAG Pipeline:
  1. User message → Bedrock Titan Embeddings (embed query)
  2. Embedding → OpenSearch hybrid search (text BM25 + kNN vector)
  3. Top 5 results → context for Claude response generation
  4. Fallback: if OpenSearch unavailable → DynamoDB GSI recent articles

Persona system: 시현(NT), 지원(NF), 정훈(ST), 하은(SF)
"""
import logging
import boto3
import json
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

from config import settings
from config.constants import (
    MBTI_GROUPS,
    MBTI_GROUP_INFO,
    CORS_HEADERS,
    BEDROCK_MODEL_ID_HAIKU,
    DYNAMODB_TABLE_ARTICLES_DEV,
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Bedrock client (reused across invocations for Lambda warm starts)
bedrock_client = None

def get_bedrock_client():
    """Get or create Bedrock client"""
    global bedrock_client
    if bedrock_client is None:
        bedrock_client = boto3.client('bedrock-runtime', region_name='us-east-1')
    return bedrock_client


# MBTI 그룹별 시스템 프롬프트 — prompts/chatbot/{group}.md 에서 로드
def _load_chatbot_prompt(group: str) -> str:
    prompt_path = os.path.join(os.path.dirname(__file__), '..', 'prompts', 'chatbot', f'{group.lower()}.md')
    try:
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        logger.warning(f"Chatbot prompt file not found: {prompt_path}")
        return f"당신은 서울경제신문의 AI 에디터입니다. {group} 스타일로 답변하세요."

MBTI_SYSTEM_PROMPTS = {g: _load_chatbot_prompt(g) for g in MBTI_GROUPS}


# ── Article context retrieval ────────────────────────────────────────────────

def _get_opensearch():
    """Create OpenSearch client if configured. Returns None otherwise."""
    if not settings.opensearch_endpoint:
        return None
    try:
        from clients.opensearch_client import OpenSearchClient
        return OpenSearchClient(
            endpoint=settings.opensearch_endpoint,
            index_name=settings.opensearch_index,
            region=settings.region,
        )
    except Exception as e:
        logger.warning(f"Failed to init OpenSearch client: {e}")
        return None


def _get_embedding_client():
    """Create embedding client. Returns None on import failure."""
    try:
        from clients.embedding_client import EmbeddingClient
        return EmbeddingClient()
    except Exception as e:
        logger.warning(f"Failed to init EmbeddingClient: {e}")
        return None


def _fetch_context_rag(
    user_message: str,
    mbti_group: str,
    limit: int = 5,
) -> Optional[List[Dict[str, Any]]]:
    """
    RAG context retrieval via OpenSearch hybrid search.

    1. Embed the user message
    2. Hybrid search (text BM25 + kNN vector, weighted 0.3/0.7)
    3. Filter to MBTI group if available
    4. Return top results

    Returns None if OpenSearch or embedding is unavailable (triggers fallback).
    """
    os_client = _get_opensearch()
    if not os_client:
        return None

    embed_client = _get_embedding_client()
    if not embed_client:
        return None

    try:
        embedding = embed_client.embed_text(user_message)

        filters: Dict[str, Any] = {}
        if mbti_group:
            filters['mbti_group'] = mbti_group

        hits = os_client.hybrid_search(
            query=user_message,
            embedding=embedding,
            filters=filters if filters else None,
            size=limit,
            text_weight=0.3,
            vector_weight=0.7,
        )

        if hits:
            logger.info(f"RAG context: {len(hits)} articles from OpenSearch hybrid search")
            return hits

        # If no results with MBTI filter, retry without it
        if mbti_group:
            hits = os_client.hybrid_search(
                query=user_message,
                embedding=embedding,
                size=limit,
            )
            if hits:
                logger.info(f"RAG context: {len(hits)} articles (no MBTI filter)")
                return hits

        return None

    except Exception as e:
        logger.warning(f"RAG context retrieval failed: {e}")
        return None


def get_recent_articles_dynamodb(limit: int = 5) -> List[Dict[str, Any]]:
    """
    Fallback: fetch recent articles from DynamoDB GSI.
    Used when OpenSearch is unavailable.
    """
    try:
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.Table(DYNAMODB_TABLE_ARTICLES_DEV)

        from boto3.dynamodb.conditions import Key
        response = table.query(
            IndexName='category-published_at-index',
            KeyConditionExpression=Key('category').eq('경제'),
            ScanIndexForward=False,
            Limit=limit
        )

        articles = []
        for item in response.get('Items', []):
            articles.append({
                'news_id': item.get('news_id'),
                'title': item.get('title_ko', ''),
                'category': item.get('category', ''),
                'published_at': item.get('published_at', ''),
            })

        return articles
    except Exception as e:
        logger.warning(f"Failed to fetch recent articles from DynamoDB: {e}")
        return []


def build_context_prompt(articles: List[Dict[str, Any]], source: str) -> str:
    """Build context about news for the chatbot."""
    if not articles:
        return ""

    context = f"\n\n[최근 관련 뉴스 컨텍스트 — {source}]\n"
    for i, article in enumerate(articles[:5], 1):
        title = article.get('title') or article.get('title_ko', '')
        category = article.get('category', '')
        published = article.get('published_at', '')[:10]

        # Include body snippet if available (from OpenSearch)
        body = article.get('body_text', '')
        snippet = f" | {body[:100]}..." if body else ""

        context += f"{i}. {title} ({category}, {published}){snippet}\n"

    return context


# ── Chat response generation ────────────────────────────────────────────────

async def generate_chat_response(
    user_message: str,
    mbti_group: str,
    conversation_history: List[Dict[str, str]],
    context_articles: List[Dict[str, Any]],
    context_source: str,
) -> str:
    """
    Generate chat response using Claude API via Bedrock.

    Args:
        user_message: User's input message
        mbti_group: MBTI group (NT, NF, ST, SF)
        conversation_history: Previous messages in the conversation
        context_articles: Articles for RAG context
        context_source: 'opensearch_rag' or 'dynamodb_fallback'

    Returns:
        AI-generated response text
    """
    client = get_bedrock_client()

    # Build system prompt
    system_prompt = MBTI_SYSTEM_PROMPTS.get(mbti_group, MBTI_SYSTEM_PROMPTS['SF'])

    # Add RAG context
    system_prompt += build_context_prompt(context_articles, context_source)

    # Add general instructions
    system_prompt += """

[중요 지침]
1. 서울경제신문의 AI 어시스턴트로서 경제/금융 뉴스에 대해 도움을 드려요
2. 정확한 정보만 제공하고, 모르는 것은 모른다고 솔직히 말해요
3. 위의 뉴스 컨텍스트를 활용하여 구체적이고 관련성 높은 답변을 해요
4. 응답은 간결하게 (200자 내외), 필요시 더 자세히 설명해요
5. 한국어로 자연스럽게 대화해요
6. 투자 조언이나 추천은 하지 않아요 (면책)
"""

    # Build messages for Claude
    messages = []

    # Add conversation history (last 6 messages max for context)
    for msg in conversation_history[-6:]:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })

    # Add current user message
    messages.append({
        "role": "user",
        "content": user_message
    })

    try:
        # Call Claude via Bedrock with prompt caching
        request_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "system": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"}
                }
            ],
            "messages": messages
        })

        response = client.invoke_model(
            modelId=BEDROCK_MODEL_ID_HAIKU,
            contentType="application/json",
            accept="application/json",
            body=request_body
        )

        response_body = json.loads(response['body'].read())

        if response_body.get("content") and len(response_body["content"]) > 0:
            return response_body["content"][0].get("text", "")
        else:
            return "죄송해요, 응답을 생성하지 못했어요. 다시 시도해주세요."

    except Exception as e:
        logger.error(f"Bedrock API error: {e}")
        raise


# ── Lambda handler ───────────────────────────────────────────────────────────

def lambda_handler(event: dict, context) -> dict:
    """
    Lambda handler for chatbot API.

    Expected request body:
    {
        "message": "사용자 메시지",
        "mbti_group": "NT" | "NF" | "ST" | "SF",
        "conversation_history": [
            {"role": "user", "content": "이전 메시지"},
            {"role": "assistant", "content": "이전 응답"}
        ]
    }

    Response:
    {
        "response": "AI 응답 텍스트",
        "mbti_group": "NT",
        "persona": { "name": "시현", "role": "전략분석팀 수석연구원", "emoji": "📊" },
        "context_source": "opensearch_rag" | "dynamodb_fallback"
    }
    """
    try:
        # Support both HTTP API v2 and REST API v1 event formats
        request_context = event.get('requestContext', {})

        # HTTP API v2 format
        if 'http' in request_context:
            http_method = request_context['http'].get('method', 'GET')
        else:
            # REST API v1 format
            http_method = event.get('httpMethod', 'GET')

        # Handle CORS preflight
        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': ''
            }

        # Parse request body (handle base64 encoding for HTTP API v2)
        import base64
        body = event.get('body', '{}')
        is_base64 = event.get('isBase64Encoded', False)

        if body and is_base64:
            body = base64.b64decode(body).decode('utf-8')

        if isinstance(body, str) and body:
            body = json.loads(body)
        elif not body:
            body = {}

        user_message = body.get('message', '').strip()
        mbti_group = body.get('mbti_group', 'SF').upper()
        conversation_history = body.get('conversation_history', [])

        # Validate inputs
        if not user_message:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'error': {
                        'code': 'INVALID_REQUEST',
                        'message': '메시지를 입력해주세요.'
                    }
                })
            }

        if mbti_group not in MBTI_GROUPS:
            mbti_group = 'SF'

        logger.info(f"Chat request: group={mbti_group}, message_length={len(user_message)}")

        # ── RAG context retrieval with fallback ──────────────────────────

        context_source = 'opensearch_rag'
        context_articles = _fetch_context_rag(user_message, mbti_group, limit=5)

        if context_articles is None:
            # Fallback to DynamoDB
            context_source = 'dynamodb_fallback'
            context_articles = get_recent_articles_dynamodb(5)
            logger.info("Using DynamoDB fallback for chatbot context")

        # ── Generate response ────────────────────────────────────────────

        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            response_text = loop.run_until_complete(
                generate_chat_response(
                    user_message=user_message,
                    mbti_group=mbti_group,
                    conversation_history=conversation_history,
                    context_articles=context_articles,
                    context_source=context_source,
                )
            )
        finally:
            loop.close()

        # Build persona info
        persona_map = {
            'NT': {'name': '시현', 'role': '전략분석팀 수석연구원', 'emoji': '📊'},
            'NF': {'name': '지원', 'role': '오피니언팀 논설위원', 'emoji': '💡'},
            'ST': {'name': '정훈', 'role': '팩트체크 에디터', 'emoji': '📋'},
            'SF': {'name': '하은', 'role': 'MZ 독자 담당 에디터', 'emoji': '💬'},
        }

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'response': response_text,
                'mbti_group': mbti_group,
                'persona': persona_map.get(mbti_group, persona_map['SF']),
                'context_source': context_source,
                'timestamp': datetime.now().isoformat()
            }, ensure_ascii=False)
        }

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'error': {
                    'code': 'INVALID_JSON',
                    'message': '잘못된 요청 형식입니다.'
                }
            })
        }

    except Exception as e:
        logger.error(f"Chatbot error: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'error': {
                    'code': 'INTERNAL_ERROR',
                    'message': '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                }
            })
        }
