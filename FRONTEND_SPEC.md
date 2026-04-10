# AI LENS 프론트엔드 완전 명세서

> 이 문서는 백엔드 아키텍처 설계를 위해 프론트엔드의 모든 기능, API 호출, 데이터 모델, 상태 관리를 정확하게 기술합니다.
> 작성일: 2026-04-07 | 브랜치: feature/backend-redesign

---

## 목차

1. [서비스 개요](#1-서비스-개요)
2. [기술 스택](#2-기술-스택)
3. [페이지 라우팅](#3-페이지-라우팅)
4. [핵심 기능 상세](#4-핵심-기능-상세)
5. [API 엔드포인트 전체 목록](#5-api-엔드포인트-전체-목록)
6. [데이터 모델/타입 정의](#6-데이터-모델타입-정의)
7. [인증 시스템](#7-인증-시스템)
8. [상태 관리](#8-상태-관리)
9. [Mock 데이터 vs 실제 API](#9-mock-데이터-vs-실제-api)
10. [MBTI 그룹 시스템](#10-mbti-그룹-시스템)

---

## 1. 서비스 개요

**AI LENS** — 서울경제신문의 MBTI 기반 맞춤형 경제 뉴스 서비스

- **Production URL**: https://mbti.sedaily.ai
- **API Gateway**: https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev

**핵심 컨셉**: 서울경제신문의 원본 기사를 4가지 MBTI 성향 그룹(NT/NF/ST/SF)별로 AI가 다른 톤과 구조로 재작성하여 제공. 각 그룹에 에디터 페르소나(시현/지원/정훈/하은)가 존재.

---

## 2. 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16.2.2 (App Router) |
| UI | React 19.2.4 + TypeScript 5 |
| 스타일링 | Tailwind CSS v4 |
| 인증 | AWS Amplify + Cognito (us-east-1_ZS8PgF3iX) |
| 상태 관리 | React Context (AuthContext) + localStorage |
| 데이터 페칭 | 직접 fetch() (SWR/React Query 미사용) |
| 아이콘 | lucide-react |
| 테스트 | 없음 |

---

## 3. 페이지 라우팅

### 3.1 활성 라우트 (10개)

| 경로 | 파일 | 설명 | 인증 필요 |
|------|------|------|-----------|
| `/` | `src/app/page.tsx` | 메인 홈 — 뷰 모드 전환 허브 | 아니오 |
| `/login` | `src/app/login/page.tsx` | 로그인/회원가입 | 아니오 |
| `/auth/callback` | `src/app/auth/callback/page.tsx` | OAuth 리다이렉트 처리 | 아니오 |
| `/saju` | `src/app/saju/page.tsx` | 사주 운세 분석 | 아니오 |
| `/subscription` | `src/app/subscription/page.tsx` | 구독 플랜 안내 | 아니오 |
| `/timeline` | `src/app/timeline/page.tsx` | 타임라인 뉴스피드 | 아니오 |
| `/timemachine` | `src/app/timemachine/page.tsx` | 과거 날짜 뉴스 탐색 | 아니오 |
| `/robots.ts` | SEO | robots.txt 생성 | - |
| `/sitemap.ts` | SEO | sitemap.xml 생성 | - |

### 3.2 메인 페이지(`/`) 뷰 모드 시스템

메인 페이지는 4개의 ViewMode를 가진 SPA:

```typescript
type ViewMode = "story" | "feed" | "editor-select" | "briefing";
```

| ViewMode | 컴포넌트 | 설명 |
|----------|----------|------|
| `feed` (기본) | `FeedPage` + `MbtiChatBot` | 메인 뉴스피드 (5개 탭) |
| `editor-select` | `OnboardingPage` | MBTI 그룹 선택 (4개 에디터 카드) |
| `briefing` | `BriefingPage` | 선택한 에디터 소개 내러티브 |
| `story` | `StoryNewsFeed` | 관심사 기반 온보딩 (스토리 형태) |

**전환 흐름**:
- 최초 방문 → `feed` (기본 SF 그룹)
- 에디터 변경 클릭 → `editor-select` → 에디터 선택 → `briefing` → `feed`
- 스토리 모드 전환 → `story` → 완료 → `feed`

---

## 4. 핵심 기능 상세

### 4.1 뉴스피드 (FeedPage) — 1,808줄, 5개 탭

FeedPage는 앱의 중심 컴포넌트. 5개 탭으로 구성:

#### 탭 구조

| 탭 | 탭 이름 | 컴포넌트 | 설명 |
|----|---------|----------|------|
| `question` | 오늘의 질문 | `QuestionTab` | AI 질문 퀴즈 (MBTI 변경 가능) |
| `feed` | 뉴스피드 | `NewsFeedTab` | 날짜별 기사 목록 + MBTI 버전 |
| `community` | 커뮤니티 | `CommunityTab` | 아카이빙 문장 기반 토론 |
| `archive` | 내 서랍 | `ArchiveTab` | 저장한 문장 관리 |
| `dna` | 나의 DNA | `DnaTab` | 뉴스 관심 분석 + 생일 |

탭 상태는 URL 쿼리 파라미터(`?tab=feed`)에 동기화 (replaceState, 히스토리 비축적).

---

#### 4.1.1 오늘의 질문 탭 (QuestionTab)

- 매일 다른 질문 3개 표시 (현재 하드코딩된 `dailyQuestions` 데이터)
- 사용자 답변에 따라 MBTI 그룹 변경 가능
- 모두 답변 시 자동으로 뉴스피드 탭으로 전환
- **백엔드 의존**: 없음 (프론트엔드 하드코딩 데이터)
- **향후 필요**: 질문 데이터 API, 답변 저장 API

```typescript
// dailyQuestions 구조
interface DailyQuestion {
  id: string;
  question: string;
  options: {
    id: string;
    text: string;
    mbti?: MbtiGroupId; // 이 답변 선택 시 MBTI 변경
  }[];
}
```

---

#### 4.1.2 뉴스피드 탭 (NewsFeedTab)

**핵심 기능**: 날짜별 기사 목록 표시 + MBTI 버전 전환 + 기사 상세 보기

**날짜 선택**: 주간 캘린더 + 월간 캘린더 모달

**기사 로드 플로우** (실제 코드):
```typescript
// 1차: S3에서 해당 날짜 기사 가져오기
const res = await fetch(`${API_URL}/s3-articles?date=${dateStr}&limit=30`);
const data = await res.json();

if (data.articles?.length > 0) {
  setArticles(data.articles);
} else {
  // 2차: S3에 없으면 search API로 fallback
  const searchRes = await fetch(`${API_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "*",
      filters: {
        published_from: targetDate, // YYYY-MM-DD
        published_until: nextDay,   // YYYY-MM-DD
      },
      page: 1,
      page_size: 30,
    }),
  });
}
```

**기사 프리페칭**: 기사 카드 노출 시 상세 데이터를 미리 로드
```typescript
// 프리페칭 순서: S3 → DynamoDB fallback
fetch(`${API_URL}/s3-article/${id}`)   // 1차: S3에서 MBTI 버전 포함 상세
fetch(`${API_URL}/api/article/${id}`)  // 2차: DynamoDB에서 fallback
```

**기사 카드 표시 데이터**:
- 제목 (MBTI 버전 title 또는 원본 title)
- 카테고리
- 발행일
- 본문 미리보기 (MBTI body 첫 200자)
- 이미지 (있는 경우)

**기사 카드에서의 MBTI 그룹 전환**: 카드 위에 NT/NF/ST/SF 버튼 4개, 클릭 시 해당 그룹 버전으로 제목/미리보기 전환

**오디오 브리핑 (Mock)**: 
- 오디오 플레이어 UI 존재 (재생/일시정지/프로그레스바)
- 비로그인 사용자: 1분(33.3%) 미리듣기 후 페이월
- 구독자: 전체 재생
- **현재 상태**: 완전한 Mock (실제 오디오 스트리밍 없음, 프로그레스만 시뮬레이션)
- **향후 필요**: TTS API 연동 (백엔드에 AWS Polly 기반 TTS 핸들러 이미 존재)

---

#### 4.1.3 커뮤니티 탭 (CommunityTab)

**핵심 컨셉**: 사용자가 아카이빙한 문장을 공유하고 토론하는 공간

**게시글 구조** (현재 하드코딩 Mock):
```typescript
interface CommunityPost {
  id: string;
  userName: string;
  userMbti: string;           // "INTJ", "ENFP" 등
  userAvatar: string;         // dicebear URL
  timeAgo: string;
  archivedSentence: string;   // 아카이빙한 기사 문장
  userComment: string;        // 사용자 코멘트
  articleTitle: string;       // 원본 기사 제목
  tags: string[];             // ["반도체", "삼성전자"]
  upvotes: number;
  commentCount: number;
  commentList: Comment[];
}

interface Comment {
  id: string;
  userName: string;
  userMbti: string;
  userAvatar: string;
  text: string;
  timeAgo: string;
  likes: number;
}
```

**기능 목록**:
- 게시글 목록 (무한스크롤 미구현, 전체 표시)
- 추천/비추천 (로컬 state만, 서버 미연동)
- 댓글 목록 펼치기/접기
- 인라인 댓글 작성 (로컬 state만)
- 글 상세 모달
- 인기 태그 필터
- 사용자 프로필 모달 (공감온도, 뱃지, 활동 통계)
- **현재 상태**: 100% Mock 데이터 (5개 게시글, 13명의 Mock 유저)
- **향후 필요**: 게시글 CRUD API, 추천 API, 댓글 API, 유저 프로필 API, 랭킹 API

**유저 프로필 시스템** (Mock):
```typescript
interface UserProfile {
  temperature: number;        // 공감온도 (0-100)
  title: string;              // 칭호 ("분석의 여왕", "스토리텔러" 등)
  titleType: 'crown' | 'star' | 'lightning' | 'heart' | 'book' | 'chart';
  badges: Badge[];            // 뱃지 목록
  mbti: string;
  avatar: string;
}

interface Badge {
  name: string;               // "추천왕", "데이터러버" 등
  type: 'trophy' | 'fire' | 'chat' | 'bulb' | 'target' | 'chart';
}
```

---

#### 4.1.4 내 서랍 탭 (ArchiveTab)

**핵심 컨셉**: 기사 읽기 중 선택한 문장들을 저장/관리하는 개인 서랍

**저장 방식**: 현재 React state (페이지 새로고침 시 초기 Mock 데이터로 리셋)

```typescript
interface ArchivedSentence {
  id: string;                 // "{articleId}-{timestamp}"
  text: string;               // 저장한 문장
  articleId: string;
  articleTitle: string;
  articlePublishedAt?: string; // ISO 8601
  createdAt: Date;
}
```

**기능 목록**:
- 날짜별 필터링 (캘린더)
- 문장 삭제 (개별)
- 커뮤니티에 공유 (CommunityTab으로 이동)
- 저장 건수 뱃지 표시 (탭 버튼에)
- **현재 상태**: Mock 데이터 8개 문장으로 초기화, 서버 저장 없음
- **향후 필요**: 아카이빙 CRUD API (user_id + article_id + text)

**문장 저장 경로 2가지**:
1. **ArticleView에서**: 문장별 클릭 선택 → "N개 문장 저장" 버튼
2. **NewsFeedTab에서**: 텍스트 드래그 선택 → 플로팅 저장 버튼

---

#### 4.1.5 나의 DNA 탭 (DnaTab)

**핵심 컨셉**: 사용자의 뉴스 관심사 분석 시각화

**두 개의 서브탭**:

| 서브탭 | 설명 |
|--------|------|
| `analysis` | 카테고리별 관심도 레이더 차트 + 바 차트 |
| `birthday` | 생년월일 입력 → 같은 날 태어난 유명인 표시 |

**레이더 차트 데이터** (현재 하드코딩):
```typescript
const newsDNA = {
  economy: 75,    // 경제
  tech: 60,       // 테크
  world: 40,      // 국제
  society: 30,    // 사회
  culture: 20,    // 문화
  politics: 45,   // 정치
};
```

**생일 데이터**: `famousBirthdays.ts` (128KB, 365일분 유명인 데이터 하드코딩)

- **현재 상태**: 관심도 데이터 하드코딩, 생일 데이터 하드코딩
- **향후 필요**: 사용자 읽기 패턴 기반 관심도 분석 API

---

### 4.2 기사 상세 보기 (ArticleView)

기사 카드 클릭 시 전체 화면 오버레이로 표시.

**두 가지 모드**:

| 모드 | 조건 | 표시 내용 |
|------|------|-----------|
| MBTI 버전 | `article.versions[currentGroup]` 존재 | MBTI 변환된 제목/부제/본문/핵심포인트/마무리 |
| 원본 모드 | MBTI 버전 없음 | 원본 한국어 기사 |

**MBTI 버전 로드**: 기사에 versions 데이터 없으면 API 호출:
```typescript
// ArticleView 내부에서 자동 호출
fetch(`${API_URL}/api/article/${article.news_id}`)
```

**문장 아카이빙 기능**:
- 본문이 문장 단위로 분리되어 표시
- 각 문장 클릭 시 노란색 하이라이트
- 여러 문장 선택 가능
- "N개 문장 저장" 플로팅 버튼 → ArchiveTab에 저장

**읽기 추적**:
```typescript
// 1. localStorage 기반 (모든 사용자)
trackArticleRead(article.news_id);

// 2. 서버 API (로그인 사용자만)
if (isAuthenticated && user) {
  recordArticleRead(user.userId, article.news_id, title);
  // POST /api/user/read { user_id, article_id, article_title }
}
```

---

### 4.3 AI 챗봇 (MbtiChatBot)

메인 페이지와 타임라인 페이지에 플로팅 버튼으로 표시.

**페르소나 시스템**:

| 그룹 | 이름 | 역할 | 스타일 |
|------|------|------|--------|
| NT | 시현 | 전략분석팀 수석연구원 | 논리적이고 분석적 |
| NF | 지원 | 오피니언팀 논설위원 | 성찰적이고 따뜻한 |
| ST | 정훈 | 팩트체크 에디터 | 정확하고 체계적 |
| SF | 하은 | MZ 독자 담당 에디터 | 친근하고 공감적 |

**API 호출**:
```typescript
// POST https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev/api/chat
{
  message: "오늘 주요 뉴스 알려줘",
  mbti_group: "NT",                    // 현재 선택된 MBTI 그룹
  conversation_history: [              // 이전 대화 내역
    { role: "user", content: "..." },
    { role: "assistant", content: "..." }
  ]
}

// Response
{
  response: "AI 생성 응답 텍스트"
}
```

**퀵 액션 버튼** (프리셋 질문):
- "오늘 뉴스" → "오늘 주요 뉴스 알려줘"
- "경제 동향" → "최근 경제 동향이 어때?"
- "MBTI 추천" → "내 MBTI에 맞는 기사 추천해줘"

**MBTI 그룹 전환**: 챗봇 내에서 NT/NF/ST/SF 버튼으로 페르소나 전환 가능 (메인 앱의 MBTI 그룹도 연동 변경)

---

### 4.4 사주 운세 페이지 (/saju)

**입력**: 생년월일(필수) + 태어난 시(선택, 12시진) + 성별(필수)

**API 호출**:
```typescript
// POST ${API_URL}/saju
{
  birth_year: 1995,
  birth_month: 3,
  birth_day: 15,
  birth_hour: 5,       // 12시진 인덱스 (0=子~11=亥), null이면 미입력
  gender: "male"       // "male" | "female"
}
```

**응답 데이터 구조** (전체):
```typescript
interface SajuResult {
  saju_pillar: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: Pillar;
  };
  five_elements_balance: Record<string, {
    count: number;
    percent: number;
    label: string;     // "목(木)", "화(火)", "토(土)", "금(金)", "수(水)"
  }>;
  ten_gods_analysis: Record<string, string>;
  useful_god: {
    useful_god: string;
    support_element: string;
    avoid_element: string;
    description: string;
    description_tips: string[];
    support_description: string;
    avoid_description: string;
    element_status: Array<{
      element: string;     // "목(木)" 등
      state: string;       // "excess" | "lack" | "balanced"
      state_label: string; // "과다", "부족", "균형"
      keywords: string;
    }>;
  };
  major_fortune_cycle: Array<{
    age: number;
    year: number;
    stem: string;
    branch: string;
    stem_kr: string;
    branch_kr: string;
    element: string;
  }>;
  current_fortune: {
    current_age: number;
    major_fortune: FortuneItem;
    annual_fortune: FortuneItem;
    monthly_fortune: FortuneItem & { month: number };
    daily_fortune: FortuneItem & { date: string };
  };
  personality_profile: {
    dominant_element: string;
    personality: string;
    strength: string;
    career: string;
  };
  special_stars: Array<{
    name: string;
    desc: string;
    emoji: string;
  }>;
}

interface Pillar {
  stem: string | null;
  branch: string | null;
  stem_kr: string | null;
  branch_kr: string | null;
  stem_element: string | null;
  branch_element: string | null;
  yin_yang: string | null;
  stem_color: string | null;       // CSS 색상 코드
  branch_color: string | null;
  ten_god_stem: string | null;
  ten_god_branch: string | null;
  ten_god_stem_color: string | null;
  ten_god_branch_color: string | null;
  family_stem: string | null;
  family_branch: string | null;
  fortune_period: string;
  fortune_desc: string;
}

interface FortuneItem {
  age?: number;
  year?: number;
  stem_kr: string;
  branch_kr: string;
  element: string;
  desc: string;
  tone: string;  // "blue" | "green" | "yellow" | "red" → UI 색상 결정
}
```

**UI 섹션** (결과 화면):
1. 사주 팔자 (四柱八字) — 4개 기둥 카드 (시/일/월/년)
2. 오행 분포 (五行) — 바 차트
3. 현재 운세 — 대운/일운/월운/세운 (색상 코딩)
4. 대운 타임라인 — 수평 스크롤 연령별 카드
5. 용신 (用神) — 용신/희신/기신 + 오행 키워드 테이블
6. 성격/적성 — 기질/강점/적합 직업
7. 신살 (神殺) — 특수 별자리 목록

---

### 4.5 타임머신 페이지 (/timemachine)

**컨셉**: 과거 날짜를 선택하면 그날의 뉴스, 역사적 사건, 유명인 생일, 투자 시뮬레이션 제공

**API 호출**:
```typescript
// GET ${API_URL}/time-machine?date=2000-03-15
// Response:
{
  news: [
    { title: "코스피 2,650선 회복", category: "경제", url?: string }
  ],
  events: [
    {
      year: 2000,
      title: "닷컴 버블 정점",
      description: "나스닥이 사상 최고치를 기록",
      images?: string[]
    }
  ],
  cached: boolean,
  date: string
}
```

**4개 결과 탭**:

| 탭 | 이름 | 데이터 소스 |
|----|------|------------|
| `news` | 그날의 뉴스 | API (`/time-machine`) |
| `celebs` | 같은 날 태어난 | 프론트엔드 하드코딩 (`famousBirthdays.ts`, 128KB) |
| `photos` | 기록된 순간 | API events의 images + fallback 하드코딩 |
| `invest` | 만약 그때 투자했더라면 | 프론트엔드 하드코딩 (`investmentScenarios.ts`, `economicSnapshots.ts`) |

**투자 시뮬레이션** (프론트 하드코딩):
- 투자 옵션: KOSPI, 비트코인, 현금(예금), 강남 아파트, 삼성전자, 스타벅스 커피
- 과거 날짜 기준 100만원 투자 시 현재 가치 계산
- 평행우주 비교 (다른 자산에 투자했다면)

**특수 진입점**: DnaTab 생일 기능에서 `?date=YYYY-MM-DD&mode=birthday`로 직접 이동 가능

---

### 4.6 구독 페이지 (/subscription)

**현재 상태**: UI만 존재, 결제 시스템 미연동

**플랜**:
| 플랜 | 가격 | 설명 |
|------|------|------|
| 월간 | ₩4,900/월 | 부담 없이 시작 |
| 연간 | ₩49,000/년 (월 ₩4,083) | 2개월 무료, 원가 ₩58,800 |

**PRO 혜택** (기획):
- 무제한 오디오 (현재 1분 미리듣기 제한)
- AI 심층 분석
- 실시간 알림
- 광고 제거

**구현 상태**: `isSubscribed = false` 하드코딩. 결제 로직 없음.
**향후 필요**: 결제 API, 구독 상태 조회 API, 구독 관리 API

---

### 4.7 타임라인 페이지 (/timeline)

`TimelineNewsFeed` 컴포넌트 사용. 세로 타임라인 형태의 뉴스피드.
- MBTI 그룹 기반 기사 표시
- `MbtiChatBot` 플로팅 포함
- localStorage에서 mbti-group, user-tags 읽기

---

### 4.8 온보딩/에디터 선택 (OnboardingPage)

**두 가지 경로**:
1. **직접 선택**: 4개 에디터 카드(NT/NF/ST/SF) 중 선택 → 바로 피드
2. **퀴즈**: 4개 질문 → MBTI 결정 → 브리핑 → 피드

**브리핑 (BriefingPage)**: 선택한 에디터의 캐릭터 소개 내러티브. 완료 시 피드로 전환.

---

### 4.9 로그인 페이지 (/login)

**5가지 인증 모드**:

| 모드 | 설명 |
|------|------|
| `login` | 이메일/비밀번호 로그인 + Google OAuth |
| `signup` | 이름/이메일/비밀번호 회원가입 |
| `confirm` | 이메일 인증 코드 입력 (6자리) |
| `forgot` | 비밀번호 찾기 (이메일 입력) |
| `reset` | 비밀번호 재설정 (코드 + 새 비밀번호) |

모든 인증은 AWS Cognito를 통해 처리 (AuthContext에서 aws-amplify 사용).

---

## 5. API 엔드포인트 전체 목록

### 5.1 기사 관련

| Method | Path | 설명 | 호출 위치 |
|--------|------|------|-----------|
| `GET` | `/s3-articles?date={YYYYMMDD}&limit=30` | 날짜별 기사 목록 (S3 XML 기반) | NewsFeedTab |
| `GET` | `/s3-article/{news_id}` | 기사 상세 (MBTI 버전 포함) | FeedPage 프리페치 |
| `GET` | `/api/article/{news_id}` | 기사 상세 (DynamoDB, fallback) | ArticleView, FeedPage 프리페치 |
| `POST` | `/api/search` | 기사 검색 | NewsFeedTab (S3 fallback) |

**`/s3-articles` 응답**:
```typescript
{
  articles: Array<{
    news_id: string;
    title: string;           // 원본 한국어 제목
    sub_title: string;
    published_at: string;    // ISO 8601
    category: string;        // "경제", "IT_과학", "정치", "사회", "문화", "스포츠", "국제"
    provider: string;
    byline: string;
    image_url: string | null;
    content: string;         // 원본 한국어 본문
    original_link: string;
    versions?: {             // MBTI 변환 버전 (있는 경우)
      NT: MbtiVersion;
      NF: MbtiVersion;
      ST: MbtiVersion;
      SF: MbtiVersion;
    };
  }>;
}
```

**`/api/article/{id}` 응답**:
```typescript
{
  news_id: string;
  title_ko: string;
  content_ko: string;
  category: string;
  published_at: string;
  version_NT?: MbtiVersion;
  version_NF?: MbtiVersion;
  version_ST?: MbtiVersion;
  version_SF?: MbtiVersion;
  // ... 기타 메타데이터
}
```

**MbtiVersion 구조**:
```typescript
interface MbtiVersion {
  title: string;
  subtitle: string;
  body: string | string[];    // 문자열 또는 문단 배열
  key_points: string[];       // 핵심 요약 포인트
  closing_line: string;       // 마무리 문장
  tone: string;               // "분석적", "성찰적" 등
  image_url?: string;
}
```

**`/api/search` 요청**:
```typescript
{
  query: string;              // 검색어 ("*"이면 전체)
  filters: {
    published_from: string;   // YYYY-MM-DD
    published_until: string;  // YYYY-MM-DD
  };
  page: number;
  page_size: number;
}
```

---

### 5.2 채팅 관련

| Method | Path | 설명 | 호출 위치 |
|--------|------|------|-----------|
| `POST` | `/api/chat` | MBTI 페르소나 기반 AI 채팅 | MbtiChatBot |

```typescript
// Request
{ message: string; mbti_group: string; conversation_history: {role: string; content: string}[] }
// Response
{ response: string }
```

---

### 5.3 사주 관련

| Method | Path | 설명 | 호출 위치 |
|--------|------|------|-----------|
| `POST` | `/saju` | 사주 분석 | SajuPage |

(요청/응답 구조는 4.4절 참조)

---

### 5.4 타임머신 관련

| Method | Path | 설명 | 호출 위치 |
|--------|------|------|-----------|
| `GET` | `/time-machine?date={YYYY-MM-DD}` | 과거 날짜 뉴스/사건 | TimeMachinePage |

```typescript
// Response
{
  news: Array<{ title: string; category: string; url?: string }>;
  events: Array<{ year: number; title: string; description?: string; images?: string[] }>;
  cached: boolean;
  date: string;
}
```

---

### 5.5 사용자 관련

| Method | Path | 설명 | 호출 위치 |
|--------|------|------|-----------|
| `POST` | `/api/user/profile` | 유저 프로필 동기화 | AuthContext (로그인 시) |
| `POST` | `/api/user/read` | 기사 읽음 기록 | ArticleView |
| `GET` | `/api/user/stats?user_id={id}` | 유저 통계 | userApi.ts (현재 미사용) |
| `GET` | `/api/user/history?user_id={id}` | 읽기 기록 | userApi.ts (현재 미사용) |

**프로필 동기화 요청**:
```typescript
{
  user_id: string;
  email: string;
  name: string;
  picture: string;
  mbti_group: string;   // localStorage에서 읽음
}
```

**읽음 기록 요청**:
```typescript
{
  user_id: string;
  article_id: string;
  article_title?: string;
}
```

---

### 5.6 API 호출 없는 기능 (프론트엔드 전용)

| 기능 | 데이터 소스 | 비고 |
|------|------------|------|
| 오늘의 질문 | `dailyQuestions` 하드코딩 | 향후 API 필요 |
| 커뮤니티 게시글/댓글 | Mock 데이터 (React state) | 향후 CRUD API 필요 |
| 내 서랍 (아카이빙) | React state (비영속) | 향후 저장 API 필요 |
| 뉴스 DNA 관심도 | 하드코딩 수치 | 향후 분석 API 필요 |
| 유명인 생일 | `famousBirthdays.ts` (128KB) | 프론트 유지 가능 |
| 투자 시뮬레이션 | `investmentScenarios.ts` | 프론트 유지 가능 |
| 경제 스냅샷 | `economicSnapshots.ts` | 프론트 유지 가능 |
| 오디오 플레이어 | Mock (프로그레스 시뮬레이션) | TTS API 연동 필요 |
| 구독/결제 | UI만 존재 | 결제 시스템 필요 |
| 읽기 트래킹 | localStorage | 서버 동기화 필요 시 API 추가 |

---

## 6. 데이터 모델/타입 정의

### 6.1 Article (프론트엔드 내부)

```typescript
// FeedPage/ArticleView에서 사용하는 기사 타입
interface Article {
  news_id: string;
  title: string;             // 원본 제목
  sub_title: string;
  published_at: string;      // ISO 8601
  category: string;
  provider: string;
  byline: string;
  image_url: string | null;
  content: string;           // 원본 본문
  original_link: string;
  versions?: Record<string, MbtiVersion>;  // "NT" | "NF" | "ST" | "SF"
}
```

### 6.2 MBTI 그룹

```typescript
type MbtiGroupId = 'NT' | 'NF' | 'ST' | 'SF';

interface MbtiGroup {
  id: MbtiGroupId;
  name: string;        // "전략형", "가치형", "실용형", "공감형"
  label: string;       // "NT 전략형"
  types: MbtiType[];   // ["INTJ", "INTP", "ENTJ", "ENTP"]
  color: string;       // "#3B82F6"
  bgClass: string;     // "bg-blue-500"
  style: string;       // "애널리스트 리포트"
  icon: string;        // "📊"
  description: string;
  axis: string;        // "추상 + 분석"
}
```

### 6.3 TimeMachine 타입

```typescript
interface DayNews {
  title: string;
  category: string;
  url?: string;
}

interface HistoricalEvent {
  year: number;
  title: string;
  description: string;
  category: string;
  image?: string;
  images?: string[];
}

interface TimeMachineData {
  news: DayNews[];
  historicalEvents: HistoricalEvent[];
}
```

### 6.4 Auth User

```typescript
interface User {
  userId: string;
  email?: string;
  name?: string;
  picture?: string;    // Google OAuth 프로필 이미지
}
```

### 6.5 Reading Tracker (localStorage)

```typescript
interface ReadingStats {
  totalArticles: number;
  currentStreak: number;    // 연속 읽기 일수
  longestStreak: number;
  thisWeekArticles: number;
  thisMonthArticles: number;
  dailyReadings: Array<{
    date: string;           // YYYY-MM-DD
    count: number;
    articleIds: string[];
  }>;
  lastReadDate: string | null;
}
```

---

## 7. 인증 시스템

### 7.1 인프라

| 항목 | 값 |
|------|-----|
| 서비스 | AWS Cognito |
| User Pool ID | `us-east-1_ZS8PgF3iX` |
| Client ID | `66c9bq3ovmk007d0eepkle92k3` |
| OAuth Domain | `sedaily-mbti.auth.us-east-1.amazoncognito.com` |
| Redirect (prod) | `https://mbti.sedaily.ai/auth/callback` |
| Redirect (local) | `http://localhost:3000/auth/callback` |
| OAuth Provider | Google |
| Flow | Authorization Code |

### 7.2 지원 인증 방식

1. **Google OAuth** — `signInWithRedirect({ provider: 'Google' })`
2. **이메일/비밀번호** — `signIn`, `signUp`, `confirmSignUp`
3. **비밀번호 재설정** — `resetPassword`, `confirmResetPassword`
4. **Kakao** — 미구현 (placeholder 함수만 존재)

### 7.3 인증 흐름

```
Google 로그인:
  signInWithRedirect → Cognito → /auth/callback → 1초 후 "/" 리다이렉트
  → AuthContext의 Hub.listen('auth') → checkUser() → setUser()
  → syncUserProfile(userData) → POST /api/user/profile

이메일 로그인:
  signIn(email, password) → 성공 → checkUser() → router.replace("/")
  → UserNotConfirmed → confirm 모드 → confirmSignUp → 로그인 안내

로그아웃:
  signOut() → setUser(null)
```

### 7.4 인증 상태 사용처

```typescript
// 어디서든 useAuth()로 접근
const { user, isAuthenticated, isLoading, logout, ... } = useAuth();

// 사용처:
// - UserMenu (헤더 우측 프로필/로그인 버튼)
// - ArticleView (읽기 기록 서버 전송)
// - SubscriptionPage (로그인 상태 표시)
// - AuthContext (로그인 시 프로필 서버 동기화)
```

---

## 8. 상태 관리

### 8.1 서버 상태

| 데이터 | 저장소 | 갱신 시점 |
|--------|--------|-----------|
| 기사 목록 | API → `articles` state | 날짜 변경 시 |
| 기사 상세 (MBTI 버전) | API → `prefetchCache` (Map) | 기사 카드 노출 시 |
| 챗봇 대화 | API → `messages` state | 메시지 전송 시 |
| 사주 결과 | API → `result` state | 폼 제출 시 |
| 타임머신 데이터 | API → `news`, `events` state | 날짜 선택 시 |

### 8.2 클라이언트 상태 (localStorage)

| Key | 값 | 용도 |
|-----|-----|------|
| `mbti-group` | `"NT"` / `"NF"` / `"ST"` / `"SF"` | 선택된 MBTI 그룹 |
| `user-tags` | `["경제", "IT"]` (JSON) | 관심 태그 |
| `user_birthday` | `"1995-03-15"` | DNA탭 생일 |
| `mbti-reading-tracker` | ReadingStats (JSON) | 읽기 통계 |
| `onboarding-completed` | `"true"` | 온보딩 완료 여부 |
| `onboarding-answers` | JSON | 온보딩 답변 |

### 8.3 React Context

- **AuthContext** — 유일한 전역 Context. user 상태, 인증 메서드 제공.
- 나머지는 모두 컴포넌트 로컬 state (useState).

### 8.4 URL 상태

| 파라미터 | 예시 | 용도 |
|----------|------|------|
| `?tab=feed` | `/?tab=community` | FeedPage 탭 상태 |
| `#article-{id}` | `/#article-2K7B9WQC2M` | 기사 상세 보기 (history.pushState) |
| `?date=YYYY-MM-DD` | `/timemachine?date=2000-03-15` | 타임머신 날짜 |
| `?mode=birthday` | `/timemachine?mode=birthday` | 생일 모드 |

---

## 9. Mock 데이터 vs 실제 API

### 실제 API 연동 완료

| 기능 | API | 상태 |
|------|-----|------|
| 날짜별 기사 목록 | `/s3-articles` | 완전 연동 |
| 기사 상세 (MBTI 버전) | `/api/article/{id}`, `/s3-article/{id}` | 완전 연동 |
| 기사 검색 | `/api/search` | 완전 연동 (fallback) |
| AI 챗봇 | `/api/chat` | 완전 연동 |
| 사주 분석 | `/saju` | 완전 연동 |
| 타임머신 | `/time-machine` | 연동 (fallback 데이터 있음) |
| 유저 프로필 동기화 | `/api/user/profile` | 연동 |
| 읽기 기록 (서버) | `/api/user/read` | 연동 |

### Mock 데이터 (서버 미연동)

| 기능 | 현재 상태 | 필요한 API |
|------|-----------|-----------|
| 오늘의 질문 | 하드코딩 3개 질문 | 질문 CRUD, 답변 저장 |
| 커뮤니티 | Mock 5개 게시글, 13명 유저 | 게시글 CRUD, 댓글 CRUD, 추천, 랭킹 |
| 내 서랍 (아카이빙) | React state, Mock 8개 문장 | 아카이빙 CRUD (user + article + text) |
| 뉴스 DNA 관심도 | 하드코딩 수치 | 읽기 패턴 분석 |
| 오디오 플레이어 | 프로그레스 시뮬레이션 | TTS 스트리밍 (Polly 백엔드 있음) |
| 구독/결제 | UI만 (`isSubscribed=false`) | 결제 처리, 구독 상태 관리 |
| 유저 프로필 상세 | Mock (온도, 뱃지, 칭호) | 유저 활동 통계, 게이미피케이션 |

---

## 10. MBTI 그룹 시스템

### 10.1 4개 그룹 정의

| 그룹 | 이름 | MBTI 유형 | 색상 | 에디터 | 스타일 |
|------|------|-----------|------|--------|--------|
| NT | 전략형 | INTJ, INTP, ENTJ, ENTP | Blue (#3B82F6) | 시현 | 애널리스트 리포트 |
| NF | 가치형 | INFJ, INFP, ENFJ, ENFP | Violet (#8B5CF6) | 지원 | 칼럼/에세이 |
| ST | 실용형 | ISTJ, ISTP, ESTJ, ESTP | Green (#22C55E) | 정훈 | 팩트시트 |
| SF | 공감형 | ISFJ, ISFP, ESFJ, ESFP | Orange (#F97316) | 하은 | 친구 톡 |

### 10.2 그룹 선택/변경 경로

1. **기본값**: SF (localStorage에 없을 때)
2. **온보딩 퀴즈**: 4개 질문 → MBTI 결정
3. **에디터 선택**: 4개 카드에서 직접 선택
4. **스토리 온보딩**: 관심사 선택 → 자동 매핑 (경제/IT→NT, 국제/정치→NF, 산업→ST)
5. **오늘의 질문**: 답변에 mbti 태그 있으면 변경
6. **챗봇 내**: NT/NF/ST/SF 버튼으로 전환
7. **피드 헤더**: 에디터 뱃지 클릭 → 에디터 선택 화면

### 10.3 그룹 영향 범위

- **기사 표시**: 제목, 부제, 본문, 핵심포인트, 마무리가 그룹별로 다름
- **챗봇 페르소나**: 이름, 말투, 스타일 변경
- **UI 색상**: 헤더 뱃지, 챗봇 UI 색상 변경
- **서버 동기화**: 로그인 시 `/api/user/profile`에 mbti_group 전송

---

## 부록: 카테고리 매핑

프론트엔드에서 사용하는 카테고리:

```typescript
// 백엔드 API에서 오는 카테고리 값들
"경제" | "IT_과학" | "정치" | "사회" | "문화" | "스포츠" | "국제"

// 프론트엔드 CATEGORY_MAP (shared/constants/categories.ts)
const CATEGORY_MAP: Record<string, string> = {
  finance: '경제',
  technology: 'IT·과학',
  politics: '정치',
  society: '사회',
  culture: '문화',
  sports: '스포츠',
  international: '국제',
  regional: '지역',
  industry: '산업',
  realestate: '부동산',
};
```
