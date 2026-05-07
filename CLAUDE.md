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

**Phase 4-A** (collector scope = 각 지면 메인 기사) replaced v2 Collector / Selector schedules from every-3-hour polling (`cron(0 0/3 * * ? *)` / `cron(30 0/3 * * ? *)`) to **once-daily KST midnight** (`cron(0 15 * * ? *)` / `cron(30 15 * * ? *)`). Collector runs in **paper-mode** by default (DDB feature flag `collector-paper-mode=true`), which (a) defaults its target date to **yesterday KST** because 서울경제 daily-xml/{D}.xml accumulates D+1's print-edition paper articles starting ~17:00 KST and finishing by 23:55 KST, (b) **runs without the action=I-only filter** (paper-mode treats action=I and action=U identically — reconnaissance found that ~87% of paperNumber=1 paper articles arrive as action=U because the print-edition metadata is appended after the original online publish), and (c) keeps only `<item>` rows whose `<paper><editingInfo><paragraph>` equals `'TOP'`. The paragraph value is the page-position label inside an inserted `<paper>` element — XML reconnaissance over five non-holiday days found exactly two values, `'TOP'` and `'9'`, where `'TOP'` (~30% of paper articles, mean 22.6/day, distributed across paperNumber 1–31) marks the lead story of each printed page and `'9'` (~70%) marks the per-page sub-articles. The 22.6/day landing rate matches the product's "페르소나당 ~20 변환" target without any selector-side boost; the earlier round's `composite_score(..., paper_number)` boost arg was reverted because it solved the wrong problem (it assumed `paperNumber == 1` was the right curation target, which yielded only ~3.6/day and missed the entire IT/사회/스포츠 lead-story pool that paragraph='TOP' captures). The collector still promotes `paper_number` / `paper_date` / `paper_paragraph` (snake_case attrs from v1 `clients/s3_xml_client.py:PaperInfo` — **flat dataclass, not editing_info/publish_info nested**) into `articles.metadata` (JSONB) for diagnostics; nothing in the ranking layer reads them after the revert. Roll-back path: toggle `collector-paper-mode` → `false` (DDB `pk=CONFIG`, `sk=feature-flag/collector-paper-mode`, `value={enabled:false}`) — collector falls back to today-KST + action=I-only + no paragraph filter. Observability: `collector_paper_mode_run` event (target_date / paper_pass / paper_fail_no_element / **paper_fail_paragraph_not_TOP** / other_filtered) + `CollectorPaperPass` CloudWatch metric (`sedaily-mbti/v2`, dim `mode=paper|legacy`) emitted via the generic `emit_count` helper in `clients/cloudwatch_metrics.py`. The selector handler exposes two read-only diagnostic endpoints — `{"_diag":"paper_metadata"}` returns recent rows' metadata.paper_* sample for verifying the promote, and `{"_diag":"phase4a_check"}` returns the metadata distribution + today's selected pool's paperNumber breakdown so the curated paragraph='TOP' pool can be inspected without waiting for tomorrow's schedule. The DDB rows `threshold/selector-paper-boost-value` and `threshold/selector-paper-boost-max-page` still exist with `threshold=0` (defensive after the revert; no Lambda reads them anymore). Phase 4-A rationale + reconciliation data live in the Phase 4 reconnaissance trail (P7 daily paper-distribution sample, P8 push-timing histogram, P11 action=U analysis). The Phase 4-B agentic-cost work is a separate round.

