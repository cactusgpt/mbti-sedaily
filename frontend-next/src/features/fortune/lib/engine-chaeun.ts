/**
 * 재운 심화 모듈 v1 — 재성 프로파일 · 4분면 진단 · 대운 재물 타임라인
 * engine.ts 의존 (CG_OH, JJG, sipsung, DaeunEntry, Pillar, SinGangYakResult)
 */
import {
  CG_OH,
  JJG,
  sipsung,
  type Pillar,
  type DaeunEntry,
  type SinGangYakResult,
} from './engine';

const OH_LIST = ['목', '화', '토', '금', '수'] as const;
const YANG_CG = new Set(['甲', '丙', '戊', '庚', '壬']);

// ── 재성 프로파일 ──
export interface ChaeseongProfile {
  pyeonJae: number;
  jeongJae: number;
  totalCount: number;
  strength: number;        // 0~100
  hasRoot: boolean;
  rootStrength: number;
  dominantType: '편재' | '정재' | '균형' | '없음';
  chaeOh: string;
}

export function calculateChaeseongProfile(ps: Pillar[]): ChaeseongProfile {
  const ilgan = ps[1]?.c;
  const ilganOh = CG_OH[ilgan || ''];
  if (!ilgan || !ilganOh) {
    return { pyeonJae: 0, jeongJae: 0, totalCount: 0, strength: 0, hasRoot: false, rootStrength: 0, dominantType: '없음', chaeOh: '' };
  }
  const idx = OH_LIST.indexOf(ilganOh as (typeof OH_LIST)[number]);
  const chaeOh = OH_LIST[(idx + 2) % 5];
  const ilganYang = YANG_CG.has(ilgan);

  let pyeonJae = 0;
  let jeongJae = 0;

  // 천간 (일간 제외)
  for (let i = 0; i < ps.length; i++) {
    if (i === 1) continue;
    const c = ps[i]?.c;
    if (!c || CG_OH[c] !== chaeOh) continue;
    if (YANG_CG.has(c) === ilganYang) pyeonJae += 1;
    else jeongJae += 1;
  }

  // 지지 본기
  for (const p of ps) {
    const j = p?.j;
    if (!j) continue;
    const arr = JJG[j] || [];
    const main = arr[arr.length - 1];
    if (!main || CG_OH[main] !== chaeOh) continue;
    if (YANG_CG.has(main) === ilganYang) pyeonJae += 1;
    else jeongJae += 1;
  }

  // 지장간 뿌리
  let rootStrength = 0;
  let hasRoot = false;
  for (const p of ps) {
    const j = p?.j;
    if (!j) continue;
    const arr = JJG[j] || [];
    const weights = arr.length === 1 ? [3] : arr.length === 2 ? [1, 3] : [1, 2, 3];
    arr.forEach((h, i) => {
      if (CG_OH[h] === chaeOh) {
        rootStrength += weights[i];
        hasRoot = true;
      }
    });
  }

  const totalCount = pyeonJae + jeongJae;
  const strength = Math.max(0, Math.min(100, totalCount * 10 + rootStrength * 5));

  let dominantType: ChaeseongProfile['dominantType'];
  if (totalCount === 0) dominantType = '없음';
  else if (pyeonJae > jeongJae * 1.5) dominantType = '편재';
  else if (jeongJae > pyeonJae * 1.5) dominantType = '정재';
  else dominantType = '균형';

  return { pyeonJae, jeongJae, totalCount, strength, hasRoot, rootStrength, dominantType, chaeOh };
}

// ── 6타입 진단 (신강/중화/신약 × 재강/재약) ──
export type ChaeunType = '관리형' | '확장형' | '균형형' | '기회형' | '재다신약' | '우회축적';
export interface ChaeunDiagnosis {
  type: ChaeunType;
  headline: string;
  strengths: string[];
  cautions: string[];
  attitude: string;
  investmentStyle: string;
}

