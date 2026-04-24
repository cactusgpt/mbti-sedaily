"""Core 2 Validator — structural + Nova Lite cross-check of 4 MBTI versions.

Called inline from ``core2_transform`` handler AFTER ``transform_article``
returns all 4 versions but BEFORE any S3 / pgvector writes. On validation
failure the handler marks ``status='failed'`` and skips the writes
entirely; no partial state is ever committed.

Inline (not a separate Lambda) per TASK-2.4 design spec option
"또는 같은 Lambda에서 inline 호출". Rationale:

1. ``.clauderules`` #5 forbids autonomous Lambda creation, which would
   block completion in this session.
2. Avoids SNS/SQS plumbing + per-invoke cost.
3. Couples validator lifecycle to transformer. Acceptable now; can
   decouple into its own Lambda in a later TASK if re-validation of
   already-transformed articles is ever needed.

What this validator checks
--------------------------
Structural (deterministic, always run):
  * ``missing``            — version dict absent from the 4-group set
  * ``missing_title``      — ``title`` empty / whitespace
  * ``missing_body``       — ``body`` empty / whitespace
  * ``body_too_short``     — ``body`` < 100 chars
  * ``body_too_long``      — ``body`` > 10,000 chars
  * ``wrong_language``     — ``body`` < 30% Korean letters

Semantic (Nova Lite, skipped on structural failure or by flag):
  * ``hallucination``      — version covers an entirely unrelated topic
                             from the original article

Default-to-pass on Nova errors
------------------------------
If the Nova Lite call raises (throttling, timeout, malformed JSON), the
validator logs a warning and treats it as passing. Mirrors v1
``step4_validate`` philosophy: the validator failing should never reject
a correctly-transformed article.

What this validator intentionally does NOT flag
-----------------------------------------------
Different phrasing, added analytical context, reordered content,
style-specific additions, tone differences across the four MBTI groups —
those are the intended product of rewriting, not defects.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import boto3
from botocore.config import Config


logger = logging.getLogger(__name__)


# ── Constants ──────────────────────────────────────────────────────────────────

_NOVA_LITE_MODEL_ID = "amazon.nova-lite-v1:0"
_REGION = "us-east-1"

# Short timeouts — Nova Lite is fast (~3s typical). If it misbehaves we
# want to fall through to default-to-pass quickly rather than burn Lambda
# wall-clock budget.
_BEDROCK_CONFIG = Config(
    read_timeout=60,
    connect_timeout=10,
    retries={"max_attempts": 2},
)

_REQUIRED_GROUPS: tuple = ("NT", "NF", "ST", "SF")
_MIN_BODY_LENGTH = 100
_MAX_BODY_LENGTH = 10_000
_KOREAN_MIN_RATIO = 0.30

# Hangul syllables + Jamo blocks. Matches what v1 step4_validate uses.
_KOREAN_CHAR = re.compile(r"[가-힯ᄀ-ᇿ㄰-㆏]")

# Structural issue types that reject an article. Semantic types added by AI.
_CRITICAL_ISSUE_TYPES = frozenset({
    "missing",
    "missing_title",
    "missing_body",
    "body_too_short",
    "body_too_long",
    "wrong_language",
    "hallucination",
})


# ── Result type ────────────────────────────────────────────────────────────────


@dataclass
class ValidationResult:
    passed: bool
    issues: List[Dict[str, str]] = field(default_factory=list)
    ai_check_used: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passed": self.passed,
            "issues": self.issues,
            "ai_check_used": self.ai_check_used,
        }


# ── Pure helpers (unit-testable, no AWS) ───────────────────────────────────────


def _is_korean_text(text: str, min_ratio: float = _KOREAN_MIN_RATIO) -> bool:
    """True when at least ``min_ratio`` of letter characters are Korean.

    Punctuation / digits / whitespace are ignored. Empty or letter-free
    inputs return False (conservative).
    """
    if not text:
        return False
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    korean = sum(1 for c in letters if _KOREAN_CHAR.match(c))
    return korean / len(letters) >= min_ratio


def structural_check(versions: Dict[str, Dict[str, Any]]) -> List[Dict[str, str]]:
    """Return structural issues for all 4 groups. Deterministic, no AWS."""
    issues: List[Dict[str, str]] = []
    for group in _REQUIRED_GROUPS:
        v = versions.get(group)
        if not v:
            issues.append(
                {"group": group, "type": "missing", "detail": "version dict absent"}
            )
            continue
        title = (v.get("title") or "").strip()
        body = (v.get("body") or "").strip()

        if not title:
            issues.append(
                {"group": group, "type": "missing_title", "detail": "title empty"}
            )
        if not body:
            issues.append(
                {"group": group, "type": "missing_body", "detail": "body empty"}
            )
            continue

        n = len(body)
        if n < _MIN_BODY_LENGTH:
            issues.append(
                {
                    "group": group,
                    "type": "body_too_short",
                    "detail": f"{n} < {_MIN_BODY_LENGTH}",
                }
            )
        elif n > _MAX_BODY_LENGTH:
            issues.append(
                {
                    "group": group,
                    "type": "body_too_long",
                    "detail": f"{n} > {_MAX_BODY_LENGTH}",
                }
            )

        if not _is_korean_text(body):
            issues.append(
                {
                    "group": group,
                    "type": "wrong_language",
                    "detail": "Korean letter ratio < 0.30",
                }
            )
    return issues


# ── Nova Lite AI check ─────────────────────────────────────────────────────────


def _build_ai_prompt(
    original_title: str, original_content: str, versions: Dict[str, Dict[str, Any]]
) -> str:
    """Build the Nova Lite user message. Kept pure so tests can assert shape."""
    versions_summary = "\n".join(
        f"[{g}] 제목: {(v.get('title') or '')[:80]}\n"
        f"     본문 발췌: {(v.get('body') or '')[:250]}"
        for g, v in versions.items()
    )
    return f"""원본 기사와 4개 MBTI 변환 버전이 주어집니다. 각 버전이 원본과 완전히 다른 사건/주제를 다루는 hallucination인지 판별하세요.

