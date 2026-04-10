"""
Podcast Handler — Audio briefing API
======================================
Generates podcasts from articles: Bedrock script generation → Polly TTS →
S3 audio storage → Podcast DB metadata.

Routes:
  POST /api/podcast/generate            — Generate podcast from article
  GET  /api/podcast/{podcast_id}        — Get podcast details + presigned audio URL
  GET  /api/podcast/list?date=YYYY-MM-DD — List podcasts by date
  GET  /api/podcast/article/{article_id} — List podcasts for an article

Replaces the frontend's Mock audio player (progress simulation only).

Polly Neural (Seoyeon) has a 3000-char limit per call, so long scripts
are split into chunks, synthesised separately, and concatenated.
"""
import base64
import io
import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

import boto3
from botocore.config import Config

from config import settings
from config.constants import (
    CORS_HEADERS,
    MBTI_GROUPS,
    MBTI_GROUP_INFO,
    BEDROCK_MODEL_ID_HAIKU,
    BEDROCK_REGION,
    POLLY_MAX_CHARS,
)
from models.podcast import Podcast
from repositories.podcast_repository import get_podcast_repository
from clients.s3_article_client import S3ArticleClient
from clients.dynamodb_client import DynamoDBClient
from core.decorators import lambda_handler as handler_decorator

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

KST = timezone(timedelta(hours=9))

# ── MBTI voice styles (reused from tts_handler) ─────────────────────────────

VOICE_STYLES = {
    'NT': {'rate': '100%', 'desc': '전문적이고 차분한'},
    'NF': {'rate': '95%',  'desc': '따뜻하고 사려 깊은'},
    'ST': {'rate': '105%', 'desc': '명확하고 간결한'},
    'SF': {'rate': '95%',  'desc': '친근하고 공감하는'},
}

# ── Bedrock / Polly / S3 clients ─────────────────────────────────────────────

_BEDROCK_CONFIG = Config(read_timeout=120, connect_timeout=30, retries={'max_attempts': 2})


def _get_bedrock():
    return boto3.client('bedrock-runtime', region_name=BEDROCK_REGION, config=_BEDROCK_CONFIG)


def _get_polly():
    return boto3.client('polly', region_name=settings.region)


def _get_s3():
    return boto3.client('s3', region_name=settings.region)


def _get_article_db() -> DynamoDBClient:
    s3_body = S3ArticleClient(
        bucket_name=settings.s3_article_body_bucket,
        region=settings.s3_article_body_region,
    )
    return DynamoDBClient(
        table_name=settings.dynamodb_table_articles,
        region=settings.region,
        s3_article_client=s3_body,
    )


# ── Script generation (Bedrock Claude) ───────────────────────────────────────

async def _generate_script(
    title: str,
    body_text: str,
    mbti_group: str,
    bedrock,
) -> str:
    """Generate a podcast script from article content using Claude."""
    style = VOICE_STYLES.get(mbti_group, VOICE_STYLES['SF'])
    group_info = MBTI_GROUP_INFO.get(mbti_group, {})

    prompt = (
        f"다음 {group_info.get('label', mbti_group)} 스타일 뉴스 기사를 "
        f"팟캐스트 대본으로 변환하세요.\n\n"
        f"톤: {style['desc']}\n"
        f"형식:\n"
        f"1. 인트로 (2~3문장, 오늘의 주제 소개)\n"
        f"2. 본문 요약 (핵심 내용 3~5개 포인트)\n"
        f"3. 핵심 포인트 정리 (1~2문장씩)\n"
        f"4. 아웃트로 (1~2문장, 마무리)\n\n"
        f"자연스러운 구어체로 작성하세요. 총 길이 800~1500자.\n\n"
        f"[기사 제목] {title}\n\n"
        f"[기사 본문]\n{body_text[:3000]}"
    )

    import asyncio
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
    })

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: bedrock.invoke_model(
            modelId=BEDROCK_MODEL_ID_HAIKU,
            contentType='application/json',
            accept='application/json',
            body=body,
        ),
    )

    resp = json.loads(response['body'].read())
    return resp.get('content', [{}])[0].get('text', '')


# ── Polly TTS (chunked for long scripts) ────────────────────────────────────

def _clean_ssml(text: str) -> str:
    """Escape XML special chars for SSML."""
    for old, new in [('&', '&amp;'), ('<', '&lt;'), ('>', '&gt;'), ('"', '&quot;'), ("'", '&apos;')]:
        text = text.replace(old, new)
    return text


def _synthesise_chunk(polly, text: str, rate: str) -> bytes:
    """Synthesise a single chunk with Polly Neural. Returns MP3 bytes."""
    cleaned = _clean_ssml(text)
    paragraphs = [f'<p>{p.strip()}</p>' for p in cleaned.split('\n\n') if p.strip()]
    if not paragraphs:
        paragraphs = [f'<p>{cleaned}</p>']

    ssml = f'<speak><prosody rate="{rate}">{"".join(paragraphs)}</prosody></speak>'

    response = polly.synthesize_speech(
        Text=ssml,
        TextType='ssml',
        OutputFormat='mp3',
        VoiceId='Seoyeon',
        Engine='neural',
        LanguageCode='ko-KR',
    )
    return response['AudioStream'].read()


