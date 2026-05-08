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
- **v2** — `backend/v2/`. A parallel redesign on branch `feature/backend-redesign` (recent commits are tagged `[v2]`). pgvector-centric storage hub; whole-corpus ingest followed by a **Core 1.5 Selector** that uses Nova Lite to score raw articles per MBTI and flag a top-N subset in the `article_selections` table; **Core 2 Transform** polls `article_selections.selected=TRUE AND transformed_at IS NULL` (not `articles.status='raw'`) and runs Opus 4.6 only for the MBTI groups the Selector chose (1–4 per article); **Core 3** exposes per-user reads via the Feed and Article Detail Lambdas, with a **Recommend Agent** (3-stage cosine + category + recency ranking) and **Memory Manager** / **Context Broker** layered on top of pgvector; Chat Agent eventually on Bedrock AgentCore Runtime. **Status (as of 2026-05-04):** v2 Feed (`/api/v2/feed`) and Article Detail (`/api/v2/article/{id}`) Lambdas serve production traffic at `mbti.sedaily.ai` (TASK-7 frontend cutover deployed 2026-04-27); the `sedaily-mbti-v2-selector-trigger` and `sedaily-mbti-v2-transform-trigger` EventBridge rules are ENABLED, so the Selector → Transform pipeline runs on schedule. Core 3 personalization (TASK-3.1–3.4, plus the frontend-side TASK-3.6/3.7 in Round 5-E/G) shipped: the Feed Lambda runs `MemoryManager` → `ContextBroker` → `RecommendAgent` inline for ranking, `sedaily-mbti-v2-interaction-dev` captures click/dwell/scroll/skip/react/rate events, and the frontend now dual-writes interactions to v1 + v2 and persists a 4-char MBTI derived from editor selection (시현=INTJ / 지원=INFP / 정훈=ISTJ / 하은=ESFP) so logged-in users hit the personalization warm path. TASK-3.5 (Round 5-D) consolidation Lambda code is committed (`backend/v2/handlers/core3_consolidate.py` + `MemoryManager.consolidate()` for EWMA-based preference updates, α=0.2, ≥10-distinct-news threshold) and listed in `deploy-v2.sh` as `sedaily-mbti-v2-consolidate-dev`. The AWS Lambda + EventBridge daily cron (`sedaily-mbti-v2-consolidate-schedule` = `cron(0 18 * * ? *)` = KST 03:00) are now both provisioned and ENABLED. Still future: Chat Agent on AgentCore Runtime.

**If you're doing v2 work, read `backend/v2/CLAUDE.md` and `backend/v2/.clauderules` first — they override this file for v2-scoped changes.** Hard rules from `.clauderules` worth knowing even from outside v2: v2 work must not modify v1 files (including this CLAUDE.md, `deploy.sh`, or anything in `handlers/`, `clients/`, `core/`, `services/`, `config/`); AWS resource creation is conditional — allowed only after a documented plan with cost estimate, explicit user approval, and stop-on-anomaly + ID tracking, while Lambda function create/delete and any secret env-var writes (e.g. `PG_V2_PASSWORD`) remain always-manual; `update-function-code` and non-secret config updates on existing Lambdas are the only fully-automated path. Commit trailer must read exactly `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` — no model-capability suffix like "(1M context)" (GitHub parses author identity from the email, and parentheticals break the author-count stats).

v2 resources are namespaced `sedaily-mbti-v2-*-dev` (Lambda — `v2` goes in the middle, e.g. `sedaily-mbti-v2-collector-dev`, `sedaily-mbti-v2-selector-dev`, `sedaily-mbti-v2-transform-dev`, `sedaily-mbti-v2-feed-dev`, `sedaily-mbti-v2-article-dev`, `sedaily-mbti-v2-interaction-dev`, `sedaily-mbti-v2-consolidate-dev`, `sedaily-mbti-v2-health-dev`), `sedaily-mbti-pgvector-v2-dev` (RDS), `sedaily-mbti-article-body-v2-dev` (S3 — these two keep `v2` at the end) and ship via `backend/v2/deploy-v2.sh` (builds `lambda_package_v2.zip` that bundles v1 source so v2 handlers can `from clients.xxx import ...`). The authoritative v2 function list is `API_V2_FUNCTIONS` / `CORE1_FUNCTIONS` / `CORE1_5_FUNCTIONS` / `CORE2_FUNCTIONS` / `CORE3_FUNCTIONS` in `deploy-v2.sh`. The v1 `./deploy.sh` never includes `v2/`.