**Phase 5 retry-limit** (commits `8481436` + `d15ec37`) caps the validation-failure retry loop in Core 2 Transform. Pre-Phase-5, a (news_id, mbti_type) pair that the Validator (Nova Lite, inline in Transform) rejected for hallucination kept ``transformed_at=NULL`` forever and was re-picked every 5-min polling cycle, with each cycle running a fresh Opus 4.6 transform (no prompt-cache hit because no version was ever written) — single article `2KCBCMQSBO` accrued 125+ retries in <24h, ~12% of weekly Opus spend. Phase 5 adds `article_selections.validation_failure_count INTEGER NOT NULL DEFAULT 0`; the Transform handler increments it per requested group on each `transform_validation_failure` and, once any group's count reaches `threshold/transform-retry-limit` (DDB, int default 5), force-stamps `transformed_at = now()` on that selection row. Feed query's existing **INNER JOIN article_versions** (no version row exists for validator-rejected groups) hides the released row from frontend without a separate status column. Schema migration runs from inside the Lambda — `pgvector_v2_client.ensure_phase5_schema()` issues `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` on every cold start, idempotent because PostgreSQL 9.6+ accepts `IF NOT EXISTS` on `ADD COLUMN` and PG 11+ does not rewrite the table for a NOT NULL column with constant default — needed because the RDS instance is in a private VPC subnet and `init_pgvector_v2.py` (the human-operator CLI) cannot reach it from outside. Tunable via DDB; setting threshold=0 effectively disables the cap (forever-retry restored). New observability: `transform_retry_limit_reached` JSON warning + `TransformRetryLimitReached` CloudWatch metric (dim `mbti=NT|NF|ST|SF`); the existing `transform_validation_failure` event picked up `fail_counts` / `released_groups` / `retry_limit` fields. Released rows leave `articles.status='failed'` (set by the same handler branch) — a future cleanup job, not yet built, is the right place to sweep them.

**Cost-3** (commit `94d812b`, plus a 2026-05-07 follow-up extending the script to 109 resources) layered a `Service=mbti` cost allocation tag across all sedaily-mbti AWS resources via `scripts/apply_service_tag.py` — one-shot, supports `--dry-run` / `--apply`, idempotent (already-tagged resources `SKIP`), **enumerates resources dynamically each run** so newly-created `sedaily-mbti-*` resources get picked up automatically; no hardcoded list to maintain. Current scope: Lambda 32, DynamoDB 6, S3 6, CloudFront 2, ACM 2, SSM 3, EventBridge 9, IAM 7, RDS 1, OpenSearch 1, API GW 1, Cognito 1, CloudWatch dashboard 1, **Step Functions 1, CloudWatch log group 31, EC2 NAT/VPCE/EIP 5** (= 109). The tag sits on top of the existing 7-key Cost-1a tag set (Project / Component / Subsystem / Environment / Phase / Owner / ManagedBy) and is the pivot for billing.on / external SaaS cost tracking; once the parent SCP unblocks Cost Explorer / Budgets, `user:Service=mbti` is the intended group-by dimension. Excluded by design: Route53 hosted zone `sedaily.ai` (shared with non-mbti) and RDS `sedaily-rag-vectordb` (dead resource). When standing up a new sedaily-mbti resource, re-run with `--apply` to backfill. Two tagging gotchas baked into the script: (a) Step Functions returns lowercase `key`/`value` (every other AWS service uses `Key`/`Value`) — `has_service_tag()` matches both; (b) the mbti VPC itself currently has no tags, so `enumerate_ec2_vpc` discovers the VPC via the NAT Gateway's `Name=sedaily-mbti-*` tag and falls back to `tag:Name` on VPCs once they grow Names. **Two structural gaps the tag cannot close**: Bedrock invocations (largest cost) aren't a taggable resource — track via the `sedaily-mbti-v2-bedrock-cost` CloudWatch dashboard; and **the cost allocation tag must be activated manually in AWS Billing console → Cost Allocation Tags → User-defined**, with ~24h propagation before Cost Explorer / billing.on can group by it. The tag values are useless for cost dashboards until that activation happens.

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

Seed script `scripts/import_prompts_to_admin_ddb.py` ports the 13 filesystem prompts under `backend/prompts/` into the admin-prompts table as `v#1` + `LATEST` rows; run with `--dry-run` first, then `--apply`. The legacy root-level `backend/MBTI_TRANSFORM_PROMPT.md` was excluded from the import; Admin-3 (commit `cb559e6`) confirmed it had no code references and deleted it. Production Lambdas now read those 13 prompts from this table at runtime — see "Prompts" section below.

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

