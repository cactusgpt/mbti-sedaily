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
from handlers.time_machine_handler import get_time_machine_news

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


@app.get("/time-machine")
async def time_machine(date: str):
    """타임머신 날짜별 뉴스 크롤링 엔드포인트"""
    result = get_time_machine_news(date, region=settings.region)
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