A few v2 internals worth knowing without opening `backend/v2/CLAUDE.md`: the **Validator runs inline inside the Core 2 Transform handler** (`backend/v2/core2/validator.py`) — not a separate Lambda — and rejects bad versions before any S3/pgvector write; the `# TASK-2.4 will add sedaily-mbti-v2-validator-dev` placeholder in `deploy-v2.sh` is intentionally unfilled. **`image_url` extraction lives in Transform, not Collector** (TASK-7-Z-2): it lands in per-version `version_metadata` (alongside the MBTI version body) and surfaces in both `/api/v2/feed` and `/api/v2/article/{id}` responses, while article-level metadata (`press`, `sub_title`, `url`, `byline`, `content_preview`) sits flat on `articles.metadata`. v2-specific clients/services live in `backend/v2/clients/` (`pgvector_v2_client`, `embedding_v2_client`, `s3_article_v2_client`, `selector_service`, `transform_v2_service`, `cloudwatch_metrics`); the Core 3 personalization libraries live in `backend/v2/core3/` (`memory_manager.py`, `context_broker.py`, `recommend_agent.py`) — `MemoryManager` runs inline inside the v2 Feed Lambda for read-time ranking (same pattern as the Validator inline inside Transform) and is also called by the Consolidation Lambda (`core3_consolidate.py`) at write-time to roll user_interactions into `user_profiles.preference_embedding` + `category_weights`. The one-shot v1→v2 backfill is `backend/v2/tools/backfill_from_v1.py`; the same directory also holds `RUNBOOK.md` + `post_validator_fix_diagnostic_v3.py` / `test_diagnostic_v3.py` (operational diagnostics for the post-Validator-fix corpus, not deployed). Session-level handoff notes from the v2 build (Phase 1 → Round 5-G) live in `backend/v2/handoff_docs/` — informal markdown, not a spec, but the most recent file is the best trail when picking up multi-session work mid-stream.

**v2 cost observability** lives in `backend/v2/observability/` (Cost-1b / Cost-2 commits) plus the metric-emit code in `backend/v2/clients/cloudwatch_metrics.py`. `EmbeddingV2Client` and `transform_v2_service` emit input/output token counts to CloudWatch metric `sedaily-mbti/v2/BedrockTokens` after each Bedrock invoke (dimensions: `Lambda`, `Model`, `TokenType`); `observability/dashboards/bedrock-cost.json` + `apply-dashboard.sh` build the `sedaily-mbti-v2-bedrock-cost` dashboard that turns those tokens into a $/day estimate. This is an **application-level cost proxy**, not real billing — the parent SCP blocks `ce:*` and `budgets:*`, so Cost Explorer / Budgets are unavailable. Estimate is a lower bound (cross-region premium, Provisioned Throughput, Knowledge Bases, data transfer all excluded). When upgrading Opus model IDs, update both the dashboard JSON `Model` dimension and `_OPUS_4_6_MODEL_ID` in `cloudwatch_metrics.py`.

v2 phase history (Phase 4-A / Phase 5 / Cost-3 등): see [docs/v2-phase-history.md](docs/v2-phase-history.md).

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

### Admin Frontend (Next.js 16 + Tailwind v4 — Admin-4)

```bash
cd frontend-admin
npm install
npm run dev          # http://localhost:3000 (do NOT run alongside frontend-next on same port)
npm run build        # static export → out/ — 8 routes, ready for S3 sync
npm run lint         # eslint (clean — set-state-in-effect rule disabled inline for legitimate cases)
```

