# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI LENS — 서울경제신문의 MBTI 맞춤형 경제 뉴스 서비스. 원본 기사를 4개 MBTI 그룹(NT/NF/ST/SF) 스타일로 AI가 리라이팅하여 제공한다.

- **Production**: https://mbti.sedaily.ai
- **API**: https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev
- **Branch**: `feature/backend-redesign`

## Commands

### Frontend (Next.js 16 + React 19)

```bash
cd frontend-next
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npx next lint        # lint
npx tsc --noEmit     # type check
```

### Backend (Python 3.11 + FastAPI)

```bash
cd backend
pip install -r requirements.txt
python3 main.py                    # http://localhost:8000 (local dev)
python3 -m pytest                  # run tests (no test suite yet)
python3 -c "import ast; ast.parse(open('file.py').read())"  # syntax check
```

### Deploy

```bash
cd backend
./deploy.sh              # all Lambda functions (API + Pipeline)
./deploy.sh api          # API functions only (13)
./deploy.sh pipeline     # Pipeline functions only (6)
```

The deploy script builds a Lambda zip (excluding fastapi/pytest/infrastructure/), uploads to S3, and updates 19 Lambda functions. Functions that don't exist yet in AWS are skipped gracefully.

## Architecture

This is a monorepo with two independent applications:

```
/
├── frontend-next/     # Next.js 16 App Router (Feature-Sliced Design)
├── backend/           # Python Lambda functions (FastAPI for local dev only)
└── infrastructure/    # Step Functions definition (not deployed to Lambda)
```

### Data Flow

```
서울경제 XML (S3, ap-northeast-2)
  → Step Functions pipeline (5 stages)
    Step 1: Select (Nova) → Step 2: Classify (Nova) → Step 3: Transform (Claude, parallel Map)
    → Step 4: Validate (Nova) → Supervisor: approve + store + index vectors
  → Article DB: DynamoDB (metadata + pointer) + S3 (body JSON)
  → Vector DBs: OpenSearch (RAG) + pgvector (similarity)
  → API Gateway → Frontend
```

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

### Four DynamoDB Tables

| Table | PK | SK | Purpose |
|-------|----|----|---------|
| `sedaily-mbti-articles-dev` | `news_id` | — | Article metadata + S3 pointer. GSIs: `category-published_at-index`, `slug-index` |
| `sedaily-mbti-personal-dev` | `user_id` | `sk` | User profiles (`PROFILE`), archived sentences (`ARCHIVE#...`), reading history (`READING#...`) |
| `sedaily-mbti-podcast-dev` | `podcast_id` | — | Podcast metadata. GSI: `date-index` |
| `sedaily-mbti-engagement-dev` | `pk` | `sk` | Reactions, ratings, comments (keyed by `ARTICLE#{id}`) |

### Backend Module Layers

```
handlers/           → Lambda entry points (19 functions). Parse event, route, call services.
  pipeline/         → Step Functions stages (6 functions). Each stage is a standalone Lambda.
clients/            → AWS service clients (DynamoDB, S3, OpenSearch, pgvector, Bedrock, Polly)
repositories/       → Business-level data access on top of clients (Personal, Podcast, Settings, Log)
services/           → Business logic (article filtering, prompt management)
models/             → Dataclasses (Article, Podcast, UserProfile, ArchivedSentence, ReadingRecord)
core/               → Framework: @lambda_handler decorator, exception hierarchy, response builders
config/             → Settings (38 env vars) and constants (model IDs, table names, categories)
prompts/            → MBTI transformation prompts (nt.md, nf.md, st.md, sf.md — ~250 lines each)
```

### Frontend Structure (Feature-Sliced Design)

```
src/app/            → Next.js routes (7 pages: /, /login, /auth/callback, /saju, /subscription, /timeline, /timemachine)
src/components/     → Large page components (FeedPage ~1800 lines, ArticleView, MbtiChatBot, OnboardingPage, BriefingPage)
src/features/       → FSD modules (auth, news-feed, question, community, archive, news-dna)
src/shared/         → Config (api.ts, auth.ts), types, data (mbtiGroups.ts), utils, lib (userApi, readingTracker, elevenlabs)
```

The main page (`/`) has 4 view modes: `feed` (default), `editor-select`, `briefing`, `story`. FeedPage contains 5 tabs: question, feed, community, archive, dna. Tab state syncs to URL via `?tab=feed`.

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

The `@lambda_handler` decorator provides: unified error handling (catches BackendError subclasses → appropriate HTTP status), request logging, and async support.

### Response Format

```python
# Always use these — never build raw dicts
from core.response import success_response, error_response
success_response({'articles': [...]})           # 200
error_response('Not found', status_code=404, code='NOT_FOUND')
```

### Error Hierarchy

```
BackendError → ValidationError (400), NotFoundError (404), RepositoryError (500),
               TranslationError (500), ExternalServiceError (502), RateLimitError (429)
```

### Graceful Degradation

OpenSearch and pgvector are optional. If `OPENSEARCH_ENDPOINT` is empty, RAG search is skipped and DynamoDB GSI is used as fallback. If `PG_PASSWORD` is empty, pgvector operations are silently skipped. Vector indexing failures in the Supervisor never block Article DB storage.

### AI Model Selection

- **Claude** (Haiku 3.5): MBTI rewriting (Step 3), chatbot RAG response, podcast script generation
- **Nova** (Lite): Article filtering (Step 1), MBTI classification (Step 2), validation (Step 4), Supervisor review
- **Titan Embeddings V2**: 1024-dim vectors for OpenSearch and pgvector

### Category System

7 standard categories: `경제`, `IT_과학`, `정치`, `사회`, `문화`, `스포츠`, `국제`. Raw XML categories (60+ variants like `산업,IT일반`, `문화·라이프`) are normalized via `CATEGORY_NORMALIZATION_MAP` in `s3_xml_client.py`. Search queries expand via `CATEGORY_SEARCH_ALIASES` to cover legacy names.

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

Prompts are loaded from `backend/prompts/*.md` files. The loading chain falls back to DynamoDB `settings_config`, then to `MBTI_TRANSFORM_PROMPT.md`.

## AWS Regions

| Region | Services |
|--------|----------|
| us-east-1 | Bedrock, DynamoDB, Lambda, API Gateway, Cognito, Polly, OpenSearch, RDS, S3 (article body + audio) |
| ap-northeast-2 | S3 (original XML), CloudFront |

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

| File | Content |
|------|---------|
| `FULL_PROJECT_SPEC.md` | Complete codebase spec (967 lines — all files, APIs, schemas, code examples) |
| `ai-lens-backend-architecture.md` | To-Be architecture design document |
| `FRONTEND_SPEC.md` | Frontend feature spec (all pages, API calls, Mock vs real data) |
| `frontend-next/CLAUDE.md` | Next.js-specific rules (FSD architecture, dependency direction, naming) |
| `infrastructure/README.md` | Step Functions deployment guide |