def _split_script(text: str, max_chars: int) -> List[str]:
    """Split script into chunks that fit Polly's char limit."""
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    if not paragraphs:
        # Hard split
        return [text[i:i+max_chars] for i in range(0, len(text), max_chars)]

    chunks: List[str] = []
    current: List[str] = []
    current_len = 0

    for para in paragraphs:
        added = len(para) + (2 if current else 0)
        if current_len + added > max_chars and current:
            chunks.append('\n\n'.join(current))
            current = [para]
            current_len = len(para)
        else:
            current.append(para)
            current_len += added

    if current:
        chunks.append('\n\n'.join(current))

    return chunks


def _synthesise_full(polly, script: str, mbti_group: str) -> bytes:
    """Synthesise full script, chunking if necessary. Returns MP3 bytes."""
    rate = VOICE_STYLES.get(mbti_group, VOICE_STYLES['SF'])['rate']

    if len(script) <= POLLY_MAX_CHARS:
        return _synthesise_chunk(polly, script, rate)

    chunks = _split_script(script, POLLY_MAX_CHARS)
    logger.info(f"Script {len(script)} chars → {len(chunks)} Polly chunks")

    audio_parts = []
    for i, chunk in enumerate(chunks):
        part = _synthesise_chunk(polly, chunk, rate)
        audio_parts.append(part)
        logger.debug(f"Chunk {i+1}/{len(chunks)}: {len(chunk)} chars → {len(part)} bytes")

    return b''.join(audio_parts)


def _estimate_duration(audio_bytes: bytes) -> int:
    """Rough MP3 duration estimate: ~16KB per second at 48kbps."""
    return max(1, len(audio_bytes) // 16000)


# ── S3 audio storage ────────────────────────────────────────────────────────

def _upload_audio(s3, podcast_id: str, audio_bytes: bytes) -> str:
    """Upload MP3 to S3 audio bucket. Returns s3:// URI."""
    key = f"podcasts/{podcast_id}.mp3"
    bucket = settings.s3_audio_bucket

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=audio_bytes,
        ContentType='audio/mpeg',
    )

    uri = f"s3://{bucket}/{key}"
    logger.info(f"Audio uploaded: {uri} ({len(audio_bytes)} bytes)")
    return uri


def _presigned_url(s3, s3_uri: str, expires: int = 3600) -> str:
    """Generate a presigned URL from an s3:// URI."""
    # s3://bucket/key → bucket, key
    without_prefix = s3_uri.replace('s3://', '')
    bucket = without_prefix.split('/')[0]
    key = '/'.join(without_prefix.split('/')[1:])

    return s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket, 'Key': key},
        ExpiresIn=expires,
    )


# ── Route handlers ───────────────────────────────────────────────────────────

async def _handle_generate(body: Dict[str, Any]) -> Dict:
    """
    POST /api/podcast/generate
    Body: { article_id, mbti_group }
    """
    article_id = body.get('article_id', '').strip()
    mbti_group = body.get('mbti_group', 'SF').upper()

    if not article_id:
        return _error(400, 'article_id is required')
    if mbti_group not in MBTI_GROUPS:
        mbti_group = 'SF'

    repo = get_podcast_repository()

    # Create initial record
    podcast_id = Podcast.build_id(article_id, mbti_group)
    podcast = Podcast(
        podcast_id=podcast_id,
        article_id=article_id,
        mbti_group=mbti_group,
        title='',
        status='creating',
        voice_id='Seoyeon',
        voice_style=VOICE_STYLES.get(mbti_group, {}).get('desc', ''),
    )
    await repo.save_podcast(podcast)

    try:
        # 1. Fetch article
        db = _get_article_db()
        article = await db.get_article(article_id)
        if not article:
            await repo.update_podcast_status(podcast_id, 'failed', error_message='Article not found')
            return _error(404, '기사를 찾을 수 없습니다.')

        # Choose content: MBTI version body if available, else original
        version = article.get(f'version_{mbti_group}', {})
        if version and version.get('body'):
            v_body = version['body']
            body_text = v_body if isinstance(v_body, str) else '\n'.join(v_body)
            title = version.get('title', article.get('title_ko', ''))
        else:
            body_text = article.get('content_ko', '')
            title = article.get('title_ko', '')

        if not body_text:
            await repo.update_podcast_status(podcast_id, 'failed', error_message='Empty article content')
            return _error(400, '기사 본문이 비어 있습니다.')

        podcast.title = f"[{mbti_group}] {title[:80]}"

        # 2. Generate script
        bedrock = _get_bedrock()
        script = await _generate_script(title, body_text, mbti_group, bedrock)
        if not script:
            await repo.update_podcast_status(podcast_id, 'failed', error_message='Script generation failed')
            return _error(500, '팟캐스트 대본 생성에 실패했습니다.')

        podcast.script_body = script

        # 3. Synthesise audio
        polly = _get_polly()
        audio_bytes = _synthesise_full(polly, script, mbti_group)

        # 4. Upload to S3
        s3 = _get_s3()
        s3_uri = _upload_audio(s3, podcast_id, audio_bytes)
        duration = _estimate_duration(audio_bytes)

        # 5. Update metadata
        updated = await repo.update_podcast_status(
            podcast_id,
            'completed',
            s3_audio_uri=s3_uri,
            duration_seconds=duration,
        )

        # Also save the script body
        if updated:
            podcast = updated
            podcast.script_body = script
            await repo.save_podcast(podcast)

        logger.info(f"Podcast generated: {podcast_id} ({duration}s)")

        return _success({
            'podcast_id': podcast_id,
            'status': 'completed',
            'duration_seconds': duration,
            'article_id': article_id,
            'mbti_group': mbti_group,
            'title': podcast.title,
        }, status_code=201)

    except Exception as e:
        logger.error(f"Podcast generation failed: {e}", exc_info=True)
        await repo.update_podcast_status(podcast_id, 'failed', error_message=str(e)[:200])
        return _error(500, '팟캐스트 생성 중 오류가 발생했습니다.')


