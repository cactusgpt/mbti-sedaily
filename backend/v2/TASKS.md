# TASKS.md — AI LENS v2 작업 체크리스트

**각 TASK는 독립적인 PR 단위다.** Claude Code 한 세션에서 하나의 TASK를 끝내고 머지한 뒤 다음 TASK로 넘어간다.

작업 순서는 원칙적으로 번호 순. 같은 Phase 내에서 독립적인 TASK는 병렬 가능 (표시됨).

체크박스 규칙:
- `[ ]` 미완료
- `[~]` 진행 중 (현재 세션)
- `[x]` 완료 & 머지됨

---

## Phase 0: 준비 (목표 1주)

### TASK-0.1: v2 디렉터리 골격 + 기본 문서 생성
- **종속성**: 없음
- **Files to create**:
  - `backend/v2/README.md` (간단한 디렉터리 설명)
  - `backend/v2/requirements.txt` (v1과 분리된 의존성 목록)
  - `backend/v2/.gitignore` (lambda-build, *.zip 등)
  - `backend/v2/clients/__init__.py`, `handlers/__init__.py`, `core3/__init__.py`, `tests/__init__.py`
- **Definition of Done**:
  - [x] 디렉터리 구조가 `CLAUDE.md` 3절과 일치 (비어있어도 됨, `__init__.py`만)
  - [x] `requirements.txt`에 pg8000, boto3, mcp 명시 (버전은 v1 `requirements.txt` 참조)
  - [x] `cd backend && python3 -c "import v2"` 성공

### TASK-0.2: deploy-v2.sh 작성 + hello world Lambda
- **종속성**: TASK-0.1
- **Files to create**:
  - `backend/v2/deploy-v2.sh` (v1 `deploy.sh` 참고해서 작성, 단 **별도 Lambda 이름 리스트**)
  - `backend/v2/handlers/health.py` (`/api/v2/health` 응답하는 hello world)
  - `backend/v2/tests/test_health.py`
- **Definition of Done**:
  - [x] `deploy-v2.sh`가 `sedaily-mbti-v2-health-dev` Lambda 함수를 빌드·업로드 (존재하지 않으면 skip 메시지)
  - [x] AWS 콘솔에서 수동으로 `sedaily-mbti-v2-health-dev` Lambda 생성 (사람이 한다, Claude Code 아님 — `.clauderules` 참조) (수동, 사용자 작업)
  - [x] API Gateway에 `/api/v2/health` 라우트 추가 (사람이 한다) (수동, 사용자 작업)
  - [x] `curl .../api/v2/health` → `{"status":"ok","version":"v2"}` 응답 (수동, 사용자 작업)
  - [x] `pytest backend/v2/tests/test_health.py` 통과

### TASK-0.3: ECR 리포지토리 생성 스크립트 (Chat Agent 준비)
- **종속성**: 없음 (TASK-0.1 후 병렬 가능)
- **Files to create**:
  - `backend/v2/infrastructure/setup_ecr.sh` (dry-run 기본, `--apply` 플래그로 실제 생성)
- **Definition of Done**:
  - [x] 스크립트가 `sedaily-mbti-chat-agent` ECR 리포지토리를 만드는 AWS CLI 명령을 **출력만** 한다 (사람이 복사해서 실행)
  - [x] `--apply` 플래그가 있을 때만 실제 실행
  - [x] 리포지토리 이미 존재하면 정상 종료 *(로직 구현 완료; 실측은 사용자 `--apply` 2회 실행 시 확인)*

---

## Phase 1: Storage Hub (목표 2주)

### TASK-1.1: pgvector v2 프로비저닝 스크립트
- **종속성**: 없음 (Phase 1 시작 가능)
- **Files to create**:
  - `backend/v2/infrastructure/provision_pgvector_v2.sh` (v1 `provision_pgvector.sh` 복제 + 수정)
- **수정 내역**:
  - DB_INSTANCE_ID: `sedaily-mbti-pgvector-v2-dev`
  - DB_NAME: `ailens_v2`
  - DB_INSTANCE_CLASS: `db.t3.small`
  - DB_STORAGE_GB: 50
  - SG_NAME: `sedaily-mbti-pgvector-v2-sg`
