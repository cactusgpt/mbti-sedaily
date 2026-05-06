# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI LENS — 서울경제신문의 MBTI 맞춤형 경제 뉴스 서비스. 원본 기사를 4개 MBTI 그룹(NT/NF/ST/SF) 스타일로 AI가 리라이팅하여 제공한다. MBTI 서비스는 영문사이트(en.sedaily.com)와 완전히 분리된 인프라를 사용한다.

- **Production**: https://mbti.sedaily.ai
- **API**: https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev

### MBTI Editor Personas

| Group | Editor | Style |
|-------|--------|-------|
| NT | 시현 | 전략형 분석가 — 애널리스트 리포트 |
| NF | 지원 | 가치형 해석자 — 칼럼/에세이 |
| ST | 정훈 | 실용형 실무자 — 팩트시트 |
| SF | 하은 | 공감형 소통가 — 친구 톡 |

### v1 / v2 Parallel Redesign

The repo currently holds two backend stacks side by side:

- **v1** — everything in `backend/` **outside** `backend/v2/`. This is the production backend serving `mbti.sedaily.ai` today. The rest of this CLAUDE.md describes v1 unless explicitly noted.
- **v2** — `backend/v2/`. A parallel redesign on branch `feature/backend-redesign` (recent commits are tagged `[v2]`). pgvector-centric storage hub; whole-corpus ingest followed by a **Core 1.5 Selector** that uses Nova Lite to score raw articles per MBTI and flag a top-N subset in the `article_selections` table; **Core 2 Transform** polls `article_selections.selected=TRUE AND transformed_at IS NULL` (not `articles.status='raw'`) and runs Opus 4.6 only for the MBTI groups the Selector chose (1–4 per article); **Core 3** exposes per-user reads via the Feed and Article Detail Lambdas, with a **Recommend Agent** (3-stage cosine + category + recency ranking) and **Memory Manager** / **Context Broker** layered on top of pgvector; Chat Agent eventually on Bedrock AgentCore Runtime. **Status (as of 2026-05-04):** v2 Feed (`/api/v2/feed`) and Article Detail (`/api/v2/article/{id}`) Lambdas serve production traffic at `mbti.sedaily.ai` (TASK-7 frontend cutover deployed 2026-04-27); the `sedaily-mbti-v2-selector-trigger` and `sedaily-mbti-v2-transform-trigger` EventBridge rules are ENABLED, so the Selector → Transform pipeline runs on schedule. Core 3 personalization (TASK-3.1–3.4, plus the frontend-side TASK-3.6/3.7 in Round 5-E/G) shipped: the Feed Lambda runs `MemoryManager` → `ContextBroker` → `RecommendAgent` inline for ranking, `sedaily-mbti-v2-interaction-dev` captures click/dwell/scroll/skip/react/rate events, and the frontend now dual-writes interactions to v1 + v2 and persists a 4-char MBTI derived from editor selection (시현=INTJ / 지원=INFP / 정훈=ISTJ / 하은=ESFP) so logged-in users hit the personalization warm path. TASK-3.5 (Round 5-D) consolidation Lambda code is committed (`backend/v2/handlers/core3_consolidate.py` + `MemoryManager.consolidate()` for EWMA-based preference updates, α=0.2, ≥10-distinct-news threshold) and listed in `deploy-v2.sh` as `sedaily-mbti-v2-consolidate-dev`, but the AWS Lambda + EventBridge daily cron (KST 03:00 / UTC 18:00) still need manual provisioning per the Definition of Done in `backend/v2/TASKS.md`. Still future: Chat Agent on AgentCore Runtime.

**If you're doing v2 work, read `backend/v2/CLAUDE.md` and `backend/v2/.clauderules` first — they override this file for v2-scoped changes.** Hard rules from `.clauderules` worth knowing even from outside v2: v2 work must not modify v1 files (including this CLAUDE.md, `deploy.sh`, or anything in `handlers/`, `clients/`, `core/`, `services/`, `config/`); AWS resource creation is conditional — allowed only after a documented plan with cost estimate, explicit user approval, and stop-on-anomaly + ID tracking, while Lambda function create/delete and any secret env-var writes (e.g. `PG_V2_PASSWORD`) remain always-manual; `update-function-code` and non-secret config updates on existing Lambdas are the only fully-automated path. Commit trailer must read exactly `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` — no model-capability suffix like "(1M context)" (GitHub parses author identity from the email, and parentheticals break the author-count stats).

v2 resources are namespaced `sedaily-mbti-v2-*-dev` (Lambda — `v2` goes in the middle, e.g. `sedaily-mbti-v2-collector-dev`, `sedaily-mbti-v2-selector-dev`, `sedaily-mbti-v2-transform-dev`, `sedaily-mbti-v2-feed-dev`, `sedaily-mbti-v2-article-dev`, `sedaily-mbti-v2-interaction-dev`, `sedaily-mbti-v2-consolidate-dev`, `sedaily-mbti-v2-health-dev`), `sedaily-mbti-pgvector-v2-dev` (RDS), `sedaily-mbti-article-body-v2-dev` (S3 — these two keep `v2` at the end) and ship via `backend/v2/deploy-v2.sh` (builds `lambda_package_v2.zip` that bundles v1 source so v2 handlers can `from clients.xxx import ...`). The authoritative v2 function list is `API_V2_FUNCTIONS` / `CORE1_FUNCTIONS` / `CORE1_5_FUNCTIONS` / `CORE2_FUNCTIONS` / `CORE3_FUNCTIONS` in `deploy-v2.sh`. The v1 `./deploy.sh` never includes `v2/`.