Same stack as `frontend-next` (Next 16.2.4 + React 19.2.4 + Tailwind v4 + TS), separate `package.json` and lockfile. `.env.local` carries `NEXT_PUBLIC_ADMIN_API_BASE_URL` (admin Lambda's API Gateway base, currently the same `chzwwtjtgk` HTTP API as the v1 frontend). Not yet behind a domain — Admin-5 covers S3 + CloudFront + ACM + Route53 provisioning.

### Backend (Python 3.11 + FastAPI)

```bash
cd backend
pip install -r requirements.txt
python3 main.py                                         # http://localhost:8000 (local dev)
python3 -m pytest tests/test_split_storage.py           # single test file
python3 -c "import ast; ast.parse(open('file.py').read())"  # syntax check
```

`main.py` is a local-only FastAPI server exposing 7 routes (`/`, `/health`, `/api/chat`, `/api/chat/stream`, `/time-machine`, `/articles`, `/article/{id}`). It re-uses the v1 handler functions (`generate_chat_response`, `get_time_machine_data`, etc.) so chat behavior matches production, but it does **not** cover the full API surface (no engagement / search / podcast / archive / etc.). The authoritative API runs as **23 Lambda functions** behind API Gateway.

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
├── frontend-next/     # Next.js 16 App Router (partial Feature-Sliced Design) — mbti.sedaily.ai
├── frontend-admin/    # Next.js 16 admin console (Admin-4) — pending deploy at mbti-admin.sedaily.ai
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

Backend module layers (디렉토리 / 모듈 구조 / v1·v2 layout): see [backend/CLAUDE.md](backend/CLAUDE.md).

Admin stack (Backend Admin Lambda / Feature Flags / Thresholds / Prompts / Secrets / Admin Frontend / Admin-5): see [docs/admin-stack.md](docs/admin-stack.md).

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
| `sedaily-mbti-frontend-dev` | us-east-1 | Frontend static files (Next.js export) — `mbti.sedaily.ai` |
| `sedaily-mbti-admin-frontend-dev` | us-east-1 | Admin frontend static files (Admin-5) — `mbti-admin.sedaily.ai` |

### Frontend Infrastructure

- **S3**: `sedaily-mbti-frontend-dev` (us-east-1)
- **CloudFront**: Distribution `E1QS7PY350VHF6` → `mbti.sedaily.ai`
- **Cognito**: User Pool `us-east-1_ZS8PgF3iX`, config in `frontend-next/src/shared/config/auth.ts`

### Admin Frontend Infrastructure (Admin-5)

- **S3**: `sedaily-mbti-admin-frontend-dev` (us-east-1, private + OAC-only access)
- **CloudFront**: Distribution `E1MITYI58DB9UW` → `mbti-admin.sedaily.ai` (`d1xxhie8x7ljjz.cloudfront.net`)
- **OAC**: `E1JULOH7UELG4I` (Origin Access Control, sigv4 always)
- **ACM**: `arn:aws:acm:us-east-1:887078546492:certificate/cdca2fe5-df66-4cb1-a91d-90fffd10b9cf` (us-east-1, DNS validated via Route53)
- **Route53**: `mbti-admin.sedaily.ai` A + AAAA aliases → CloudFront (zone `Z07543813V4FC5RK599U0`)
- **API Gateway CORS**: `chzwwtjtgk` HTTP API narrowed from `["*"]` to `["https://mbti.sedaily.ai", "https://mbti-admin.sedaily.ai"]` in Admin-5 (must include both — narrowing without v1 would have broken the production frontend)
- **CustomError SPA fallback**: 403 + 404 → `/index.html` (200) so deep links like `/prompts/edit?id=cat/name` resolve on hard reload (clean-URL paths return index.html and the React Router handles `pathname` client-side; the prerendered `/login.html` is also reachable directly)
- **Auth**: localStorage JWT (Admin-1 argon2id + JWT, NOT Cognito). 8h expiry → `/login` redirect on 401 from any admin endpoint.

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
| `docs/AWS_BACKEND_ARCHITECTURE.md` | Verified production AWS inventory — account, ARNs, 62 API routes, 23 Lambda configs, Step Functions state details, cost estimates. Use this when you need exact resource names/IDs. |
| `docs/archive/FULL_PROJECT_SPEC.md` | Complete codebase spec (all files, APIs, schemas, code examples) |
| `docs/archive/PROJECT_DOCUMENTATION.md` | Korean-language project spec — service overview, editor personas, data flow. Last refreshed 2026-04-07 so individual values may have drifted; verify against this CLAUDE.md or the source before relying on specifics. |
| `docs/archive/ai-lens-backend-architecture.md` | To-Be architecture design document |
| `docs/ARTICLE_PIPELINE.md` | Step Functions pipeline walkthrough (current chained-Map design) |
| `frontend-next/CLAUDE.md` | Target FSD architecture rules, naming conventions, dependency direction |
| `frontend-next/AGENTS.md` | Agent-oriented rules for frontend work |
| `frontend-admin/CLAUDE.md` | Admin frontend rules — `@`-imports `AGENTS.md` ("This is NOT the Next.js you know" — Next 16 breaking changes warning) |
| `frontend-admin/AGENTS.md` | Source of truth for the Next 16 caveat — read before writing any admin-frontend code |
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
| `backend/v2/observability/README.md` | Cost-1b/Cost-2 observability notes — what the dashboard JSON pulls and how to apply it |

Note: `README.md` at project root is outdated (still references React+Vite and the old `frontend/` directory). Use this CLAUDE.md as the authoritative reference.
