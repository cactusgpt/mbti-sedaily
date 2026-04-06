"""
News Briefing Generator Service
Generates MBTI-styled daily news briefings from collected articles.
Called after article_collector finishes to cache briefings for the chatbot.
"""
import json
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta

import boto3
from botocore.config import Config

from config.constants import (
    BEDROCK_MODEL_ID_HAIKU,
    MBTI_GROUPS,
    ALL_CATEGORIES,
)

logger = logging.getLogger(__name__)

BEDROCK_CONFIG = Config(
    read_timeout=120,
    connect_timeout=30,
    retries={'max_attempts': 3}
)

BRIEFING_SYSTEM_PROMPT = """당신은 서울경제신문의 뉴스 브리핑 생성 AI입니다.
주어진 기사 목록을 바탕으로 4가지 MBTI 그룹(NT, NF, ST, SF)에 맞춘 오늘의 뉴스 브리핑을 생성하세요.

각 브리핑은 300~500자 내외로, 모든 카테고리의 핵심 뉴스를 포함해야 합니다.

MBTI 그룹별 톤:
- NT (시현): 논리적, 분석적, 핵심 데이터 중심, 간결한 구조화
- NF (지원): 성찰적, 의미 중심, 사회적 맥락과 가치 강조
- ST (정훈): 정확, 팩트 중심, 체계적 정리, 출처 명시
- SF (하은): 친근, 쉬운 설명, 실생활 연결, 공감적 톤

반드시 아래 JSON 형식으로만 응답하세요:
{
  "briefing_NT": "...",
  "briefing_NF": "...",
  "briefing_ST": "...",
  "briefing_SF": "..."
}"""


class BriefingGenerator:
    """Generates cached news briefings for the chatbot."""

    def __init__(self, region: str = 'us-east-1'):
        self.client = boto3.client(
            'bedrock-runtime',
            region_name=region,
            config=BEDROCK_CONFIG,
        )

    def _build_articles_context(self, articles: List[Dict[str, Any]]) -> str:
        """Build article context grouped by category."""
        by_category: Dict[str, List[Dict]] = {}
        for article in articles:
            cat = article.get('category', '기타')
            by_category.setdefault(cat, []).append(article)

        lines = []
        for cat in ALL_CATEGORIES:
            cat_articles = by_category.get(cat, [])
            if not cat_articles:
                continue
            lines.append(f"\n## {cat}")
            for i, a in enumerate(cat_articles, 1):
                title = a.get('title_ko', '')
                # Extract key_points from any available MBTI version
                key_points = []
                for group in MBTI_GROUPS:
                    version = a.get(f'version_{group}', {})
                    if isinstance(version, dict) and version.get('key_points'):
                        key_points = version['key_points']
                        break
                kp_str = ' / '.join(key_points[:3]) if key_points else ''
                lines.append(f"{i}. {title}")
                if kp_str:
                    lines.append(f"   핵심: {kp_str}")

        return '\n'.join(lines)

    async def generate_briefing(self, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate 4 MBTI-styled briefings from the given articles.

        Args:
            articles: List of article dicts from DynamoDB (with version_NT etc.)

        Returns:
            Dict with briefing_NT, briefing_NF, briefing_ST, briefing_SF,
            plus metadata (generated_at, articles_count, source_articles, etc.)
        """
        kst = timezone(timedelta(hours=9))
        now_kst = datetime.now(kst)

        context = self._build_articles_context(articles)

        user_message = f"오늘 날짜: {now_kst.strftime('%Y년 %m월 %d일')}\n\n[수집된 기사 목록]{context}"

        request_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2048,
            "system": [
                {
                    "type": "text",
                    "text": BRIEFING_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": [
                {"role": "user", "content": user_message}
            ],
        })

        logger.info(f"Generating news briefing from {len(articles)} articles")

        response = self.client.invoke_model(
            modelId=BEDROCK_MODEL_ID_HAIKU,
            contentType="application/json",
            accept="application/json",
            body=request_body,
        )

        response_body = json.loads(response['body'].read())
        raw_text = response_body.get('content', [{}])[0].get('text', '{}')

        # Parse JSON from response (handle markdown code blocks)
        cleaned = raw_text.strip()
        if cleaned.startswith('```'):
            cleaned = cleaned.split('\n', 1)[-1].rsplit('```', 1)[0].strip()

        briefings = json.loads(cleaned)

        # Build source article references
        source_articles = []
        for a in articles:
            source_articles.append({
                'news_id': a.get('news_id', ''),
                'title': a.get('title_ko', '')[:80],
                'category': a.get('category', ''),
            })

        # Collect categories covered
        categories_covered = list(set(a.get('category', '') for a in articles if a.get('category')))

        usage = response_body.get('usage', {})

        result = {
            'briefing_NT': briefings.get('briefing_NT', ''),
            'briefing_NF': briefings.get('briefing_NF', ''),
            'briefing_ST': briefings.get('briefing_ST', ''),
            'briefing_SF': briefings.get('briefing_SF', ''),
            'generated_at': now_kst.isoformat(),
            'date': now_kst.strftime('%Y-%m-%d'),
            'articles_count': len(articles),
            'source_articles': source_articles,
            'categories_covered': categories_covered,
            'generation_usage': {
                'input_tokens': usage.get('input_tokens', 0),
                'output_tokens': usage.get('output_tokens', 0),
            },
        }

        logger.info(
            f"News briefing generated: {len(articles)} articles, "
            f"{len(categories_covered)} categories, "
            f"tokens: {usage.get('input_tokens', 0)}+{usage.get('output_tokens', 0)}"
        )

        return result
