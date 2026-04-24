"""
MBTI Chatbot Handler Lambda Function
Provides AI-powered chat responses styled for each MBTI group (NT, NF, ST, SF).
Uses Claude API via AWS Bedrock.
"""
import logging
import boto3
import json
import os
from typing import Optional, Dict, Any, List
from datetime import datetime

from config.constants import (
    MBTI_GROUPS,
    MBTI_GROUP_INFO,
    CORS_HEADERS,
    BEDROCK_MODEL_ID_HAIKU,  # Haiku for cost-effective chatbot
    DYNAMODB_TABLE_ARTICLES_DEV,
    NEWS_BRIEFING_ID,
    NEWS_BRIEFING_MAX_AGE_HOURS,
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


# MBTI 그룹별 시스템 프롬프트
MBTI_SYSTEM_PROMPTS = {
    'NT': """당신은 '시현'입니다. 서울경제신문 전략분석팀 수석연구원이에요.

성격 특성:
- 논리적이고 분석적인 사고를 좋아해요
- 핵심을 빠르게 파악하고 구조화해서 설명해요
- 데이터와 근거를 중시해요
- 효율적인 커뮤니케이션을 선호해요

말투 가이드:
- 간결하고 핵심적으로 설명
- "~입니다", "~이에요" 종결어미 사용
- 넘버링이나 구조화된 형태로 정보 제공
- 분석적 관점 제시
- 이모지는 📊, 📈, 💡 정도만 절제해서 사용

예시: "핵심 포인트 3가지로 정리해드릴게요. 첫째, ..."
""",

    'NF': """당신은 '지원'입니다. 서울경제신문 오피니언팀 논설위원이에요.

성격 특성:
- 성찰적이고 의미를 중시해요
- 사람과 가치에 관심이 많아요
- 큰 그림과 맥락을 잘 파악해요
- 공감과 이해를 중요하게 생각해요

말투 가이드:
- 따뜻하고 사려 깊은 어조
- "~이에요", "~해요" 부드러운 종결어미
- 의미와 배경을 함께 설명
- 질문을 통해 생각을 유도
- 이모지는 💡, ✨, 🌱 정도 사용

예시: "이 뉴스가 우리에게 시사하는 바가 있어요. 함께 생각해볼까요?"
""",

    'ST': """당신은 '정훈'입니다. 서울경제신문 팩트체크 에디터예요.

성격 특성:
- 정확하고 체계적인 것을 좋아해요
- 사실과 데이터에 집중해요
- 실용적인 정보를 중시해요
- 신뢰할 수 있는 정보 전달이 중요해요

말투 가이드:
- 명확하고 정확한 표현
- "~입니다", "~습니다" 격식체 사용
- 체크리스트나 표 형태 선호
- 출처와 근거 명시
- 이모지는 📋, ✓, 📌 정도만 사용

예시: "확인된 사실을 정리하면 다음과 같습니다. ✓ 첫째..."
""",

    'SF': """당신은 '하은'입니다. 서울경제신문 MZ 독자 담당 에디터예요.

성격 특성:
- 친근하고 공감을 잘 해요
- 어려운 것도 쉽게 설명해요
- 실생활과 연결해서 이야기해요
- 독자와의 소통을 즐겨요

말투 가이드:
- 친구처럼 편안한 말투
- "~해요", "~거든요", "~예요" 사용
- 비유와 예시를 많이 활용
- 실생활 관련성 강조
- 이모지 자연스럽게 사용 😊💬🎯

예시: "쉽게 말하면요, 이건 우리 월급에 직접 영향을 주는 거예요 😊"
"""
}


def get_cached_briefing(mbti_group: str) -> Optional[str]:
    """Fetch the cached news briefing for the given MBTI group.
    Returns the briefing text if fresh, or None to fall back to article query."""
    try:
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.Table(DYNAMODB_TABLE_ARTICLES_DEV)

        response = table.get_item(Key={'news_id': NEWS_BRIEFING_ID})
        item = response.get('Item')

        if not item:
            return None

        # Check staleness
        generated_at = item.get('generated_at', '')
        if generated_at:
            from datetime import timedelta, timezone
            gen_time = datetime.fromisoformat(generated_at)
            kst = timezone(timedelta(hours=9))
            now = datetime.now(kst)
            # Make gen_time offset-aware if needed
            if gen_time.tzinfo is None:
                gen_time = gen_time.replace(tzinfo=kst)
            age_hours = (now - gen_time).total_seconds() / 3600
            if age_hours > NEWS_BRIEFING_MAX_AGE_HOURS:
                logger.warning(f"Briefing is stale ({age_hours:.1f}h old), falling back to article query")
                return None

        briefing_key = f'briefing_{mbti_group}'
        briefing = item.get(briefing_key)
        if briefing:
            logger.info(f"Using cached briefing for {mbti_group} (generated: {generated_at})")
        return briefing

    except Exception as e:
        logger.warning(f"Failed to fetch cached briefing: {e}")
        return None


def _fetch_article_body(s3_body_uri: str, max_chars: int = 500) -> str:
    """Fetch article body from S3 and return truncated content_ko."""
    try:
        if not s3_body_uri or not s3_body_uri.startswith('s3://'):
            return ''
        parts = s3_body_uri.replace('s3://', '').split('/', 1)
        bucket, key = parts[0], parts[1]
        s3 = boto3.client('s3', region_name='ap-northeast-2')
        resp = s3.get_object(Bucket=bucket, Key=key)
        body = json.loads(resp['Body'].read().decode('utf-8'))
        content = body.get('content_ko', '')
        return content[:max_chars] if content else ''
    except Exception as e:
        logger.warning(f"Failed to fetch article body from S3: {e}")
        return ''


def get_recent_articles(limit: int = 5) -> List[Dict[str, Any]]:
    """Fetch recent articles with body content for context"""
    try:
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.Table(DYNAMODB_TABLE_ARTICLES_DEV)

        # Query recent articles from multiple categories
        from boto3.dynamodb.conditions import Key
        all_items = []
        for cat in ['경제', '정치', '사회', 'IT_과학']:
            try:
                response = table.query(
                    IndexName='category-published_at-index',
                    KeyConditionExpression=Key('category').eq(cat),
                    ScanIndexForward=False,
                    Limit=3
                )
                all_items.extend(response.get('Items', []))
            except Exception:
                continue

        # Sort by published_at descending, take top N
        all_items.sort(key=lambda x: x.get('published_at', ''), reverse=True)
        all_items = all_items[:limit]

        articles = []
        for item in all_items:
            content = _fetch_article_body(item.get('s3_body_uri', ''))
            articles.append({
                'news_id': item.get('news_id'),
                'title': item.get('title_ko', ''),
                'category': item.get('category', ''),
                'published_at': item.get('published_at', ''),
                'content': content,
            })

        return articles
    except Exception as e:
        logger.warning(f"Failed to fetch recent articles: {e}")
        return []


def build_context_prompt(articles: List[Dict[str, Any]], mbti_group: str) -> str:
    """Build context about recent news for the chatbot"""
    if not articles:
        return ""

    context = "\n\n[최근 뉴스 컨텍스트 - 필요시 참조]\n"
    for i, article in enumerate(articles[:5], 1):
        content_preview = article.get('content', '')
        if content_preview:
            context += f"{i}. [{article['category']}] {article['title']} ({article['published_at'][:10]})\n   {content_preview[:200]}\n\n"
        else:
            context += f"{i}. [{article['category']}] {article['title']} ({article['category']}, {article['published_at'][:10]})\n"

    return context


KOREAN_STOPWORDS = {
    '은', '는', '이', '가', '을', '를', '에', '의', '로', '으로',
    '와', '과', '도', '만', '부터', '까지', '에서', '한', '된', '하는',
    '있는', '없는', '대한', '위한', '통한', '그', '저', '것', '해줘',
    '수', '등', '및', '또', '더', '좀', '뭐', '어떤', '오늘', '최근',
    '알려줘', '설명해줘', '분석해줘', '추천해줘', '어때', '뭐야',
}


def search_related_articles(user_message: str, limit: int = 3) -> List[Dict[str, Any]]:
    """Search DynamoDB for articles related to the user's message keywords."""
    try:
        keywords = [w for w in user_message.split() if len(w) >= 2 and w not in KOREAN_STOPWORDS][:5]
        if not keywords:
            return []

        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.Table(DYNAMODB_TABLE_ARTICLES_DEV)
        from boto3.dynamodb.conditions import Key, Attr
        from datetime import timedelta, timezone

        kst = timezone(timedelta(hours=9))
        now = datetime.now(kst)
        week_ago = (now - timedelta(days=7)).isoformat()

        all_matches = []
        for cat in ['경제', '정치', '사회', 'IT_과학', '문화']:
            try:
                filter_expr = None
                for kw in keywords:
                    cond = Attr('title_ko').contains(kw)
                    filter_expr = cond if filter_expr is None else (filter_expr | cond)

                response = table.query(
                    IndexName='category-published_at-index',
                    KeyConditionExpression=Key('category').eq(cat) & Key('published_at').gte(week_ago),
                    FilterExpression=filter_expr,
                    ScanIndexForward=False,
                    Limit=20,
                )
                all_matches.extend(response.get('Items', []))
            except Exception:
                continue

        all_matches.sort(key=lambda x: x.get('published_at', ''), reverse=True)

        # Fallback: 키워드 매칭 없고, 광범위한 뉴스 질문일 때만 최신 기사 반환
        BROAD_KEYWORDS = {'뉴스', '기사', '소식', '이슈', '헤드라인', '브리핑', '시장', '경제', '오늘'}
        is_broad = any(bk in user_message for bk in BROAD_KEYWORDS)
        if not all_matches and is_broad:
            for cat in ['경제', '정치', '사회']:
                try:
                    response = table.query(
                        IndexName='category-published_at-index',
                        KeyConditionExpression=Key('category').eq(cat) & Key('published_at').gte(week_ago),
                        ScanIndexForward=False,
                        Limit=2,
                    )
                    all_matches.extend(response.get('Items', []))
                except Exception:
                    continue
            all_matches.sort(key=lambda x: x.get('published_at', ''), reverse=True)

        results = []
        for item in all_matches[:limit]:
            image_url = None
            images = item.get('images', [])
            if images and isinstance(images, list) and len(images) > 0:
                img = images[0]
                image_url = img.get('url', '') if isinstance(img, dict) else str(img)

            results.append({
                'news_id': item.get('news_id', ''),
                'title_ko': item.get('title_ko', ''),
                'category': item.get('category', ''),
                'published_at': item.get('published_at', ''),
                'original_link': item.get('original_link', item.get('url', '')),
                'image_url': image_url,
            })

        return results
    except Exception as e:
        logger.warning(f"Failed to search related articles: {e}")
        return []


def build_context_from_briefing(briefing_text: str) -> str:
    """Build context from pre-generated daily briefing."""
    return f"\n\n[오늘의 뉴스 브리핑 - 대화 시 참조]\n{briefing_text}\n"


# ── Shared helpers ──────────────────────────────────────────────

GENERAL_INSTRUCTIONS = """

[중요 지침]
1. 서울경제신문의 AI 어시스턴트로서 경제/금융 뉴스에 대해 도움을 드려요
2. 정확한 정보만 제공하고, 모르는 것은 모른다고 솔직히 말해요
3. 주가 관련 질문은 반드시 get_stock_price 도구를 사용하세요. 장중에는 실시간 현재가, 장 마감 후에는 종가가 반환됩니다. 도구 없이 수치를 만들어내지 마세요
4. 시장 분석 요청 시, 먼저 get_market_index로 코스피/코스닥 지수를 조회하고, 뉴스에서 언급된 종목의 주가를 get_stock_price로 조회하여 실제 데이터 기반으로 분석해주세요
5. 구체적인 수치, 종목명, 이슈를 포함하여 답변하세요. "변동성 확인 필요", "주목" 같은 모호한 표현은 피하세요
6. 응답은 충분히 상세하게 (300~500자), 핵심 데이터와 근거를 포함해주세요
7. 한국어로 자연스럽게 대화해요
8. 투자 조언이나 추천은 하지 않아요 (면책)
"""

NO_CONTEXT_INSTRUCTIONS = """

[뉴스 컨텍스트 없음]
현재 오늘의 뉴스 브리핑 데이터에 접근할 수 없습니다.
- get_market_index 도구로 코스피/코스닥 실시간 지수를 조회하고, get_stock_price로 주요 종목 주가를 조회하여 실제 데이터 기반으로 답변하세요.
- 뉴스 내용에 대한 질문에는 "현재 뉴스 데이터를 불러올 수 없어서, 시장 데이터 기반으로 답변드릴게요"라고 안내한 뒤 도구를 활용해 답변하세요.
- 절대로 뉴스 내용을 지어내지 마세요.
"""


def _build_full_system_prompt(mbti_group: str, recent_articles=None, cached_briefing=None) -> str:
    """Build complete system prompt with context and instructions."""
    prompt = MBTI_SYSTEM_PROMPTS.get(mbti_group, MBTI_SYSTEM_PROMPTS['SF'])

    if cached_briefing:
        prompt += build_context_from_briefing(cached_briefing)
    elif recent_articles:
        prompt += build_context_prompt(recent_articles, mbti_group)
    else:
        prompt += NO_CONTEXT_INSTRUCTIONS

    prompt += GENERAL_INSTRUCTIONS
    return prompt


def _get_tools() -> list:
    """Return tool definitions for Claude."""
    return [
        {
            "name": "get_stock_price",
            "description": "한국 주식의 실시간 시세를 조회합니다. 장중에는 현재가, 장 마감 후에는 종가를 반환합니다. 종목명(예: 삼성전자) 또는 종목코드(예: 005930)로 검색할 수 있습니다.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "종목명 또는 종목코드 (예: '삼성전자', '005930', 'SK하이닉스')"
                    }
                },
                "required": ["query"]
            }
        },
        {
            "name": "get_market_index",
            "description": "코스피(KOSPI) 또는 코스닥(KOSDAQ) 시장 지수를 조회합니다. 시장 분석 시 반드시 이 도구로 실제 지수를 확인하세요.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "시장 지수명 (예: '코스피', '코스닥', 'KOSPI', 'KOSDAQ')"
                    }
                },
                "required": ["query"]
            }
        }
    ]


