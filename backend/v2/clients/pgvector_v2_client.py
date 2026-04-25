"""PgVector v2 Client — AI LENS v2 Storage Hub.

Thin wrapper over ``pg8000.native`` for the four v2 tables
(``articles``, ``article_versions``, ``user_profiles``,
``user_interactions``). v1 remains on ``clients.pgvector_client``; this
module is a separate class operating against the v2 database so the two
never share state.

Connection
----------
* Env vars: ``PG_V2_HOST``, ``PG_V2_PORT`` (5432), ``PG_V2_DATABASE``
  (``ailens_v2``), ``PG_V2_USER`` (``ailens``), ``PG_V2_PASSWORD``.
* If ``PG_V2_PASSWORD`` is blank the client runs in **no-op mode** — every
  method returns a safe default (``None`` / ``[]`` / ``{}`` / ``''``) and
  logs a warning. This mirrors v1 ``PgVectorClient`` so local dev and
  unit tests work without RDS.
* The ``pg8000.native.Connection`` is created lazily on first use and
  reused within the same Lambda container; ``close()`` tears it down.

Error policy
------------
Query exceptions are caught and logged — methods fall back to the same
no-op default. The lone exception is ``update_article_status`` which
logs at ``ERROR`` level with ``exc_info`` because a failed status
transition can strand articles outside the pipeline. Upstream handlers
decide how to react; this client never raises from a DB error.

Schema reference: ``backend/v2/infrastructure/schema_v2.sql``.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Constants ────────────────────────────────────────────────────────────────

# Titan V2 output dimension. schema_v2.sql pins every vector column to 1024.
_DEFAULT_DIMENSION = 1024

# article_versions.mbti_type / user_interactions.mbti_type CHECK values.
_MBTI_GROUPS = ("NT", "NF", "ST", "SF")

# articles.status CHECK values.
_ARTICLE_STATUSES = ("raw", "transformed", "failed")

# user_interactions.interaction_type CHECK values.
_INTERACTION_TYPES = ("click", "dwell", "scroll", "skip", "react", "rate")

# user_interactions columns that may arrive via record_interaction(**kwargs).
# Anything else in kwargs goes into the ``metadata`` JSONB column.
_INTERACTION_COLUMNS = ("dwell_ms", "scroll_pct", "rating", "reaction_type")


# ── Module-level helpers ─────────────────────────────────────────────────────


def _normalize_mbti_group(mbti: str) -> str:
    """Convert full MBTI (INTJ) or group (NT) to group form (NT/NF/ST/SF).

    Shared with Context Broker and Recommend Agent (Phase 3) so callers
    can pass either a user's stored ``mbti_type`` (4-char) or a 2-char
    group without branching.
    """
    if not isinstance(mbti, str):
        raise ValueError(f"Invalid mbti: {mbti!r}")
    if len(mbti) == 4:
        group = mbti[1:3]
    elif len(mbti) == 2:
        group = mbti
    else:
        raise ValueError(f"Invalid mbti: {mbti!r}")
    if group not in _MBTI_GROUPS:
        raise ValueError(f"Invalid mbti group: {group!r}")
    return group


def _vec_literal(embedding: List[float]) -> str:
    """Render a Python list of floats as a pgvector text literal.

    Example: ``[0.1, 0.2, 0.3]`` → ``'[0.1,0.2,0.3]'``. Paired with a
    ``::vector`` cast in SQL because pg8000 has no native vector support.

    Pure conversion — does not validate dimension. ``NaN``/``Inf`` are
    stringified verbatim and rejected downstream by pgvector. Dimension
    validation is a per-instance concern; see ``_validate_embedding``.
    """
    return "[" + ",".join(str(v) for v in embedding) + "]"


def _json_default(obj: Any) -> Any:
    """Fallback serializer used by every ``json.dumps`` call in this client.

    JSONB columns store caller-supplied metadata (collector headers,
    interaction annotations). Callers occasionally hand us ``datetime``,
    ``Decimal``, or ``set`` values; those three are the tolerated types
    here. Anything else raises ``TypeError`` — an explicit failure is
    better than silently losing data in a JSONB blob.

    * ``datetime`` / ``date`` → ISO-8601 string (timezone preserved)
    * ``Decimal``             → ``int`` when whole, otherwise ``float``
    * ``set`` / ``frozenset`` → ``list``

    Deliberately narrower than v1's ``core.response._json_serializer``
    (no ``hasattr(obj, '__dict__')`` fallback) because JSONB stores
    structured query-able data; smuggling object state via ``__dict__``
    would escape that contract.
    """
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    if isinstance(obj, (set, frozenset)):
        return list(obj)
    raise TypeError(
        f"Object of type {type(obj).__name__} is not JSON serializable"
    )


# ── Client ───────────────────────────────────────────────────────────────────


class PgVectorV2Client:
    """Client for the AI LENS v2 pgvector Storage Hub.

    See module docstring for connection and error semantics.
    """

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        database: Optional[str] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        dimension: int = _DEFAULT_DIMENSION,
    ) -> None:
        self._host = host or os.getenv("PG_V2_HOST", "")
        self._port = port or int(os.getenv("PG_V2_PORT", "5432"))
        self._database = database or os.getenv("PG_V2_DATABASE", "ailens_v2")
        self._user = user or os.getenv("PG_V2_USER", "ailens")
        self._password = (
            password if password is not None else os.getenv("PG_V2_PASSWORD", "")
        )
        self._dimension = dimension
        self._conn = None
        self._enabled = bool(self._password)
        if not self._enabled:
            logger.warning(
                "PG_V2_PASSWORD is empty — PgVectorV2Client running in no-op mode"
            )

    # ---- connection ---------------------------------------------------------

    @property
    def conn(self):
        """Lazy ``pg8000.native.Connection``. Cached for container reuse."""
        if self._conn is None:
            # Lazy import: unit tests and ``--dry-run`` paths don't need pg8000.
            import pg8000.native  # noqa: WPS433

            self._conn = pg8000.native.Connection(
                host=self._host,
                port=self._port,
                database=self._database,
                user=self._user,
                password=self._password,
                ssl_context=True,
            )
            logger.info(
                f"Connected to {self._host}:{self._port}/{self._database}"
            )
        return self._conn

    def close(self) -> None:
        """Close the cached connection if one exists. Safe to call twice."""
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    # ---- validation ---------------------------------------------------------

    def _validate_embedding(self, embedding: List[float]) -> None:
        """Fail fast on wrong-length vectors.

        ``NaN``/``Inf`` values are left to pgvector to reject — the server
        returns a clear error, and client-side filtering here would swallow
        useful diagnostics. Length, however, is both cheap to check and
        otherwise silent in no-op mode, so we validate it unconditionally.
        Called from every method that writes or queries on an embedding.
        """
        if len(embedding) != self._dimension:
            raise ValueError(
                f"Embedding length mismatch: got {len(embedding)}, "
                f"expected {self._dimension}"
            )

    # =========================================================================
    # articles
    # =========================================================================

    def insert_article(
        self,
        news_id: str,
        metadata: Dict[str, Any],
        embedding: List[float],
    ) -> None:
        """Insert a raw article. Idempotent via ``ON CONFLICT DO NOTHING``.

        ``metadata`` must supply ``title``; ``category`` and ``published_at``
        are optional top-level columns. Any remaining keys go into the
        ``metadata`` JSONB column.

        DO NOTHING prevents accidental re-trigger of Core 2 transform on
        re-collected articles — once a news_id is present we keep its
        existing row (which may already be ``status='transformed'``). Use
        ``update_article_status`` for deliberate transitions and a future
        dedicated method (not this one) for metadata edits.
        """
        self._validate_embedding(embedding)
        if not self._enabled:
            return
        try:
            meta = dict(metadata or {})
            title = meta.pop("title", "")
            category = meta.pop("category", None)
            published_at = meta.pop("published_at", None)
            self.conn.run(
                """
                INSERT INTO articles
                    (news_id, status, title, category, published_at, embedding, metadata)
                VALUES
                    (:news_id, 'raw', :title, :category, :published_at,
                     :embedding::vector, :metadata::jsonb)
                ON CONFLICT (news_id) DO NOTHING
                """,
                news_id=news_id,
                title=title,
                category=category,
                published_at=published_at,
                embedding=_vec_literal(embedding),
                metadata=json.dumps(meta, default=_json_default, ensure_ascii=False),
            )
        except Exception as exc:
            logger.warning(f"insert_article({news_id!r}) failed: {exc}")

    def update_article_status(self, news_id: str, status: str) -> None:
        """Transition an article's ``status`` column and bump ``updated_at``.

        Raises ``ValueError`` for out-of-range status values (server-side
        CHECK would also reject, but failing fast avoids a round-trip).
        """
        if status not in _ARTICLE_STATUSES:
            raise ValueError(
                f"Invalid status: {status!r}. Must be one of {_ARTICLE_STATUSES}"
            )
        if not self._enabled:
            return
        try:
            self.conn.run(
                "UPDATE articles SET status = :status, updated_at = now() "
                "WHERE news_id = :nid",
                status=status,
                nid=news_id,
            )
        except Exception as exc:
            logger.error(
                f"update_article_status({news_id!r}, {status!r}) failed: {exc}",
                exc_info=True,
            )

    def get_articles_by_status(
        self,
        status: str,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Return articles with ``status``, oldest first (FIFO for Core 2)."""
        if not self._enabled:
            return []
        try:
            rows = self.conn.run(
                """
                SELECT news_id, status, title, category, published_at, metadata,
                       created_at, updated_at
                FROM articles
                WHERE status = :status
                ORDER BY created_at ASC
                LIMIT :lim
                """,
                status=status,
                lim=limit,
            )
            return [
                {
                    "news_id": r[0],
                    "status": r[1],
                    "title": r[2],
                    "category": r[3],
                    "published_at": r[4],
                    "metadata": r[5],
                    "created_at": r[6],
                    "updated_at": r[7],
                }
                for r in rows
            ]
        except Exception as exc:
            logger.warning(f"get_articles_by_status({status!r}) failed: {exc}")
            return []

    def find_similar_articles(
        self,
        embedding: List[float],
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Cosine-nearest articles (pre-MBTI embedding).

        Restricted to ``status='transformed'`` so callers never surface a
        raw or failed article. Used for "related articles" UI, not feed
        ranking (use ``find_feed_candidates`` for that).
        """
        self._validate_embedding(embedding)
        if not self._enabled:
            return []
        try:
            vec = _vec_literal(embedding)
            rows = self.conn.run(
                """
                SELECT news_id, title, category, published_at, metadata,
                       embedding <=> :q::vector AS distance
                FROM articles
                WHERE status = 'transformed'
                ORDER BY embedding <=> :q::vector
                LIMIT :lim
                """,
                q=vec,
                lim=limit,
            )
            return [
                {
                    "news_id": r[0],
                    "title": r[1],
                    "category": r[2],
                    "published_at": r[3],
                    "metadata": r[4],
                    "distance": float(r[5]) if r[5] is not None else None,
                }
                for r in rows
            ]
        except Exception as exc:
            logger.warning(f"find_similar_articles failed: {exc}")
            return []

    def filter_existing_news_ids(self, news_ids: List[str]) -> set:
        """Return the subset of ``news_ids`` already present in ``articles``.

        Used by Core 1 Collector to skip Bedrock + S3 writes for duplicates.
        ``insert_article`` already has ``ON CONFLICT (news_id) DO NOTHING``,
        so this is strictly a cost-saver for the upstream embed/S3 steps —
        correctness still holds if the method returns the empty set.

        Empty input short-circuits to avoid pg8000's empty-array type
        inference brittleness (see the SAFETY comment in
        ``find_feed_candidates`` about ``<> ALL(ARRAY[]::text[])``). For
        non-empty input the Python list binds to ``text[]`` the same way
        ``find_feed_candidates.excl`` does — pg8000 handles the cast once
        the list has at least one element.

        Fail-open semantics: if the query raises (DB down, transient
        network error), returns an empty set so the caller treats every
        candidate as "new" and relies on ``ON CONFLICT DO NOTHING`` for
        dedup at insert time. A logged warning records the failure.
        """
        if not self._enabled or not news_ids:
            return set()
        try:
            rows = self.conn.run(
                "SELECT news_id FROM articles WHERE news_id = ANY(:ids::text[])",
                ids=list(news_ids),
            )
            return {r[0] for r in rows}
        except Exception as exc:
            logger.warning(f"filter_existing_news_ids failed: {exc}")
            return set()

    # =========================================================================
    # article_versions
    # =========================================================================

    def insert_article_version(
        self,
        news_id: str,
        mbti_type: str,
        metadata: Dict[str, Any],
        embedding: List[float],
    ) -> str:
        """Upsert one MBTI version. Returns the row's ``version_id`` UUID.

        ``ON CONFLICT (news_id, mbti_type) DO UPDATE`` makes Core 2
        Transform retries safe: re-running with an improved prompt
        overwrites the prior version in place. This is intentionally
        stricter than ``insert_article`` — versions *should* be replaced
        when we re-transform; originals should not.

        ``metadata`` must supply ``title`` and ``body``; the rest goes
        into the ``metadata`` JSONB column.

        Accepts either full MBTI (``INTJ``) or a 2-char group
        (``NT``) via ``_normalize_mbti_group``.
        """
        group = _normalize_mbti_group(mbti_type)
        self._validate_embedding(embedding)
        if not self._enabled:
            return ""
        try:
            meta = dict(metadata or {})
            title = meta.pop("title", "")
            body = meta.pop("body", "")
            rows = self.conn.run(
                """
                INSERT INTO article_versions
                    (news_id, mbti_type, title, body, embedding, metadata)
                VALUES
                    (:news_id, :mbti_type, :title, :body,
                     :embedding::vector, :metadata::jsonb)
                ON CONFLICT (news_id, mbti_type) DO UPDATE SET
                    title     = EXCLUDED.title,
                    body      = EXCLUDED.body,
                    embedding = EXCLUDED.embedding,
                    metadata  = EXCLUDED.metadata
                RETURNING version_id
                """,
                news_id=news_id,
                mbti_type=group,
                title=title,
                body=body,
                embedding=_vec_literal(embedding),
                metadata=json.dumps(meta, default=_json_default, ensure_ascii=False),
            )
            return str(rows[0][0]) if rows else ""
        except Exception as exc:
            logger.warning(
                f"insert_article_version({news_id!r}, {group!r}) failed: {exc}"
            )
            return ""

    def get_article_versions(self, news_id: str) -> Dict[str, Dict[str, Any]]:
        """Return ``{mbti_group: version_dict}`` with 0–4 entries."""
        if not self._enabled:
            return {}
        try:
            rows = self.conn.run(
                """
                SELECT version_id, mbti_type, title, body, metadata, created_at
                FROM article_versions
                WHERE news_id = :nid
                """,
                nid=news_id,
            )
            return {
                r[1]: {
                    "version_id": str(r[0]),
                    "mbti_type": r[1],
                    "title": r[2],
                    "body": r[3],
                    "metadata": r[4],
                    "created_at": r[5],
                }
                for r in rows
            }
        except Exception as exc:
            logger.warning(f"get_article_versions({news_id!r}) failed: {exc}")
            return {}

    # =========================================================================
    # user_profiles
    # =========================================================================

    def upsert_user_profile(
        self,
        user_id: str,
        mbti_type: Optional[str],
        category_weights: Optional[Dict[str, float]],
        preference_embedding: Optional[List[float]],
    ) -> None:
        """Insert-or-update a profile. ``mbti_type`` and embedding may be NULL.

        The 4-char ``mbti_type`` is stored verbatim (schema CHECK enforces
        the 16-value set). ``category_weights`` defaults to ``{}`` so the
        JSONB column stays non-null even during cold-start.

        Two explicit SQL paths rather than a single ``CASE WHEN :vec IS
        NULL THEN NULL ELSE :vec::vector END`` — PostgreSQL cannot infer
        the type of a bare parameter inside that CASE (error 42P08
        "could not determine data type of parameter"), because neither
        branch supplies type information for ``:vec`` itself before the
        cast runs. The pre-cast parameter is inspected for the IS NULL
        check, and the server refuses to proceed without a resolved
        type. Branching in Python sidesteps this entirely.
        """
        if preference_embedding is not None:
            self._validate_embedding(preference_embedding)
        if not self._enabled:
            return
        try:
            weights_json = json.dumps(
                category_weights or {},
                default=_json_default,
                ensure_ascii=False,
            )
            if preference_embedding is not None:
                self.conn.run(
                    """
                    INSERT INTO user_profiles
                        (user_id, mbti_type, category_weights, preference_embedding)
                    VALUES
                        (:uid, :mbti, :weights::jsonb, :vec::vector)
                    ON CONFLICT (user_id) DO UPDATE SET
                        mbti_type            = EXCLUDED.mbti_type,
                        category_weights     = EXCLUDED.category_weights,
                        preference_embedding = EXCLUDED.preference_embedding,
                        updated_at           = now()
                    """,
                    uid=user_id,
                    mbti=mbti_type,
                    weights=weights_json,
                    vec=_vec_literal(preference_embedding),
                )
            else:
                self.conn.run(
                    """
                    INSERT INTO user_profiles
                        (user_id, mbti_type, category_weights, preference_embedding)
                    VALUES
                        (:uid, :mbti, :weights::jsonb, NULL)
                    ON CONFLICT (user_id) DO UPDATE SET
                        mbti_type            = EXCLUDED.mbti_type,
                        category_weights     = EXCLUDED.category_weights,
                        preference_embedding = EXCLUDED.preference_embedding,
                        updated_at           = now()
                    """,
                    uid=user_id,
                    mbti=mbti_type,
                    weights=weights_json,
                )
        except Exception as exc:
            logger.warning(f"upsert_user_profile({user_id!r}) failed: {exc}")

    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Return the profile dict or ``None`` if missing.

        ``preference_embedding`` is intentionally omitted from the select
        list — it's a 1024-float column used only inside SQL joins, not by
        application code. Phase 3 Memory Manager may add an
        ``include_embedding`` parameter (or a dedicated method) if a
        consumer actually needs the raw vector in Python.
        """
        if not self._enabled:
            return None
        try:
            rows = self.conn.run(
                """
                SELECT user_id, mbti_type, category_weights, created_at, updated_at
                FROM user_profiles
                WHERE user_id = :uid
                LIMIT 1
                """,
                uid=user_id,
            )
            if not rows:
                return None
            r = rows[0]
            return {
                "user_id": r[0],
                "mbti_type": r[1],
                "category_weights": r[2],
                "created_at": r[3],
                "updated_at": r[4],
            }
        except Exception as exc:
            logger.warning(f"get_user_profile({user_id!r}) failed: {exc}")
            return None

    # =========================================================================
    # user_interactions
    # =========================================================================

    def record_interaction(
        self,
        user_id: str,
        news_id: str,
        mbti_type: Optional[str],
        interaction_type: str,
        **kwargs: Any,
    ) -> None:
        """Log a single interaction event.

        Known kwargs — ``dwell_ms``, ``scroll_pct``, ``rating``,
        ``reaction_type`` — map to their dedicated columns so Stage 2
        ranking can ``AVG``/``COUNT FILTER`` without JSONB path casts.
        Any other kwargs land in the ``metadata`` JSONB column and are
        passed through ``_json_default`` (datetime/Decimal/set tolerated).

        ``mbti_type`` is optional — a 'skip' event may have no version.
        Note: Phase 3 aggregations that group by version must exclude
        NULL rows, e.g.
        ``COUNT(*) FILTER (WHERE mbti_type IS NOT NULL)``.
        """
        if interaction_type not in _INTERACTION_TYPES:
            raise ValueError(
                f"Invalid interaction_type: {interaction_type!r}. "
                f"Must be one of {_INTERACTION_TYPES}"
            )
        group = _normalize_mbti_group(mbti_type) if mbti_type else None
        if not self._enabled:
            return
        try:
            col_values = {col: kwargs.pop(col, None) for col in _INTERACTION_COLUMNS}
            metadata = kwargs  # leftover kwargs → JSONB
            self.conn.run(
                """
                INSERT INTO user_interactions
                    (user_id, news_id, mbti_type, interaction_type,
                     dwell_ms, scroll_pct, rating, reaction_type, metadata)
                VALUES
                    (:uid, :nid, :mbti, :itype,
                     :dwell_ms, :scroll_pct, :rating, :reaction_type,
                     :metadata::jsonb)
                """,
                uid=user_id,
                nid=news_id,
                mbti=group,
                itype=interaction_type,
                dwell_ms=col_values["dwell_ms"],
                scroll_pct=col_values["scroll_pct"],
                rating=col_values["rating"],
                reaction_type=col_values["reaction_type"],
                metadata=json.dumps(
                    metadata, default=_json_default, ensure_ascii=False
                ),
            )
        except Exception as exc:
            logger.warning(
                f"record_interaction({user_id!r}, {news_id!r}) failed: {exc}"
            )

    def get_user_interactions(
        self,
        user_id: str,
        limit: int = 100,
        since: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Return newest-first interaction rows, optionally filtered by time."""
        if not self._enabled:
            return []
        try:
            if since is not None:
                rows = self.conn.run(
                    """
                    SELECT id, user_id, news_id, mbti_type, interaction_type,
                           dwell_ms, scroll_pct, rating, reaction_type,
                           metadata, created_at
                    FROM user_interactions
                    WHERE user_id = :uid AND created_at >= :since
                    ORDER BY created_at DESC
                    LIMIT :lim
                    """,
                    uid=user_id,
                    since=since,
                    lim=limit,
                )
            else:
                rows = self.conn.run(
                    """
                    SELECT id, user_id, news_id, mbti_type, interaction_type,
                           dwell_ms, scroll_pct, rating, reaction_type,
                           metadata, created_at
                    FROM user_interactions
                    WHERE user_id = :uid
                    ORDER BY created_at DESC
                    LIMIT :lim
                    """,
                    uid=user_id,
                    lim=limit,
                )
            return [
                {
                    "id": r[0],
                    "user_id": r[1],
                    "news_id": r[2],
                    "mbti_type": r[3],
                    "interaction_type": r[4],
                    "dwell_ms": r[5],
                    "scroll_pct": r[6],
                    "rating": r[7],
                    "reaction_type": r[8],
                    "metadata": r[9],
                    "created_at": r[10],
                }
                for r in rows
            ]
        except Exception as exc:
            logger.warning(f"get_user_interactions({user_id!r}) failed: {exc}")
            return []

    # =========================================================================
    # feed ranking
    # =========================================================================

    def find_feed_candidates(
        self,
        user_mbti: str,
        preference_embedding: Optional[List[float]],
        exclude_news_ids: List[str],
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Return candidate article versions for the user's MBTI group.

        Joins ``article_versions`` with ``articles`` so the caller receives
        the version body plus article metadata (``category``,
        ``published_at``) in one round-trip. Restricted to
        ``articles.status = 'transformed'`` for safety against partial
        pipeline state.

        Cold-start path: if ``preference_embedding`` is ``None``, falls
        back to recency-based ranking within the user's MBTI version.
        Phase 3 will extend this to a popularity + recency combination.

        ``exclude_news_ids`` filters out news_ids the user has already
        seen; an empty list skips the clause entirely (no-op filter).

        ``user_mbti`` accepts full 16-value MBTI (``INTJ``) or 2-char
        group (``NT``).
        """
        group = _normalize_mbti_group(user_mbti)
        exclude = list(exclude_news_ids or [])
        if preference_embedding is not None:
            self._validate_embedding(preference_embedding)
        if not self._enabled:
            return []

        # SAFETY: this query is the only f-string SQL in this module.
        # The three interpolated fragments below — ``select_distance``,
        # ``order_by``, ``where_exclude`` — are each picked from at most
        # two hard-coded string literals defined in this function. No
        # argument, env var, column value, or user input reaches the
        # f-string; real values travel via ``:grp / :lim / :pref /
        # :excl`` parameter bindings. We assemble SQL this way only
        # because pg8000 empty-array type inference is brittle for
        # ``<> ALL(ARRAY[]::text[])`` — we'd rather omit the clause
        # than rely on it.
        if preference_embedding is not None:
            select_distance = "av.embedding <=> :pref::vector AS distance"
            order_by = "ORDER BY av.embedding <=> :pref::vector"
        else:
            select_distance = "NULL::float8 AS distance"
            order_by = "ORDER BY a.published_at DESC NULLS LAST"

        where_exclude = (
            "AND av.news_id <> ALL(:excl::text[])" if exclude else ""
        )

        sql = f"""
            SELECT av.news_id, av.mbti_type, av.title, av.body,
                   av.metadata, av.created_at,
                   a.category, a.published_at,
                   {select_distance}
            FROM article_versions av
            JOIN articles a ON a.news_id = av.news_id
            WHERE av.mbti_type = :grp
              AND a.status = 'transformed'
              {where_exclude}
            {order_by}
            LIMIT :lim
        """

        params: Dict[str, Any] = {"grp": group, "lim": limit}
        if preference_embedding is not None:
            params["pref"] = _vec_literal(preference_embedding)
        if exclude:
            params["excl"] = exclude

        try:
            rows = self.conn.run(sql, **params)
            return [
                {
                    "news_id": r[0],
                    "mbti_type": r[1],
                    "title": r[2],
                    "body": r[3],
                    "metadata": r[4],
                    "created_at": r[5],
                    "category": r[6],
                    "published_at": r[7],
                    "distance": float(r[8]) if r[8] is not None else None,
                }
                for r in rows
            ]
        except Exception as exc:
            logger.warning(f"find_feed_candidates({user_mbti!r}) failed: {exc}")
            return []

    # =========================================================================
    # article_selections (Phase 2.5 — Selection + Minimal Feed)
    # =========================================================================

    def upsert_selection_score(
        self,
        news_id: str,
        mbti_type: str,
        selection_date: date,
        mbti_score: float,
        composite_score: float,
        quality_score: Optional[float] = None,
    ) -> None:
        """Insert or update one per-MBTI score row for a candidate article.

        On re-run within the same day the three score columns and scored_at
        are overwritten; selected and transformed_at are preserved so an
        article that has already been transformed stays transformed when
        its scores refresh. Accepts full MBTI (INTJ) or 2-char group (NT).
        """
        group = _normalize_mbti_group(mbti_type)
        if not self._enabled:
            return
        try:
            self.conn.run(
                """
                INSERT INTO article_selections
                    (news_id, mbti_type, selection_date,
                     mbti_score, quality_score, composite_score)
                VALUES
                    (:news_id, :mbti_type, :selection_date,
                     :mbti_score, :quality_score, :composite_score)
                ON CONFLICT (news_id, mbti_type, selection_date)
                DO UPDATE SET
                    mbti_score      = EXCLUDED.mbti_score,
                    quality_score   = EXCLUDED.quality_score,
                    composite_score = EXCLUDED.composite_score,
                    scored_at       = now()
                """,
                news_id=news_id,
                mbti_type=group,
                selection_date=selection_date,
                mbti_score=float(mbti_score),
                quality_score=(
                    float(quality_score) if quality_score is not None else None
                ),
                composite_score=float(composite_score),
            )
        except Exception as exc:
            logger.warning(
                f"upsert_selection_score({news_id!r},{group},{selection_date}) "
                f"failed: {exc}"
            )

    def rerank_selections(
        self,
        selection_date: date,
        mbti_type: str,
        top_n: int = 20,
    ) -> int:
        """Re-rank (date, mbti) partition; flag top N selected, rest not.

        Single SQL statement (CTE + UPDATE with RETURNING) so no transient
        partial-flag state is visible. transformed_at is preserved across
        selected flips — re-entering top N on a later same-day run skips
        re-transform. Returns count left with selected=TRUE.
        """
        group = _normalize_mbti_group(mbti_type)
        if not self._enabled:
            return 0
        try:
            rows = self.conn.run(
                """
                WITH ranked AS (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               ORDER BY composite_score DESC, scored_at ASC
                           ) AS rn
                    FROM article_selections
                    WHERE selection_date = :d AND mbti_type = :g
                )
                UPDATE article_selections s
                   SET selected = (r.rn <= :n)
                  FROM ranked r
                 WHERE s.id = r.id
             RETURNING s.selected
                """,
                d=selection_date,
                g=group,
                n=int(top_n),
            )
            return sum(1 for r in rows if r[0])
        except Exception as exc:
            logger.warning(
                f"rerank_selections({selection_date},{group},top_n={top_n}) "
                f"failed: {exc}"
            )
            return 0

    def get_transform_queue(
        self,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Return selected rows still awaiting transform, oldest-scored first.

        JOIN articles for title/category/published_at/metadata so the
        Transform worker gets everything in one round-trip. FIFO by
        scored_at ASC; partial index idx_selections_transform_queue
        keeps the scan at O(pending).
        """
        if not self._enabled:
            return []
        try:
            rows = self.conn.run(
                """
                SELECT s.id, s.news_id, s.mbti_type, s.selection_date,
                       s.composite_score, s.scored_at,
                       a.title, a.category, a.published_at, a.metadata
                FROM article_selections s
                JOIN articles a ON a.news_id = s.news_id
                WHERE s.selected = TRUE AND s.transformed_at IS NULL
                ORDER BY s.scored_at ASC
                LIMIT :n
                """,
                n=int(limit),
            )
            return [
                {
                    "selection_id": r[0],
                    "news_id": r[1],
                    "mbti_type": r[2],
                    "selection_date": r[3],
                    "composite_score": float(r[4]),
                    "scored_at": r[5],
                    "title": r[6],
                    "category": r[7],
                    "published_at": r[8],
                    "article_metadata": r[9],
                }
                for r in rows
            ]
        except Exception as exc:
            logger.warning(f"get_transform_queue(limit={limit}) failed: {exc}")
            return []

    def mark_transformed(
        self,
        news_id: str,
        mbti_type: str,
        selection_date: date,
    ) -> None:
        """Stamp transformed_at = now() on one selection row.

        Silent no-op if the row doesn't exist (race insurance against
        re-rank between polling and completion). Errors go to logger.error
        with exc_info because a missed stamp leaks a phantom pending row
        forever — stricter than other warning-only swallows.
        """
        group = _normalize_mbti_group(mbti_type)
        if not self._enabled:
            return
        try:
            self.conn.run(
                """
                UPDATE article_selections
                   SET transformed_at = now()
                 WHERE news_id = :nid
                   AND mbti_type = :g
                   AND selection_date = :d
                """,
                nid=news_id,
                g=group,
                d=selection_date,
            )
        except Exception as exc:
            logger.error(
                f"mark_transformed({news_id!r},{group},{selection_date}) "
                f"failed: {exc}",
                exc_info=True,
            )

    def get_feed(
        self,
        mbti_type: str,
        limit: int = 20,
        since_date: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """Return the feed payload for one MBTI group.

        JOIN article_selections + articles + article_versions, filtered to
        selected + transformed within since_date window (default: today
        KST minus 7 days). ORDER BY selection_date DESC, composite_score
        DESC. Empty list on error or when disabled.
        """
        group = _normalize_mbti_group(mbti_type)
        if not self._enabled:
            return []
        if since_date is None:
            kst = timezone(timedelta(hours=9))
            since_date = datetime.now(kst).date() - timedelta(days=7)
        try:
            rows = self.conn.run(
                """
                SELECT s.news_id, s.mbti_type, s.selection_date,
                       s.composite_score, s.transformed_at,
                       a.category, a.published_at, a.metadata,
                       av.title, av.body, av.metadata
                FROM article_selections s
                JOIN articles a ON a.news_id = s.news_id
                JOIN article_versions av
                     ON av.news_id = s.news_id
                    AND av.mbti_type = s.mbti_type
                WHERE s.selected = TRUE
                  AND s.transformed_at IS NOT NULL
                  AND s.mbti_type = :g
                  AND s.selection_date >= :cutoff
                ORDER BY s.selection_date DESC, s.composite_score DESC
                LIMIT :n
                """,
                g=group,
                cutoff=since_date,
                n=int(limit),
            )
            return [
                {
                    "news_id": r[0],
                    "mbti_type": r[1],
                    "selection_date": r[2],
                    "composite_score": float(r[3]),
                    "transformed_at": r[4],
                    "category": r[5],
                    "published_at": r[6],
                    "article_metadata": r[7],
                    "version_title": r[8],
                    "version_body": r[9],
                    "version_metadata": r[10],
                }
                for r in rows
            ]
        except Exception as exc:
            logger.warning(f"get_feed({group},limit={limit}) failed: {exc}")
            return []
