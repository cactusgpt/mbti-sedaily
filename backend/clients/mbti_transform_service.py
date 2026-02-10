"""
MBTI Transform Service
Handles article style transformation using AWS Bedrock Claude API

Transforms a single Korean article into 4 MBTI group styles (NT, NF, ST, SF).
Each group has a dedicated prompt file in /backend/prompts/:
- NT: 전략형 분석가 (nt.md)
- NF: 가치형 해석자 (nf.md)
- ST: 실용형 실무자 (st.md)
- SF: 공감형 소통가 (sf.md)
"""
import asyncio
from typing import Optional, Dict, Any
import logging
import os
import json
import re

import boto3
from botocore.config import Config

from config.constants import MBTI_GROUPS, MBTI_GROUP_INFO

# Boto3 config with extended timeouts for Bedrock
BEDROCK_CONFIG = Config(
    read_timeout=300,  # 5 minutes read timeout
    connect_timeout=60,  # 1 minute connect timeout
    retries={'max_attempts': 3}
)

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 5
INITIAL_RETRY_DELAY = 30
MAX_RETRY_DELAY = 300

# AWS Bedrock Claude Haiku 3.5 - Cost optimized model
# Cost: $0.25/$1.25 per 1M tokens (input/output)
BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

# Prompt file names for each MBTI group
PROMPT_FILES = {
    'NT': 'nt.md',
    'NF': 'nf.md',
    'ST': 'st.md',
    'SF': 'sf.md'
}


class TransformError(Exception):
    """Raised when MBTI transformation fails"""
    pass


