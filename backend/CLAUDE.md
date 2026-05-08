# backend/

CLAUDE.md 의 Backend Module Layers 섹션에서 분리됨 — backend/ 전체의 디렉토리 / 모듈 구조 reference. v1 (production) 과 v2 의 layout, 모듈별 책임, 주요 entry point 를 다룸.

본 파일은 backend/ 안에서 작업 시 자동 load. 본 repository 의 root CLAUDE.md 는 1줄 포인터로 본 파일 reference.

frontend-next/CLAUDE.md / frontend-admin/CLAUDE.md 패턴 일관.

---

### Backend Module Layers

```
handlers/           → Lambda entry points. Each handler does its own HTTP method + path
                     routing internally (not relying on API Gateway routing). Supports
                     both REST API v1 and HTTP API v2 event formats.
                     Deployed (18): article_collector, search, article, chatbot, engagement,
                     tts, time_machine, s3_articles, user, archive, podcast, recommendation,
                     post, question, metrics, abtest, translation, briefing.
  pipeline/         → Step Functions stages (5 deployed Lambdas):
                     step1_select, step2_classify, step3_transform, step4_validate, supervisor.
                     translation_pipeline.py also lives here but is not in deploy.sh.
clients/            → Service clients: dynamodb, personal_db, podcast_db, s3_article, s3_xml,
                     opensearch, pgvector, embedding (Titan), translate (AWS Translate),
                     personalize (AWS Personalize for recommendations).
                     Bedrock Claude is wrapped by clients/mbti_transform_service.py (unusual
                     placement — it's a service file inside clients/). Polly has no client file;
                     tts_handler and podcast_handler call boto3 polly directly.
                     OpenSearch and pgvector clients are lazy-imported (not in __init__.py)
                     to avoid pulling in opensearch-py/pg8000 at module load time.
repositories/       → Business-level data access on top of clients (Personal, Podcast, Settings, Log)
services/           → Business logic: article_filter, prompt_service, prompt_loader,
                     collaborative_filter, metrics, briefing_generator (used by
                     briefing_handler), stock_service (used by chatbot_handler for
                     inline stock/market-index lookups)
models/             → Dataclasses: Article, Podcast, UserProfile/ArchivedSentence/ReadingRecord
                     (in personal.py), ABTest
core/               → Framework: decorators.py (@lambda_handler, @require_params, etc.),
                     exceptions.py (BackendError hierarchy), response.py (success/error builders),
                     revalidation.py (CacheRevalidator — triggers frontend cache invalidation)
config/             → settings.py (env-var-driven @dataclass Settings, cached
                     via @lru_cache get_settings()) + constants.py (model IDs,
                     DynamoDB table names, S3_BODY_FIELDS, CORS_HEADERS,
                     category normalization + search aliases, MBTI_GROUP_INFO,
                     Polly podcast voice styles). Never call `os.getenv` in
                     handlers — go through `config.settings`.
prompts/            → AI prompt templates organized by purpose:
                     transform/ (nt/nf/st/sf.md — MBTI rewriting),
                     chatbot/ (nt/nf/st/sf.md — chatbot persona),
                     selection/ (article_scorer.md),
                     validation/ (validator.md),
                     supervisor/ (supervisor_review.md),
                     podcast/ (podcast_script.md),
                     question/ (daily_question.md)
utils/              → Small helpers included in the Lambda zip: date_utils.py,
                     hash_utils.py. Not a layer in the architectural sense —
                     just shared utilities.
common/             → Cross-track shared utilities (v1 / v2 / admin all import from here).
                     Each module is a thin wrapper with its own 5-min TTL cache, picking
                     fail-open vs fail-closed based on what's safer when the upstream
                     store is unavailable (see "Feature Flags" / "Secrets" sections below).
                     - `feature_flag.py` — DDB-backed feature flags + numeric thresholds
                                           (Admin-2a `0ee43df` + Admin-2d `e172175`). Fail-open / fail-safe.
                     - `secrets.py`      — SSM SecureString reader (Admin-2c, `61b7177`). Fail-closed.
                     Bundled into the v1 Lambda zip by `deploy.sh` and the v2 zip by
                     `v2/deploy-v2.sh` (both copy lists include `common`). Import path inside
                     Lambda: `from common.<module> import ...` (zip root, no `backend.` prefix).
```

A legacy `backend/MBTI_TRANSFORM_PROMPT.md` still sits at the backend root as the last-resort fallback for `clients/mbti_transform_service.py`. The canonical prompts live in `prompts/transform/` now — don't edit the root file.