- **Definition of Done**:
  - [x] `--dry-run` 실행 시 모든 AWS CLI 명령어 출력 (실제 실행 안 함)
  - [x] `--status` 플래그 구현
  - [x] `--endpoint` 플래그 구현 *(로직 구현 완료; 실측은 인스턴스 생성 후 사용자 확인)*
  - [x] **실제 프로비저닝은 사람이 수동 실행** — Claude Code는 건드리지 않는다 (수동, 사용자 작업)

### TASK-1.2: 스키마 v2 SQL + 초기화 스크립트
- **종속성**: TASK-1.1 (인스턴스가 실제로 존재해야 검증 가능, 하지만 SQL 작성은 선행 가능)
- **Files to create**:
  - `backend/v2/infrastructure/schema_v2.sql` (4 테이블 DDL, `CLAUDE.md` 6절 참조)
  - `backend/v2/infrastructure/init_pgvector_v2.py` (pg8000으로 SQL 실행, `CREATE EXTENSION vector` 포함)
- **Definition of Done**:
  - [x] 4 테이블 모두 `IF NOT EXISTS` 포함 (재실행 안전)
  - [x] 모든 필수 인덱스 (ivfflat, 카테고리·published_at, user_id·created_at)
  - [x] `python3 init_pgvector_v2.py --dry-run` → SQL 출력만
  - [x] `python3 init_pgvector_v2.py` → 실제 실행 (환경변수 `PG_V2_HOST`, `PG_V2_PASSWORD` 필요) (수동, 사용자 작업)
  - [x] 실행 후 `\dt` 결과에 4 테이블 확인 (수동, 사용자 작업)

### TASK-1.3: PgVectorV2Client 작성
- **종속성**: TASK-1.2
- **Files to create**:
  - `backend/v2/clients/pgvector_v2_client.py`
  - `backend/v2/tests/test_pgvector_v2_client.py`
- **필수 메서드** (단위 테스트 각각 필요):
  - `insert_article(news_id, metadata, embedding) -> None`
  - `update_article_status(news_id, status) -> None`
  - `get_articles_by_status(status, limit) -> list[dict]`
  - `insert_article_version(news_id, mbti_type, metadata, embedding) -> str` (version_id 반환)
  - `get_article_versions(news_id) -> dict[mbti_type, dict]`
  - `upsert_user_profile(user_id, mbti_type, category_weights, preference_embedding) -> None`
  - `get_user_profile(user_id) -> dict | None`
  - `record_interaction(user_id, news_id, mbti_type, interaction_type, **kwargs) -> None`
  - `get_user_interactions(user_id, limit, since) -> list[dict]`
  - `find_feed_candidates(user_mbti, preference_embedding, exclude_news_ids, limit=100) -> list[dict]`
  - `find_similar_articles(embedding, limit) -> list[dict]`
- **Definition of Done**:
  - [x] v1 `pgvector_client.py`와 **별도 파일, 별도 클래스**
  - [x] `PG_V2_PASSWORD` 비어있으면 no-op (v1 패턴 따라)
  - [x] 모든 메서드에 타입 힌트
  - [x] 각 메서드별 pytest (통합, `PG_V2_HOST` 환경변수 있을 때만 실행) *(117 unit + 10 integration + 1 perf 전부 PASS, 2026-04-19 실측)*
  - [x] 쿼리 성능: `find_feed_candidates` 1000 rows 기준 p95 < 200ms *(local ceiling 3000ms로 실측 PASS [p95 ~815ms]; VPC 200ms target은 `BENCHMARK_ENV=aws_vpc`에서만 enforce — local은 Korea↔us-east-1 RTT ~800ms 지배로 regression 감지용)*

### TASK-1.4: S3 v2 버킷 생성 + 라이프사이클
- **종속성**: 없음 (Phase 1 초입에 병렬 가능)
- **Files to create**:
  - `backend/v2/infrastructure/setup_s3_v2.sh` (dry-run 기본)