class MbtiTransformService:
    """
    Service for transforming Korean articles into 4 MBTI styles
    using AWS Bedrock Claude API.
    """

    def __init__(
        self,
        model_id: str = None,
        region: str = "us-east-1",
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
    ):
        self.model_id = model_id or BEDROCK_MODEL_ID
        self.region = region

        if aws_access_key_id and aws_secret_access_key:
            self.bedrock_client = boto3.client(
                'bedrock-runtime',
                region_name=region,
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
                config=BEDROCK_CONFIG
            )
        else:
            self.bedrock_client = boto3.client(
                'bedrock-runtime',
                region_name=region,
                config=BEDROCK_CONFIG
            )

        logger.info(f"MbtiTransformService initialized with Bedrock model: {self.model_id}")

    def _load_group_prompt(self, group: str) -> Optional[str]:
        """
        Load prompt for a specific MBTI group from prompts folder.

        Args:
            group: MBTI group (NT, NF, ST, SF)

        Returns:
            Prompt content or None if not found
        """
        if group not in PROMPT_FILES:
            logger.warning(f"Unknown MBTI group: {group}")
            return None

        prompts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")
        prompt_path = os.path.join(prompts_dir, PROMPT_FILES[group])

        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                content = f.read()
                logger.debug(f"Loaded prompt for {group} from {prompt_path}")
                return content
        except FileNotFoundError:
            logger.warning(f"Prompt file not found: {prompt_path}")
            return None
        except Exception as e:
            logger.warning(f"Failed to load prompt for {group}: {e}")
            return None

    def _load_transform_prompt(self) -> str:
        """
        Load all 4 MBTI group prompts and combine into a comprehensive system prompt.

        Priority:
        1. Individual prompt files from /backend/prompts/ (nt.md, nf.md, st.md, sf.md)
        2. DynamoDB settings_config.transform_prompt (legacy fallback)
        3. MBTI_TRANSFORM_PROMPT.md file (legacy fallback)
        4. Default fallback
        """
        # Load all 4 individual prompts
        group_prompts = {}
        all_loaded = True

        for group in MBTI_GROUPS:
            prompt = self._load_group_prompt(group)
            if prompt:
                group_prompts[group] = prompt
            else:
                all_loaded = False
                logger.warning(f"Failed to load prompt for {group}")

        # If all 4 prompts loaded successfully, combine them
        if all_loaded and len(group_prompts) == 4:
            logger.info("Using individual prompts from /backend/prompts/ folder")
            return self._build_combined_prompt(group_prompts)

        # Fallback: Try DynamoDB
        try:
            from config.constants import DYNAMODB_TABLE_ARTICLES_DEV
            dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
            table = dynamodb.Table(DYNAMODB_TABLE_ARTICLES_DEV)
            response = table.get_item(Key={'news_id': 'settings_config'})
            settings = response.get('Item', {})

            if settings.get('transform_prompt'):
                logger.info("Using transform prompt from DynamoDB settings (fallback)")
                return settings['transform_prompt']
        except Exception as e:
            logger.warning(f"Failed to load prompt from DynamoDB: {e}")

        # Fallback: Try legacy file
        prompt_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "MBTI_TRANSFORM_PROMPT.md")
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                logger.info("Using transform prompt from MBTI_TRANSFORM_PROMPT.md file (fallback)")
                return f.read()
        except Exception as e:
            logger.warning(f"Failed to load MBTI_TRANSFORM_PROMPT.md: {e}. Using default.")
            return "당신은 경제 뉴스를 MBTI 4그룹(NT, NF, ST, SF) 스타일로 변환하는 전문가입니다. JSON 형식으로 출력하세요."

    def _build_combined_prompt(self, group_prompts: Dict[str, str]) -> str:
        """
        Build a comprehensive system prompt from individual group prompts.

        Args:
            group_prompts: Dict mapping group name to prompt content

        Returns:
            Combined system prompt with JSON output instructions
        """
        combined = """당신은 서울경제신문의 MBTI 맞춤형 뉴스 변환 전문가입니다.
하나의 경제 기사를 4가지 MBTI 그룹 스타일(NT, NF, ST, SF)로 변환합니다.
각 그룹별로 아래 가이드라인을 정확히 따라주세요.

===========================================
[중요] 출력 형식 - 반드시 JSON으로 출력하세요
===========================================

다음 JSON 형식으로 출력해주세요. 각 그룹별로 title과 body를 포함해야 합니다:

```json
{
  "NT": {
    "title": "NT 스타일 제목",
    "body": "NT 스타일 본문 (마크다운 형식)"
  },
  "NF": {
    "title": "NF 스타일 제목",
    "body": "NF 스타일 본문 (마크다운 형식)"
  },
  "ST": {
    "title": "ST 스타일 제목",
    "body": "ST 스타일 본문 (마크다운 형식)"
  },
  "SF": {
    "title": "SF 스타일 제목",
    "body": "SF 스타일 본문 (마크다운 형식)"
  }
}
```

===========================================
[NT 전략형 분석가] 가이드라인
===========================================
"""

        # Add NT prompt
        combined += f"\n{group_prompts.get('NT', '')}\n\n"

        combined += """
===========================================
[NF 가치형 해석자] 가이드라인
===========================================
"""

        # Add NF prompt
        combined += f"\n{group_prompts.get('NF', '')}\n\n"

        combined += """
===========================================
[ST 실용형 실무자] 가이드라인
===========================================
"""

        # Add ST prompt
        combined += f"\n{group_prompts.get('ST', '')}\n\n"

        combined += """
===========================================
[SF 공감형 소통가] 가이드라인
===========================================
"""

        # Add SF prompt
        combined += f"\n{group_prompts.get('SF', '')}\n\n"

        combined += """
===========================================
[최종 확인 사항]
===========================================

1. 팩트 100% 유지 - 원본 기사의 사실을 절대 변조하지 마세요
2. 각 그룹별 스타일 차이가 명확해야 합니다
3. 모든 4개 그룹(NT, NF, ST, SF)을 반드시 포함하세요
4. 반드시 유효한 JSON 형식으로 출력하세요
5. body는 마크다운 형식으로 작성하세요 (** 볼드, ■ 소제목 등)
"""

        return combined

    async def transform_article(
        self,
        title: str,
        subtitle: str,
        content: str,
        category: str = "",
        custom_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Transform a Korean article into 4 MBTI styles.

        Args:
            title: Original Korean title
            subtitle: Original Korean subtitle
            content: Original Korean content (clean text)
            category: Article category
            custom_prompt: Optional custom prompt override

        Returns:
            Dict with:
              - 'versions': {NT: {...}, NF: {...}, ST: {...}, SF: {...}}
              - 'usage': token usage data
        """
        if not content or not content.strip():
            raise TransformError("Article content must be non-empty")

        system_prompt = custom_prompt or self._load_transform_prompt()

        user_message = f"""다음 경제 기사를 4가지 MBTI 그룹 스타일(NT, NF, ST, SF)로 변환해주세요.

[원본 제목] {title}
[원본 부제목] {subtitle or '없음'}
[카테고리] {category or '경제'}

[원본 기사]
{content}"""

        last_error = None
        retry_delay = INITIAL_RETRY_DELAY

        for attempt in range(MAX_RETRIES):
            try:
                request_body = json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 8192,
                    "system": [
                        {
                            "type": "text",
                            "text": system_prompt,
                            "cache_control": {"type": "ephemeral"}
                        }
                    ],
                    "messages": [
                        {"role": "user", "content": user_message}
                    ]
                })

                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.bedrock_client.invoke_model(
                        modelId=self.model_id,
                        contentType="application/json",
                        accept="application/json",
                        body=request_body
                    )
                )

                response_body = json.loads(response['body'].read())

                if not response_body.get("content") or len(response_body["content"]) == 0:
                    raise TransformError("Empty content in Bedrock response")

                response_text = response_body["content"][0].get("text", "")

                if attempt > 0:
                    logger.info(f"Transform succeeded on attempt {attempt + 1}")

                # Parse JSON from response
                json_match = re.search(r'\{[\s\S]*\}', response_text)
                if not json_match:
                    raise TransformError("No JSON found in response")

                versions = json.loads(json_match.group(0))

                # Validate all 4 groups exist
                for group in MBTI_GROUPS:
                    if group not in versions:
                        raise TransformError(f"Missing MBTI group '{group}' in response")
                    v = versions[group]
                    if not v.get('title') or not v.get('body'):
                        raise TransformError(f"MBTI group '{group}' missing title or body")

                # Extract usage
                usage = response_body.get("usage", {})
                usage_data = {
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                    "cache_read_input_tokens": usage.get("cache_read_input_tokens", 0),
                    "cache_creation_input_tokens": usage.get("cache_creation_input_tokens", 0),
                }

                return {
                    "versions": versions,
                    "usage": usage_data
                }

            except self.bedrock_client.exceptions.ThrottlingException as e:
                logger.warning(f"Bedrock throttling. Retry {attempt + 1}/{MAX_RETRIES} in {retry_delay}s...")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, MAX_RETRY_DELAY)
                    last_error = e
                    continue
                raise TransformError(f"Transform failed: Throttling - {str(e)}")

            except self.bedrock_client.exceptions.ModelTimeoutException as e:
                logger.warning(f"Bedrock timeout. Retry {attempt + 1}/{MAX_RETRIES} in {retry_delay}s...")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, MAX_RETRY_DELAY)
                    last_error = e
                    continue
                raise TransformError(f"Transform failed: Timeout - {str(e)}")

            except (json.JSONDecodeError, TransformError) as e:
                logger.error(f"Transform parse error: {str(e)}")
                if attempt < MAX_RETRIES - 1:
                    logger.warning(f"Retrying... {attempt + 1}/{MAX_RETRIES}")
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, MAX_RETRY_DELAY)
                    last_error = e
                    continue
                raise TransformError(f"Transform failed: {str(e)}")

            except Exception as e:
                logger.error(f"Transform error: {str(e)}")
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, MAX_RETRY_DELAY)
                    continue
                raise TransformError(f"Transform failed: {str(e)}")

        raise TransformError(f"Transform failed after {MAX_RETRIES} retries: {str(last_error)}")

    async def close(self):
        """Close resources (no-op for Bedrock client)"""
        pass
