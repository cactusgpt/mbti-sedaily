"""
Stock Data Service
Fetches real-time Korean stock data from Naver Finance API.
Used by the chatbot via Claude Tool Use for stock-related queries.
"""
import logging
import json
from typing import Optional, Dict, Any, List
from urllib.request import urlopen, Request
from urllib.parse import quote
from urllib.error import URLError

logger = logging.getLogger(__name__)

NAVER_STOCK_API = "https://m.stock.naver.com/api/stock/{code}/basic"
NAVER_SEARCH_API = "https://ac.stock.naver.com/ac?q={query}&target=stock"
USER_AGENT = "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36"
TIMEOUT = 5


def _fetch_json(url: str) -> Optional[Dict]:
    """Fetch JSON from URL with timeout."""
    try:
        req = Request(url, headers={"User-Agent": USER_AGENT})
        with urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (URLError, json.JSONDecodeError, Exception) as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None


def search_stock(query: str) -> Optional[Dict[str, str]]:
    """
    Search for a stock by name or code.
    Returns the best match: {'code': '005930', 'name': '삼성전자', 'market': '코스피'}
    """
    url = NAVER_SEARCH_API.format(query=quote(query))
    data = _fetch_json(url)

    if not data or not data.get("items"):
        return None

    item = data["items"][0]
    return {
        "code": item["code"],
        "name": item["name"],
        "market": item.get("typeName", ""),
    }


def get_stock_price(code: str) -> Optional[Dict[str, Any]]:
    """
    Get real-time stock price by code.
    Returns structured price data.
    """
    url = NAVER_STOCK_API.format(code=code)
    data = _fetch_json(url)

    if not data or not data.get("closePrice"):
        return None

    compare_info = data.get("compareToPreviousPrice", {})
    direction = compare_info.get("text", "")  # 상승/하락/보합

    return {
        "name": data.get("stockName", ""),
        "code": data.get("itemCode", ""),
        "market": data.get("stockExchangeName", ""),
        "price": data.get("closePrice", ""),
        "change": data.get("compareToPreviousClosePrice", ""),
        "change_percent": data.get("fluctuationsRatio", ""),
        "direction": direction,
        "market_status": data.get("marketStatus", ""),
        "traded_at": data.get("localTradedAt", ""),
    }


def lookup_stock(query: str) -> Optional[Dict[str, Any]]:
    """
    Search + get price in one call.
    Accepts stock name ('삼성전자') or code ('005930').
    """
    # If query looks like a stock code (digits only), use directly
    if query.strip().isdigit():
        code = query.strip()
    else:
        match = search_stock(query)
        if not match:
            return None
        code = match["code"]

    return get_stock_price(code)
