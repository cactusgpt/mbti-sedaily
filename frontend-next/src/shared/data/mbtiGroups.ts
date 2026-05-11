export type MbtiGroupId = 'NT' | 'NF' | 'ST' | 'SF'

export type MbtiType =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISTP' | 'ESTJ' | 'ESTP'
  | 'ISFJ' | 'ISFP' | 'ESFJ' | 'ESFP'

export interface MbtiGroup {
  id: MbtiGroupId
  name: string
  label: string
  types: MbtiType[]
  color: string
  bgClass: string
  bgLightClass: string
  textClass: string
  borderClass: string
  style: string
  icon: string
  description: string
  axis: string
}

export interface EditorPersona {
  id: MbtiGroupId
  mbti: MbtiType
  name: string
  label: string
  role: string
  tagline: string
  description: string
  avatar: string
  colorClass: string
  textClass: string
  lightClass: string
  ringClass: string
}

export const mbtiGroups: Record<MbtiGroupId, MbtiGroup> = {
  NT: {
    id: 'NT',
    name: '전략형',
    label: 'NT 전략형',
    types: ['INTJ', 'INTP', 'ENTJ', 'ENTP'],
    color: '#3B82F6',
    bgClass: 'bg-blue-500',
    bgLightClass: 'bg-blue-50',
    textClass: 'text-blue-600',
    borderClass: 'border-blue-300',
    style: '애널리스트 리포트',
    icon: '📊',
    description: '데이터와 논리로 핵심을 꿰뚫는 분석형 뉴스',
    axis: '추상 + 분석',
  },
  NF: {
    id: 'NF',
    name: '가치형',
    label: 'NF 가치형',
    types: ['INFJ', 'INFP', 'ENFJ', 'ENFP'],
    color: '#8B5CF6',
    bgClass: 'bg-violet-500',
    bgLightClass: 'bg-violet-50',
    textClass: 'text-violet-600',
    borderClass: 'border-violet-300',
    style: '칼럼 / 에세이',
    icon: '💡',
    description: '의미와 가치를 찾아 깊이 읽는 인문형 뉴스',
    axis: '추상 + 감성',
  },
  ST: {
    id: 'ST',
    name: '실용형',
    label: 'ST 실용형',
    types: ['ISTJ', 'ISTP', 'ESTJ', 'ESTP'],
    color: '#22C55E',
    bgClass: 'bg-green-500',
    bgLightClass: 'bg-green-50',
    textClass: 'text-green-600',
    borderClass: 'border-green-300',
    style: '팩트시트',
    icon: '✅',
    description: '숫자와 팩트로 빠르게 파악하는 실용형 뉴스',
    axis: '구체 + 분석',
  },
  SF: {
    id: 'SF',
    name: '공감형',
    label: 'SF 공감형',
    types: ['ISFJ', 'ISFP', 'ESFJ', 'ESFP'],
    color: '#F97316',
    bgClass: 'bg-orange-500',
    bgLightClass: 'bg-orange-50',
    textClass: 'text-orange-600',
    borderClass: 'border-orange-300',
    style: '친구 톡',
    icon: '💬',
    description: '친근한 대화체로 쉽게 이해하는 공감형 뉴스',
    axis: '구체 + 감성',
  },
}

export const mbtiGroupList: MbtiGroup[] = Object.values(mbtiGroups)

export const mbtiTypeToGroup: Record<MbtiType, MbtiGroupId> = {
  INTJ: 'NT', INTP: 'NT', ENTJ: 'NT', ENTP: 'NT',
  INFJ: 'NF', INFP: 'NF', ENFJ: 'NF', ENFP: 'NF',
  ISTJ: 'ST', ISTP: 'ST', ESTJ: 'ST', ESTP: 'ST',
  ISFJ: 'SF', ISFP: 'SF', ESFJ: 'SF', ESFP: 'SF',
}

/**
 * Default 4-char MBTI for each group, used when the user picks an editor in
 * OnboardingPage but doesn't tell us their precise MBTI. The selection of
 * defaults mirrors the 4 editor personas defined in OnboardingPage.tsx
 * (시현=INTJ, 지원=INFP, 정훈=ISTJ, 하은=ESFP) so picking an editor is
 * functionally equivalent to adopting that editor's MBTI.
 *
 * Phase 3 personalization (Round 5-C/D) lazy-creates the user_profiles row
 * when a 4-char MBTI accompanies the request. Without this default mapping,
 * group-only requests would never trigger the lazy-create and consolidate
 * would always report skipped_no_profile.
 *
 * Users who know their precise MBTI (and want to override INTJ → INTP, etc)
 * can adjust via a future settings page (separate round). Until then, all
 * NT users share the INTJ seed embedding — which is identical to the NT
 * group seed at the backend (Round 5-A canonical sentence is per-group),
 * so the loss of precision is cosmetic.
 */
export const groupToDefaultMbti: Record<MbtiGroupId, MbtiType> = {
  NT: 'INTJ',
  NF: 'INFP',
  ST: 'ISTJ',
  SF: 'ESFP',
}

export const editorPersonas: Record<MbtiGroupId, EditorPersona> = {
  NT: {
    id: 'NT',
    mbti: 'INTJ',
    name: '시현',
    label: '전략형 분석가',
    role: '애널리스트 리포트',
    tagline: '데이터와 논리로 뉴스의 구조를 읽습니다',
    description: '정책, 시장, 산업 변수를 분해해 원인과 파급효과를 먼저 짚습니다.',
    avatar: '/editors/intj.png',
    colorClass: 'bg-blue-500',
    textClass: 'text-blue-600',
    lightClass: 'bg-blue-50',
    ringClass: 'ring-blue-200',
  },
  NF: {
    id: 'NF',
    mbti: 'INFP',
    name: '지원',
    label: '가치형 해석자',
    role: '칼럼 / 에세이',
    tagline: '숫자 뒤의 사람과 의미를 함께 봅니다',
    description: '지표 너머의 삶, 관계, 사회적 맥락을 차분하게 풀어줍니다.',
    avatar: '/editors/infp.png',
    colorClass: 'bg-violet-500',
    textClass: 'text-violet-600',
    lightClass: 'bg-violet-50',
    ringClass: 'ring-violet-200',
  },
  ST: {
    id: 'ST',
    mbti: 'ISTJ',
    name: '정훈',
    label: '실용형 실무자',
    role: '팩트시트',
    tagline: '필요한 사실만 빠르게 정리합니다',
    description: '일정, 수치, 이해관계, 다음 행동처럼 바로 써먹을 정보를 우선합니다.',
    avatar: '/editors/istj.png',
    colorClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    lightClass: 'bg-emerald-50',
    ringClass: 'ring-emerald-200',
  },
  SF: {
    id: 'SF',
    mbti: 'ESFP',
    name: '하은',
    label: '공감형 소통가',
    role: '친구 톡',
    tagline: '어려운 뉴스를 대화거리처럼 쉽게 풀어줍니다',
    description: '생활 변화, 재미있는 장면, 주변에 설명하기 좋은 포인트부터 보여줍니다.',
    avatar: '/editors/esfp.png',
    colorClass: 'bg-orange-500',
    textClass: 'text-orange-600',
    lightClass: 'bg-orange-50',
    ringClass: 'ring-orange-200',
  },
}