A few v2 internals worth knowing without opening `backend/v2/CLAUDE.md`: the **Validator runs inline inside the Core 2 Transform handler** (`backend/v2/core2/validator.py`) — not a separate Lambda — and rejects bad versions before any S3/pgvector write; the `# TASK-2.4 will add sedaily-mbti-v2-validator-dev` placeholder in `deploy-v2.sh` is intentionally unfilled. **`image_url` extraction lives in Transform, not Collector** (TASK-7-Z-2): it lands in per-version `version_metadata` (alongside the MBTI version body) and surfaces in both `/api/v2/feed` and `/api/v2/article/{id}` responses, while article-level metadata (`press`, `sub_title`, `url`, `byline`, `content_preview`) sits flat on `articles.metadata`. v2-specific clients/services live in `backend/v2/clients/` (`pgvector_v2_client`, `embedding_v2_client`, `s3_article_v2_client`, `selector_service`, `transform_v2_service`, `cloudwatch_metrics`); the Core 3 personalization libraries live in `backend/v2/core3/` (`memory_manager.py`, `context_broker.py`, `recommend_agent.py`) — `MemoryManager` runs inline inside the v2 Feed Lambda for read-time ranking (same pattern as the Validator inline inside Transform) and is also called by the Consolidation Lambda (`core3_consolidate.py`) at write-time to roll user_interactions into `user_profiles.preference_embedding` + `category_weights`. The one-shot v1→v2 backfill is `backend/v2/tools/backfill_from_v1.py`.

**v2 cost observability** lives in `backend/v2/observability/` (Cost-1b / Cost-2 commits). `EmbeddingV2Client` and `transform_v2_service` emit input/output token counts to CloudWatch metric `sedaily-mbti/v2/BedrockTokens` after each Bedrock invoke (dimensions: `Lambda`, `Model`, `TokenType`); `observability/dashboards/bedrock-cost.json` + `apply-dashboard.sh` build the `sedaily-mbti-v2-bedrock-cost` dashboard that turns those tokens into a $/day estimate. This is an **application-level cost proxy**, not real billing — the parent SCP blocks `ce:*` and `budgets:*`, so Cost Explorer / Budgets are unavailable. Estimate is a lower bound (cross-region premium, Provisioned Throughput, Knowledge Bases, data transfer all excluded). When upgrading Opus model IDs, update both the dashboard JSON `Model` dimension and `_OPUS_4_6_MODEL_ID` in `cloudwatch_metrics.py`.

## Commands

### Frontend (Next.js 16 + React 19)

```bash
cd frontend-next
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (static export → out/)
npm run lint         # eslint (package.json script — `next lint` is deprecated in Next 15+)
npx tsc --noEmit     # type check
```

The frontend uses `output: "export"` (static HTML, no SSR). There are no API routes or server components — all data fetching is client-side via `useEffect` + `fetch()`.

### Backend (Python 3.11 + FastAPI)

```bash
cd backend
pip install -r requirements.txt
python3 main.py                                         # http://localhost:8000 (local dev)
python3 -m pytest tests/test_split_storage.py           # single test file
python3 -c "import ast; ast.parse(open('file.py').read())"  # syntax check
```

`main.py` is a local-only FastAPI server with limited endpoints (health, time-machine, raw S3 articles). It does **not** serve MBTI-transformed versions or the full API surface. The authoritative API runs as **23 Lambda functions** behind API Gateway.

`backend/tests/` contains integration tests (`test_split_storage`, `test_pipeline`, `test_pgvector`, `test_opensearch`, `test_full_integration`, `test_model_comparison`, etc.) that hit real AWS resources — they need AWS credentials and Bedrock access to run, and are not wired into CI. Treat them as operational smoke tests, not a unit-test safety net.

### Deploy

```bash
# Backend (Lambda)
cd backend
./deploy.sh              # all Lambda functions (API + Pipeline)
./deploy.sh api          # API functions only (18)
./deploy.sh pipeline     # Pipeline functions only (5)

# Frontend (S3 + CloudFront)
cd frontend-next
npm run build
aws s3 sync out/ s3://sedaily-mbti-frontend-dev --delete
aws cloudfront create-invalidation --distribution-id E1QS7PY350VHF6 --paths "/*"
```

The backend deploy script builds a single Lambda zip (runtime deps only — `fastapi`/`pytest` and `infrastructure/` are excluded), uploads to `s3://sedaily-mbti-lambda-packages-dev/`, and calls `update-function-code` on each of 23 Lambda functions (18 API + 5 Pipeline). Functions that don't exist in AWS are skipped gracefully (`[SKIP] Function not found`). The authoritative function list is `API_FUNCTIONS` / `PIPELINE_FUNCTIONS` in `deploy.sh`.

Lambda names don't match handler filenames: `article_handler.py` → `sedaily-mbti-article-dev` (no `handler` suffix), `step1_select.py` → `sedaily-mbti-pipeline-step1-dev`, `supervisor.py` → `sedaily-mbti-pipeline-supervisor-dev`. Use `deploy.sh` as the source of truth for the mapping.

Two one-shot setup scripts live alongside `deploy.sh` and are deliberately *not* invoked by it — run them manually only when standing up the infrastructure they own:

