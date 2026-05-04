"""Memory Manager — Phase 3 Core 3 personalization library.

A small wrapper around ``PgVectorV2Client`` and ``EmbeddingV2Client`` that
exposes the four memory layers (short-term, episodic, semantic,
procedural) plus a profile bootstrap helper. Pure library — never wired
into a Lambda handler directly. The Phase 3 handlers (Round 5-C
``core3_feed`` and ``core3_record_interaction``) consume this through
``ContextBroker``.

Memory layer ↔ data source mapping (decided in Round 5 planning, Q2)
-------------------------------------------------------------------
* **Short-term**: last 30 minutes of ``user_interactions``. Used by the
  Recommend Agent's "current session" signal — articles the user is
  actively reading right now should not reappear higher in the feed.
* **Episodic**: the last N (default 100) ``user_interactions`` rows.
  Used by Context Broker to derive ``recent_news_ids`` (deduped recency
  list) for Stage 1 candidate exclusion.
* **Semantic**: stable user facts from ``user_profiles`` — currently
  only ``mbti_type``. Cognito demographic fields could land here in a
  later phase but are not in scope.
* **Procedural**: learned preferences — ``category_weights`` JSONB and
  the 1024-dim ``preference_embedding``. Updated by Round 5-D
  consolidation Lambda; read here for the Recommend Agent.

Cold-start (Q3 = C, decided in Round 5 planning)
------------------------------------------------
``get_or_create_profile(user_id, mbti_type)`` is idempotent. On first
call for a user, it embeds a canonical Korean sentence describing the
MBTI group's preferences (see ``_MBTI_GROUP_SEEDS``) and writes it as
the seed ``preference_embedding``. On subsequent calls it returns the
existing profile unchanged — never re-seeds, never overwrites.

The transition from seed → learned embedding (EWMA over recent clicks)
happens in Round 5-D consolidation Lambda, not here. Users with <10
interactions continue using the seed.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from v2.clients.pgvector_v2_client import PgVectorV2Client
from v2.clients.embedding_v2_client import EmbeddingV2Client


logger = logging.getLogger(__name__)


# ── Constants ────────────────────────────────────────────────────────────────

# Default short-term window. 30 min is generous for "current session" —
# typical mobile reading sessions are 5-15 min; the wider window catches
# users who pause mid-article (push notification, tab switch) and resume.
DEFAULT_SHORT_TERM_MINUTES = 30

# Default episodic depth. 100 events ≈ 1-2 weeks of typical engagement.
# Used by Context Broker to derive recent_news_ids; the deduped distinct
# news_id count is usually 30-60 from this many events.
DEFAULT_EPISODIC_LIMIT = 100

# 16-value MBTI whitelist — matches user_profiles.mbti_type CHECK.
_VALID_MBTI_FULL = frozenset({
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISTP", "ESTJ", "ESTP",
    "ISFJ", "ISFP", "ESFJ", "ESFP",
})

# Seed sentences for cold-start preference_embedding (Q3 = C).
# 4-group keys (NT/NF/ST/SF) — derived from full mbti_type[1:3]. The
# group level is deliberate: article_versions are also at group level,
# so the seed embedding lives in the same conceptual space the
# Recommend Agent will compare against.
#
# Korean prose because the article corpus is Korean and Titan V2 produces
# language-aware embeddings. English seeds would land in a different
# region of the embedding space and bias the cold-start ranking.
_MBTI_GROUP_SEEDS: Dict[str, str] = {
    "NT": (
        "분석적이고 데이터 중심의 사고. 시스템 전체를 보는 논리적 통찰. "
        "객관적 사실, 통계, 시장 동향, 기술 트렌드, 거시경제 분석. "
        "효율과 합리성을 중시하며 새로운 아이디어와 미래 가능성에 관심."
    ),
    "NF": (
        "가치와 의미를 추구. 인간적 통찰과 사회적 비전. "
        "영감을 주는 이야기, 변화의 동력, 윤리와 철학, 인물의 신념. "
        "정성적 판단을 신뢰하며 따뜻한 관점으로 세상을 바라봄."
    ),
    "ST": (
        "검증된 절차와 안정성을 선호. 즉시 적용 가능한 실용적 정보. "
        "구체적 사실, 명확한 데이터, 안전 규제, 정책 시행, 실무 사례. "
        "체계적이고 신중한 접근, 책임감과 의무를 중요시."
    ),
    "SF": (
        "사람 중심의 따뜻한 이야기. 공감과 관계, 일상의 작은 변화. "
        "실제 경험, 사람들의 목소리, 지역 사회, 가족과 이웃. "
        "감정의 결을 읽고 의미 있는 순간을 소중히 여김."
    ),
}


# ── Helpers ──────────────────────────────────────────────────────────────────


def _validate_mbti_full(mbti_type: str) -> str:
    """Strict 16-value MBTI validator.

    Returns the normalized (uppercased, stripped) MBTI string. Raises
    ``ValueError`` on invalid input. Stricter than client-level
    ``_normalize_mbti_group`` because profile creation requires the
    full MBTI for storage in the CHAR(4) column.
    """
    if not isinstance(mbti_type, str):
        raise ValueError(f"mbti_type must be str, got {type(mbti_type).__name__}")
    cleaned = mbti_type.strip().upper()
    if cleaned not in _VALID_MBTI_FULL:
        raise ValueError(
            f"Invalid mbti_type: {mbti_type!r}. Must be one of "
            f"the 16 standard codes (e.g. INTJ, ENFP)."
        )
    return cleaned


def _mbti_group_from_full(mbti_full: str) -> str:
    """INTJ → NT, ENFP → NF, etc. Assumes ``_validate_mbti_full`` already ran."""
    return mbti_full[1:3]


# ── Memory Manager ───────────────────────────────────────────────────────────


class MemoryManager:
    """Read-side facade over the four memory layers.

    Designed for dependency injection: tests pass fakes for
    ``pg_client`` and ``embedding_client``; production code default-
    constructs both from environment variables (matching the v2
    client convention).

    Round 5-A scope is read-only + ``get_or_create_profile``. The
    ``consolidate(user_id)`` write path mentioned in TASK-3.1 spec
    requires aggregation over interaction history with article
    metadata (category, embedding) — that pulls in client-level
    helpers we'll add in Round 5-D when the consolidation Lambda is
    wired. Adding it here without the Lambda host would leave it
    untriggered, so we defer.
    """

    def __init__(
        self,
        pg_client: Optional[PgVectorV2Client] = None,
        embedding_client: Optional[EmbeddingV2Client] = None,
    ) -> None:
        self._pg = pg_client if pg_client is not None else PgVectorV2Client()
        if embedding_client is not None:
            self._embed = embedding_client
        else:
            # VPC-routed Bedrock requires explicit endpoint_url. Default
            # boto3 fallback resolves the public hostname which has no
            # route from inside this VPC (Private DNS disabled at the
            # interface endpoint per CLAUDE.md). Mirroring the
            # core1_collector pattern keeps every Bedrock consumer
            # consistent — and prevents this default constructor from
            # silently hanging in production for future callers
            # (Round 5-D consolidation, etc.).
            self._embed = EmbeddingV2Client(
                endpoint_url=os.getenv("BEDROCK_RUNTIME_ENDPOINT_URL", "")
            )

    # ---- Short-term -----------------------------------------------------------

    def get_short_term(
        self,
        user_id: str,
        window_minutes: int = DEFAULT_SHORT_TERM_MINUTES,
    ) -> List[Dict[str, Any]]:
        """Interactions from the last ``window_minutes``, newest-first.

        Pgvector-only implementation (Q2). The ``idx_user_interactions
        _user_created`` index makes the time-windowed read cheap even
        on large tables.
        """
        since = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        # Generous limit — short-term windows are small in practice
        # (≤ a few hundred events even for power users), so the
        # 200-row cap is just a safety rail.
        return self._pg.get_user_interactions(user_id, limit=200, since=since)

    # ---- Episodic -------------------------------------------------------------

    def get_episodic(
        self,
        user_id: str,
        limit: int = DEFAULT_EPISODIC_LIMIT,
    ) -> List[Dict[str, Any]]:
        """Last ``limit`` interactions, all-time, newest-first.

        Pattern-detection layer. Used by Context Broker's
        ``recent_news_ids`` derivation and by Round 5-D consolidation
        when computing fresh ``category_weights``.
        """
        return self._pg.get_user_interactions(user_id, limit=limit)

    # ---- Semantic -------------------------------------------------------------

    def get_semantic(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Stable facts from the user profile, or ``None`` if no profile.

        Currently exposes only ``mbti_type``. The dict shape leaves
        room for Cognito-derived fields (display_name, locale) in a
        later phase without breaking callers.
        """
        profile = self._pg.get_user_profile(user_id)
        if profile is None:
            return None
        return {"mbti_type": profile.get("mbti_type")}

    # ---- Procedural -----------------------------------------------------------

    def get_procedural(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Learned preferences (weights + embedding), or ``None`` if no profile.

        Two reads (profile metadata + embedding) because the v2 client
        keeps the embedding off the standard profile read path. For
        cold-start users, ``preference_embedding`` may be ``None`` —
        callers must handle that (Recommend Agent falls back to
        recency-based ranking when missing).
        """
        profile = self._pg.get_user_profile(user_id)
        if profile is None:
            return None
        embedding = self._pg.get_preference_embedding(user_id)
        return {
            "category_weights": profile.get("category_weights") or {},
            "preference_embedding": embedding,
        }

    # ---- Profile bootstrap ---------------------------------------------------

    def get_or_create_profile(
        self,
        user_id: str,
        mbti_type: str,
    ) -> Dict[str, Any]:
        """Idempotent profile creation with MBTI-seeded ``preference_embedding``.

        Call site (Round 5-C handlers): on every authenticated request,
        before reading the profile. Cheap when profile exists (1 SELECT,
        no Bedrock call). Expensive only on first-time creation
        (1 SELECT + 1 Titan embed + 1 INSERT).

        Returns the profile dict (same shape as
        ``PgVectorV2Client.get_user_profile``). The returned dict does
        NOT include the seed embedding — callers needing the vector
        use ``get_procedural`` separately. This keeps the bootstrap
        return value small.

        Raises
        ------
        ValueError
            If ``mbti_type`` is not one of the 16 standard codes. Caller
            (handler) should catch and return HTTP 400.
        """
        # Validate FIRST — never embed or upsert with bad MBTI.
        normalized_mbti = _validate_mbti_full(mbti_type)

        # Fast path: existing profile.
        existing = self._pg.get_user_profile(user_id)
        if existing is not None:
            logger.debug(
                f"get_or_create_profile({user_id!r}): existing profile, "
                f"returning unchanged"
            )
            return existing

        # Cold start: embed seed sentence for the user's MBTI group.
        group = _mbti_group_from_full(normalized_mbti)
        seed_text = _MBTI_GROUP_SEEDS[group]
        logger.info(
            f"get_or_create_profile({user_id!r}): cold-start, seeding "
            f"with {group} canonical embedding"
        )
        seed_embedding = self._embed.embed_text(seed_text)

        # Upsert with seed. category_weights starts empty — populated
        # by Round 5-D consolidation as interactions accumulate.
        self._pg.upsert_user_profile(
            user_id=user_id,
            mbti_type=normalized_mbti,
            category_weights={},
            preference_embedding=seed_embedding,
        )

        # Re-read to get canonical row (with timestamps from server).
        # If the read fails (transient DB issue post-write), return a
        # synthesized dict matching the shape — caller doesn't need to
        # know the read failed since the write succeeded.
        created = self._pg.get_user_profile(user_id)
        if created is not None:
            return created
        return {
            "user_id": user_id,
            "mbti_type": normalized_mbti,
            "category_weights": {},
            "created_at": None,
            "updated_at": None,
        }