def _execute_tool(tool_name: str, tool_input: dict) -> str:
    """Execute a single tool and return result as JSON string."""
    from services.stock_service import lookup_stock, get_market_index

    if tool_name == "get_stock_price":
        query = tool_input.get("query", "")
        stock_data = lookup_stock(query)
        if stock_data:
            return json.dumps({
                "종목명": stock_data["name"],
                "종목코드": stock_data["code"],
                "시장": stock_data["market"],
                "현재가": stock_data["current_price"],
                "전일종가": stock_data["prev_close"],
                "전일대비등락": stock_data["change"],
                "등락률": f"{stock_data['change_percent']}%",
                "방향": stock_data["direction"],
                "장상태": stock_data["market_status"],
                "고가": stock_data.get("high", ""),
                "저가": stock_data.get("low", ""),
                "거래량": stock_data.get("volume", ""),
            }, ensure_ascii=False)
        return json.dumps({"error": f"'{query}' 종목을 찾을 수 없습니다."}, ensure_ascii=False)

    elif tool_name == "get_market_index":
        query = tool_input.get("query", "")
        index_data = get_market_index(query)
        if index_data:
            return json.dumps({
                "지수명": index_data["name"],
                "현재지수": index_data["current_price"],
                "전일대비등락": index_data["change"],
                "등락률": f"{index_data['change_percent']}%",
                "방향": index_data["direction"],
                "장상태": index_data["market_status"],
            }, ensure_ascii=False)
        return json.dumps({"error": f"'{query}' 지수를 찾을 수 없습니다."}, ensure_ascii=False)

    return json.dumps({"error": f"Unknown tool: {tool_name}"}, ensure_ascii=False)