### Prompts (Admin-3)

DDB-backed prompt storage with 5-minute TTL cache and filesystem fallback. Pattern landed by re-implementing `services/prompt_loader.py` in commit `cb559e6` (Admin-3). Sibling to "Feature Flags" / "Thresholds" / "Secrets" — all four use the same module-level cache + 5-min TTL shape; the failure-mode is tuned per concern. Prompts get a **3-tier fallback** (cache → stale cache → filesystem) because shipping an old prompt to a real user reply is strictly better than a 5xx, while admin DDB stays source-of-truth on the happy path.

- **Storage**: `sedaily-mbti-admin-prompts-dev` (Admin-1 seed via `scripts/import_prompts_to_admin_ddb.py`):
  - `pk = 'PROMPT#<category>/<name>'`
  - `sk = 'LATEST'` → `{active_version: <int>, updated_at}` (pointer row)
  - `sk = 'v#<int>'` → `{content, created_at, actor}` (immutable version row)
  13 prompts × 2 rows = 26 total. All start at `active_version=1`. Categories: `chatbot` (nt/nf/st/sf), `transform` (nt/nf/st/sf), `selection/article_scorer`, `question/daily_question`, `supervisor/supervisor_review`, `validation/validator`, `podcast/podcast_script`.
- **Read path**: `from services.prompt_loader import load_prompt` (or wrappers `load_transform_prompt`, `load_chatbot_prompt`, `load_prompt_by_path`). All wrappers funnel through `load_prompt(category, name)`, which:
  1. cache hit (< 5 min in this Lambda container) → return cached content
  2. else two DDB reads: `LATEST.active_version` → `v#<that-version>.content`
  3. on DDB error / row miss: **stale cache if any**, else `prompts/<category>/<name>.md` on disk + warn log
- **Write path**: `POST /admin/prompts/<category>/<name>` (admin Lambda, Admin-1) — writes a new `v#N` row and bumps `LATEST.active_version`. Production Lambdas pick up the change within 5 minutes naturally, or immediately on the next cold start.
- **IAM (v1 vs v2)**: same shape as Feature Flags / Thresholds. v1 shared role inherits `AmazonDynamoDBFullAccess`. v2 shared role got an **`AdminPromptsRead`** inline policy in Admin-3 (Sid `AdminPromptsDDBRead`, scoped to the single `sedaily-mbti-admin-prompts-dev` table). It's intentionally separate from `AdminConfigRead` (Admin-2d) so each policy maps to one logical concern. ⚠️ A v2 Lambda calling `load_prompt` without the policy degrades silently to filesystem (warn-log, not 5xx) — verify the policy is attached when wiring up a new v2 caller.
- **Integration point in handlers** ⚠️ **call `load_prompt` inside the request-processing function, never at module-load time**. A `MODULE_CONST = load_prompt(...)` at import time freezes the prompt for the warm container's lifetime — defeats the 5-min TTL. Admin-3 fixed exactly this in `step1_select.py:147` (a `SCORING_SYSTEM_PROMPT = load_prompt(...)` at module scope, moved inline to `_score_one_batch`).
- **Coverage — 13/13 prompts after Admin-3 cutover (option B-1)**: 5 prompts (`selection`/`question`/`supervisor`/`validation`/`podcast`) already used `load_prompt` pre-Admin-3. The other 8 (`chatbot/{nt,nf,st,sf}` + `transform/{nt,nf,st,sf}`) had been bypassing prompt_loader entirely and were folded in by Admin-3:
  - `handlers/chatbot_handler.py` — removed the hardcoded `MBTI_SYSTEM_PROMPTS` dict, replaced with `load_chatbot_prompt(group)`. **⚠️ This changed chatbot response style in production**: the dict was a deprecated short persona that had drifted from `prompts/chatbot/<group>.md` (the source-of-truth versions Admin-1 imported). Verified post-deploy: chatbot now returns the fuller "AI LENS의 김시현" persona from the `.md` versions, not the dict's shorter "시현".
  - `clients/mbti_transform_service.py::_load_group_prompt` — was reading `prompts/transform/<group>.md` directly via `open()` (the bare `PROMPT_FILES` dict). Now delegates to `load_transform_prompt`. Content unchanged on the happy path; the read goes through DDB now.
