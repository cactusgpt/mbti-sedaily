# Phase 4: 미사용 코드 정리 작업 기록

## 작업일: 2026-04-06

## 완료된 작업

### 1. 미사용 파일 식별 및 legacy 폴더로 이동

전체 프로젝트를 스캔하여 사용되지 않는 컴포넌트 15개를 식별하고 보관 처리:

| 파일명 | 원본 위치 | 새 위치 | 사용 횟수 |
|---|---|---|---|
| ArticleDemo.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| ArticleDiscussion.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| ArticlePodcast.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| ArticleReactions.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| CompareModal.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| ComparisonView.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| FeedHeader.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| FortuneSection.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| MbtiFooter.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| MbtiHeader.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| MbtiHero.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| MbtiNewsHeader.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| MbtiSelector.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| NewsFeed.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |
| NewsletterCTA.tsx | src/components/mbti/ | src/legacy/mbti-unused/ | 0회 |

**미사용 파일 처리**: 15개 파일 → `src/legacy/mbti-unused/`로 이동

### 2. FeedPage.tsx 중복 코드 제거

FeedPage.tsx 내에서 다른 곳에 이미 존재하는 중복 코드를 식별하고 제거:

| 제거 대상 | 라인 범위 | 사유 | 대체 방법 |
|---|---|---|---|
| ScrollReveal 컴포넌트 | 21-70줄 (50줄) | `src/shared/ui/ScrollReveal.tsx`에 이미 존재 | `@/shared/ui/ScrollReveal` import 추가 |
| questionIcons 객체 | 104-113줄 (10줄) | `src/features/question/`에 이미 존재 | (사용처 없어 제거만 진행) |
| dailyQuestions 데이터 | 116-139줄 (24줄) | `src/features/question/`에 이미 존재 | `dailyQuestions` import 추가 |

**FeedPage.tsx 라인 수 변화**: 1,897줄 → 1,813줄 (약 84줄, 4.4% 감소)

### 3. Import 경로 최적화

중복 제거 후 필요한 import 추가:

```typescript
// 추가된 imports
import { ScrollReveal } from "@/shared/ui/ScrollReveal";
import { QuestionTab, dailyQuestions } from "@/features/question";
```

## 빌드 상태

✅ TypeScript 타입 체크 통과
✅ Next.js 빌드 성공 (`npm run build` 통과)
✅ 14개 페이지 정상 빌드 확인

## Git 변경사항

```
M  src/components/mbti/FeedPage.tsx         (수정)
D  src/components/mbti/ArticleDemo.tsx      (삭제) × 15개
A  src/legacy/mbti-unused/ArticleDemo.tsx   (추가) × 15개
```

**총 변경**: 1개 수정, 15개 삭제, 15개 추가

## 남은 작업 (다음 세션)

### 우선순위 1: widgets 레이어 구현
1. **Header 컴포넌트 분리**
   - FeedPage.tsx의 헤더 부분 (805-895줄, 약 90줄)
   - → `src/widgets/Header/`

2. **TabNavigation 컴포넌트 분리**
   - FeedPage.tsx의 탭 네비게이션 (812-882줄, 약 70줄)
   - → `src/widgets/TabNavigation/`

3. **AudioPlayer 컴포넌트 분리**
   - FeedPage.tsx의 오디오 플레이어 (1565-1750줄, 약 185줄)
   - → `src/widgets/AudioPlayer/`

**예상 효과**: FeedPage.tsx 약 345줄 추가 감소 → ~1,470줄

### 우선순위 2: FeedPage.tsx 내부 정리
- 미사용 상태/함수 제거
- Mock 데이터 분리 검토 (archivedSentences, communityPosts, userProfiles)

### 우선순위 3: ESLint boundaries 설정
- FSD 의존성 방향 규칙 강제
- 같은 레이어 간 import 방지

## 현재 폴더 구조

```
src/
├── app/                    # Next.js 라우팅
├── components/
│   └── mbti/
│       ├── FeedPage.tsx    # 메인 피드 (1,813줄, -84줄)
│       ├── ArticleView.tsx
│       ├── BriefingPage.tsx
│       ├── MbtiChatBot.tsx
│       └── OnboardingPage.tsx
├── features/               # FSD features
│   ├── auth/
│   ├── news-feed/
│   ├── question/
│   ├── community/
│   ├── archive/
│   └── news-dna/
├── legacy/                 # 미사용 코드 보관 (NEW)
│   └── mbti-unused/        # 15개 파일
├── shared/                 # 공통 레이어
│   ├── config/
│   ├── data/
│   ├── hooks/
│   ├── types/
│   ├── ui/
│   │   └── ScrollReveal.tsx
│   └── utils/
└── widgets/                # (플레이스홀더)
    └── index.ts
```

## 참고사항

- 미사용 파일은 삭제가 아닌 legacy 폴더로 이동하여 보관
- 모든 변경사항은 빌드 성공 확인 후 적용됨
- 중복 코드 제거 시 기존 기능 유지 확인
- 리팩토링 원칙: 구조만 변경, 로직 변경 없음

## 작업 방법론

1. **전체 프로젝트 스캔**: `grep -r` 명령어로 각 파일의 import 사용 횟수 조사
2. **사용 횟수 0회 파일 식별**: 15개 컴포넌트가 미사용으로 확인됨
3. **legacy 폴더 생성 및 이동**: 향후 참고를 위해 보관 처리
4. **중복 코드 식별**: FeedPage.tsx 내 이미 shared/features에 있는 코드 제거
5. **빌드 검증**: 타입 체크 및 프로덕션 빌드로 안정성 확인
