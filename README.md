# AI LENS — MBTI 맞춤 경제 뉴스

서울경제신문의 MBTI 기반 맞춤형 경제 뉴스 서비스. 원본 기사를 4개 MBTI 그룹(NT/NF/ST/SF) 스타일로 AI가 리라이팅하여 제공한다.

- **Production**: https://mbti.sedaily.ai
- **Admin**: https://mbti-admin.sedaily.ai
- **API**: https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev

> 본 README 는 GitHub landing-page reference. 깊이 있는 architecture / convention 정보는 [`CLAUDE.md`](./CLAUDE.md) 를 참조.

---

## Repository Layout

```
.
├── frontend-next/      # Next.js 16 (App Router, static export) — mbti.sedaily.ai
├── frontend-admin/     # Next.js 16 admin console (Admin-4) — mbti-admin.sedaily.ai
├── backend/            # Python 3.11 Lambda functions
│   ├── admin/            # standalone admin-API Lambda (own bespoke build, NOT in deploy.sh)
│   ├── common/           # shared utilities (feature_flag, secrets) — bundled by both deploy scripts
│   ├── infrastructure/   # v1 Step Functions definition + provisioning scripts
│   └── v2/               # parallel redesign — pgvector-centric storage hub + 3-Core architecture
├── scripts/            # one-shot repo-level tools (manual run)
└── docs/               # architecture references + phase history
    └── archive/          # outdated docs (kept for historical context)
```

## v1 / v2 Parallel Backend

Two backend stacks side by side:

- **v1** — `backend/` outside `backend/v2/`. Original production Lambda set (Step Functions pipeline + 18 API + 5 Pipeline = 23 functions).
- **v2** — `backend/v2/`. pgvector-centric redesign with 3-Core architecture (Collection / Transform / Personalization). v2 Feed (`/api/v2/feed`) and Article Detail (`/api/v2/article/{id}`) Lambdas already serve production traffic at `mbti.sedaily.ai` (TASK-7 frontend cutover deployed 2026-04-27).

For v2-specific work read [`backend/v2/CLAUDE.md`](./backend/v2/CLAUDE.md) + [`backend/v2/.clauderules`](./backend/v2/.clauderules) first — they override the root CLAUDE.md.

## MBTI Editor Personas

| Group | Editor | Style |
|-------|--------|-------|
| NT | 시현 | 전략형 분석가 — 애널리스트 리포트 |
| NF | 지원 | 가치형 해석자 — 칼럼/에세이 |
| ST | 정훈 | 실용형 실무자 — 팩트시트 |
| SF | 하은 | 공감형 소통가 — 친구 톡 |

## Data Flow (v1, current production pipeline)

```
서울경제 XML (S3, ap-northeast-2)
  → Step Functions pipeline (EventBridge every 3 hours)
    Step 1: Select   (Nova, per-category allocation)
    Step 2: Classify (Nova, MBTI bucket)
    Map (MaxConcurrency=3) per article:
      Step 3: Transform (Claude Opus 4.6 → 4 parallel MBTI calls)
      Step 4: Validate  (Nova validates spelling/style/facts)
      Store             (Supervisor: cross-version review + write + vector index)
  → DynamoDB (metadata + S3 pointer) + S3 (body JSON)
  → OpenSearch (RAG) + pgvector (similarity)
  → API Gateway → Frontend
```

v2 pipeline replaces this for the `feed` / `article` paths — see [`docs/ARTICLE_PIPELINE.md`](./docs/ARTICLE_PIPELINE.md) (v1 walkthrough) and [`backend/v2/CLAUDE.md`](./backend/v2/CLAUDE.md) (v2 details).

## Local Development

### Frontend (mbti.sedaily.ai)

```bash
cd frontend-next
npm install
npm run dev          # http://localhost:3000
npm run build        # static export → out/
```

### Admin Frontend (mbti-admin.sedaily.ai)

```bash
cd frontend-admin
npm install
npm run dev          # do NOT run alongside frontend-next on same port
npm run build        # static export → out/ (8 routes)
```

### Backend (Lambda local dev)

```bash
cd backend
pip install -r requirements.txt
python3 main.py      # FastAPI local dev server, http://localhost:8000
```

`main.py` exposes a subset of the API (chat / time-machine / articles) for local iteration. The authoritative API runs as 23 Lambda functions behind API Gateway.

## Deploy

```bash
# Backend (Lambda)
cd backend
./deploy.sh                    # all 23 Lambda functions
./deploy.sh api                # 18 API functions only
./deploy.sh pipeline           # 5 Pipeline functions only
cd v2 && ./deploy-v2.sh        # v2 stack (separate zip + function set)

# Frontend
cd frontend-next
npm run build
aws s3 sync out/ s3://sedaily-mbti-frontend-dev --delete
aws cloudfront create-invalidation --distribution-id E1QS7PY350VHF6 --paths "/*"

# Admin Frontend
cd frontend-admin
./deploy-admin.sh              # build + S3 sync + CloudFront invalidation
```

## Authoritative References

- [`CLAUDE.md`](./CLAUDE.md) — full architecture, conventions, AWS resources, AI model selection, frontend API contract
- [`backend/CLAUDE.md`](./backend/CLAUDE.md) — backend module layers (handlers/clients/services/...) for v1 / v2 / admin
- [`backend/v2/CLAUDE.md`](./backend/v2/CLAUDE.md) — v2 3-Core architecture, naming conventions, pgvector schema
- [`backend/v2/.clauderules`](./backend/v2/.clauderules) — v2 hard rules (don't modify v1, AWS resource creation policy, prompt-cache requirement)
- [`docs/admin-stack.md`](./docs/admin-stack.md) — Admin track (Backend Admin Lambda / Feature Flags / Thresholds / Prompts / Secrets / Admin Frontend / Admin-5)
- [`docs/v2-phase-history.md`](./docs/v2-phase-history.md) — v2 phase history (Phase 4-A / Phase 5 / Cost-3) + repo cleanup history (R1-R7)
- [`docs/ARTICLE_PIPELINE.md`](./docs/ARTICLE_PIPELINE.md) — v1 Step Functions pipeline walkthrough (v1 reference, banner 명시)
- [`docs/AWS_BACKEND_ARCHITECTURE.md`](./docs/AWS_BACKEND_ARCHITECTURE.md) — v1 production AWS inventory snapshot (2026-04-15, banner 명시)
- [`frontend-next/CLAUDE.md`](./frontend-next/CLAUDE.md) / [`frontend-next/AGENTS.md`](./frontend-next/AGENTS.md) — frontend FSD architecture, Next 16 caveat
- [`frontend-admin/CLAUDE.md`](./frontend-admin/CLAUDE.md) / [`frontend-admin/AGENTS.md`](./frontend-admin/AGENTS.md) — admin frontend conventions

## Out of Scope

**Saju (사주/운세)** — 2026-05-04 본 repo 에서 분리되어 별도 GitHub repository + `saju.sedaily.ai` 도메인으로 이전. AI LENS / MBTI 와 완전 무관한 별도 프로젝트. 본 repo 에 saju 코드를 추가하지 마라.