async def _handle_get(podcast_id: str) -> Dict:
    """GET /api/podcast/{podcast_id} — details + presigned audio URL."""
    if not podcast_id:
        return _error(400, 'podcast_id is required')

    repo = get_podcast_repository()
    podcast = await repo.get_podcast(podcast_id)
    if not podcast:
        return _error(404, '팟캐스트를 찾을 수 없습니다.')

    data = podcast.to_api()

    # Generate presigned URL if audio exists
    if podcast.s3_audio_uri:
        try:
            s3 = _get_s3()
            data['audio_url'] = _presigned_url(s3, podcast.s3_audio_uri)
        except Exception as e:
            logger.warning(f"Failed to generate presigned URL: {e}")
            data['audio_url'] = None

    return _success(data)


async def _handle_list_by_date(date_str: str) -> Dict:
    """GET /api/podcast/list?date=YYYY-MM-DD"""
    if not date_str:
        date_str = datetime.now(KST).strftime('%Y-%m-%d')

    repo = get_podcast_repository()
    podcasts = await repo.list_podcasts_by_date(date_str)

    return _success({
        'podcasts': [p.to_api() for p in podcasts],
        'count': len(podcasts),
        'date': date_str,
    })


async def _handle_list_by_article(article_id: str) -> Dict:
    """GET /api/podcast/article/{article_id}"""
    if not article_id:
        return _error(400, 'article_id is required')

    repo = get_podcast_repository()
    podcasts = await repo.list_podcasts_by_article(article_id)

    return _success({
        'podcasts': [p.to_api() for p in podcasts],
        'count': len(podcasts),
        'article_id': article_id,
    })


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
            'error': {'code': 'PODCAST_ERROR', 'message': message}
        }, ensure_ascii=False),
    }


# ── Request parsing ──────────────────────────────────────────────────────────

def _parse_event(event: dict):
    rc = event.get('requestContext', {})
    if 'http' in rc:
        method = rc['http'].get('method', 'GET')
        path = rc['http'].get('path', '')
    else:
        method = event.get('httpMethod', 'GET')
        path = event.get('path', '')

    params = event.get('queryStringParameters', {}) or {}
    path_params = event.get('pathParameters', {}) or {}

    raw = event.get('body', '{}')
    if raw and event.get('isBase64Encoded', False):
        raw = base64.b64decode(raw).decode('utf-8')
    if isinstance(raw, str) and raw:
        body = json.loads(raw)
    elif isinstance(raw, dict):
        body = raw
    else:
        body = {}

    return method, path, params, path_params, body


# ── Lambda entry point ───────────────────────────────────────────────────────

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    """
    Podcast API Lambda handler.

    Routes:
      POST /api/podcast/generate            — Generate podcast
      GET  /api/podcast/list                — List by date
      GET  /api/podcast/article/{article_id} — List by article
      GET  /api/podcast/{podcast_id}        — Get details + audio URL
    """
    method, path, params, path_params, body = _parse_event(event)

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    logger.info(f"Podcast request: {method} {path}")

    # POST /api/podcast/generate
    if '/generate' in path and method == 'POST':
        return await _handle_generate(body)

    # GET /api/podcast/list?date=...
    if '/list' in path and method == 'GET':
        return await _handle_list_by_date(params.get('date', ''))

    # GET /api/podcast/article/{article_id}
    if '/article/' in path and method == 'GET':
        article_id = path_params.get('article_id', '')
        if not article_id:
            parts = path.rstrip('/').split('/')
            article_id = parts[-1] if parts else ''
        return await _handle_list_by_article(article_id)

    # GET /api/podcast/{podcast_id}
    if method == 'GET':
        podcast_id = path_params.get('podcast_id', '')
        if not podcast_id:
            parts = path.rstrip('/').split('/')
            podcast_id = parts[-1] if parts else ''
        return await _handle_get(podcast_id)

    return _error(405, 'Method not allowed')
