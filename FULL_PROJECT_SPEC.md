# AI LENS — 완전한 프로젝트 & 코드베이스 명세서

> **서비스**: AI LENS — 서울경제신문 MBTI 맞춤형 경제 뉴스  
> **도메인**: https://mbti.sedaily.ai  
> **API Gateway**: `https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev`  
> **최종 업데이트**: 2026-04-10  
> **코드 규모**: 백엔드 102 파일 / 28,907줄, 프론트엔드 102 파일 / 20,697줄  
> **데모**: 2026-06-11 서울경제 최종 발표

---

## 목차

1. [서비스 개요](#1-서비스-개요)
2. [인프라 아키텍처](#2-인프라-아키텍처)
3. [MBTI 그룹 시스템](#3-mbti-그룹-시스템)
4. [프론트엔드](#4-프론트엔드)
5. [백엔드 디렉토리 구조](#5-백엔드-디렉토리-구조)
6. [데이터 저장 레이어](#6-데이터-저장-레이어)
7. [기사 변환 파이프라인 (Step Functions)](#7-기사-변환-파이프라인)
8. [번역 파이프라인 (영문 사이트)](#8-번역-파이프라인)
9. [AI 모델 구성](#9-ai-모델-구성)
10. [API 엔드포인트 전체 목록](#10-api-엔드포인트-전체-목록)
11. [인증 시스템](#11-인증-시스템)
12. [벡터 검색 (OpenSearch + pgvector)](#12-벡터-검색)
13. [추천 시스템](#13-추천-시스템)
14. [A/B 테스트 프레임워크](#14-ab-테스트-프레임워크)
15. [운영 메트릭 + 모니터링](#15-운영-메트릭--모니터링)
16. [환경 변수](#16-환경-변수)
17. [배포](#17-배포)
18. [테스트 스위트](#18-테스트-스위트)
19. [파일별 상세 명세](#19-파일별-상세-명세)

---

## 1. 서비스 개요

AI LENS는 서울경제신문의 원본 경제 기사를 MBTI 인지 스타일 4그룹(NT/NF/ST/SF)별로 AI가 서로 다른 톤과 구조로 리라이팅하여 제공하는 뉴스 서비스이다.

### 핵심 데이터 플로우

```
서울경제 원본 기사 (S3 XML, ap-northeast-2)
  │
  ▼ EventBridge 스케줄 (매일 07:00 KST)
  │
  ▼ Step Functions 파이프라인 (us-east-1, 5단계)
  ├─ Step 1: 기사 선별 (Nova) — 규칙 + AI 필터링
  ├─ Step 2: MBTI 분류 (Nova) — 카테고리별 할당
  ├─ Step 3: 톤앤매너 변환 (Claude) — 4버전 동시 생성 (병렬 Map)
  ├─ Step 4: 품질 검증 (Nova) — 맞춤법, 스타일, 팩트 보존
  └─ Supervisor: 최종 승인 → 저장 → 벡터 인덱싱
      ├─ Article Body → S3 (sedaily-mbti-article-body-dev)
      ├─ Article Pointer → DynamoDB (sedaily-mbti-articles-dev)
      ├─ Embeddings → OpenSearch (RAG 검색)
      └─ Embeddings → pgvector (유사도 검색)
  │
  ▼ (선택) 번역 파이프라인
  ├─ AWS Translate (경제 용어 84개 커스텀)
  └─ Nova 영문 품질 향상 → S3 body_en.json
  │
  ▼ API Gateway → 프론트엔드 (Next.js, mbti.sedaily.ai)
```

---

## 2. 인프라 아키텍처

### 2.1 AWS 리소스 전체 목록

| 서비스 | 리소스명 | 리전 | 용도 |
|--------|----------|------|------|
| **DynamoDB** | `sedaily-mbti-articles-dev` | us-east-1 | 기사 메타데이터 + S3 포인터 |
| **DynamoDB** | `sedaily-mbti-personal-dev` | us-east-1 | 유저 프로필, 아카이빙, 읽기 기록, A/B 테스트 |
| **DynamoDB** | `sedaily-mbti-podcast-dev` | us-east-1 | 팟캐스트 메타데이터 |
| **DynamoDB** | `sedaily-mbti-engagement-dev` | us-east-1 | 반응, 댓글, 별점 |
| **S3** | `sedaily-news-xml-storage` | ap-northeast-2 | 서울경제 원본 XML |
| **S3** | `sedaily-mbti-article-body-dev` | us-east-1 | 기사 본문 (원문 + MBTI 4버전 + 영문) |
| **S3** | `sedaily-mbti-audio-dev` | us-east-1 | 팟캐스트/TTS 음성 파일 |
| **S3** | `sedaily-mbti-frontend-dev` | ap-northeast-2 | 프론트엔드 정적 파일 |
| **S3** | `sedaily-mbti-lambda-packages-dev` | us-east-1 | Lambda 배포 패키지 |
| **CloudFront** | `E1QS7PY350VHF6` | Global | CDN (mbti.sedaily.ai) |
| **Cognito** | `us-east-1_ZS8PgF3iX` | us-east-1 | 사용자 인증 (Google OAuth) |
| **API Gateway** | `chzwwtjtgk` | us-east-1 | REST API 진입점 |
| **Bedrock** | Claude Haiku, Sonnet, Nova Lite/Pro, Titan Embed V2 | us-east-1 | AI 모델 |
| **Polly** | Seoyeon (Neural, ko-KR) | us-east-1 | TTS 음성 합성 |
| **Translate** | Custom Terminology (84 경제 용어) | us-east-1 | 한→영 번역 |
| **OpenSearch** | `sedaily-mbti-search-dev` (선택) | us-east-1 | RAG 하이브리드 검색 |
| **RDS PostgreSQL** | `sedaily-mbti-pgvector-dev` (선택) | us-east-1 | 유사도 검색 |
| **Step Functions** | `sedaily-mbti-transform-pipeline-dev` | us-east-1 | 기사 변환 오케스트레이션 |
| **EventBridge** | `sedaily-mbti-pipeline-schedule-dev` | us-east-1 | 매일 07:00 KST 트리거 |

### 2.2 Lambda 함수 (21개)

**API 함수 (15개)**:

| 함수명 | 핸들러 | 라우트 |
|--------|--------|--------|
| `sedaily-mbti-article-collector-dev` | `handlers.article_collector.lambda_handler` | EventBridge |
| `sedaily-mbti-article-dev` | `handlers.article_handler.lambda_handler` | `GET /api/article/{id}` |
| `sedaily-mbti-search-dev` | `handlers.search_handler.lambda_handler` | `POST /api/search` |
| `sedaily-mbti-chatbot-dev` | `handlers.chatbot_handler.lambda_handler` | `POST /api/chat` |
| `sedaily-mbti-engagement-dev` | `handlers.engagement_handler.lambda_handler` | `/api/engagement/*` |
| `sedaily-mbti-tts-dev` | `handlers.tts_handler.lambda_handler` | `POST /api/tts` |
| `sedaily-mbti-time-machine-dev` | `handlers.time_machine_handler.lambda_handler` | `GET /time-machine` |
| `sedaily-mbti-s3-articles-dev` | `handlers.s3_articles_handler.lambda_handler` | `GET /s3-articles` |
| `sedaily-mbti-user-dev` | `handlers.user_handler.lambda_handler` | `/api/user/*` |
| `sedaily-mbti-archive-dev` | `handlers.archive_handler.lambda_handler` | `/api/archive/*` |
| `sedaily-mbti-podcast-dev` | `handlers.podcast_handler.lambda_handler` | `/api/podcast/*` |
| `sedaily-mbti-recommend-dev` | `handlers.recommendation_handler.lambda_handler` | `/api/recommend/*` |
| `sedaily-mbti-post-dev` | `handlers.post_handler.lambda_handler` | `/api/posts/*` |
| `sedaily-mbti-metrics-dev` | `handlers.metrics_handler.lambda_handler` | `/api/metrics/*` |
| `sedaily-mbti-abtest-dev` | `handlers.ab_test_handler.lambda_handler` | `/api/ab-test/*` |

**파이프라인 함수 (6개)**:

| 함수명 | 핸들러 | 역할 |
|--------|--------|------|
| `sedaily-mbti-pipeline-step1-dev` | `handlers.pipeline.step1_select.lambda_handler` | 기사 선별 |
| `sedaily-mbti-pipeline-step2-dev` | `handlers.pipeline.step2_classify.lambda_handler` | MBTI 분류 |
| `sedaily-mbti-pipeline-step3-dev` | `handlers.pipeline.step3_transform.lambda_handler` | 톤앤매너 변환 |
| `sedaily-mbti-pipeline-step4-dev` | `handlers.pipeline.step4_validate.lambda_handler` | 품질 검증 |
| `sedaily-mbti-pipeline-supervisor-dev` | `handlers.pipeline.supervisor.lambda_handler` | 최종 승인 + 저장 |
| `sedaily-mbti-pipeline-merge-dev` | `handlers.pipeline.merge_transform_results.lambda_handler` | 병렬 결과 병합 |

---

## 3. MBTI 그룹 시스템

### 3.1 4개 그룹 정의

```typescript
// frontend-next/src/shared/data/mbtiGroups.ts
export const mbtiGroups = {
  NT: { id: 'NT', name: '전략형', color: '#3B82F6', style: '애널리스트 리포트', icon: '📊',
        types: ['INTJ', 'INTP', 'ENTJ', 'ENTP'] },
  NF: { id: 'NF', name: '가치형', color: '#8B5CF6', style: '칼럼 / 에세이', icon: '💡',
        types: ['INFJ', 'INFP', 'ENFJ', 'ENFP'] },
  ST: { id: 'ST', name: '실용형', color: '#22C55E', style: '팩트시트', icon: '✅',
        types: ['ISTJ', 'ISTP', 'ESTJ', 'ESTP'] },
  SF: { id: 'SF', name: '공감형', color: '#F97316', style: '친구 톡', icon: '💬',
        types: ['ISFJ', 'ISFP', 'ESFJ', 'ESFP'] },
};
```

### 3.2 에디터 페르소나 + 팟캐스트 음성

| 그룹 | 에디터 | 직함 | 프롬프트 | Polly 속도 |
|------|--------|------|----------|-----------|
| NT | 김시현 | 전략분석팀 수석연구원 | `prompts/nt.md` (255줄) | 100% |
| NF | 박지원 | 오피니언팀 논설위원 | `prompts/nf.md` (249줄) | 95% |
| ST | 이정훈 | 팩트체크 에디터 | `prompts/st.md` (286줄) | 105% |
| SF | 김하은 | MZ 독자 담당 에디터 | `prompts/sf.md` (281줄) | 95% |

---

## 4. 프론트엔드 (frontend-next/)

### 4.1 기술 스택

```json
{ "next": "16.2.2", "react": "19.2.4", "aws-amplify": "^6.16.3",
  "tailwindcss": "^4", "lucide-react": "^1.7.0", "react-markdown": "^10.1.0" }
```

### 4.2 활성 파일 구조 (102 파일 / 20,697줄)

```
src/
├── app/                              # Next.js App Router (13 파일, 2,522줄)
│   ├── layout.tsx (52), page.tsx (120), providers.tsx (11)
│   ├── login/page.tsx (375), auth/callback/page.tsx (25)
│   ├── saju/page.tsx (426), subscription/page.tsx (257)
│   ├── timeline/page.tsx (64), timemachine/page.tsx (1,006)
│   └── globals.css (78), robots.ts (29), sitemap.ts (49)
│
├── components/                       # 대형 페이지 컴포넌트 (8 파일, 4,969줄)
│   ├── mbti/FeedPage.tsx (1,941)     # 메인 뉴스피드 (5개 탭 + 오디오 플레이어)
│   ├── mbti/ArticleView.tsx (420)    # 기사 전체화면 (문장 아카이빙)
│   ├── mbti/MbtiChatBot.tsx (371)    # AI 챗봇 플로팅
│   ├── mbti/OnboardingPage.tsx (317) # MBTI 에디터 선택
│   ├── mbti/BriefingPage.tsx (417)   # 음성 브리핑 (ElevenLabs TTS)
│   ├── story/StoryNewsFeed.tsx (665) # 카드 스와이프 온보딩
│   ├── timeline/TimelineNewsFeed.tsx (658)
│   └── character/Character3D.tsx (180)
│
├── features/                         # FSD Feature 모듈 (13 파일, 3,061줄)
│   ├── auth/ (507) — AuthContext (Cognito), LoginButton, UserMenu
│   ├── news-feed/ (535) — NewsFeedTab
│   ├── archive/ (638) — ArchiveTab ← API 연동 완료 (GET/POST/DELETE + 유사도)
│   ├── community/ (700) — CommunityTab (Mock)
│   ├── news-dna/ (526) — DnaTab ← API 연동 완료 (레이더 차트 + 추천)
│   └── question/ (155) — QuestionTab (하드코딩)
│
├── shared/                           # 공통 모듈 (23 파일, 4,148줄)
│   ├── lib/archiveApi.ts (122)       # 내 서랍 API 클라이언트 ← NEW
│   ├── lib/podcastApi.ts (125)       # 팟캐스트 API 클라이언트 ← NEW
│   ├── lib/recommendApi.ts (79)      # 추천/DNA API 클라이언트 ← NEW
│   ├── lib/abTestApi.ts (78)         # A/B 테스트 클라이언트 ← NEW
│   ├── lib/userApi.ts (57), readingTracker.ts (221), elevenlabs.ts (194)
│   ├── config/api.ts (7), auth.ts (34), videoConfig.ts (20)
│   ├── data/mbtiGroups.ts (95), mockArticles.ts (521), famousBirthdays.ts (1,462)
│   ├── types/article.ts (99), mbti.ts (60), timeMachine.ts (20)
│   └── utils/, constants/, services/, ui/
│
└── legacy/                           # 미사용 코드 (44 파일, 5,992줄)
```

### 4.3 프론트엔드 API 연동 현황

| 기능 | 이전 상태 | 현재 상태 | API 연동 |
|------|-----------|-----------|----------|
| 뉴스피드 | API ✅ | API ✅ | `/s3-articles`, `/api/search` |
| 기사 상세 | API ✅ | API ✅ | `/api/article/{id}` (split storage 지원) |
| AI 챗봇 | API ✅ | API ✅ (RAG) | `/api/chat` (OpenSearch fallback DynamoDB) |
| **내 서랍** | **Mock ❌** | **API ✅** | `/api/archive` CRUD + `/api/archive/similar` |
| **오디오** | **Mock ❌** | **API ✅** | `/api/podcast/generate` + HTML5 `<audio>` |
| **뉴스 DNA** | **하드코딩 ❌** | **API ✅** | `/api/recommend/analysis` → 레이더 차트 |
| **추천 기사** | 없음 | **API ✅** | `/api/recommend` → DnaTab 맞춤 추천 |
| 사주 분석 | API ✅ | API ✅ | `/saju` |
| 타임머신 | API ✅ | API ✅ | `/time-machine` |
| 커뮤니티 | Mock ❌ | Mock ❌ | 아직 미연동 |
| 오늘의 질문 | 하드코딩 | 하드코딩 | 아직 미연동 |

---

## 5. 백엔드 디렉토리 구조

```
backend/                               # 102 파일, 28,907줄
├── main.py (235)                      # FastAPI 로컬 서버
├── requirements.txt (39)              # 12 런타임 패키지
├── deploy.sh (178)                    # Lambda 배포 (21개 함수)
│
├── config/ (4 파일, 717줄)
│   ├── constants.py (282)             # 모든 상수 (테이블, 모델ID, 카테고리, 팟캐스트 음성)
│   ├── settings.py (191)              # Settings 데이터클래스 (38개 필드, 39개 환경변수)
│   ├── __init__.py (160)              # 78개 re-export
│   └── economics_terminology.csv (84) # 한→영 경제 용어 84개 ← NEW
│
├── clients/ (13 파일, 4,287줄)
│   ├── dynamodb_client.py (870)       # DynamoDB + S3 split 저장/조회
│   ├── s3_xml_client.py (897)         # S3 XML 파싱 (카테고리 정규화 60+)
│   ├── opensearch_client.py (487)     # OpenSearch full-text + kNN 검색 ← NEW
│   ├── mbti_transform_service.py (407)# Claude MBTI 변환
│   ├── pgvector_client.py (370)       # PostgreSQL 유사도 검색 ← NEW
│   ├── embedding_client.py (298)      # Bedrock Titan 임베딩 (1024차원) ← NEW
│   ├── podcast_db_client.py (223)     # Podcast DB 클라이언트 ← NEW
│   ├── translate_client.py (210)      # AWS Translate 한→영 ← NEW
│   ├── personal_db_client.py (209)    # Personal DB 클라이언트 ← NEW
│   ├── s3_article_client.py (168)     # S3 기사 본문 저장/조회 ← NEW
│   └── personalize_client.py (158)    # Amazon Personalize 어댑터 ← NEW
│
├── handlers/ (21 파일, 8,971줄)
│   ├── saju_handler.py (956)          # 사주 팔자 분석
│   ├── recommendation_handler.py (698)# 개인화 추천 + DNA 분석 ← ENHANCED
│   ├── engagement_handler.py (544)    # 반응/댓글/별점
│   ├── chatbot_handler.py (505)       # RAG 챗봇 (OpenSearch + 폴백) ← ENHANCED
│   ├── podcast_handler.py (496)       # 팟캐스트 생성/조회 ← NEW
│   ├── ab_test_handler.py (449)       # A/B 테스트 프레임워크 ← NEW
│   ├── post_handler.py (445)          # 관리자 게시글
│   ├── article_collector.py (418)     # 기사 수집 (레거시, 유지)
│   ├── archive_handler.py (391)       # 내 서랍 CRUD + 유사도 ← NEW
│   ├── user_handler.py (375)          # 유저 프로필/통계 ← MIGRATED (Personal DB)
│   ├── article_handler.py (369)       # 기사 상세 ← ENHANCED (split storage)
│   ├── search_handler.py (366)        # GSI 검색 ← ENHANCED (S3 body fetch)
│   ├── s3_articles_handler.py (256)   # S3 XML 직접 조회
│   ├── translation_handler.py (205)   # 영문 기사 API ← NEW
│   ├── tts_handler.py (205)           # AWS Polly TTS
│   ├── time_machine_handler.py (344)  # 과거 날짜 뉴스
│   └── metrics_handler.py (71)        # 대시보드 메트릭 ← NEW
│
├── handlers/pipeline/ (8 파일, 2,170줄) ← ALL NEW
│   ├── supervisor.py (628)            # 최종 승인 + 저장 + 벡터 인덱싱
│   ├── translation_pipeline.py (371)  # 한→영 번역 파이프라인
│   ├── step4_validate.py (323)        # 품질 검증 (Nova)
│   ├── step1_select.py (310)          # 기사 선별 (규칙 + Nova)
│   ├── step2_classify.py (245)        # MBTI 분류 (Nova)
│   ├── step3_transform.py (200)       # 변환 (Claude)
│   ├── merge_transform_results.py (82)# 병렬 결과 병합
│   └── __init__.py (11)
│
├── models/ (5 파일, 938줄)
│   ├── article.py (371)               # Article, ArticleVersion, CollectionLog
│   ├── personal.py (237)              # ArchivedSentence, UserProfile, ReadingRecord ← NEW
│   ├── ab_test.py (166)               # Experiment, Assignment, ABEvent ← NEW
│   └── podcast.py (129)               # Podcast ← NEW
│
├── repositories/ (6 파일, 1,424줄)
│   ├── base.py (406)                  # BaseDynamoDBRepository
│   ├── log_repository.py (300)        # 수집 로그
│   ├── personal_repository.py (283)   # 아카이빙, 프로필, 읽기 기록 ← NEW
│   ├── settings_repository.py (226)   # 설정/프롬프트
│   └── podcast_repository.py (203)    # 팟캐스트 CRUD ← NEW
│
├── services/ (5 파일, 1,164줄)
│   ├── metrics_service.py (309)       # 운영 메트릭 수집/집계 ← NEW
│   ├── prompt_service.py (296)        # 프롬프트 CRUD/버저닝
│   ├── collaborative_filter_service.py (282) # MBTI 협업 필터링 ← NEW
│   └── article_filter_service.py (277)# 기사 필터링 (규칙 + AI)
│
├── infrastructure/ (8 파일, 2,231줄) ← ALL NEW
│   ├── provision.sh (400)             # AWS 리소스 프로비저닝
│   ├── provision_pgvector.sh (332)    # RDS PostgreSQL + pgvector
│   ├── cost_monitoring.sh (270)       # CloudWatch 비용 알람
│   ├── step_functions_definition.json (270) # Step Functions 상태 머신
│   ├── deploy_step_functions.sh (248) # SFN + IAM + EventBridge
│   ├── provision_opensearch.sh (213)  # OpenSearch 도메인
│   ├── README.md (177)                # 배포 가이드 + 트러블슈팅
│   └── demo_checklist.md (121)        # 6/11 데모 체크리스트
│
├── tests/ (15 파일, 5,327줄) ← ALL NEW
│   ├── test_new_apis.py (592)         # 아카이브/팟캐스트/추천 스모크 테스트
│   ├── test_full_integration.py (561) # 전체 통합 테스트
│   ├── test_split_storage.py (560)    # DynamoDB + S3 split 저장 테스트
│   ├── test_regression.py (510)       # 기존 API 회귀 테스트
│   ├── test_opensearch.py (480)       # OpenSearch 통합 테스트
│   ├── test_model_comparison.py (482) # Claude vs Nova 비교 테스트
│   ├── test_pgvector.py (490)         # pgvector 통합 테스트
│   ├── test_full_volume.py (478)      # 대량 파이프라인 부하 테스트
│   ├── estimate_costs.py (432)        # AWS 비용 분석 + 크레딧 예측
│   ├── test_pipeline.py (398)         # Step Functions E2E 테스트
│   ├── run_demo_checks.py (264)       # 데모 전 자동 검증
│   ├── test_performance.py (254)      # 성능 벤치마크
│   └── demo_data_setup.py (244)       # 데모 데이터 생성
│
├── utils/ (2 파일, 123줄)
│   ├── hash_utils.py (67)             # SHA256 콘텐츠 해시
│   └── date_utils.py (56)             # news_id → ISO 타임스탬프
│
└── prompts/ (4 파일, 1,071줄)
    ├── st.md (286), sf.md (281), nt.md (255), nf.md (249)
```

---

## 6. 데이터 저장 레이어

### 6.1 Article DB (split storage)

DynamoDB에는 메타데이터 + S3 포인터만 저장. 본문은 S3에 JSON으로 저장.

**DynamoDB** (`sedaily-mbti-articles-dev`, PK: `news_id`):
```
news_id, item_type, title_ko, sub_title_ko, category, categories,
published_at, author_name, byline, url, original_link, images,
content_hash, transformed_at, transform_usage, s3_body_uri,
s3_body_en_uri, translated_en_at  ← 번역 포인터
```

**S3** (`sedaily-mbti-article-body-dev`):
```
articles/{news_id}/body.json     # 한국어 원본 + MBTI 4버전
articles/{news_id}/body_en.json  # 영문 번역 (선택)
```

**통합 조회**:
```python
db = DynamoDBClient(s3_article_client=S3ArticleClient(...))
article = await db.get_article(news_id)  # DynamoDB + S3 자동 병합
# 레거시 (s3_body_uri 없는 기사)도 그대로 작동
```

### 6.2 Personal DB

```
테이블: sedaily-mbti-personal-dev (PK: user_id, SK: sk)
SK 패턴:
  PROFILE                          — 유저 프로필
  ARCHIVE#{article_id}#{timestamp} — 아카이빙 문장
  READING#{article_id}             — 읽기 기록
  AB_META#{experiment_id}          — A/B 실험 정의 (PK=__experiment__)
  AB_ASSIGN#{experiment_id}        — A/B 그룹 할당
  AB_EVENT#{experiment_id}#{ts}    — A/B 이벤트
```

### 6.3 Podcast DB

```
테이블: sedaily-mbti-podcast-dev (PK: podcast_id)
GSI: date-index (PK: created_date, SK: podcast_id)
상태: creating → completed | failed
```

### 6.4 Engagement DB

```
테이블: sedaily-mbti-engagement-dev (PK: pk, SK: sk)
ARTICLE#{id}/REACTIONS, RATING_STATS, COMMENT#, USER_REACTION#
```

---

## 7. 기사 변환 파이프라인

### 7.1 Step Functions 상태 머신

```
Step1_Select → CheckStep1HasArticles → Step2_Classify
  → PrepareTransformBatches
  → Step3_TransformMap (MaxConcurrency=3, Batch=3)
  → MergeTransformResults → Step4_Validate → Supervisor → END

에러 시: PipelineFailure → Supervisor가 에러 로그 저장 → END
빈 날짜: CheckStep1HasArticles → NoArticles → END
```

### 7.2 카테고리별 할당량

```python
ALLOCATION_PER_CATEGORY = {
    '경제': 3, 'IT_과학': 2, '정치': 1,
    '사회': 2, '문화': 1, '스포츠': 1, '국제': 1,
}  # 총 11개 기사/일
```

### 7.3 Supervisor 저장 + 벡터 인덱싱

```python
# Phase 3: Article DB 저장 (DynamoDB pointer + S3 body)
await db.save_article(storage_dict)

# Phase 4: 벡터 인덱싱 (기사당 5개: 원본 + NT + NF + ST + SF)
embeddings = embed_client.embed_batch(texts)
os_client.bulk_index_articles(articles, embeddings, groups)  # OpenSearch 배치
pg_client.insert_article_vector(news_id, group, text, embedding)  # pgvector
```

---

## 8. 번역 파이프라인

```
변환 완료 기사 (MBTI 4버전 존재)
  → AWS Translate (84개 경제 용어 커스텀 터미놀로지)
    title_ko → title_en, content_ko → content_en
    version_NT/NF/ST/SF → 각각 영문 번역
  → Nova 품질 향상 (자연스러운 영어, 문화 맥락 추가)
  → S3: articles/{news_id}/body_en.json
  → DynamoDB: s3_body_en_uri 추가
  → GET /api/article/{news_id}/en 으로 서빙
```

커스텀 터미놀로지 예시 (`config/economics_terminology.csv`):
```
공매도,short selling
기준금리,base interest rate
전세,jeonse (lump-sum deposit lease)
양도세,capital gains tax
코스피,KOSPI
```

---

## 9. AI 모델 구성

```python
# Claude (복잡한 리라이팅 — Step 3, 챗봇, 팟캐스트 대본)
BEDROCK_MODEL_ID_HAIKU  = 'us.anthropic.claude-3-5-haiku-20241022-v1:0'  # $0.25/$1.25/1M
BEDROCK_MODEL_ID_SONNET = 'us.anthropic.claude-sonnet-4-20250514-v1:0'   # 고품질 옵션

# Nova (분류/필터링/검증 — Steps 1, 2, 4, Supervisor, 번역 향상)
BEDROCK_MODEL_ID_NOVA_LITE = 'amazon.nova-lite-v1:0'
BEDROCK_MODEL_ID_NOVA_PRO  = 'amazon.nova-pro-v1:0'

# 임베딩 (벡터 검색)
BEDROCK_EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0'  # 1024차원
```

실측 비교 (test_model_comparison.py 결과):
| 지표 | Claude Haiku | Nova Pro |
|------|-------------|----------|
| 기사당 비용 | $0.0025 | $0.0279 |
| 응답 시간 | ~28초 | ~33초 |
| 4버전 완성률 | 100% | 100% |

---

## 10. API 엔드포인트 전체 목록

### 기사 (4개)

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/s3-articles?date={YYYYMMDD}&limit=30` | S3 XML 기사 목록 |
| `GET` | `/s3-article/{id}` | S3 XML 기사 상세 |
| `GET` | `/api/article/{id}` | DynamoDB+S3 기사 상세 (MBTI 포함) |
| `POST` | `/api/search` | GSI 검색 |

### 챗봇 (1개)

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/chat` | RAG 챗봇 (OpenSearch → DynamoDB fallback) |

### 내 서랍 (4개) ← NEW

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/archive` | 문장 저장 (Personal DB + pgvector) |
| `GET` | `/api/archive?user_id=&date_from=&date_to=` | 문장 목록 |
| `DELETE` | `/api/archive/{id}?user_id=` | 문장 삭제 |
| `POST` | `/api/archive/similar` | 유사 문장 검색 (pgvector) |

### 팟캐스트 (4개) ← NEW

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/podcast/generate` | 팟캐스트 생성 (Bedrock + Polly) |
| `GET` | `/api/podcast/{id}` | 상세 + presigned audio URL |
| `GET` | `/api/podcast/list?date=` | 날짜별 목록 |
| `GET` | `/api/podcast/article/{id}` | 기사별 목록 |

### 추천 (2개) ← NEW

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/recommend?user_id=&limit=` | 개인화 추천 (Personalize → 협업 필터 → 카테고리) |
| `GET` | `/api/recommend/analysis?user_id=` | DNA 분석 (레이더 차트) |

### 유저 (5개)

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/user/profile` | 프로필 동기화 |
| `PUT` | `/api/user/mbti` | MBTI 그룹 변경 |
| `POST` | `/api/user/read` | 읽기 기록 |
| `GET` | `/api/user/history` | 읽기 기록 조회 |
| `GET` | `/api/user/stats` | 통계 (뱃지, 스트릭) |

### A/B 테스트 (4개) ← NEW

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/api/ab-test/experiment` | 실험 생성 (admin) |
| `POST` | `/api/ab-test/assign` | 그룹 할당 (결정론적 해시) |
| `POST` | `/api/ab-test/event` | 이벤트 기록 |
| `GET` | `/api/ab-test/results?experiment_id=` | 결과 집계 (lift %) |

### 번역 (1개) ← NEW

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/article/{id}/en` | 영문 기사 |

### 메트릭 (3개) ← NEW

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/metrics/dashboard` | 전체 대시보드 |
| `GET` | `/api/metrics/pipeline` | 파이프라인 성능 |
| `GET` | `/api/metrics/costs` | 비용 분석 |

### 기타 (5개)

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/saju` | 사주 분석 |
| `GET` | `/time-machine?date=` | 타임머신 |
| `POST` | `/api/tts` | TTS 음성 (Polly) |
| `/api/engagement/*` | | 반응/댓글/별점 |
| `/api/posts/*` | | 관리자 게시글 |

**총 33개 API 엔드포인트**

---

## 11. 인증 시스템

```typescript
// Cognito: us-east-1_ZS8PgF3iX, Client: 66c9bq3ovmk007d0eepkle92k3
// OAuth: Google, domain: sedaily-mbti.auth.us-east-1.amazoncognito.com
// Redirect: https://mbti.sedaily.ai/auth/callback (prod), localhost:3000 (dev)
```

---

## 12. 벡터 검색

### OpenSearch (RAG 하이브리드)

```python
# 인덱스: sedaily-articles
# 필드: news_id, title (nori 분석기), body_text, category, published_at, mbti_group, embedding_vector (knn_vector 1024)
# 검색: hybrid_search(query, embedding, text_weight=0.3, vector_weight=0.7)
```

### pgvector (유사도)

```sql
-- articles_vectors: news_id, mbti_group, chunk_text, embedding vector(1024)
-- archive_vectors: user_id, sentence_text, article_id, embedding vector(1024)
-- 검색: embedding <=> query::vector (cosine distance)
```

---

## 13. 추천 시스템

**다중 전략 캐스케이드:**
```
1. Amazon Personalize (PERSONALIZE_CAMPAIGN_ARN 설정 시)
   ↓ 미설정 → 건너뜀
2. MBTI 협업 필터링 ("같은 MBTI 그룹 유저들이 읽은 기사")
   ↓ 항상 실행
3. 카테고리 기반 관심 매칭 (읽기 기록 분석)
   ↓ 항상 실행
4. pgvector 유사도 (아카이빙 문장 기반)
   ↓ PG 설정 시
5. Cold start (인기 카테고리 최신 기사)
```

응답의 `recommendation_source`: `"personalize"` | `"collaborative"` | `"rule_based"` | `"cold_start"`

---

## 14. A/B 테스트 프레임워크

```python
# 그룹 할당: SHA256(user_id + experiment_id) % 2 → A 또는 B (결정론적)
# 이벤트: read (read_time_seconds), scroll (scroll_depth_percent), archive, share, return
# 결과: group_a vs group_b 메트릭 + lift % 계산
```

---

## 15. 운영 메트릭 + 모니터링

### CloudWatch 알람 (6개)

| 알람 | 임계값 |
|------|--------|
| Bedrock 호출 | > 500/일 |
| DynamoDB WCU | > 1000/일 |
| Lambda 동시 실행 | > 50 |
| S3 저장 용량 | > 10 GB |
| 일일 비용 | > $50 |
| 파이프라인 에러 | > 5/시간 |

### 비용 현황 (실측)

| 서비스 | 일일 비용 | 월간 예상 |
|--------|-----------|-----------|
| Bedrock | $0.11 | $3.15 |
| Lambda | $0.02 | $0.48 |
| DynamoDB | ~$0 | ~$1 |
| S3 | ~$0 | ~$1 |
| OpenSearch (미배포) | $0.86 | $25.92 |
| RDS pgvector (미배포) | $0.43 | $15.26 |
| **합계** | **$1.47** | **$44.15** |

**예산**: $26,000 → **589개월** 사용 가능

---

## 16. 환경 변수

```bash
# AWS 기본
AWS_REGION=us-east-1

# DynamoDB
DYNAMODB_TABLE_ARTICLES=sedaily-mbti-articles-dev
DYNAMODB_TABLE_PERSONAL=sedaily-mbti-personal-dev
DYNAMODB_TABLE_PODCAST=sedaily-mbti-podcast-dev

# S3
S3_ARTICLE_BODY_BUCKET=sedaily-mbti-article-body-dev
S3_AUDIO_BUCKET=sedaily-mbti-audio-dev

# AI 모델
CLAUDE_MODEL_ID=us.anthropic.claude-3-5-haiku-20241022-v1:0
NOVA_MODEL_ID=amazon.nova-lite-v1:0
EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0

# 검색 (선택)
OPENSEARCH_ENDPOINT=https://xxx.es.amazonaws.com
PG_HOST=xxx.rds.amazonaws.com
PG_PASSWORD=...

# 추천 (선택)
PERSONALIZE_CAMPAIGN_ARN=...
```

---

## 17. 배포

```bash
cd backend
./deploy.sh              # 전체 (API 15 + Pipeline 6)
./deploy.sh api          # API만
./deploy.sh pipeline     # Pipeline만

# 인프라 프로비저닝
./infrastructure/provision.sh          # S3, DynamoDB, Lambda, SFN, EventBridge
./infrastructure/deploy_step_functions.sh  # Step Functions + IAM
./infrastructure/provision_opensearch.sh   # OpenSearch (15-20분)
./infrastructure/provision_pgvector.sh     # RDS pgvector (10분)
./infrastructure/cost_monitoring.sh        # CloudWatch 알람
```

---

## 18. 테스트 스위트

| 테스트 | 파일 | 대상 | 실행 시간 |
|--------|------|------|-----------|
| 회귀 | `test_regression.py` | 기존 8개 API + 신규 3개 | ~30초 |
| Split 저장 | `test_split_storage.py` | DynamoDB + S3 분리 저장 | ~20초 |
| 신규 API | `test_new_apis.py` | Archive, Podcast, Recommend | ~30초 |
| 통합 | `test_full_integration.py` | 전체 5단계 (저장→벡터→챗봇→서랍→추천) | ~30초 |
| OpenSearch | `test_opensearch.py` | 인덱스, 검색, RAG | ~20초 |
| pgvector | `test_pgvector.py` | 테이블, 벡터, 유사도 | ~20초 |
| 파이프라인 | `test_pipeline.py` | Step Functions E2E | ~10분 |
| 대량 | `test_full_volume.py` | 3일치 파이프라인 부하 | ~30분 |
| 모델 비교 | `test_model_comparison.py` | Claude vs Nova (20기사) | ~20분 |
| 성능 | `test_performance.py` | API + DynamoDB + Embedding 레이턴시 | ~1분 |
| 비용 | `estimate_costs.py` | CloudWatch → 비용 분석 | ~10초 |
| 데모 검증 | `run_demo_checks.py` | 인프라/데이터/기능/성능/비용 | ~36초 |
| 데모 데이터 | `demo_data_setup.py` | 데모 사용자 + 읽기/아카이빙 데이터 | ~10초 |

**테스트 결과 파일**: `tests/results/` (cost_estimate, performance, model_comparison, volume_test JSON)

---

## 19. 파일별 상세 명세

### 19.1 클라이언트 계층 (13 파일, 4,287줄)

| 파일 | 줄 수 | 핵심 클래스 | 외부 서비스 |
|------|-------|------------|------------|
| `dynamodb_client.py` | 870 | `DynamoDBClient(s3_article_client=)` | DynamoDB + S3 |
| `s3_xml_client.py` | 897 | `S3XMLClient`, `normalize_category()` | S3 (XML) |
| `opensearch_client.py` | 487 | `OpenSearchClient.hybrid_search()` | OpenSearch |
| `mbti_transform_service.py` | 407 | `MbtiTransformService.transform_article()` | Bedrock Claude |
| `pgvector_client.py` | 370 | `PgVectorClient.search_similar_sentences()` | PostgreSQL |
| `embedding_client.py` | 298 | `EmbeddingClient.embed_batch()` | Bedrock Titan |
| `podcast_db_client.py` | 223 | `PodcastDBClient.query_by_date()` | DynamoDB |
| `translate_client.py` | 210 | `TranslateClient.translate_text()` | AWS Translate |
| `personal_db_client.py` | 209 | `PersonalDBClient.query_by_user()` | DynamoDB |
| `s3_article_client.py` | 168 | `S3ArticleClient.put_body()` | S3 |
| `personalize_client.py` | 158 | `PersonalizeClient.get_recommendations()` | Personalize |

### 19.2 핸들러 계층 (21 파일, 8,971줄)

| 파일 | 줄 수 | 라우트 | 핵심 동작 |
|------|-------|--------|-----------|
| `chatbot_handler.py` | 505 | `/api/chat` | embed → OpenSearch hybrid → Claude (fallback: DynamoDB) |
| `recommendation_handler.py` | 698 | `/api/recommend[/analysis]` | Personalize → 협업 필터 → 카테고리 → pgvector |
| `podcast_handler.py` | 496 | `/api/podcast/*` | Bedrock 대본 → Polly TTS (청크) → S3 → presigned URL |
| `archive_handler.py` | 391 | `/api/archive[/similar]` | Personal DB CRUD + Bedrock embed + pgvector |
| `ab_test_handler.py` | 449 | `/api/ab-test/*` | 실험 관리, 결정론적 할당, 이벤트 추적, 결과 집계 |
| `translation_handler.py` | 205 | `/api/article/{id}/en` | S3 body_en.json → 영문 기사 서빙 |
| `metrics_handler.py` | 71 | `/api/metrics/*` | 파이프라인/비용/참여 메트릭 대시보드 |

### 19.3 서비스 계층 (5 파일, 1,164줄)

| 파일 | 줄 수 | 핵심 기능 |
|------|-------|-----------|
| `metrics_service.py` | 309 | CloudWatch + DynamoDB → 파이프라인/비용/참여 메트릭 집계 |
| `collaborative_filter_service.py` | 282 | MBTI 그룹별 읽기 패턴 → 협업 추천 (Personalize 대체) |
| `article_filter_service.py` | 277 | 규칙 기반 + AI 기반 기사 필터링 (속보/인사/부고 제외) |
| `prompt_service.py` | 296 | 프롬프트 CRUD + 버전 관리 + 테스트 |

### 19.4 에러 처리 체계

```python
BackendError (500)
├── ValidationError (400)
├── AuthenticationError (401)
├── AuthorizationError (403)
├── NotFoundError (404)
├── RateLimitError (429)
├── RepositoryError (500)
├── TranslationError (500)
├── ConfigurationError (500)
└── ExternalServiceError (502)

# 데코레이터
@lambda_handler         # 통합 에러 처리 + 로깅 + async
@require_params(...)    # 쿼리 파라미터 검증
```

### 19.5 외부 서비스 연동

| 서비스 | 용도 | 호출 위치 |
|--------|------|-----------|
| Bedrock Claude | MBTI 변환, 챗봇 RAG, 팟캐스트 대본 | transform_service, chatbot, podcast |
| Bedrock Nova | 필터링, 분류, 검증, Supervisor, 번역 향상 | pipeline steps, supervisor, translation |
| Bedrock Titan Embed | 1024차원 벡터 임베딩 | embedding_client |
| AWS Translate | 한→영 번역 (84개 경제 용어) | translate_client |
| AWS Polly | TTS (Seoyeon Neural, MBTI별 rate) | tts_handler, podcast_handler |
| DynamoDB | 기사, 유저, 팟캐스트, 참여 | 4개 테이블 |
| S3 | 기사 본문, 오디오, XML | 3개 버킷 |
| OpenSearch | RAG 하이브리드 검색 | opensearch_client |
| PostgreSQL + pgvector | 유사도 검색 | pgvector_client |
| Wikipedia API | 과거 날짜 역사 이벤트 | time_machine_handler |
| 서울경제 아카이브 | 과거 날짜 뉴스 크롤링 | time_machine_handler |
| ElevenLabs TTS | 에디터 음성 브리핑 (프론트엔드) | elevenlabs.ts |
| AWS Cognito | Google OAuth + Email 인증 | auth.ts |
| Amazon Personalize | 개인화 추천 (미래 연동) | personalize_client |
