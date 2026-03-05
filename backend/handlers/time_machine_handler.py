"""
Time Machine Handler
날짜별 서울경제 아카이브 뉴스를 크롤링하여 반환합니다.

Flow:
  1. DynamoDB 캐시 확인 (같은 날짜 재요청 시 스킵)
  2. sedaily.com/newsArchive/YYYY/MM/DD 크롤링 → 기사 목록 수집
  3. 제목 키워드로 카테고리 추론
  4. DynamoDB에 캐싱 후 반환

GET /time-machine?date=YYYY-MM-DD
Response: { "news": [{ "title", "category", "url" }] }
"""
import logging
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

import boto3
import requests

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; SedailyBot/1.0)"}

# ─── 카테고리 키워드 추론 ────────────────────────────────────────────────────
# 순서가 중요 — 앞에 있을수록 우선순위 높음

CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("IT", [
        # 기존
        "인터넷", "컴퓨터", "소프트웨어", "반도체", "디지털", "사이버",
        "IT", "AI", "인공지능", "스마트폰", "앱", "플랫폼", "데이터", "클라우드",
        "전자", "휴대폰", "게임", "포털", "벤처", "이동통신", "5G", "4G",
        "스마트", "빅데이터", "블록체인", "핀테크", "로봇", "드론",
        # 보강: 생성형 AI / LLM 계열
        "챗GPT", "오픈AI", "LLM", "생성형", "거대언어모델", "GPU", "HBM",
        # 보강: 국내 플랫폼 기업명 (제목에 직접 노출)
        "네이버", "카카오", "쿠팡", "배달의민족", "당근", "토스", "라인",
        # 보강: 디지털 전환 / 산업 기술
        "자율주행", "전기차", "모빌리티", "디지털전환", "DX", "SaaS",
        "IoT", "사물인터넷", "엣지컴퓨팅", "양자컴퓨터", "사이버보안",
        # 보강: 콘텐츠·미디어 IT
        "OTT", "스트리밍", "메타버스", "NFT", "웹툰", "구독",
        # 보강: 스타트업 / 투자
        "유니콘", "스타트업", "VC", "액셀러레이터",
    ]),

    ("국제", [
        # 기존
        "미국", "중국", "일본", "유럽", "UN", "러시아", "영국", "독일",
        "프랑스", "중동", "아시아", "글로벌", "해외", "외신",
        "달러", "엔화", "위안", "IMF", "WTO", "OECD", "G7", "G20",
        "북미", "남미", "아프리카", "호주", "캐나다", "이스라엘",
        # 보강: 지역·국가 보완
        "대만", "인도", "베트남", "사우디", "이란", "우크라이나", "폴란드",
        "동남아", "유로존", "아세안", "ASEAN", "APEC", "NATO",
        # 보강: 통상·무역 갈등 (제목 빈출)
        "관세", "제재", "수출규제", "무역전쟁", "공급망", "디커플링",
        "리쇼어링", "프렌드쇼어링", "반도체규제",
        # 보강: 국제 이슈 동사·명사
        "분쟁", "전쟁", "협정", "조약", "정상회담", "외교전",
        "지정학", "난민", "기후협약", "파리협정",
        # 보강: 통화·금융 국제
        "달러인덱스", "유로화", "파운드", "연준", "Fed", "ECB",
    ]),

    ("정치", [
        # 기존
        "대통령", "국회", "청와대", "총리", "의원", "정당", "여당", "야당",
        "선거", "국정", "안보", "통일", "북한", "외교", "장관", "정부",
        "국무", "행정부", "헌법", "탄핵", "개헌", "여야",
        # 보강: 정당명 (제목에 직접 등장)
        "민주당", "국민의힘", "개혁신당", "조국혁신당",
        # 보강: 국회 프로세스
        "국정감사", "국감", "예산안", "법안", "청문회", "인사청문회",
        "필리버스터", "본회의", "상임위",
        # 보강: 사법·정치 교차
        "특검", "검찰개혁", "공수처", "수사", "기소",
        # 보강: 권력 구조
        "차관", "내각", "임명", "사퇴", "경질", "계엄", "비상계엄",
        # 보강: 선거 관련
        "총선", "대선", "지방선거", "공천", "출마", "지지율",
    ]),

    ("사회", [
        # 기존
        "사망", "사고", "경찰", "법원", "교육", "환경", "복지", "의료",
        "병원", "학교", "범죄", "재판", "노동", "고용", "인구", "화재",
        "지진", "태풍", "홍수", "파업", "시위", "집회", "검찰", "수사",
        # 보강: 의료·보건 (빈출)
        "의대", "전공의", "간호사", "의사", "건강보험", "약가",
        "감염병", "코로나", "백신", "보건",
        # 보강: 인구·가족
        "저출산", "고령화", "출산율", "다문화", "1인가구",
        # 보강: 노동·고용 심화
        "최저임금", "주52시간", "산재", "직장갑질", "비정규직", "플랫폼노동",
        # 보강: 교육
        "수능", "입시", "대학", "사교육", "학교폭력",
        # 보강: 사회 안전
        "마약", "음주운전", "보이스피싱", "성범죄", "스토킹",
        # 보강: 기후·재난
        "폭염", "한파", "산불", "미세먼지", "탄소중립",
    ]),

    ("문화", [
        # 기존
        "영화", "음악", "전시", "공연", "스포츠", "축구", "야구", "올림픽",
        "문화", "예술", "방송", "드라마", "연예", "책", "출판", "골프",
        "농구", "배구", "테니스", "월드컵", "아시안게임", "콘서트",
        # 보강: K콘텐츠 한류
        "K팝", "K콘텐츠", "K드라마", "한류", "아이돌", "BTS", "블랙핑크",
        # 보강: 플랫폼·미디어 (문화 맥락)
        "넷플릭스", "디즈니플러스", "유튜브", "틱톡", "인플루언서",
        # 보강: 장르·형식
        "뮤지컬", "웹툰", "웹소설", "게임", "e스포츠",
        # 보강: 스포츠 심화
        "손흥민", "류현진", "프로야구", "K리그", "NBA", "EPL", "UFC",
        "마라톤", "수영", "빙상", "스키", "태권도",
        # 보강: 문화기관
        "미술관", "박물관", "갤러리", "도서관",
    ]),

    ("경제", [
        # 기존
        "주가", "코스피", "코스닥", "금리", "환율", "GDP", "물가", "은행",
        "증권", "주식", "부동산", "아파트", "금융", "투자", "펀드", "채권",
        "기업", "매출", "영업이익", "상장", "수출", "수입", "무역",
        "경기", "성장률", "실업", "취업", "임금", "세금", "예산",
        # 보강: 통화·금융당국
        "한국은행", "한은", "기준금리", "금통위", "연준", "긴축", "피벗",
        "양적완화", "유동성", "통화정책",
        # 보강: 경제 지표
        "소비자물가", "CPI", "PPI", "경상수지", "무역수지", "외환보유액",
        "잠재성장률", "스태그플레이션", "경기침체", "리세션",
        # 보강: 자본시장
        "IPO", "공모주", "ETF", "리츠", "공매도", "선물", "옵션",
        "사모펀드", "M&A", "인수합병", "지분",
        # 보강: 산업·기업 경제
        "대기업", "중소기업", "중견기업", "소상공인", "자영업",
        "삼성", "SK", "LG", "현대", "롯데", "포스코",  # 제목 직접 노출
        # 보강: 부동산 심화
        "재건축", "재개발", "청약", "전셋값", "집값", "공시가격",
        # 보강: 재정
        "국채", "재정적자", "추경", "세수",
    ]),
]