def _build_messages(conversation_history: list, user_message: str) -> list:
    """Build messages array for Claude API."""
    messages = []
    for msg in conversation_history[-6:]:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
    messages.append({"role": "user", "content": user_message})
    return messages


async def generate_chat_response(
    user_message: str,
    mbti_group: str,
    conversation_history: List[Dict[str, str]],
    recent_articles: List[Dict[str, Any]] = None,
    cached_briefing: Optional[str] = None
) -> str:
    """
    Generate chat response using Claude API via Bedrock.

    Args:
        user_message: User's input message
        mbti_group: MBTI group (NT, NF, ST, SF)
        conversation_history: Previous messages in the conversation
        recent_articles: Recent news articles for context (fallback)
        cached_briefing: Pre-generated MBTI-styled briefing text (preferred)

    Returns:
        AI-generated response text
    """
    client = get_bedrock_client()
    system_prompt = _build_full_system_prompt(mbti_group, recent_articles, cached_briefing)
    tools = _get_tools()
    messages = _build_messages(conversation_history, user_message)

    try:
        # Call Claude via Bedrock with tool use support
        request_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2048,
            "system": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"}
                }
            ],
            "tools": tools,
            "messages": messages
        })

        response = client.invoke_model(
            modelId=BEDROCK_MODEL_ID_HAIKU,
            contentType="application/json",
            accept="application/json",
            body=request_body
        )

        response_body = json.loads(response['body'].read())

        # Check if Claude wants to use a tool
        if response_body.get("stop_reason") == "tool_use":
            return await _handle_tool_use(client, system_prompt, tools, messages, response_body)

        # Normal text response — find first text block
        for block in response_body.get("content", []):
            if block.get("type") == "text" and block.get("text"):
                return block["text"]

        return "죄송해요, 응답을 생성하지 못했어요. 다시 시도해주세요."

    except Exception as e:
        logger.error(f"Bedrock API error: {e}")
        raise


