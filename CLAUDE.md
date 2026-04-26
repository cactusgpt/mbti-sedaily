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
- **v2** — `backend/v2/`. A parallel redesign on branch `feature/backend-redesign` (recent commits are tagged `[v2]`). pgvector-centric storage hub, whole-corpus ingest (no Nova pre-selection), per-user personalization, and a Chat Agent on Bedrock AgentCore Runtime. Nothing in v2 is in production yet.

**If you're doing v2 work, read `backend/v2/CLAUDE.md` and `backend/v2/.clauderules` first — they override this file for v2-scoped changes.** Hard rules from `.clauderules` worth knowing even from outside v2: v2 work must not modify v1 files (including this CLAUDE.md, `deploy.sh`, or anything in `handlers/`, `clients/`, `core/`, `services/`, `config/`); AWS resource creation is conditional — allowed only after a documented plan with cost estimate, explicit user approval, and stop-on-anomaly + ID tracking, while Lambda function create/delete and any secret env-var writes (e.g. `PG_V2_PASSWORD`) remain always-manual; `update-function-code` and non-secret config updates on existing Lambdas are the only fully-automated path. Commit trailer must read exactly `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` — no model-capability suffix like "(1M context)" (GitHub parses author identity from the email, and parentheticals break the author-count stats).

v2 resources are namespaced `sedaily-mbti-*-v2-dev` (Lambda), `sedaily-mbti-pgvector-v2-dev` (RDS), `sedaily-mbti-article-body-v2-dev` (S3) and ship via `backend/v2/deploy-v2.sh` (builds `lambda_package_v2.zip` that bundles v1 source so v2 handlers can `from clients.xxx import ...`). The v1 `./deploy.sh` never includes `v2/`.

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

`main.py` is a local-only FastAPI server with limited endpoints (health, saju, time-machine, raw S3 articles). It does **not** serve MBTI-transformed versions or the full API surface. The authoritative API runs as **23 Lambda functions** behind API Gateway.

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

## Architecture

Monorepo with two independent applications:

```
/
├── frontend-next/     # Next.js 16 App Router (partial Feature-Sliced Design)
├── backend/           # Python Lambda functions (FastAPI for local dev only)
└── infrastructure/    # Step Functions definition (not deployed to Lambda)
```

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
                     Not in deploy.sh (local-only): saju.
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
```

A legacy `backend/MBTI_TRANSFORM_PROMPT.md` still sits at the backend root as the last-resort fallback for `clients/mbti_transform_service.py`. The canonical prompts live in `prompts/transform/` now — don't edit the root file.

### Frontend Structure

The frontend is migrating toward Feature-Sliced Design but is not fully there yet. The `frontend-next/CLAUDE.md` describes the **target** architecture — read it before touching frontend code, but be aware of the actual state:

```
src/app/            → Next.js App Router routes (flat, no route groups yet):
                     /, /login, /auth/callback, /editors, /saju, /subscription,
                     /timeline, /timemachine
src/components/     → Most UI still lives here: mbti/ (FeedPage ~1900 lines,
                     ArticleView, MbtiChatBot, OnboardingPage, BriefingPage),
                     story/, timeline/, character/
src/features/       → 7 FSD modules migrated so far: auth, news-feed, question,
                     community, archive, news-dna, fortune. Import only via
                     index.ts barrel exports (ESLint `boundaries` plugin enforces this).
src/shared/         → api/, config/ (api.ts, auth.ts), constants/ (categories.ts,
                     reporterNames.ts), data/ (mbtiGroups.ts — 24+ imports),
                     lib/ (userApi, readingTracker, elevenlabs, communityApi, etc.),
                     services/, types/, ui/, utils/
src/widgets/        → Placeholder (index.ts exports nothing yet) — reserved for
                     Header/BottomNav once FeedPage is broken up
src/legacy/         → Old code excluded from tsconfig (do not import from here)
```

The main page (`/`) has 4 view modes: `feed` (default), `editor-select`, `briefing`, `story`. `src/components/mbti/FeedPage.tsx` contains 6 tabs: question, feed, community, archive, dna, fortune. Tab state syncs to URL via `?tab=feed`. The `/editors` route is a standalone dark-themed editor-intro page (Radix Sand Dark palette) separate from the `editor-select` view inside `/`.

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

The frontend calls these endpoints (do not change paths or response shapes):

| Endpoint | Used By |
|----------|---------|
| `GET /s3-articles?date={YYYYMMDD}&limit=30` | NewsFeedTab (primary article list) |
| `GET /api/article/{id}` | ArticleView (MBTI version detail) |
| `POST /api/search` | NewsFeedTab (fallback when S3 empty) |
| `POST /api/chat` | MbtiChatBot |
| `POST /saju` | SajuPage |
| `GET /time-machine?date=YYYY-MM-DD` | TimeMachinePage |
| `POST /api/user/profile` | AuthContext (on login) |
| `POST /api/user/read` | ArticleView (reading tracker) |

`/s3-articles` reads from raw S3 XML (original articles, no MBTI). `/api/article/{id}` reads from Article DB (DynamoDB + S3 body, includes MBTI versions).

## Reference Documents

### v1 (production)

| File | Content |
|------|---------|
| `AWS_BACKEND_ARCHITECTURE.md` | Verified production AWS inventory — account, ARNs, 62 API routes, 23 Lambda configs, Step Functions state details, cost estimates. Use this when you need exact resource names/IDs. |
| `FULL_PROJECT_SPEC.md` | Complete codebase spec (all files, APIs, schemas, code examples) |
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