스타일 차이, 추가 분석·감정 context, 재구성, 톤 차이는 hallucination이 아닙니다. 오직 완전히 다른 사건 / 주제 / 인물로 변질된 경우만 hallucination으로 표시하세요.

[원본 제목]
{original_title}

[원본 본문 발췌]
{original_content[:600]}

[변환 버전들]
{versions_summary}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{"issues": [{{"group": "NT" | "NF" | "ST" | "SF", "type": "hallucination", "detail": "구체 사유"}}]}}

hallucination이 없으면 issues를 빈 배열로 두세요."""


def _parse_ai_issues(response_text: str) -> List[Dict[str, str]]:
    """Extract the ``issues`` list from a Nova response. Best-effort parsing.

    Nova may wrap the JSON in prose or markdown fences; we locate the first
    balanced ``{...}`` block. Anything unparseable → empty list (default-to-
    pass semantics; caller logs at WARNING).
    """
    if not response_text:
        return []
    start = response_text.find("{")
    if start == -1:
        return []
    depth = 0
    end = -1
    for i in range(start, len(response_text)):
        ch = response_text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end == -1:
        return []
    try:
        parsed = json.loads(response_text[start : end + 1])
    except json.JSONDecodeError:
        return []
    raw_issues = parsed.get("issues", [])
    if not isinstance(raw_issues, list):
        return []
    # Filter to the shape we expect; discard malformed entries silently.
    return [
        {
            "group": str(it.get("group", "")),
            "type": str(it.get("type", "hallucination")),
            "detail": str(it.get("detail", "")),
        }
        for it in raw_issues
        if isinstance(it, dict) and it.get("group") in _REQUIRED_GROUPS
    ]


async def _ai_check(
    client: Any,
    original_title: str,
    original_content: str,
    versions: Dict[str, Dict[str, Any]],
) -> List[Dict[str, str]]:
    """Invoke Nova Lite. Returns issues list; empty on any error (default-to-pass)."""
    try:
        user_msg = _build_ai_prompt(original_title, original_content, versions)
        body = json.dumps(
            {
                "messages": [{"role": "user", "content": [{"text": user_msg}]}],
                "inferenceConfig": {
                    "maxTokens": 400,
                    "temperature": 0.0,
                    "topP": 0.9,
                },
            }
        )
        response = await asyncio.to_thread(
            client.invoke_model,
            modelId=_NOVA_LITE_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        payload = json.loads(response["body"].read())
        text = (
            payload.get("output", {})
            .get("message", {})
            .get("content", [{}])[0]
            .get("text", "")
        )
        return _parse_ai_issues(text)
    except Exception as exc:
        logger.warning(
            f"Validator AI check failed (default-to-pass): "
            f"{type(exc).__name__}: {exc}"
        )
        return []


# ── Public entry point ─────────────────────────────────────────────────────────


async def validate_versions(
    *,
    title: str,
    content: str,
    versions: Dict[str, Dict[str, Any]],
    endpoint_url: Optional[str] = None,
    enable_ai_check: bool = True,
    bedrock_client: Optional[Any] = None,
) -> ValidationResult:
    """Validate 4 MBTI versions against the original article.

    Parameters
    ----------
    title, content : str
        Original Korean article fields (from ``original.json``).
    versions : dict
        ``{NT: {title, body, ...}, NF: ..., ST: ..., SF: ...}``.
    endpoint_url : str, optional
        Bedrock VPC endpoint override (same pattern as
        ``TransformV2Service`` and ``EmbeddingV2Client``).
    enable_ai_check : bool
        If False, skips the Nova Lite hallucination probe. Useful for
        unit tests and when operating under strict cost controls.
    bedrock_client : boto3 client, optional
        Inject a pre-built client (mocking).

    Returns
    -------
    ValidationResult
        ``passed=True`` iff no critical issues. Structural issues always
        count as critical; AI issues only when Nova returns a
        ``hallucination`` type.
    """
    issues = structural_check(versions)

    ai_check_used = False
    if enable_ai_check and not issues:
        if bedrock_client is None:
            kwargs = {"region_name": _REGION, "config": _BEDROCK_CONFIG}
            if endpoint_url:
                kwargs["endpoint_url"] = endpoint_url
            bedrock_client = boto3.client("bedrock-runtime", **kwargs)
        ai_issues = await _ai_check(bedrock_client, title, content, versions)
        issues.extend(ai_issues)
        ai_check_used = True

    # An issue counts as a failure only if its ``type`` is in the critical set.
    passed = not any(issue.get("type") in _CRITICAL_ISSUE_TYPES for issue in issues)
    return ValidationResult(passed=passed, issues=issues, ai_check_used=ai_check_used)