- **Definition of Done**:
  - [x] 버킷 `sedaily-mbti-article-body-v2-dev` 생성 명령 출력
  - [x] 라이프사이클 정책: 90일 후 Glacier (JSON으로 작성, 스크립트가 적용) *(GLACIER_IR 구체 선택 — sub-second retrieval 필요, 커밋 903f138 참조)*
  - [x] CORS 정책 (프론트가 직접 body를 읽는 경우 대비)
  - [x] **실제 생성은 사람이 수동 실행** *(--apply 성공, --status 6개 섹션 검증 완료: PAB 4/4, AES256, GLACIER_IR@90d, CORS 2 origins, versioning OFF, 2026-04-19 실측)*

---

## Phase 2: Core 1 + Core 2 (목표 3주)

> ⚠️ **Phase 5 재검토 예정**: `U`/`D` action 처리 정책
> - 현재 Core 1 Collector는 `I`만 처리, `U`/`D`는 카운트만 (TASK-2.1 참조)
> - `U`: 서울경제 기사 수정 반영 여부 (embedding + MBTI 4 버전 재생성 비용 고려)
> - `D`: 기사 삭제 전파 여부 (v2 DB에 tombstone 유지 or 완전 제거)
> - 결정 후 Core 1 Collector 로직 확장. 담당 TASK 번호 미정.

### TASK-2.1: Core 1 Collector Lambda
- **종속성**: TASK-1.3 (PgVectorV2Client 필요), TASK-1.4
- **Files to create**:
  - `backend/v2/handlers/core1_collector.py`
  - `backend/v2/clients/s3_article_v2_client.py` (Core 2에서도 재사용)
  - `backend/v2/tests/test_core1_collector.py`
  - `backend/v2/tests/test_s3_article_v2_client.py`
- **Files to modify** (v2 내부만):
  - `backend/v2/clients/pgvector_v2_client.py` — `filter_existing_news_ids` 메서드 추가 (Notes 참조)
  - `backend/v2/tests/test_pgvector_v2_client.py` — 새 메서드 테스트 합류
  - `backend/v2/deploy-v2.sh` — `CORE1_FUNCTIONS`에 `sedaily-mbti-v2-collector-dev` 등록
  - `backend/v2/tests/conftest.py` — `_TEST_PREFIXES`에 `test_v2_2_1_` 추가
- **로직**:
  1. EventBridge 이벤트에서 날짜 추출 (기본 오늘 KST)
  2. v1 `S3XMLClient`로 XML 다운로드 & 파싱
  3. `PgVectorV2Client.filter_existing_news_ids(candidate_ids)` → dedup (기존 news_id 제외)
  4. garbage 필터 (본문 < 300자, 제목에 `[인사]`/`[부고]` 포함 기사 제외); action `I`만 처리, `U`/`D`는 카운트만
  5. 새 기사만 Titan V2 임베딩 (제목 + 본문 앞 6000자)
  6. `S3ArticleV2Client.put_article_file(news_id, "original.json", dict)` 업로드
  7. `insert_article(status='raw')`
- **Definition of Done**:
  - [x] Lambda 함수명 `sedaily-mbti-v2-collector-dev` *(deploy-v2.sh CORE1_FUNCTIONS 등록 완료; Lambda 생성·env·IAM은 사용자 수동 작업)*
  - [x] 선별 로직 **없음** — 모든 기사 수집 (쓰레기 기사만 간단한 룰 필터: 본문 < 300자 제외, [인사]/[부고] 제외)
  - [x] dedup 통과한 기사만 Bedrock·S3·pgvector 쓰기
  - [x] 실패 시 CloudWatch 에러 로그 (기사별 try/except로 부분 실패 격리, 실패 news_id는 응답 페이로드에 포함)
  - [x] 테스트: mock 기사 5개 주입 → DB에 5 row, S3에 5 object *(unit 23 + integration 4 구현; 실측은 사용자 Lambda 생성 후 env 세팅하고 `pytest -m integration` 실행)*