- `backend/setup-briefing-lambda.sh` — creates `sedaily-mbti-briefing-dev` Lambda + the daily 07:00 KST EventBridge rule (`sedaily-mbti-daily-briefing`). After it runs once, ongoing code updates flow through `deploy.sh` like any other API function.
- `backend/setup-lambda-warming.sh` — registers a 5-minute CloudWatch Events rule (`sedaily-mbti-lambda-warming`) that pings `search`, `article`, and `post` Lambdas with `{"warmup": true}` to keep them warm.

## Architecture

Monorepo with two independent applications:

```
/
├── frontend-next/     # Next.js 16 App Router (partial Feature-Sliced Design)
├── backend/           # Python Lambda functions (FastAPI for local dev only)
│   ├── admin/           # standalone admin-API Lambda (deployed, own bespoke build; NOT in deploy.sh)
│   ├── common/          # shared utilities for v1/v2/admin (feature_flag, secrets) — bundled by deploy.sh + deploy-v2.sh
│   ├── infrastructure/  # v1 Step Functions definition + provisioning scripts
│   └── v2/              # parallel redesign — see "v1 / v2 Parallel Redesign" above
├── scripts/           # one-shot repo-level tools, run manually (e.g. import_prompts_to_admin_ddb.py)
└── docs/              # informal dev notes (chatbot-todo.md)
```

There is no `infrastructure/` at the repo root — it lives under `backend/`. Both `backend/infrastructure/` (v1) and `backend/v2/infrastructure/` exist and are not deployed as Lambdas. The repo-root `scripts/` directory holds one-shot tooling that is run manually (not on a schedule and not from `deploy.sh` / `deploy-v2.sh`).

### Data Flow

```
서울경제 XML (S3, ap-northeast-2)
  → Step Functions pipeline (EventBridge every 3 hours, 8 runs/day)
    Step 1: Select (Nova, per-category allocation + dedup against earlier runs)
    Step 2: Classify (Nova, assign MBTI bucket)
    ProcessArticlesMap (inline Map, MaxConcurrency=3) — per-article:
      Step 3: TransformOne (Claude Opus 4.6 → 4 parallel MBTI calls)
      Step 4: ValidateOne (Nova validates spelling/style/facts)
      StoreOne (Supervisor: cross-version review + write + vector index)
  → Article DB: DynamoDB (metadata + pointer) + S3 (body JSON)
  → Vector DBs: OpenSearch (RAG) + pgvector (similarity)
  → API Gateway → Frontend
```

The pipeline chains Step3→Step4→Supervisor inside each Map iteration so one article's failure cannot block the others. Per-iteration output is projected to a small metrics object (via `OutputPath` on `StoreOne`) to keep the Map's aggregated state under the 256 KB Step Functions limit. `MaxConcurrency=3` respects Bedrock throttling (3 articles × 4 Opus calls = 12 concurrent requests). Step 1 deduplicates against already-processed articles from earlier runs via the `__type_assignments__{date}` DynamoDB item; type assignments are merged (not overwritten) across runs. The old separate `merge_transform_results` Lambda was removed in this redesign — don't re-add it. Definition: `backend/infrastructure/step_functions_definition.json`.

### Split Storage Pattern

Articles are stored in two layers. DynamoDB holds metadata (title, category, dates, images, `s3_body_uri` pointer). S3 holds body content (`content_ko`, `content_raw`, `content_blocks`, `version_NT/NF/ST/SF`). The `DynamoDBClient.get_article()` method transparently fetches both and merges them. Legacy articles (no `s3_body_uri`) are read from DynamoDB directly.

```python
# How to create a properly wired DynamoDBClient
from clients.s3_article_client import S3ArticleClient
from clients.dynamodb_client import DynamoDBClient
from config import settings

s3_client = S3ArticleClient(bucket_name=settings.s3_article_body_bucket, region=settings.s3_article_body_region)
db = DynamoDBClient(table_name=settings.dynamodb_table_articles, region=settings.region, s3_article_client=s3_client)
article = await db.get_article(news_id)  # unified retrieval
```

`DynamoDBClient` is the articles client only — user profiles use `PersonalDBClient` and podcasts use `PodcastDBClient`, which are separate classes over their own tables.

### Four DynamoDB Tables

| Table | PK | SK | Purpose |
|-------|----|----|---------|
| `sedaily-mbti-articles-dev` | `news_id` | — | Article metadata + S3 pointer. GSIs: `category-published_at-index`, `slug-index` |
| `sedaily-mbti-personal-dev` | `user_id` | `sk` | User profiles (`PROFILE`), archived sentences (`ARCHIVE#...`), reading history (`READING#...`) |
| `sedaily-mbti-podcast-dev` | `podcast_id` | — | Podcast metadata. GSI: `date-index` |
| `sedaily-mbti-engagement-dev` | `pk` | `sk` | Reactions, ratings, comments (keyed by `ARTICLE#{id}`) |

First three tables have constants in `config/constants.py` and are exposed through `config.settings`. The engagement table is hardcoded as `ENGAGEMENT_TABLE` in `handlers/engagement_handler.py:33` — if you need to add an engagement constant, put it in `config/constants.py` and thread it through settings rather than duplicating the string.

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

### Backend Admin Lambda

