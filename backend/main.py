"""
FastAPI application for Sedaily-MBTI backend
K-Stock Insight MBTI News Style Transformation API
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import uvicorn
from config import settings
from handlers.saju_handler import lambda_handler as saju_handler
from handlers.time_machine_handler import get_time_machine_data
from fastapi.responses import StreamingResponse
from handlers.chatbot_handler import (
    generate_chat_response, generate_chat_response_stream,
    get_cached_briefing, get_recent_articles,
)

app = FastAPI(
    title="Sedaily-MBTI API",
    description="K-Stock Insight MBTI News Style Transformation API",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Sedaily-MBTI API is running", "status": "healthy"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "sedaily-mbti-backend"}

@app.post("/saju")
async def saju(request: Request):
    """사주 분석 엔드포인트"""
    body = await request.body()
    event = {"httpMethod": "POST", "body": body.decode("utf-8"), "isBase64Encoded": False}
    result = saju_handler(event, None)
    content = json.loads(result["body"])
    if result["statusCode"] == 200:
        return content
    return JSONResponse(status_code=result["statusCode"], content=content)


@app.post("/api/chat")
async def chat(request: Request):
    """MBTI 챗봇 엔드포인트"""
    body = await request.json()
    user_message = body.get("message", "").strip()
    mbti_group = body.get("mbti_group", "SF").upper()
    conversation_history = body.get("conversation_history", [])

    if not user_message:
        return JSONResponse(status_code=400, content={"error": "메시지를 입력해주세요."})

    cached_briefing = get_cached_briefing(mbti_group)
    recent_articles = None if cached_briefing else get_recent_articles(5)

    import logging
    logger = logging.getLogger(__name__)
    if cached_briefing:
        logger.info(f"[chat] Using cached briefing for {mbti_group} ({len(cached_briefing)} chars)")
    elif recent_articles:
        logger.info(f"[chat] Using {len(recent_articles)} recent articles as context")
    else:
        logger.warning("[chat] No news context available — briefing and articles both empty")

    response_text = await generate_chat_response(
        user_message=user_message,
        mbti_group=mbti_group,
        conversation_history=conversation_history,
        recent_articles=recent_articles,
        cached_briefing=cached_briefing,
    )

    return {
        "response": response_text,
        "mbti_group": mbti_group,
    }


@app.post("/api/chat/stream")
async def chat_stream(request: Request):
    """MBTI 챗봇 스트리밍 엔드포인트 (SSE)"""
    body = await request.json()
    user_message = body.get("message", "").strip()
    mbti_group = body.get("mbti_group", "SF").upper()
    conversation_history = body.get("conversation_history", [])

    if not user_message:
        return JSONResponse(status_code=400, content={"error": "메시지를 입력해주세요."})

    cached_briefing = get_cached_briefing(mbti_group)
    recent_articles = None if cached_briefing else get_recent_articles(5)

    def event_generator():
        for chunk in generate_chat_response_stream(
            user_message=user_message,
            mbti_group=mbti_group,
            conversation_history=conversation_history,
            recent_articles=recent_articles,
            cached_briefing=cached_briefing,
        ):
            yield f"data: {json.dumps({'type': 'text', 'content': chunk}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/time-machine")
async def time_machine(date: str):
    """타임머신 날짜별 뉴스 크롤링 엔드포인트"""
    result = get_time_machine_data(date, region=settings.region)
    if "error" in result:
        return JSONResponse(status_code=400, content=result)
    return result

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        log_level=settings.log_level.lower()
    )