async def _handle_tool_use(client, system_prompt: str, tools: list, messages: list, response_body: dict) -> str:
    """Handle Claude's tool use request: execute tool(s) and get final response."""
    max_iterations = 5
    pre_tool_text = []
    current_response = response_body

    for _ in range(max_iterations):
        tool_use_blocks = []
        for block in current_response.get("content", []):
            if block.get("type") == "tool_use":
                tool_use_blocks.append(block)
            elif block.get("type") == "text" and block.get("text"):
                pre_tool_text.append(block["text"])

        if not tool_use_blocks:
            break

        messages.append({"role": "assistant", "content": current_response["content"]})

        tool_results = []
        for tool_block in tool_use_blocks:
            logger.info(f"Tool call: {tool_block['name']}({tool_block.get('input', {})})")
            result = _execute_tool(tool_block["name"], tool_block.get("input", {}))
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_block["id"],
                "content": result,
            })

        messages.append({"role": "user", "content": tool_results})

        request_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2048,
            "system": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
            "tools": tools,
            "messages": messages,
        })

        response = client.invoke_model(
            modelId=BEDROCK_MODEL_ID_HAIKU,
            contentType="application/json",
            accept="application/json",
            body=request_body,
        )
        current_response = json.loads(response['body'].read())

        if current_response.get("stop_reason") != "tool_use":
            for block in current_response.get("content", []):
                if block.get("type") == "text" and block.get("text"):
                    pre_tool_text.append(block["text"])
            break

    return "\n\n".join(pre_tool_text) if pre_tool_text else "죄송해요, 응답을 생성하지 못했어요."