`backend/admin/` is a **standalone Lambda separate from the 23 production Lambdas** — `sedaily-mbti-admin-api-dev`, deployed but **not built by `deploy.sh` / `deploy-v2.sh`** (its own one-shot zip pattern: `pip install argon2-cffi PyJWT --target /tmp/admin-rebuild && cp -r backend/admin/* /tmp/admin-rebuild && zip ...`). Admin-1 skeleton landed in commit `9d94f32`; Admin-2a (commit `0ee43df`) added the feature-flag toggle wire. The admin Lambda intentionally does not share v1's framework:

- **Routing**: dispatches by API Gateway HTTP API `routeKey` directly via `admin/handler.py:HANDLERS`. Does **not** use v1's `@lambda_handler` decorator, `core/response.py`, or `core/exceptions.py` — the admin Lambda has its own minimal `shared/response.py` (no CORS headers; HTTP API handles CORS at the gateway level).
- **Auth**: argon2id password verify + JWT (HS256, 8h expiry); password hash and JWT secret live in SSM Parameter Store at `/sedaily-mbti/admin/password-hash` and `/sedaily-mbti/admin/jwt-secret`. 5 failed logins → 5-minute global lockout, tracked via `pk=AUTH, sk=lockout/global` in the admin config table. `audit_log()` writes a row per mutating action (`pk=AUDIT, sk=<iso-timestamp-ms>`) and is wrapped in try/except so audit failures never block the main flow.
- **Tables (separate from the four v1 tables)**: `sedaily-mbti-admin-config-dev` (auth state, feature flags, audit log) and `sedaily-mbti-admin-prompts-dev` (versioned prompt rows: `pk=PROMPT#<category>/<name>`, `sk=v#N` | `LATEST`). Override via env vars `ADMIN_CONFIG_TABLE` / `ADMIN_PROMPTS_TABLE`.
- **Dependencies**: `argon2-cffi`, `PyJWT` are declared in `backend/admin/requirements.txt` only — **not** in the main `backend/requirements.txt`, so the regular Lambda zip does not bundle them.
- **Routes (Admin-1 + 2a + 2d)**: `POST /admin/login`, `POST /admin/password-change`, `GET /admin/drivers` (returns `rules` + `feature_flags` + `thresholds`), `POST /admin/drivers/{id}` (EventBridge rule enable/disable/set-cron — driver_id must start with `sedaily-mbti-`), **`POST /admin/drivers/feature-flag/{name}`** (feature flag enable/disable, Admin-2a — separate route + separate handler `drivers.handle_feature_flag_update`, intentionally not folded into `handle_update`), **`POST /admin/drivers/threshold/{name}`** (numeric tunable update, Admin-2d — body `{"value": <int>}`, validation `1..10000`, separate handler `drivers.handle_threshold_update`), `GET /admin/prompts`, `GET|POST /admin/prompts/{category}/{name}`, `GET /admin/cost` (Bedrock token → $ estimate over 7d), `GET /admin/audit`.

Seed script `scripts/import_prompts_to_admin_ddb.py` ports the 13 filesystem prompts under `backend/prompts/` into the admin-prompts table as `v#1` + `LATEST` rows; run with `--dry-run` first, then `--apply`. The legacy `backend/MBTI_TRANSFORM_PROMPT.md` is intentionally excluded from this import (deferred to Admin-3).

### Feature Flags (Admin-2a/2b)

Runtime kill-switch for v1 Lambda handlers, backed by the admin DDB table. Pattern established for chatbot in commit `0ee43df` (Admin-2a) and extended to podcast + question in `3cad18f` (Admin-2b — same commit also fixes an Admin-2a OPTIONS-preflight bug, see "Integration point" below). Intended for incremental adoption across more Lambdas. Sibling mechanisms in `common/`: Admin-2c (`secrets.py`, SSM SecureString, fail-closed) for password-shaped secrets, and Admin-2d (`get_threshold` in the same `feature_flag.py`, integer values, see "Thresholds" below) for runtime-tunable knobs.