const CHAEUN_DIAGNOSES: Record<ChaeunType, Omit<ChaeunDiagnosis, 'type'>> = {
  '관리형': {
    headline: '자수성가형 · 꾸준히 쌓아가는 축적의 구조',
    strengths: [
      '재성을 스스로 다룰 힘이 있어 체계적 자산 관리에 유리',
      '장기 저축·부동산·우량주 등 안정 자산과 궁합이 좋음',
      '본업과 사이드 수익 모두 감당 가능한 체력',
    ],
    cautions: [
      '재성을 눌러 쓰는 구조라 과욕으로 무리한 확장 시 피로 누적',
      '공격적 단기 투자는 효율이 낮음',
      '세금·상속 등 보이지 않는 유출 구멍 점검 필요',
    ],
    attitude: '천천히, 꾸준히. 시스템과 규칙을 만들어 복리로 쌓는 태도.',
    investmentStyle: '저축·우량 배당·장기 ETF·부동산 중심의 코어 포트폴리오',
  },
  '확장형': {
    headline: '기회를 만들어가는 구조 · 재성이 용신/희신',
    strengths: [
      '재성이 필요해 기회가 보일 때 실행력이 돋보임',
      '사업·영업·프리랜스 등 소득 원천 확장에 유리',
      '재성 세운에 눈에 띄는 도약 가능',
    ],
    cautions: [
      '재성이 약해 꾸준한 자산 관리 습관이 흐트러지기 쉬움',
      '기회가 올 때 준비가 덜 되어 있으면 놓치기 쉬움',
      '사람·네트워크에 의존하는 구조라 인연 관리가 핵심',
    ],
    attitude: '평소에 준비, 기회 올 때 과감히. 관계와 신용에 투자.',
    investmentStyle: '성장주·사업 재투자·신규 수익 채널 개발 중심',
  },
  '균형형': {
    headline: '중화된 바탕 위에 재성이 넉넉한 구조 · 공수 양면 자유',
    strengths: [
      '일간의 세력이 치우치지 않아 상황 따라 유연하게 대응 가능',
      '재성이 받쳐주어 공격(확장)과 수비(관리)를 자유롭게 전환',
      '단기 변동에도 흔들리지 않는 정서·재정 안정감',
    ],
    cautions: [
      '특화 포인트가 약해 임팩트가 작을 수 있음 — 선택과 집중 필요',
      '균형이 오히려 판단을 미루게 하는 함정',
      '리스크 회피 성향이 지나치면 성장 기회 놓침',
    ],
    attitude: '균형을 유지하되 분기별로 공격 포인트 하나는 설정.',
    investmentStyle: '코어(안정)+위성(공격) 하이브리드, 리밸런싱 주기 엄격 유지',
  },
  '기회형': {
    headline: '중화된 구조지만 재성이 약함 · 외부 기회가 재운의 핵심',
    strengths: [
      '감정 기복이 적어 침착하게 기회를 판단 가능',
      '사람·정보 관계에 기반한 수익 설계에 유리',
      '실수가 적고 장기적으로 누적 가능한 신뢰 자산 보유',
    ],
    cautions: [
      '먼저 움직이지 않으면 기회가 그냥 지나감',
      '안전주의가 지나쳐 작은 기회까지 놓칠 수 있음',
      '재성이 약해 꾸준한 소득 채널 구축이 중요',
    ],
    attitude: '때를 기다리되, 왔을 때는 주저하지 않고 움직이기.',
    investmentStyle: '부지런한 정보 수집 + 여유 자금은 보수 자산으로 방어',
  },
  '재다신약': {
    headline: '돈은 많이 보이나 감당이 어려운 구조',
    strengths: [
      '큰 돈이 돌아다니는 환경에 노출되기 쉬움',
      '재무·금융 흐름을 읽는 감각이 발달',
      '중개·유통 등 돈을 거치게 하는 일에 유리',
    ],
    cautions: [
      '직접 운용보다 전문가 위임·분산 투자가 안전',
      '대출·보증 등 타인 돈과 얽히는 관계 주의',
      '건강 관리가 곧 재물 관리 — 무리 금물',
    ],
    attitude: '욕심을 줄이고, 위임하고, 나눠 담아라.',
    investmentStyle: '분산 ETF·전문가 자문·인덱스 중심, 개별 종목 비중 낮게',
  },
  '우회축적': {
    headline: '재물보다 지식·전문직으로 우회하는 구조',
    strengths: [
      '인성·식상이 강해 전문성·자격·브랜드로 소득 전환 가능',
      '학업·연구·창작 등 무형 자산이 곧 재물 원천',
      '큰 기복 없이 안정적으로 쌓이는 소득 구조',
    ],
    cautions: [
      '직접 재성이 약해 큰 재물 기회는 적을 수 있음',
      '지식을 돈으로 환산하는 채널(강의·저술·컨설팅)을 설계해야 함',
      '단기 투자 성공 집착은 오히려 실패 확률 높임',
    ],
    attitude: '실력을 쌓고, 그 실력으로 보수를 받는 구조를 설계.',
    investmentStyle: '자기 계발 투자 우선, 여유 자금은 보수적 저축·우량 ETF',
  },
};

export function diagnoseChaeun(sgy: SinGangYakResult, chaeseong: ChaeseongProfile): ChaeunDiagnosis {
  // 신강약을 3단계로 분리: 신강(극신강+신강) / 중화 / 신약(신약+극신약)
  const bodyLevel: 'strong' | 'medium' | 'weak' =
    sgy.level === '극신강' || sgy.level === '신강' ? 'strong'
    : sgy.level === '중화' ? 'medium'
    : 'weak';
  const chaeStrong = chaeseong.strength >= 40;

  let type: ChaeunType;
  if (bodyLevel === 'strong' && chaeStrong) type = '관리형';
  else if (bodyLevel === 'strong' && !chaeStrong) type = '확장형';
  else if (bodyLevel === 'medium' && chaeStrong) type = '균형형';
  else if (bodyLevel === 'medium' && !chaeStrong) type = '기회형';
  else if (bodyLevel === 'weak' && chaeStrong) type = '재다신약';
  else type = '우회축적';

  return { type, ...CHAEUN_DIAGNOSES[type] };
}

// ── 대운 재물 타임라인 ──
export type ChaeunTimelineRating = 'strong' | 'mixed' | 'caution';
export interface ChaeunDaeunSegment {
  age: number;
  ganji: string;
  ganjiHanja: string;
  theme: string;
  rating: ChaeunTimelineRating;
  note: string;
}

export function evaluateDaeunChaeun(daeuns: DaeunEntry[], ilgan: string): ChaeunDaeunSegment[] {
  if (!ilgan) return [];
  return daeuns.map((d, i) => {
    const cgSS = sipsung(ilgan, d.c);
    const jjArr = JJG[d.j] || [];
    const jjMain = jjArr[jjArr.length - 1] || '';
    const jjSS = jjMain ? sipsung(ilgan, jjMain) : '';
    const bothSS = [cgSS, jjSS];

    let theme = '안정 유지';
    let rating: ChaeunTimelineRating = 'mixed';
    let note = '';

    const hasChaeseong = bothSS.some(s => s === '편재' || s === '정재');
    const hasGeobjae = bothSS.includes('겁재');
    const hasBigyeon = bothSS.includes('비견');
    const hasGwansung = bothSS.some(s => s === '편관' || s === '정관');
    const hasInsung = bothSS.some(s => s === '편인' || s === '정인');
    const hasSiksang = bothSS.some(s => s === '식신' || s === '상관');

    if (hasChaeseong && hasGwansung) {
      theme = '직장 재물';
      rating = 'strong';
      note = '재성과 관성이 함께 와 직장·지위 기반의 수익이 확장되는 구간.';
    } else if (hasChaeseong) {
      theme = '재물 확장';
      rating = 'strong';
      note = '재성이 들어와 적극적 재물 활동·사업 기회가 크게 열리는 구간.';
    } else if (hasGeobjae) {
      theme = '재물 유출 주의';
      rating = 'caution';
      note = i === 0
        ? '겁재 대운 초입 — 충동 지출·보증·공동투자 주의가 특히 강한 구간.'
        : '겁재가 들어와 지출·경쟁이 늘어나는 구간. 보수적 재정 운영이 안전.';
    } else if (hasBigyeon) {
      theme = '경쟁·분재';
      rating = 'mixed';
      note = '비견이 들어와 동료·경쟁과 얽히는 구간. 독자 판단이 유리.';
    } else if (hasGwansung) {
      theme = '직장·책임';
      rating = 'mixed';
      note = '관성이 들어와 직장·사회적 책임이 커지는 구간. 재물은 직책 따라 따라옴.';
    } else if (hasInsung) {
      theme = '전문성 기반';
      rating = 'mixed';
      note = '인성이 들어와 학습·자격·전문성이 재물의 뿌리가 되는 구간.';
    } else if (hasSiksang) {
      theme = '재물 생산';
      rating = 'strong';
      note = '식상이 들어와 생산·표현·서비스를 통해 수익이 만들어지는 구간.';
    }

    return {
      age: d.age,
      ganji: `${d.ck}${d.jk}`,
      ganjiHanja: `${d.c}${d.j}`,
      theme,
      rating,
      note,
    };
  });
}
