"""
Time Machine Handler
날짜별 서울경제 아카이브 뉴스를 크롤링하여 반환합니다.

Flow:
  1. DynamoDB 캐시 확인 (같은 날짜 재요청 시 스킵)
  2. sedaily.com/newsArchive/YYYY/MM/DD 크롤링
  3. 제목 + article_id 파싱, 카테고리 키워드 추론
  4. DynamoDB에 캐싱 후 반환

GET /time-machine?date=YYYY-MM-DD
Response: { "news": [{ "title", "category", "url" }] }
"""
import logging
import asyncio
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

import boto3
import requests
from boto3.dynamodb.conditions import Key

logger = logging.getLogger(__name__)

# ─── 카테고리 키워드 추론 ────────────────────────────────────────────────────

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "IT": ["인터넷", "컴퓨터", "소프트웨어", "반도체", "통신", "디지털", "사이버",
           "IT", "AI", "인공지능", "스마트폰", "앱", "플랫폼", "데이터", "클라우드"],
    "정치": ["대통령", "국회", "정부", "장관", "여당", "야당", "선거", "청와대",
             "총리", "의원", "정당", "국정", "외교", "안보", "통일", "북한"],
    "국제": ["미국", "중국", "일본", "유럽", "UN", "러시아", "영국", "독일",
             "프랑스", "중동", "아시아", "글로벌", "해외", "수입", "수출"],
    "사회": ["사망", "사고", "경찰", "법원", "교육", "환경", "복지", "의료",
             "병원", "학교", "범죄", "재판", "노동", "고용", "인구"],
    "문화": ["영화", "음악", "전시", "공연", "스포츠", "축구", "야구", "올림픽",
             "문화", "예술", "방송", "드라마", "연예", "책", "출판"],
    "경제": ["주가", "코스피", "금리", "환율", "GDP", "물가", "은행", "증권",
             "주식", "부동산", "아파트", "금융", "투자", "펀드", "채권",
             "기업", "매출", "영업이익", "상장", "코스닥"],
}

def infer_category(title: str) -> str:
    """제목 키워드로 카테고리 추론. 매칭 없으면 '경제' (서울경제 기본값)."""
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in title for kw in keywords):
            return category
    return "경제"


# ─── 크롤러 ──────────────────────────────────────────────────────────────────

def crawl_archive(date: str, limit: int = 10) -> list[dict]:
    """
    sedaily.com/newsArchive/YYYY/MM/DD 크롤링.
    BeautifulSoup 없이 간단한 정규식으로 파싱합니다.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        # BeautifulSoup 없을 때 정규식 fallback
        return _crawl_with_regex(date, limit)

    try:
        year, month, day = date.split("-")
        url = f"https://www.sedaily.com/newsArchive/{year}/{month}/{day}"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; SedailyBot/1.0)"}
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        res.encoding = "utf-8"

        soup = BeautifulSoup(res.text, "html.parser")
        items = soup.select("ul.article-list li h2.headline a")

        news = []
        for item in items[:limit]:
            title = item.get_text(strip=True)
            href = item.get("href", "")
            article_url = f"https://www.sedaily.com{href}" if href.startswith("/") else href
            news.append({
                "title": title,
                "category": infer_category(title),
                "url": article_url,
            })
        return news

    except Exception as e:
        logger.error(f"크롤링 실패 ({date}): {e}")
        return []


def _crawl_with_regex(date: str, limit: int = 10) -> list[dict]:
    """BeautifulSoup 없을 때 정규식으로 파싱하는 fallback."""
    import re
    try:
        year, month, day = date.split("-")
        url = f"https://www.sedaily.com/newsArchive/{year}/{month}/{day}"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; SedailyBot/1.0)"}
        res = requests.get(url, headers=headers, timeout=10)
        res.raise_for_status()
        res.encoding = "utf-8"

        # <a href="/article/XXXXXXXX">제목</a> 패턴
        pattern = r'<a href="(/article/[^"]+)">([^<]+)</a>'
        matches = re.findall(pattern, res.text)

        news = []
        for href, title in matches[:limit]:
            title = title.strip()
            if not title:
                continue
            article_url = f"https://www.sedaily.com{href}"
            news.append({
                "title": title,
                "category": infer_category(title),
                "url": article_url,
            })
        return news

    except Exception as e:
        logger.error(f"정규식 크롤링 실패 ({date}): {e}")
        return []


# ─── DynamoDB 캐시 ────────────────────────────────────────────────────────────

CACHE_TABLE = "sedaily-mbti-articles-dev"
CACHE_TTL_DAYS = 30  # 캐시 유효기간


def _get_cache_key(date: str) -> str:
    return f"timemachine_news_{date}"


def get_cached_news(date: str, region: str = "us-east-1") -> Optional[list[dict]]:
    try:
        dynamodb = boto3.resource("dynamodb", region_name=region)
        table = dynamodb.Table(CACHE_TABLE)
        res = table.get_item(Key={"news_id": _get_cache_key(date)})
        item = res.get("Item")
        if item:
            logger.info(f"캐시 히트: {date}")
            return item.get("news_data", [])
    except Exception as e:
        logger.warning(f"캐시 조회 실패: {e}")
    return None


def save_cache(date: str, news: list[dict], region: str = "us-east-1") -> None:
    try:
        kst = timezone(timedelta(hours=9))
        expires_at = (datetime.now(kst) + timedelta(days=CACHE_TTL_DAYS)).isoformat()

        dynamodb = boto3.resource("dynamodb", region_name=region)
        table = dynamodb.Table(CACHE_TABLE)
        table.put_item(Item={
            "news_id": _get_cache_key(date),
            "item_type": "timemachine_cache",
            "date": date,
            "news_data": news,
            "cached_at": datetime.now(kst).isoformat(),
            "expires_at": expires_at,
        })
        logger.info(f"캐시 저장: {date} ({len(news)}건)")
    except Exception as e:
        logger.warning(f"캐시 저장 실패: {e}")


# ─── 메인 핸들러 ──────────────────────────────────────────────────────────────

def get_time_machine_news(date: str, region: str = "us-east-1") -> dict:
    """
    날짜별 뉴스 반환. 캐시 우선, 없으면 크롤링 후 캐싱.

    Args:
        date: YYYY-MM-DD 형식
        region: AWS 리전

    Returns:
        { "news": [...], "cached": bool, "date": str }
    """
    # 날짜 유효성 검사
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return {"error": "날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요."}

    # 캐시 확인
    cached = get_cached_news(date, region)
    if cached is not None:
        return {"news": cached, "cached": True, "date": date}

    # 크롤링
    news = crawl_archive(date, limit=10)

    # 캐싱 (결과가 있을 때만)
    if news:
        save_cache(date, news, region)

    return {"news": news, "cached": False, "date": date}


def lambda_handler(event: dict, context) -> dict:
    """AWS Lambda / API Gateway 핸들러."""
    logger.info(f"time-machine event: {event}")

    try:
        # 쿼리 파라미터에서 date 추출
        params = event.get("queryStringParameters") or {}
        date = params.get("date", "").strip()

        if not date:
            return _response(400, {"error": "date 파라미터가 필요합니다. (YYYY-MM-DD)"})

        from config import settings
        result = get_time_machine_news(date, region=settings.region)

        if "error" in result:
            return _response(400, result)

        return _response(200, result)

    except Exception as e:
        logger.error(f"Lambda 오류: {e}", exc_info=True)
        return _response(500, {"error": "서버 오류가 발생했습니다."})


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }
