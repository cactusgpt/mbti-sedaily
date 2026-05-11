import type { MbtiGroupId } from '@/shared/data/mbtiGroups';

/**
 * 4-lens descriptions surfaced on the editorial hero side-panel.
 * Single source of truth so Demo A's "같은 기사, 네 가지 렌즈" panel and the
 * mobile brief card stay in sync.
 */
export const lensDescriptions: Record<MbtiGroupId, string> = {
  NT: '사업성, 규제 변수, 산업 전략을 먼저 봅니다.',
  NF: '숫자 뒤의 사람과 사회 변화를 함께 읽습니다.',
  ST: '필요한 일정, 수치, 다음 행동만 정리합니다.',
  SF: '친구에게 설명하듯 흥미로운 장면부터 풀어줍니다.',
};

/**
 * Persona-aware pick blurb shown in the editorial intro / mobile brief card.
 * Keep it short — first impression, not an article summary.
 */
export const pickBlurb: Record<MbtiGroupId, string> = {
  NT: '데이터와 인과관계가 가장 명료한 기사를 오늘의 한 편으로 골랐습니다.',
  NF: '오늘 마음에 남는 흐름이 있는 기사를 조심스럽게 꺼내봤어요.',
  ST: '실무에 바로 쓸 수 있는 사실 위주 기사를 추렸습니다.',
  SF: '주변에 바로 공유하고 싶어진 오늘의 대화거리예요.',
};

/**
 * "왜 추천됐는지" 짧은 라벨. 카드 하단의 meta row, mobile brief card에서 사용.
 * 첫 항목은 항상 카테고리, 그 뒤로 persona + index 기반 두 개를 더 끼워 넣음.
 */
const reasonsByPersona: Record<MbtiGroupId, string[]> = {
  NT: ['논리적 정합성', '구조 분석', '인과 추적', '시장 변수'],
  NF: ['생활 영향', '사람 이야기', '사회 맥락', '함께 읽기'],
  ST: ['핵심 사실', '바로 실무', '짧은 호흡', '수치 정리'],
  SF: ['대화거리', '관심 토픽', '쉬운 설명', '오늘의 장면'],
};

export function pickReasons(group: MbtiGroupId, seed: string, category: string): string[] {
  const list = reasonsByPersona[group];
  const idx = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const first = list[idx % list.length];
  const second = list[(idx + 1) % list.length];
  return [category || '오늘의 추천', first, second].filter(Boolean);
}

export function estimateReadMinutes(text: string): number {
  if (!text) return 3;
  const charCount = text.length;
  // 한국어 평균 분당 600자 가정. 최소 2분, 최대 8분으로 클램프.
  const minutes = Math.round(charCount / 600);
  return Math.max(2, Math.min(8, minutes || 3));
}

export function formatKstUpdated(d: Date = new Date()): string {
  const kst = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return `${kst.replace(/\.\s?$/, '')} KST 업데이트`;
}