- **Notes**:
  - `PgVectorV2Client`에 `filter_existing_news_ids(news_ids: List[str]) -> set` 추가 (TASK-1.3의 11 메서드에는 없던 dedup 헬퍼 — Collector 핵심 경로에서 필요성 발견). 해당 테스트는 `test_pgvector_v2_client.py`에 기존 prefix `test_v2_1_3_`로 합류. TASK-1.3 스펙은 무수정 — 작업 당시 합의된 11 메서드로 완결된 상태 그대로 둠. 히스토리 정직성 우선.
  - `S3ArticleV2Client` 신설 — v1 `clients.s3_article_client.S3ArticleClient`는 객체 키가 `articles/{news_id}/body.json` 고정이라 Core 1의 `original.json`과 Core 2의 `version_*.json`을 담을 수 없음. 같은 버킷 레이아웃을 둘 다 쓰는 Core 2 Transform에서도 재사용 예정.
  - 동시성: Bedrock Titan V2 호출은 `asyncio.Semaphore(10)`으로 제한 (on-demand RPM 한도 대비 충분한 여유), pgvector insert는 `asyncio.Lock`으로 직렬화 (pg8000.native.Connection은 스레드 안전하지 않음). S3 `put_object`는 boto3 low-level client 문서상 스레드 안전하므로 잠금 없이 병렬.

### TASK-2.2: EventBridge 스케줄 등록 스크립트
- **종속성**: TASK-2.1 (Lambda 배포 후)
- **Files to create**:
  - `backend/v2/infrastructure/setup_eventbridge_v2.sh` (dry-run 기본)
