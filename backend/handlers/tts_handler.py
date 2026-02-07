"""
TTS (Text-to-Speech) Handler Lambda Function
Generates audio from article text using AWS Polly.
Supports Korean voice (Seoyeon) with MBTI group-specific speaking styles.
"""
import logging
import boto3
import json
import base64
import hashlib
from typing import Dict, Any

from config.constants import CORS_HEADERS, MBTI_GROUPS

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# AWS Polly client
polly_client = None

def get_polly_client():
    """Get or create Polly client"""
    global polly_client
    if polly_client is None:
        polly_client = boto3.client('polly', region_name='us-east-1')
    return polly_client


# MBTI 그룹별 음성 스타일 (SSML)
MBTI_VOICE_STYLES = {
    'NT': {
        'rate': '100%',      # 보통 속도
        'pitch': 'medium',   # 중간 톤
        'style': 'professional'  # 전문적
    },
    'NF': {
        'rate': '95%',       # 약간 느림
        'pitch': 'medium',   # 중간 톤
        'style': 'warm'      # 따뜻한
    },
    'ST': {
        'rate': '105%',      # 약간 빠름
        'pitch': 'low',      # 낮은 톤
        'style': 'factual'   # 사실적
    },
    'SF': {
        'rate': '95%',       # 약간 느림
        'pitch': 'high',     # 높은 톤
        'style': 'friendly'  # 친근한
    }
}


def create_ssml_text(text: str, mbti_group: str) -> str:
    """Create SSML formatted text with MBTI group-specific style"""
    style = MBTI_VOICE_STYLES.get(mbti_group, MBTI_VOICE_STYLES['SF'])

    # Clean text for SSML
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    text = text.replace("'", '&apos;')

    # Add pauses between paragraphs
    paragraphs = text.split('\n\n')
    formatted_paragraphs = []
    for p in paragraphs:
        if p.strip():
            formatted_paragraphs.append(f'<p>{p.strip()}</p>')

    ssml_content = ''.join(formatted_paragraphs)

    ssml = f'''<speak>
    <prosody rate="{style['rate']}">
        {ssml_content}
    </prosody>
</speak>'''

    return ssml


def synthesize_speech(text: str, mbti_group: str) -> bytes:
    """Synthesize speech using AWS Polly"""
    polly = get_polly_client()

    # Create SSML
    ssml_text = create_ssml_text(text, mbti_group)

    try:
        response = polly.synthesize_speech(
            Text=ssml_text,
            TextType='ssml',
            OutputFormat='mp3',
            VoiceId='Seoyeon',  # Korean female voice
            Engine='neural',    # Neural engine for better quality
            LanguageCode='ko-KR'
        )

        # Read audio stream
        audio_stream = response['AudioStream'].read()
        return audio_stream

    except Exception as e:
        logger.error(f"Polly synthesis error: {e}")
        raise


def lambda_handler(event: dict, context) -> dict:
    """
    Lambda handler for TTS API.

    POST /api/tts
    {
        "text": "읽을 텍스트",
        "mbti_group": "NT" | "NF" | "ST" | "SF",
        "article_id": "기사ID (캐싱용)"
    }

    Response: audio/mpeg (MP3 binary or base64)
    """
    try:
        # Support both HTTP API v2 and REST API v1 event formats
        request_context = event.get('requestContext', {})

        if 'http' in request_context:
            http_method = request_context['http'].get('method', 'GET')
        else:
            http_method = event.get('httpMethod', 'GET')

        # Handle CORS preflight
        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': ''
            }

        # Parse request body
        body = event.get('body', '{}')
        is_base64 = event.get('isBase64Encoded', False)

        if body and is_base64:
            import base64 as b64
            body = b64.b64decode(body).decode('utf-8')

        if isinstance(body, str) and body:
            body = json.loads(body)
        elif not body:
            body = {}

        # Extract parameters
        text = body.get('text', '').strip()
        mbti_group = body.get('mbti_group', 'SF').upper()
        article_id = body.get('article_id', '')

        # Validate
        if not text:
            return error_response(400, '텍스트를 입력해주세요.')

        if mbti_group not in MBTI_GROUPS:
            mbti_group = 'SF'

        # Limit text length (Polly has 3000 character limit for neural)
        if len(text) > 2800:
            text = text[:2800] + '... 전체 내용은 기사 본문을 참고해주세요.'

        logger.info(f"TTS request: group={mbti_group}, text_length={len(text)}")

        # Synthesize speech
        audio_data = synthesize_speech(text, mbti_group)

        # Return audio as base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        return {
            'statusCode': 200,
            'headers': {
                **CORS_HEADERS,
                'Content-Type': 'application/json',
            },
            'body': json.dumps({
                'audio': audio_base64,
                'format': 'mp3',
                'mbti_group': mbti_group,
                'text_length': len(text)
            })
        }

    except Exception as e:
        logger.error(f"TTS error: {e}", exc_info=True)
        return error_response(500, '음성 생성 중 오류가 발생했습니다.')


def error_response(status_code: int, message: str) -> dict:
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'error': {
                'code': 'TTS_ERROR',
                'message': message
            }
        }, ensure_ascii=False)
    }