- **Storage**: `sedaily-mbti-admin-config-dev`, `pk=CONFIG`, `sk=feature-flag/<name>`, `value={"enabled": bool}` (+ `updated_at`, `actor`). Existing flags: `chatbot`, `podcast`, `question` (all enabled by default).
- **Read path** (in any Lambda — v1 / v2 / admin): `from common.feature_flag import is_enabled` then `if not is_enabled('<name>'): return <503>`. The module caches per-flag results for **5 minutes** at module level; Lambda cold start re-fetches. On DDB error: stale cache → `_DEFAULT_ON_MISSING=True` (fail-open — admin must explicitly disable).
- **Write path**: `POST /admin/drivers/feature-flag/{name}` body `{"action": "enable" | "disable"}` → `drivers.handle_feature_flag_update` runs `update_item` + `audit_log("feature-flag-update", ...)`. The single route handles all flags.
- **Cache invalidation**: there is no push-based invalidation. Toggle takes effect within 5 minutes naturally, or immediately by forcing a Lambda cold start (`aws lambda update-function-configuration --environment` with a dummy var like `ROTATION_AT=$(date +%s)`). Two operational gotchas learned in Admin-2b: (1) read existing env vars first and merge — `--environment` replaces the entire dict; (2) Lambdas with no env vars at all (`Environment: null`, e.g. `sedaily-mbti-question-dev` pre-Admin-2b) need `ROTATION_AT` added once before the rotation pattern works. To avoid shell-quoting bugs with `Variables={K=V,...}` syntax for non-trivial values, write a JSON file and pass `--cli-input-json file:///tmp/env.json`.
- **IAM (v1 vs v2 — read carefully)**: v1 Lambdas using the shared role `sedaily-mbti-lambda-execution-dev` (chatbot/podcast/question and most v1 API Lambdas) inherit `AmazonDynamoDBFullAccess` and need no extra policy. **v2 Lambdas use a tighter role (`sedaily-mbti-v2-collector-dev-role-nbf99tic`)** that does NOT have managed DDB access — Admin-2d added an `AdminConfigRead` inline policy (Sid `AdminConfigDDBRead`, `dynamodb:GetItem`+`dynamodb:Query` scoped to the admin-config-dev table only) so the same role covers both `is_enabled` and `get_threshold`. **When wiring `is_enabled` (or `get_threshold`) into a v2 Lambda for the first time, verify the role has DDB read access on this table — otherwise both calls silently degrade to fail-safe defaults** (visible in CloudWatch as a `feature_flag DDB error` / `feature_flag get_threshold error` warning, not a 500). This was the Admin-2d ship blocker — fixed only after the explicit Step 7 verification log surfaced `AccessDeniedException`.
- **Integration point in handlers** ⚠️ **place the `is_enabled(...)` check AFTER the OPTIONS-preflight short-circuit, never before**. Browser CORS preflight requires a 2xx response; if the gate fires on `OPTIONS` and returns 503, the browser refuses the actual request and the user sees only "Failed to fetch" — never the 503 body. This is exactly the bug Admin-2a shipped (chatbot gate placed before the OPTIONS branch) and Admin-2b fixed; the original verification used `curl -X POST` only, so the broken preflight wasn't caught. Correct shape:
  ```python
  def lambda_handler(event, context):
      """docstring"""
      # ... parse method (HTTP API v2 vs REST API v1) ...
      if method == 'OPTIONS':
          return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}
      if not is_enabled('<name>'):
          return {
              'statusCode': 503,
              'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
              'body': json.dumps({'error': '<name> disabled by admin'}),
          }
      # ... rest of handler
  ```
- **Verification checklist** (when integrating a new Lambda): baseline POST/GET → 200; baseline OPTIONS → 200; toggle off + cold start → OPTIONS **still 200** (preflight intact), POST/GET → 503 with friendly body; toggle on + cold start → POST/GET → 200. **Always exercise the OPTIONS preflight explicitly** with browser-style headers (`Origin`, `Access-Control-Request-Method`, `Access-Control-Request-Headers`) — server-side `curl -X POST` alone misses the failure mode.

### Thresholds (Admin-2d)

Numeric runtime tunables (currently `transform-max-articles`), backed by the same admin DDB table as feature flags but under a separate `sk` prefix. Pattern established for the Core 2 Transform batch size in commit `e172175` (Admin-2d). Sibling to "Feature Flags" above — same module (`common.feature_flag`), same DDB table, same 5-min cache, same fail-safe philosophy. The only differences are the sk prefix (`threshold/<name>` vs `feature-flag/<name>`) and value shape (`{"threshold": <int>}` vs `{"enabled": <bool>}`).

- **Storage**: `sedaily-mbti-admin-config-dev`, `pk=CONFIG`, `sk=threshold/<name>`, `value={"threshold": <int>}` (+ `updated_at`, `actor`). Existing thresholds: `transform-max-articles` (default 20). DDB Number arrives as `Decimal` via boto3 resource — `_load_thresholds` coerces with `int(...)`.
- **Read path**: `from common.feature_flag import get_threshold` then `value = get_threshold('<name>', default=<int>)`. `default` is mandatory — typically the existing module-level constant (e.g. `BATCH_SIZE = 20` in `core2_transform.py`) preserved as the DDB-unavailable fallback so the original sizing comment stays next to the call site. Cache shares the same module dict as `is_enabled` but uses key prefix `_threshold_<name>` to avoid collisions if a flag and threshold ever share a name.
- **Write path**: `POST /admin/drivers/threshold/{name}` body `{"value": <int>}` → `drivers.handle_threshold_update` validates `1 <= int <= 10000`, runs `update_item` + `audit_log("threshold-update", ...)`. Single route handles all thresholds (parallel to `feature-flag/{name}`).
- **IAM**: same caveat as Feature Flags above — v1 lambdas inherit `AmazonDynamoDBFullAccess` and work out of the box; **v2 lambdas need the `AdminConfigRead` inline policy added in Admin-2d**. That policy covers both `is_enabled` and `get_threshold` (single `dynamodb:GetItem`+`dynamodb:Query` grant on the admin-config-dev table).
- **Integration point**: call `get_threshold` **inside the request handler**, not at module-load time. A module-level read happens once at cold start and never refreshes within the 5-min cache window — defeats the whole point. Keep the module-level constant as the `default=` fallback only.
- **Verification log pattern** (recommended for new thresholds): emit a one-line resolved-value log immediately after the `get_threshold` call, e.g. `logger.info(json.dumps({"event": "transform_batch_size_resolved", "batch_size": batch_size, "default_fallback": BATCH_SIZE}))`. The natural per-fire summary log (`transform_run_complete.queue_rows` for transform) can't distinguish "threshold=20, 4 selected rows" from "threshold=4, 20 selected rows" — both yield `queue_rows=4`. After changing the DDB value, force a cold start (`update-function-configuration` env-var rotation) and confirm the resolved-value log line shows the new threshold.