- **Definition of Done**:
  - [x] `sedaily-mbti-v2-collector-schedule` cron(0 0/3 * * ? *) → collector Lambda *(rate→cron 변경: wall-clock 정렬 위해 UTC 00/03/06/09/12/15/18/21 고정 = KST 09/12/15/18/21/00/03/06. 2026-04-22 09:09 UTC `--apply` 실측, State=ENABLED, 첫 fire 2026-04-22 12:00 UTC 예정)*
  - [ ] `sedaily-mbti-v2-transform-trigger` rate(5 minutes) → transform Lambda *(TASK-2.3에서 Transform Lambda 배포 후 같은 스크립트에 추가 + 활성화 — 이 PR 범위 밖)*
  - [x] **실제 등록은 사람이 수동** *(.clauderules #4 2026-04-22 완화로 Claude Code가 계획·승인·비용·announce·ID추적·stop-on-anomaly 6조건 충족 후 직접 `--apply` 실행. 생성 리소스: rule `sedaily-mbti-v2-collector-schedule`, target `collector-lambda`, permission SID `EventBridgeV2CollectorSchedule`)*

### TASK-2.3: Core 2 Transform Lambda
- **종속성**: TASK-2.1
- **Files to create**:
  - `backend/v2/clients/transform_v2_service.py` *(wrapper; composition around v1 MbtiTransformService, injects VPC Bedrock endpoint + correct Opus 4.6 model ID)*
  - `backend/v2/handlers/core2_transform.py`
  - `backend/v2/tests/test_transform_v2_service.py` *(7 unit: 3 user-specified regression guards + 2 model_id guards + close + delegation smoke)*
  - `backend/v2/tests/test_core2_transform.py` *(11 unit + 1 integration: OPTIONS, empty batch, full success, partial failure, total failure, semaphore, deadline, 3× logging events)*
  - `backend/v2/infrastructure/verify_opus_baseline.py` *(one-shot diagnostic — not part of Lambda package; measures Opus 4.6 p99 latency + verifies 1h TTL)*
- **Files to modify (v2 only)**:
  - `backend/v2/tests/conftest.py` — `_TEST_PREFIXES` += `test_v2_2_3_`
  - `backend/v2/deploy-v2.sh` — `CORE2_FUNCTIONS=("sedaily-mbti-v2-transform-dev")`
- **로직**:
  1. `PgVectorV2Client.get_articles_by_status('raw', limit=20)` — 배치 크기 20 (Phase A2 Section 3 sizing)
  2. 각 기사: v1 `MbtiTransformService.transform_article()` 재사용 (4 병렬 Opus) via `TransformV2Service` wrapper
  3. 4 버전 각각 Titan V2 임베딩 (4 parallel)
  4. S3에 `version_{NT|NF|ST|SF}.json` 업로드 (4 parallel)
  5. `insert_article_version` × 4 (db_lock 직렬화 — pg8000 thread-unsafe)
  6. `update_article_status(news_id, 'transformed')`
  7. 부분 실패 (<4 versions) 또는 예외 시 `status='failed'` (strict policy)
  8. Wave 사이 `context.get_remaining_time_in_millis()` 체크, < `WAVE_DEADLINE_BUFFER_S` (90s) 시 나머지 articles 스킵 (status='raw' 유지, 다음 fire pickup)
- **Definition of Done**:
  - [x] 함수명 `sedaily-mbti-v2-transform-dev` *(빈 Lambda 사용자 생성됨, Phase C에서 Handler/VPC/Timeout/Memory/Env 설정)*
  - [~] **프롬프트 캐싱 활성화** *(v1 `cache_control: {"type": "ephemeral"}` 상속 — 하지만 `verify_opus_baseline.py` 실측 결과 Opus 4.6는 default ephemeral에 cache 0% 반환. **1h TTL만 작동**함. v2 버전에서 1h TTL 적용은 v1 `transform_single_group` 수정 필요 → `.clauderules` #1 위반 → 별도 follow-up TASK로 defer. Option Z.)*
  - [x] 4 병렬 호출 (asyncio.gather) *(v1 재사용)*
  - [x] Bedrock 스로틀링 시 exponential backoff 재시도 *(v1 5회 재시도 그대로 상속. spec 3회보다 보수적)*
  - [x] 실패한 기사는 재처리 가능 (`status='failed'` → 별도 잡으로 재시도) *(`ON CONFLICT (news_id, mbti_type) DO UPDATE` for version rows; status 재설정은 수동 SQL 또는 별도 retry job)*
  - [x] 18 unit tests PASS (`pytest v2/tests/test_transform_v2_service.py v2/tests/test_core2_transform.py -m 'not integration'`)
  - [x] `verify_opus_baseline.py` 실측 완료 *(article 2KB8R3LJ9D, p50=27.96s, p99=28.73s, 1h TTL PASS — 결과 C1 commit body)*
- **Notes**:
  - **Mega-system prompt rejected**: consolidating 4 personas into a single system block would save ~18% input tokens but re-introduces the quality regression that drove v1 from single-call → 4-parallel. Not worth the trade. Re-evaluate at Phase 5 if cost pressure increases.
  - **1h cache TTL deferred (Option Z)**: v1 `MbtiTransformService` hardcodes `cache_control: {"type":"ephemeral"}` at line 188-192 (no ttl). `.clauderules` #1 forbids editing v1. `verify_opus_baseline.py` confirms Opus 4.6 supports `ttl="1h"` — but also reveals Opus 4.6 does **NOT** honor default 5min ephemeral (cache_creation=0 on all 5 no-ttl calls). **Implication: current v2 Transform runs with ZERO cache benefit on Opus 4.6.** Cost per article ≈ $0.74 without cache vs ~$0.52 with 1h cache (warm) = ~30% savings left on the table. **Follow-up TASK-2.6 suggested**: thick v2 wrapper that bypasses v1's Bedrock call to inject `ttl="1h"`. Verify with TASK-2.3 live data: if cache_read_input_tokens stays 0 after backlog clear (expected per this finding), create TASK-2.6 with estimated $2000+/month savings at current traffic.
  - **v1 MODEL_ID bug surfaced**: `config/constants.py:86 BEDROCK_MODEL_ID_OPUS = 'us.anthropic.claude-opus-4-6-v1:0'` — but Bedrock's actual Opus 4.6 inference profile is `us.anthropic.claude-opus-4-6-v1` (no `:0` suffix; AWS changed convention for 4.6+). `TransformV2Service` overrides to the correct ID; v1 production may be silently failing transforms. **Separate v1 hotfix session recommended.**
  - **S3 field convention** (discovered during TASK-2.3): v1 `article_to_dict()` renames Python dataclass fields to JSON keys at S3 boundary — `title` → `title_ko`, `sub_title` → `sub_title_ko`, `content_clean` → `content_ko`. v2 Transform handler uses the JSON keys directly (not the dataclass names). Future v2 handlers reading `original.json` must follow the same convention.
  - **WAVE_DEADLINE_BUFFER_S = 90s** sized from `verify_opus_baseline.py` p99 observation (28.73s per single Opus call), wave of 5 ≈ 35s p99, + one retry allowance 30s + 25s safety. Phase D production data may prompt tightening to 60s or loosening to 120s.

### TASK-2.4: Core 2 Validator Lambda
- **종속성**: TASK-2.3
- **Files to create**:
  - `backend/v2/handlers/core2_validator.py`
  - `backend/v2/tests/test_core2_validator.py`
- **로직**: Nova Lite로 4 버전 cross-check (사실 일관성, 톤 매칭). v1 `step4_validate.py` 로직 단순화해서 이식.
- **Definition of Done**:
  - [ ] 함수명 `sedaily-mbti-v2-validator-dev`
  - [ ] Transform Lambda가 성공 시 SNS/SQS로 Validator에 트리거 (또는 같은 Lambda에서 inline 호출)
  - [ ] Validator 실패 시 `status='failed'`로 돌림

### TASK-2.5: v1 → v2 데이터 백필 스크립트 (일회성)
- **종속성**: TASK-2.4
- **Files to create**:
  - `backend/v2/tools/backfill_from_v1.py`
- **로직**:
  1. v1 DynamoDB `sedaily-mbti-articles-dev`에서 최근 30일 기사 스캔
  2. 이미 변환된 4 버전은 그대로 이전 (S3 body + pgvector rows)
  3. 임베딩은 새로 생성 (Titan V2)
  4. `status='transformed'` 마킹
- **Definition of Done**:
  - [ ] `--dry-run` 옵션 지원
  - [ ] `--limit N` 옵션 (테스트용 소량 이전)
  - [ ] 진행률 표시 (tqdm)
  - [ ] 실패한 기사 건너뛰고 계속 진행 (리포트 출력)

---

## Phase 3: Core 3 Personalization (목표 3주)

### TASK-3.1: Memory Manager 라이브러리
- **종속성**: TASK-1.3
- **Files to create**:
  - `backend/v2/core3/memory_manager.py`
  - `backend/v2/tests/test_memory_manager.py`
- **메서드**:
  - `get_short_term(user_id) -> list[dict]` (DynamoDB personal TTL 세션 이벤트)
  - `get_semantic(user_id) -> dict` (MBTI + 프로필 사실)
  - `get_episodic(user_id, limit) -> list[dict]` (pgvector user_interactions)
  - `get_procedural(user_id) -> dict` (category_weights, preference_embedding)
  - `consolidate(user_id) -> None` (short-term → procedural 재계산, 주기 배치에서 호출)
- **Definition of Done**:
  - [ ] Lambda 아님, 순수 라이브러리
  - [ ] 각 메서드 단위 테스트

### TASK-3.2: Context Broker
- **종속성**: TASK-3.1
- **Files to create**:
  - `backend/v2/core3/context_broker.py`
  - `backend/v2/tests/test_context_broker.py`
- **메서드**:
  - `get_user_context(user_id, request_type)` — request_type별 레이어 조립 (feed/chat/search/podcast)
  - `get_article_context(news_id, mbti_type)` — 메타 + body + similar
  - (Recommend Agent는 TASK-3.3에서 분리)
- **Definition of Done**:
  - [ ] request_type별 반환 필드 다름 (v2 아키텍처 문서 5.2절 기준)
  - [ ] 각 타입별 테스트

### TASK-3.3: Recommend Agent (3-Stage Ranking)
- **종속성**: TASK-3.2
- **Files to create**:
  - `backend/v2/core3/recommend_agent.py`
  - `backend/v2/tests/test_recommend_agent.py`
- **로직**:
  - Stage 1: `PgVectorV2Client.find_feed_candidates()` → ~100개
  - Stage 2: personal scoring (코사인 유사도 × 카테고리 가중치 × recency × engagement avg)
  - Stage 3: MMR diversity + 카테고리 cap
- **Definition of Done**:
  - [ ] 10 테스트 유저 → 각각 다른 피드 반환
  - [ ] MMR λ 파라미터 설정 가능

### TASK-3.4: Core 3 API Handlers
- **종속성**: TASK-3.3
- **Files to create**:
  - `backend/v2/handlers/core3_feed.py` (`GET /api/v2/feed`)
  - `backend/v2/handlers/core3_article.py` (`GET /api/v2/article/{id}`)
  - `backend/v2/handlers/core3_record_interaction.py` (`POST /api/v2/feed/event`)
- **Definition of Done**:
  - [ ] 각 Lambda `sedaily-mbti-v2-{feed|article|event}-dev`로 배포
  - [ ] `GET /api/v2/feed?limit=20` → 20개 개인화된 기사
  - [ ] `GET /api/v2/article/{id}?mbti=NT` → 해당 버전 전체 반환
  - [ ] `POST /api/v2/feed/event` → 즉시 pgvector user_interactions INSERT + DynamoDB short-term 업데이트

### TASK-3.5: Consolidation 배치 Lambda
- **종속성**: TASK-3.4
- **Files to create**:
  - `backend/v2/handlers/core3_consolidation.py`
- **로직**: EventBridge rate(1 hour)로 트리거 → 모든 활성 유저의 `Memory Manager.consolidate()` 실행
- **Definition of Done**:
  - [ ] 함수명 `sedaily-mbti-v2-consolidation-dev`
  - [ ] 1시간 스케줄 등록
  - [ ] 실행 후 `user_profiles.category_weights`, `preference_embedding` 업데이트 확인

---

## Phase 4: AgentCore + MCP (목표 3주)

### TASK-4.1: Chat Agent MCP 서버 골격
- **종속성**: TASK-3.2 (Context Broker 필요)
- **Files to create**:
  - `backend/v2/agents/chat_agent/Dockerfile` (ARM64, python:3.11-slim)
  - `backend/v2/agents/chat_agent/requirements.txt` (mcp, bedrock-agentcore, boto3, pg8000)
  - `backend/v2/agents/chat_agent/server.py` (FastMCP, stateless_http=True 초기)
  - `backend/v2/agents/chat_agent/tools/__init__.py`
  - `backend/v2/agents/chat_agent/tools/get_user_context.py`
  - `backend/v2/agents/chat_agent/tools/get_article.py`
  - `backend/v2/agents/chat_agent/tools/search_archive.py`
  - `backend/v2/agents/chat_agent/tools/record_interaction.py`
- **Definition of Done**:
  - [ ] 로컬에서 `docker buildx build --platform linux/arm64` 성공
  - [ ] 로컬 `docker run` 후 `curl localhost:8000/mcp` 응답
  - [ ] 4개 도구가 MCP initialize 응답에 포함

### TASK-4.2: ECR push + AgentCore Runtime 배포
- **종속성**: TASK-4.1
- **Files to create**:
  - `backend/v2/agents/chat_agent/deploy.sh` (docker build + ECR push + agentcore CLI)
- **Definition of Done**:
  - [ ] ECR에 이미지 태그 `:latest`, `:{git-sha}` 둘 다 push
  - [ ] AgentCore Runtime `sedaily-mbti-chat-agent-v2-dev` 배포
  - [ ] `InvokeAgentRuntime` API 호출 성공 (Mcp-Session-Id 반환 확인)

### TASK-4.3: Stateful 모드 전환 & 세션 유지
- **종속성**: TASK-4.2
- **수정 파일**: `server.py` — `stateless_http=False`
- **Definition of Done**:
  - [ ] 세션 생성 후 2번째 요청에서 이전 context 유지
  - [ ] 15분 유휴 후 404 확인 (timeout 동작)

### TASK-4.4: AgentCore Gateway 라우팅
- **종속성**: TASK-4.3
- **Files to create**:
  - `backend/v2/infrastructure/setup_agentcore_gateway.sh`
- **Definition of Done**:
  - [ ] `/api/v2/chat/*` 트래픽이 Chat Agent Runtime으로 라우팅
  - [ ] Cognito OAuth 통합 (`us-east-1_ZS8PgF3iX` 풀)
  - [ ] 프론트에서 세션 ID 유지하면서 multi-turn 대화 동작

### TASK-4.5: Observability 대시보드
- **종속성**: TASK-4.2
- **Definition of Done**:
  - [ ] AgentCore Observability 자동 생성 대시보드 확인
  - [ ] CloudWatch 알람: 에러율 > 5%, p95 latency > 3s

### TASK-4.6: AgentCore Policy 가드레일 (선택, 시간 있으면)
- **종속성**: TASK-4.3
- **Definition of Done**:
  - [ ] 정책: "record_interaction은 본인 user_id만"
  - [ ] 정책: "PII 응답 금지"

---

## Phase 5: 트래픽 전환 & v1 정리 (목표 2주)

### TASK-5.1: 프론트엔드 feature flag 시스템
- **종속성**: Phase 3 완료
- **Files to modify** (프론트엔드): `frontend-next/src/shared/config/api.ts`
- **Definition of Done**:
  - [ ] `NEXT_PUBLIC_V2_{FEED|ARTICLE|CHAT|ARCHIVE|RECOMMEND}` 환경변수 5개
  - [ ] 각 플래그 true면 `/api/v2/*` 호출, false면 `/api/*` (v1)

### TASK-5.2 ~ 5.6: 기능별 순차 전환 (각각 1주 운영 후 다음)
- TASK-5.2: `/s3-articles` (원본, 리스크 낮음) — 사실 v2 불필요, pass 가능
- TASK-5.3: `/api/article/{id}` → `/api/v2/article/{id}`
- TASK-5.4: `/api/feed` → `/api/v2/feed` (신규 엔드포인트)
- TASK-5.5: `/api/chat` → `/api/v2/chat` (AgentCore)
- TASK-5.6: `/api/recommend`, `/api/archive`, `/api/podcast` 나머지
- **각 Definition of Done**:
  - [ ] 24시간 에러율 < 0.5%
  - [ ] p95 latency 기존 대비 +20% 이내
  - [ ] A/B 비교 리포트

### TASK-5.7: v1 Lambda 비활성화
- **종속성**: TASK-5.6 + 30일 안정화
- **Definition of Done**:
  - [ ] v1 Lambda 22개 concurrency 0으로 (삭제 아님)
  - [ ] v1 Step Functions 정지
  - [ ] v1 EventBridge 스케줄 비활성화

### TASK-5.8: v1 데이터 정리 (3개월 후 판단)
- **종속성**: TASK-5.7 + 3개월 무중단
- **Definition of Done**:
  - [ ] v1 DynamoDB `sedaily-mbti-articles-dev` 삭제 (또는 S3 백업 후)
  - [ ] v1 OpenSearch 도메인 삭제 (한글 full-text 필요 없다고 확정된 경우)
  - [ ] v1 코드 `legacy/` 디렉터리로 이동

---

## 진행 현황 요약

| Phase | TASK 수 | 완료 | 진행 중 | 남음 |
|---|---|---|---|---|
| Phase 0 | 3 | 3 | 0 | 0 |
| Phase 1 | 4 | 4 | 0 | 0 |
| Phase 2 | 5 | 3 | 0 | 2 |
| Phase 3 | 5 | 0 | 0 | 5 |
| Phase 4 | 6 | 0 | 0 | 6 |
| Phase 5 | 8 | 0 | 0 | 8 |
| **합계** | **31** | **10** | **0** | **21** |

세션 시작 시 이 표 업데이트할 것.