- **Rollback (5-min safety net)**: a regression in a new prompt version → admin writes a corrected `v#N+1` (or rolls `LATEST.active_version` back to a prior `v#`). The active prompt swaps within ≤ 5 min, or instantly on cold start. **Do not delete `backend/prompts/<category>/<name>.md` on disk** — those files are the cold-cache filesystem fallback. The only `.md` Admin-3 deleted was the unreferenced root-level `backend/MBTI_TRANSFORM_PROMPT.md`.
- **Verification log pattern**: there is no resolved-prompt log by default (prompts are large; logging full content would balloon CloudWatch). To confirm a cutover is live in production, either (a) inject a short instructional marker into the new version (e.g. "응답 첫 토큰을 [TEST] 로 시작하세요") and grep the next response, or (b) tail logs for the warning `"prompt_loader DDB error ... falling back to filesystem"` — its **absence** during normal operation is the success signal.

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

### Admin Frontend (Admin-4)

`frontend-admin/` is a **second Next.js app** alongside `frontend-next/`, dedicated to the admin console targeting `mbti-admin.sedaily.ai`. Built by Admin-4 in commit `bb0c900` and **not yet deployed** — Admin-5 covers the AWS-side work. The two frontends share **zero source code and zero state**; they are independently versioned, built, and (eventually) hosted.

- **Stack consistency with `frontend-next`**: Next.js 16.2.4 + React 19.2.4 + Tailwind v4 + TypeScript 5. Generated via `create-next-app@latest --app --src-dir --tailwind --typescript --eslint`. The lockfile and `node_modules` are independent — keep dependency versions intentionally in sync when bumping either app, but do not symlink.
- **Output**: `next.config.ts` sets `output: "export"` + `images: { unoptimized: true }`. `npm run build` writes static HTML/JS/CSS to `frontend-admin/out/` — eight routes: `/`, `/login`, `/cost`, `/drivers`, `/prompts`, `/prompts/edit`, `/settings`, `/_not-found`. Admin-5 will `aws s3 sync out/ s3://...` this directory.
- **Tailwind v4 — config-less**: there is no `tailwind.config.{js,ts}`. Theme is declared inside `src/app/globals.css` via `@import "tailwindcss";` followed by a `@theme inline { ... }` block. PostCSS pipeline is one plugin (`@tailwindcss/postcss`) — `autoprefixer` and `postcss-import` are bundled into v4 itself. When porting components between this app and `frontend-next/`, class names work identically but custom CSS variables must be redeclared in this app's `globals.css`.
- **Auth model — localStorage JWT, not Cognito**: Admin-1 chose argon2id + JWT for the admin Lambda specifically. `src/lib/auth.ts` handles save / clear / expiry of `admin_jwt` + `admin_jwt_expires` (8h TTL). `src/components/AuthGuard.tsx` is a client-side gate placed in `src/app/(authenticated)/layout.tsx` so every page in that route group is protected. 401 from any API call → `clearAuth()` + `window.location.href = "/login"`.
- **API client**: `src/lib/adminClient.ts` is the single fetch wrapper for all 9 admin endpoints (`adminApi.login` / `changePassword` / `getDrivers` / `updateRule` / `toggleFeatureFlag` / `updateThreshold` / `listPrompts` / `getPrompt` / `updatePrompt` / `getCost` / `getAudit`). `AdminApiError` carries the HTTP status. Base URL from `NEXT_PUBLIC_ADMIN_API_BASE_URL` env var (`.env.local` for dev, build-env for production).
- **Routing — query params, not dynamic segments**: `/prompts/edit?id=<category>/<name>` instead of `/prompts/[category]/[name]`. Reason: `output: "export"` requires `generateStaticParams` for dynamic routes, and the 13 prompt list is data-driven — hardcoding it in build config would go stale when admin adds new categories. Query params keep the route count fixed at 8 and stay static-export friendly. Trade-off: URLs are slightly less semantic; for a one-admin tool this is fine.
- **Suspense boundary for `useSearchParams`**: any page that reads search params during static export must be wrapped in `<Suspense>` — `prompts/edit/page.tsx` exports a `PromptEditPageWrapper` that wraps the actual editor in `<Suspense>` for this reason. If you add another search-params page, follow the same pattern.
- **Zero-new-dependency policy**: the only npm packages installed are what `create-next-app --tailwind --typescript --eslint` brought in (175 packages, all transitive). Toast notifications are a 30-line custom `ToastProvider` (createContext + setTimeout); the diff preview is a simple line-by-line component (no `diff-match-patch` / Monaco / CodeMirror). The frontend half of `.clauderules` "Frontend 신규 의존성 금지" is enforced via reviewer discretion — when adding features, prefer custom over deps unless the saved code is more than ~100 lines.
- **`set-state-in-effect` exemptions**: React 19's lint rule fires on two legitimate patterns: `AuthGuard.tsx` (mount-detection flag for SSG → CSR handoff) and `drivers/page.tsx` (initial async fetch on mount). Both are annotated with `// eslint-disable-next-line react-hooks/set-state-in-effect` and a comment explaining why. Don't add new exemptions without justifying — most setState-in-effect cases are real anti-patterns.