### Secrets (Admin-2c)

SSM SecureString reader for v1 / v2 / admin Lambdas, replacing plaintext password env vars. Pattern established for the v2 Postgres password in commit `61b7177` (Admin-2c — `PG_V2_PASSWORD` env var → `/sedaily-mbti/v2/pg-password`). Same module-level 5-min TTL cache shape as `feature_flag.py`, but **opposite failure mode** — see contrast below.

- **Storage**: SSM Parameter Store SecureString, Standard tier, AWS-managed KMS key (`alias/aws/ssm`). Tagged `Project=sedaily-mbti, Component=backend-v2, Phase=admin-2c, ManagedBy=claude-code` (+ Subsystem / Environment / Owner). The admin SSM params from Admin-1 (`/sedaily-mbti/admin/password-hash`, `/sedaily-mbti/admin/jwt-secret`) are the same shape, predating this module — they're read directly via boto3 inside the admin Lambda and not yet routed through `common.secrets`.
- **Read path**: `from common.secrets import get_pg_password` (or the lower-level `get_secret(name)`). 5-min TTL module cache. **Fail-closed** — on SSM error or missing parameter the call raises rather than returning a default. Reasoning: a Lambda that reaches the DB code path without a valid password should crash visibly; a fail-open default would mean silently connecting (or pretending to connect) with garbage.
- **Path override**: `get_pg_password()` reads `PG_PASSWORD_SSM_PARAM` env var, defaulting to `/sedaily-mbti/v2/pg-password`. The 4 v2 Lambdas (collector / selector / transform / consolidate) all set this env var explicitly so the path is visible in their config without grepping code.
- **IAM**: the v2 Lambdas share role `sedaily-mbti-v2-collector-dev-role-nbf99tic`; Admin-2c added a `V2SecretsAccess` inline policy granting `ssm:GetParameter` / `ssm:GetParameters` on `parameter/sedaily-mbti/v2/*` (wildcard so future v2 secrets don't need IAM changes) plus `kms:Decrypt` conditioned on `kms:ViaService = ssm.us-east-1.amazonaws.com`. v1 / admin Lambdas adding their own SSM-backed secret will need similar inline policies on their roles.
- **Migration playbook** (one-shot scripts in `scripts/`):
  1. `scripts/migrate_pg_password_to_ssm.py --dry-run` then `--apply` — copies the password from a Lambda env var into SSM and verifies (length-only output, no value leakage).
  2. Code change: `os.getenv("PG_V2_PASSWORD", "")` → `get_pg_password()`.
  3. Deploy with the new code via `deploy-v2.sh` (or `deploy.sh` for v1).
  4. `scripts/update_v2_lambdas_pg_env.py --apply` — removes `PG_V2_PASSWORD`, adds `PG_PASSWORD_SSM_PARAM`. `update_function_configuration` auto-forces cold start, so the next invoke runs the new SSM path.
- **Fail-closed vs fail-open** (`secrets.py` vs `feature_flag.py`):
  | Module | Store | Cache | On store error | Why |
  |---|---|---|---|---|
  | `feature_flag.py` | DDB `sedaily-mbti-admin-config-dev` | 5 min, stale-cache fallback | Use stale cache if any, else `_DEFAULT_ON_MISSING=True` (enabled) | A flag flap shouldn't take a feature down; admin must explicitly disable. |
  | `secrets.py` | SSM SecureString | 5 min, no fallback | Raise | A DB password the Lambda can't fetch is uniformly worse than crashing — silent fallbacks would hide IAM / KMS / param-name regressions. |
- **Test fallout (known follow-up)**: integration tests under `backend/v2/tests/` historically use `monkeypatch.setenv("PG_V2_PASSWORD", "...")` then construct `PgVectorV2Client()` with no args — that path now calls `get_pg_password()` and hits real SSM. Tests that don't already pass `password=` explicitly need to mock `common.secrets.get_pg_password`. Out of scope for the Admin-2c commit; treat as a follow-up.

### Frontend Structure

The frontend is migrating toward Feature-Sliced Design but is not fully there yet. The `frontend-next/CLAUDE.md` describes the **target** architecture — read it before touching frontend code, but be aware of the actual state:

```
src/app/            → Next.js App Router routes (flat, no route groups yet):
                     /, /login, /auth/callback, /editors, /subscription,
                     /timeline, /timemachine
src/components/     → Most UI still lives here: mbti/ (FeedPage ~2k lines,
                     ArticleView, MbtiChatBot, OnboardingPage, BriefingPage),
                     story/, timeline/, character/
src/features/       → 6 FSD modules migrated so far: auth, news-feed, question,
                     community, archive, news-dna. (A 7th, `fortune/`, was removed
                     in commit 6531b33 when the saju feature moved to its own
                     codebase at saju.sedaily.ai.) Import only via
                     index.ts barrel exports (ESLint `boundaries` plugin enforces this).
src/shared/         → api/, config/ (api.ts, auth.ts), constants/ (categories.ts,
                     reporterNames.ts), data/ (mbtiGroups.ts — 24+ imports),
                     lib/ (userApi, readingTracker, elevenlabs, communityApi, etc.),
                     types/, ui/, utils/
src/widgets/        → Placeholder (index.ts exports nothing yet) — reserved for
                     Header/BottomNav once FeedPage is broken up
```

The main page (`/`) has 4 view modes: `feed` (default), `editor-select`, `briefing`, `story`. `src/components/mbti/FeedPage.tsx` contains 5 tabs: question, feed, community, archive, dna. Tab state syncs to URL via `?tab=feed`. The `/editors` route is a standalone dark-themed editor-intro page (Radix Sand Dark palette) separate from the `editor-select` view inside `/`.

Planned FSD layers not yet implemented: `entities/`, `pages/`.

## Key Conventions

### Handler Pattern

Every Lambda handler follows the same structure:

```python
from core.decorators import lambda_handler as handler_decorator
from config.constants import CORS_HEADERS

@handler_decorator
async def lambda_handler(event: dict, context) -> dict:
    method, path, params, path_params, body = _parse_event(event)
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}
    # route logic...
    return _success(data)  # or _error(status_code, message)
```

The `@lambda_handler` decorator provides: unified error handling (catches BackendError subclasses → appropriate HTTP status), request logging, and async support (wraps with `asyncio.run()`). Additional validation decorators:

```python
from core.decorators import require_params, require_body_fields, require_path_param

@require_params('category', 'page')       # validates queryStringParameters
@require_body_fields('title', 'content')   # validates JSON body fields
@require_path_param('id')                  # validates pathParameters
```

These raise `ValidationError` (400) automatically when required fields are missing.

### Response Format

```python
from core.response import success_response, error_response, paginated_response
success_response({'articles': [...]})                              # 200
created_response({'id': '...'})                                    # 201
error_response('Not found', status_code=404, code='NOT_FOUND')     # custom status
paginated_response(items, total, page, page_size)                  # 200 with pagination
not_found_response('article', article_id)                          # 404
```

All response helpers use `CORS_HEADERS` from `config/constants.py`. Custom JSON serializer handles datetime, Decimal, set, and `.to_dict()` objects.

### Error Hierarchy

```
BackendError
  ├─ ValidationError (400)
  ├─ AuthenticationError (401)
  ├─ AuthorizationError (403)
  ├─ NotFoundError (404)
  ├─ RateLimitError (429)
  ├─ RepositoryError (500)
  ├─ TranslationError (500)
  ├─ ConfigurationError (500)
  └─ ExternalServiceError (502)
```

Status code mapping is in `core/exceptions.py:EXCEPTION_STATUS_CODES`.

### Graceful Degradation

OpenSearch and pgvector are optional. If `OPENSEARCH_ENDPOINT` is empty, RAG search is skipped and DynamoDB GSI is used as fallback. If `PG_PASSWORD` is empty, pgvector operations are silently skipped. Vector indexing failures in the Supervisor never block Article DB storage.

### AI Model Selection

| Model | ID | Use |
|-------|----|-----|
| Claude Opus 4.6 | `us.anthropic.claude-opus-4-6-v1:0` | MBTI rewriting (Step 3) — 4 parallel calls per article |
| Claude Haiku 3.5 | `us.anthropic.claude-3-5-haiku-20241022-v1:0` | Chatbot RAG, podcast scripts, daily questions |
| Claude Sonnet 4 | `us.anthropic.claude-sonnet-4-20250514-v1:0` | Optional upgrade (not currently used in pipeline) |
| Nova Lite | `amazon.nova-lite-v1:0` | Article filtering (Step 1), MBTI classification (Step 2), validation (Step 4), Supervisor review |
| Titan Embeddings V2 | `amazon.titan-embed-text-v2:0` | 1024-dim vectors for OpenSearch and pgvector |

Constants are in `config/constants.py` (`BEDROCK_MODEL_ID_OPUS`, `BEDROCK_MODEL_ID_HAIKU`, `BEDROCK_MODEL_ID_NOVA_LITE`, etc.). Prompt caching (`cache_control: {"type": "ephemeral"}`) is already applied to the shared system prompt in Step 3 Opus calls and the chatbot Haiku call — don't remove it, it cuts ~30–50% of input-token cost on Opus.

### Category System

7 standard categories: `경제`, `IT_과학`, `정치`, `사회`, `문화`, `스포츠`, `국제`. Raw XML categories (60+ variants like `산업,IT일반`, `문화·라이프`) are normalized via `CATEGORY_NORMALIZATION_MAP` in `s3_xml_client.py`. Search queries expand via `CATEGORY_SEARCH_ALIASES` in `config/constants.py` to cover legacy names.

### MBTI Versions

Each transformed article contains 4 versions stored as:
```json
{
  "version_NT": { "title": "...", "body": "..." },
  "version_NF": { "title": "...", "body": "..." },
  "version_ST": { "title": "...", "body": "..." },
  "version_SF": { "title": "...", "body": "..." }
}
```

### Prompt Loading

Prompts are loaded via `services/prompt_loader.py` from `prompts/{category}/{name}.md` with `@lru_cache(maxsize=32)`:
- `load_prompt('transform', 'nt')` — MBTI rewriting prompts
- `load_chatbot_prompt('NF')` — chatbot persona prompts
- `load_prompt_by_path('selection/article_scorer')` — arbitrary subpath

The legacy `PromptService` (DynamoDB `settings_config` fallback) is a separate system used only for admin prompt management.

## AWS Resources

### Regions

| Region | Services |
|--------|----------|
| us-east-1 | Bedrock, DynamoDB, Lambda, API Gateway, Cognito, Polly, OpenSearch, RDS, S3 (article body + audio + Lambda packages) |
| ap-northeast-2 | S3 (original XML + frontend), CloudFront |

### S3 Buckets

| Bucket | Region | Purpose |
|--------|--------|---------|
| `sedaily-mbti-article-body-dev` | us-east-1 | Split-storage body JSON (MBTI versions, content_ko, content_blocks) |
| `sedaily-mbti-audio-dev` | us-east-1 | Polly TTS audio files for podcasts |
| `sedaily-news-xml-storage` | ap-northeast-2 | Source XML feed from 서울경제 (read-only), keyed `daily-xml/{YYYYMMDD}.xml` |
| `sedaily-mbti-frontend-dev` | ap-northeast-2 | Frontend static files (Next.js export) |

### Frontend Infrastructure

- **S3**: `sedaily-mbti-frontend-dev` (ap-northeast-2)
- **CloudFront**: Distribution `E1QS7PY350VHF6` → `mbti.sedaily.ai`
- **Cognito**: User Pool `us-east-1_ZS8PgF3iX`, config in `frontend-next/src/shared/config/auth.ts`

## Frontend API Contract

After the TASK-7 cutover (deployed 2026-04-27), the article-list and article-detail flows are served by **v2 Lambdas**; everything else is still v1. Don't change paths or response shapes without updating both sides.

| Endpoint | Used By | Stack |
|----------|---------|-------|
| `GET /api/v2/feed?mbti={MBTI}&limit=N` | `FeedPage.tsx` primary article list | **v2** (`sedaily-mbti-v2-feed-dev`) |
| `GET /api/v2/article/{news_id}?mbti={MBTI}` | `ArticleView.tsx` (called 4× in parallel for NT/NF/ST/SF on entry) + `FeedPage.tsx` prefetch | **v2** (`sedaily-mbti-v2-article-dev`) |
| `POST /api/chat`, `POST /api/chat/stream` | `MbtiChatBot`, `BriefingPage` | v1 |
| `POST /api/search` | `StoryNewsFeed`, `TimelineNewsFeed` | v1 |
| `GET /time-machine?date=YYYY-MM-DD` | `TimeMachinePage` | v1 |
| `POST /api/user/profile`, `POST /api/user/read`, `GET /api/user/stats`, `GET /api/user/history` | `AuthContext`, `ArticleView` reading tracker, profile views | v1 |
| `/api/posts*`, `/api/podcast/*`, `/api/questions`, `/api/recommend*`, `/api/archive*` | community / podcast / question / recommendation / archive features | v1 |

The v1 `/s3-articles` and `/api/article/{id}` Lambdas still exist and respond, but no production frontend code path calls them — the 3-tier fallback in `FeedPage.tsx` was removed in TASK-7. Don't delete those Lambdas without checking other consumers — `backend/tests/` (`test_split_storage`, `test_performance`, `test_regression`, `run_demo_checks`) still hits them. The v2 Feed/Article responses use a slightly different shape than v1 (`items[]` wrapper, `press`/`sub_title`/`url`/`byline` flat on each item, `image_url` inside per-version `version_metadata`); the frontend wraps them with `adaptV2FeedItem` / `adaptV2Version` adapters in `FeedPage.tsx` and `ArticleView.tsx` to keep the existing `MbtiArticle` type unchanged.

## Reference Documents

### v1 (production)

| File | Content |
|------|---------|
| `AWS_BACKEND_ARCHITECTURE.md` | Verified production AWS inventory — account, ARNs, 62 API routes, 23 Lambda configs, Step Functions state details, cost estimates. Use this when you need exact resource names/IDs. |
| `FULL_PROJECT_SPEC.md` | Complete codebase spec (all files, APIs, schemas, code examples) |
| `PROJECT_DOCUMENTATION.md` | Korean-language project spec — service overview, editor personas, data flow. Last refreshed 2026-04-07 so individual values may have drifted; verify against this CLAUDE.md or the source before relying on specifics. |
| `ai-lens-backend-architecture.md` | To-Be architecture design document |
| `ARTICLE_PIPELINE.md` | Step Functions pipeline walkthrough (current chained-Map design) |
| `frontend-next/CLAUDE.md` | Target FSD architecture rules, naming conventions, dependency direction |
| `frontend-next/AGENTS.md` | Agent-oriented rules for frontend work |
| `backend/infrastructure/README.md` | Step Functions + CloudFormation provisioning guide |

### v2 (redesign, `backend/v2/`)

Read these in order when starting any v2 work. `backend/v2/CLAUDE.md` explicitly takes precedence over this file for v2-scoped decisions.

| File | Content |
|------|---------|
| `backend/v2/CLAUDE.md` | v2 context: 3-Core architecture (Collection / Transform / Personalization), v1-reuse policy, naming/env-var conventions, pgvector schema outline |
| `backend/v2/.clauderules` | Hard rules: don't modify v1, don't create AWS resources, prompt-cache Opus calls, per-file pytest tests |
| `backend/v2/TASKS.md` | PR-sized task checklist (Phase 0 scaffolding → Phase 5). Each TASK is one session / one commit |
| `backend/v2/COMMANDS.md` | Validated v2 commands — use these instead of guessing AWS CLI / pytest / deploy incantations |
| `backend/v2/README.md` | Quick directory tour + import sanity check (`python3 -c "import v2"`) |

Note: `README.md` at project root is outdated (still references React+Vite and the old `frontend/` directory). Use this CLAUDE.md as the authoritative reference.