# ── Streaming support ───────────────────────────────────────────

def generate_chat_response_stream(
    user_message: str,
    mbti_group: str,
    conversation_history: list,
    recent_articles: list = None,
    cached_briefing: str = None
):
    """Synchronous generator yielding text chunks from Bedrock streaming API.
    Handles tool use transparently — tools are resolved without streaming,
    then the final text response is streamed to the caller."""
    client = get_bedrock_client()
    system_prompt = _build_full_system_prompt(mbti_group, recent_articles, cached_briefing)
    tools = _get_tools()
    messages = _build_messages(conversation_history, user_message)

    for iteration in range(3):
        request_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2048,
            "system": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
            "tools": tools,
            "messages": messages
        })

        response = client.invoke_model_with_response_stream(
            modelId=BEDROCK_MODEL_ID_HAIKU,
            contentType="application/json",
            accept="application/json",
            body=request_body
        )

        stream = response.get('body')
        content_blocks = []
        tool_blocks = []
        current_tool = None
        current_tool_input = ""

        for event in stream:
            chunk_bytes = event.get('chunk', {}).get('bytes', b'')
            if not chunk_bytes:
                continue
            chunk = json.loads(chunk_bytes)
            event_type = chunk.get('type')

            if event_type == 'content_block_start':
                block = chunk.get('content_block', {})
                if block.get('type') == 'tool_use':
                    current_tool = {"id": block['id'], "name": block['name']}
                    current_tool_input = ""
                elif block.get('type') == 'text':
                    content_blocks.append({"type": "text", "text": ""})

            elif event_type == 'content_block_delta':
                delta = chunk.get('delta', {})
                if delta.get('type') == 'text_delta':
                    text = delta.get('text', '')
                    if text:
                        if content_blocks and content_blocks[-1].get('type') == 'text':
                            content_blocks[-1]['text'] += text
                        yield text
                elif delta.get('type') == 'input_json_delta':
                    current_tool_input += delta.get('partial_json', '')

            elif event_type == 'content_block_stop':
                if current_tool:
                    tool_block = {
                        "type": "tool_use",
                        "id": current_tool['id'],
                        "name": current_tool['name'],
                        "input": json.loads(current_tool_input) if current_tool_input else {}
                    }
                    content_blocks.append(tool_block)
                    tool_blocks.append(tool_block)
                    current_tool = None
                    current_tool_input = ""

        # No tool use — text was already yielded
        if not tool_blocks:
            return

        # Handle tool use, then loop to stream the follow-up
        logger.info(f"Stream: handling {len(tool_blocks)} tool calls (iteration {iteration})")
        messages.append({"role": "assistant", "content": content_blocks})

        tool_results = []
        for tb in tool_blocks:
            result = _execute_tool(tb['name'], tb['input'])
            logger.info(f"Tool {tb['name']} → {result[:100]}")
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tb['id'],
                "content": result
            })
        messages.append({"role": "user", "content": tool_results})

    yield "죄송해요, 응답을 생성하지 못했어요."


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
        "persona": {
            "name": "시현",
            "role": "전략분석팀 수석연구원",
            "emoji": "📊"
        }
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
            mbti_group = 'SF'  # Default fallback

        logger.info(f"Chat request: group={mbti_group}, message_length={len(user_message)}")

        # Try cached briefing first, fall back to article query
        cached_briefing = get_cached_briefing(mbti_group)
        recent_articles = None if cached_briefing else get_recent_articles(5)

        # Generate response (sync wrapper for async function)
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            response_text = loop.run_until_complete(
                generate_chat_response(
                    user_message=user_message,
                    mbti_group=mbti_group,
                    conversation_history=conversation_history,
                    recent_articles=recent_articles,
                    cached_briefing=cached_briefing
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

        # Search related articles based on user message
        related_articles = search_related_articles(user_message, limit=3)

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'response': response_text,
                'mbti_group': mbti_group,
                'persona': persona_map.get(mbti_group, persona_map['SF']),
                'recommended_articles': related_articles,
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