### Admin-5 — deployment ✓

Admin-5 (commit pending) is the final round in the admin track and is **complete**. It did not change any code in `frontend-admin/` or `backend/admin/`; it provisioned AWS infrastructure to put `frontend-admin/out/` behind `https://mbti-admin.sedaily.ai`. Live resources are listed in the **"Admin Frontend Infrastructure (Admin-5)"** section above. Per-deploy workflow:

```bash
cd frontend-admin
./deploy-admin.sh   # npm build → S3 sync (long cache for /_next/, short for entries) → CloudFront /* invalidation
```

Decisions worth knowing for future maintenance (Admin-5 reconnaissance learnings):

- **`sedaily-mbti-frontend-dev` is in `us-east-1`, not `ap-northeast-2`** — earlier CLAUDE.md notes had this wrong. Admin-5 corrected the record and chose `us-east-1` for `sedaily-mbti-admin-frontend-dev` to keep both frontend buckets in the same region (CloudFront is global; bucket region only affects origin-fetch latency).
- **CustomError = 403 + 404 → /index.html (200)** — both error codes route to the SPA shell because S3 with OAC returns 403 (not 404) for missing objects. This matches the v1 frontend's existing pattern.
- **CORS narrowing must list both domains** — narrowing `chzwwtjtgk` from `["*"]` to a single origin would have broken whichever frontend was excluded. The current allowlist `["https://mbti.sedaily.ai", "https://mbti-admin.sedaily.ai"]` covers both. Adding a third origin (e.g. a future staging frontend) requires `aws apigatewayv2 update-api --cors-configuration ...`.
- **Route53 A + AAAA both aliased** — the v1 frontend's record set has both, so the admin domain mirrors that. CloudFront supports IPv6 by default (`IsIPV6Enabled: true` in distribution config).
- **CloudFront deployment latency**: ~90 seconds end-to-end (modern), not the 15–20 minutes that older docs sometimes quote. ACM DNS validation was similarly fast (~30 seconds once the Route53 record landed).

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
