# K-Stock Insight - MBTI 맞춤 경제 뉴스

서울경제신문의 MBTI 기반 맞춤형 경제 뉴스 서비스

## 서비스 URL

- **Production**: https://mbti.sedaily.ai
- **API**: https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev

---

## 인프라 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           데이터 소스                                    │
│  S3: sedaily-news-xml-storage/daily-xml/YYYYMMDD.xml                   │
│  (서울경제신문 원본 기사 XML - 매일 업데이트)                              │
│  리전: ap-northeast-2                                                   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Article Collector Lambda                            │
│  함수명: sedaily-mbti-article-collector-dev                             │
│  - S3 XML에서 기사 수집                                                  │
│  - Claude Bedrock으로 4가지 MBTI 스타일 변환 (NT, NF, ST, SF)             │
│  - EventBridge 스케줄로 자동 실행                                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        DynamoDB 저장소                                   │
│  테이블: sedaily-mbti-articles-dev                                      │
│  리전: us-east-1                                                        │
│                                                                         │
│  저장 데이터:                                                            │
│  - news_id (PK)                                                         │
│  - title_ko, content_ko (원본 한글)                                      │
│  - version_NT, version_NF, version_ST, version_SF (MBTI 변환본)          │
│  - category, published_at, author, images 등                            │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    API Gateway (HTTP API)                               │
│  ID: chzwwtjtgk                                                         │
│  이름: sedaily-mbti-api-dev                                             │
│  엔드포인트: https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Frontend (React + Vite)                            │
│  S3: sedaily-mbti-frontend-dev                                          │
│  CloudFront: E1QS7PY350VHF6                                             │
│  도메인: mbti.sedaily.ai                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AWS 리소스 목록

### Lambda 함수 (리전: us-east-1)

| 함수명 | 설명 |
|--------|------|
| `sedaily-mbti-search-dev` | 기사 검색 API |
| `sedaily-mbti-article-dev` | 기사 상세 조회 |
| `sedaily-mbti-article-collector-dev` | S3 XML 수집 및 MBTI 변환 |
| `sedaily-mbti-chatbot-dev` | AI 챗봇 |
| `sedaily-mbti-tts-dev` | 텍스트 음성 변환 |
| `sedaily-mbti-engagement-dev` | 반응/댓글 관리 |
| `sedaily-mbti-user-dev` | 사용자 관리 |

### S3 버킷

| 버킷명 | 용도 | 리전 |
|--------|------|------|
| `sedaily-news-xml-storage` | 서울경제 원본 XML | ap-northeast-2 |
| `sedaily-mbti-frontend-dev` | 프론트엔드 정적 파일 | ap-northeast-2 |
| `sedaily-mbti-lambda-packages-dev` | Lambda 배포 패키지 | us-east-1 |

### DynamoDB

| 테이블명 | 용도 | 리전 |
|----------|------|------|
| `sedaily-mbti-articles-dev` | MBTI 변환 기사 저장 | us-east-1 |

### CloudFront

| Distribution ID | 도메인 |
|-----------------|--------|
| `E1QS7PY350VHF6` | mbti.sedaily.ai |

---

## MBTI 그룹별 에디터

| MBTI 그룹 | 에디터 | 스타일 |
|-----------|--------|--------|
| NT | 시현 | 전략형 분석가 - 애널리스트 리포트 |
| NF | 지원 | 가치형 해석자 - 칼럼/에세이 |
| ST | 정훈 | 실용형 실무자 - 팩트시트 |
| SF | 하은 | 공감형 소통가 - 친구 톡 |

---

## 데이터 플로우

1. **수집**: 서울경제 원본 기사가 `sedaily-news-xml-storage` S3에 XML 형태로 저장
2. **변환**: `sedaily-mbti-article-collector-dev` Lambda가 XML 파싱 후 Claude Bedrock으로 4가지 MBTI 스타일 변환
3. **저장**: 변환된 기사가 `sedaily-mbti-articles-dev` DynamoDB에 저장
4. **서빙**: API Gateway를 통해 프론트엔드에서 조회

---

## 영문사이트와의 분리

**MBTI 서비스는 영문사이트(en.sedaily.com)와 완전히 분리된 인프라를 사용합니다.**

| 구분 | MBTI 서비스 | 영문사이트 |
|------|-------------|------------|
| DynamoDB | `sedaily-mbti-articles-dev` | `seodaily-eng-articles-dev` |
| CloudFront | `E1QS7PY350VHF6` | `EUWQ1K71CXJUH` |
| 도메인 | mbti.sedaily.ai | en.sedaily.com |
| S3 Frontend | `sedaily-mbti-frontend-dev` | `origin-en.sedaily.ai` |

---

## 로컬 개발

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

### 백엔드 배포

```bash
cd backend
./deploy.sh
```

---

## 환경 변수

### Backend (.env)

```env
# BigKinds API
BIGKINDS_API_KEY=your-api-key
BIGKINDS_API_URL=https://tools.kinds.or.kr

# AWS
AWS_REGION=us-east-1

# DynamoDB
DYNAMODB_TABLE_ARTICLES=sedaily-mbti-articles-dev

# Frontend
FRONTEND_URL=https://mbti.sedaily.ai
```

---

## 배포

### 프론트엔드 배포

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://sedaily-mbti-frontend-dev --delete
aws cloudfront create-invalidation --distribution-id E1QS7PY350VHF6 --paths "/*"
```

### 백엔드 배포

```bash
cd backend
./deploy.sh
```

---

## 문서

- [프롬프트 가이드](./docs/prompts/README.md) - MBTI 변환 AI 프롬프트 상세 문서
  - [NT 전략형 분석가](./docs/prompts/NT.md)
  - [NF 가치형 해석자](./docs/prompts/NF.md)
  - [ST 실용형 실무자](./docs/prompts/ST.md)
  - [SF 공감형 소통가](./docs/prompts/SF.md)