def infer_category(title: str) -> str:
    """제목 키워드로 카테고리 추론. 매칭 없으면 '경제' (서울경제 기본값)."""
    for category, keywords in CATEGORY_RULES:
        if any(kw in title for kw in keywords):
            return category
    return "경제"


# ─── 크롤러 ──────────────────────────────────────────────────────────────────

def _fetch_page(url: str) -> list[dict]:
    """단일 페이지에서 기사 목록 파싱."""
    from bs4 import BeautifulSoup
    res = requests.get(url, headers=HEADERS, timeout=10)
    res.encoding = "utf-8"
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")
    items = soup.select("ul.article-list li h2.headline a")
    result = []
    for item in items:
        title = item.get_text(strip=True)
        href = item.get("href", "")
        if not title or not href:
            continue
        article_url = f"https://www.sedaily.com{href}" if href.startswith("/") else href
        result.append({"title": title, "category": infer_category(title), "url": article_url})
    return result


def crawl_archive(date: str, limit: int = 10) -> list[dict]:
    """
    sedaily.com/newsArchive/YYYY/MM/DD 크롤링.
    전체 페이지에서 랜덤 샘플링하여 카테고리 다양성 확보.
    """
    import random
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return _crawl_with_regex(date, limit)

    try:
        year, month, day = date.split("-")
        base_url = f"https://www.sedaily.com/newsArchive/{year}/{month}/{day}"

        # 1페이지 먼저 가져오면서 총 페이지 수 파악
        res = requests.get(base_url, headers=HEADERS, timeout=10)
        res.encoding = "utf-8"
        res.raise_for_status()

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(res.text, "html.parser")

        # 총 페이지 수 파악 (페이지네이션 마지막 링크)
        last_page_link = soup.select_one("nav.paging-wrap .page-end a")
        total_pages = 1
        if last_page_link:
            href = last_page_link.get("href", "")
            import re
            m = re.search(r"page=(\d+)", href)
            if m:
                total_pages = int(m.group(1))

        # 1페이지 기사 수집
        all_news = []
        items = soup.select("ul.article-list li h2.headline a")
        for item in items:
            title = item.get_text(strip=True)
            href = item.get("href", "")
            if not title or not href:
                continue
            article_url = f"https://www.sedaily.com{href}" if href.startswith("/") else href
            all_news.append({"title": title, "category": infer_category(title), "url": article_url})

        # 페이지가 여러 개면 랜덤 페이지 추가 수집 (최대 2페이지 더)
        if total_pages > 1:
            extra_pages = random.sample(range(2, total_pages + 1), min(2, total_pages - 1))
            for page in extra_pages:
                try:
                    page_news = _fetch_page(f"{base_url}?page={page}")
                    all_news.extend(page_news)
                except Exception:
                    pass

        if not all_news:
            return []

        # 전체에서 랜덤 샘플링
        return random.sample(all_news, min(limit, len(all_news)))

    except Exception as e:
        logger.error(f"크롤링 실패 ({date}): {e}")
        return []


def _crawl_with_regex(date: str, limit: int = 10) -> list[dict]:
    """BeautifulSoup 없을 때 정규식으로 파싱하는 fallback."""
    import re
    try:
        year, month, day = date.split("-")
        url = f"https://www.sedaily.com/newsArchive/{year}/{month}/{day}"
        res = requests.get(url, headers=HEADERS, timeout=10)
        res.encoding = "utf-8"
        res.raise_for_status()

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
