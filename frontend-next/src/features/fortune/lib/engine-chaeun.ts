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
    headline: '자수성가형 · 꾸준히 쌓아가는 축적의 구조예요',
    strengths: [
      '재물을 스스로 다룰 힘이 있어 체계적인 자산 관리에 강점이 있어요',
      '장기 저축·부동산·우량주 같은 안정 자산과 잘 맞는 편이에요',
      '본업과 부수입을 함께 챙기는 체력이 받쳐줘요',
    ],
    cautions: [
      '과도한 확장은 오히려 피로가 쌓이기 쉬워요',
      '공격적인 단기 투자는 들이는 노력에 비해 효율이 낮은 편이에요',
      '세금·상속처럼 보이지 않는 유출 구멍은 한 번쯤 점검해보시면 좋아요',
    ],
    attitude: '천천히, 꾸준히. 시스템과 규칙을 만들어 복리로 쌓아가시면 가장 잘 맞아요.',
    investmentStyle: '저축·우량 배당·장기 ETF·부동산 같은 코어 포트폴리오가 어울려요',
  },
  '확장형': {
    headline: '기회를 만들어가는 구조예요 · 재성이 용신/희신 역할',
    strengths: [
      '재물에 대한 갈증이 실행력으로 이어져, 기회를 포착하면 빠르게 움직이는 편이에요',
      '사업·영업·프리랜스처럼 소득 원천을 넓히는 쪽이 잘 맞아요',
      '재성 세운이 오면 눈에 띄는 도약을 이루기 좋아요',
    ],
    cautions: [
      '재성이 약해 꾸준한 자산 관리 습관이 흐트러지기 쉬운 편이에요',
      '기회가 왔을 때 준비가 덜 되어 있으면 놓치기 쉬워요',
      '사람·네트워크에 기대는 구조라, 평소 인연 관리가 중요해요',
    ],
    attitude: '평소엔 조용히 준비하고, 기회가 왔을 때 과감히 움직이는 리듬이 잘 맞아요.',
    investmentStyle: '성장주·사업 재투자·새로운 수익 채널 개발 쪽이 힘을 발휘해요',
  },
  '균형형': {
    headline: '중화된 바탕에 재성이 넉넉한 구조예요 · 공수 양면에 자유로움',
    strengths: [
      '일간의 세력이 치우치지 않아, 상황에 따라 유연하게 대응할 수 있어요',
      '재성이 받쳐줘서 공격(확장)과 수비(관리)를 자유롭게 오갈 수 있어요',
      '단기 변동에도 크게 흔들리지 않는 안정감이 있어요',
    ],
    cautions: [
      '특화된 포인트가 약해 임팩트가 작게 느껴질 수 있어, 선택과 집중이 가끔 필요해요',
      '균형을 맞추려다 판단이 늦어지는 때가 있어요',
      '리스크를 너무 피하면 성장 기회를 놓치기도 해요',
    ],
    attitude: '전반적인 균형을 지키되, 분기마다 공격 포인트 하나쯤 정해 두시면 좋아요.',
    investmentStyle: '안정(코어)과 공격(위성)을 섞은 하이브리드 구성에 정기 리밸런싱이 잘 맞아요',
  },
  '기회형': {
    headline: '중화된 구조지만 재성이 약한 편 · 외부 기회를 잡아내는 게 재운의 핵심이에요',
    strengths: [
      '감정 기복이 적어 기회를 침착하게 판단할 수 있어요',
      '사람·정보를 잘 엮어내는 감각이 수익 설계에 도움이 돼요',
      '실수가 적어 장기적으로 신뢰 자산이 쌓이기 좋은 체질이에요',
    ],
    cautions: [
      '먼저 움직이지 않으면 기회가 그냥 지나갈 수 있어요',
      '안전주의가 지나치면 작은 기회도 놓치기 쉬워요',
      '재성이 약한 편이라 꾸준한 소득 채널을 만드는 게 중요해요',
    ],
    attitude: '때를 기다리되, 와 닿는 순간엔 망설임 없이 움직여보세요.',
    investmentStyle: '평소 정보를 부지런히 챙기고, 여유 자금은 보수적인 자산으로 지키는 흐름이 좋아요',
  },
  '재다신약': {
    headline: '돈은 많이 보이지만, 혼자 감당하기는 버거운 구조예요',
    strengths: [
      '큰 돈이 오가는 환경에 자연스럽게 노출되는 편이에요',
      '재무·금융 흐름을 읽어내는 감각이 발달해 있어요',
      '중개·유통처럼 돈을 거쳐가게 하는 일에서 강점이 드러나요',
    ],
    cautions: [
      '직접 운용하기보다는 전문가에게 맡기거나 분산 투자하는 쪽이 안전해요',
      '대출·보증처럼 타인 돈과 얽히는 관계는 한 박자 신중하게 살펴보세요',
      '건강이 곧 재물이에요 — 몸을 무리하게 쓰지 않는 게 제일 큰 관리랍니다',
    ],
    attitude: '욕심을 조금 줄이고, 혼자 짊어지기보다 위임하고 나눠 담는 태도가 잘 맞아요.',
    investmentStyle: '분산 ETF·전문가 자문·인덱스 중심으로, 개별 종목 비중은 낮게 두시는 게 안정적이에요',
  },
  '우회축적': {
    headline: '재물보다 지식·전문직으로 우회하며 쌓아가는 구조예요',
    strengths: [
      '인성·식상이 강해 전문성·자격·브랜드가 그대로 소득으로 이어져요',
      '학업·연구·창작 같은 무형 자산이 곧 재물의 뿌리가 돼요',
      '큰 기복 없이 안정적으로 소득이 쌓이는 체질이에요',
    ],
    cautions: [
      '직접적인 재성이 약해 큰 재물 기회는 상대적으로 적은 편이에요',
      '지식을 돈으로 바꾸는 채널(강의·저술·컨설팅 등)을 의식적으로 설계해보시면 좋아요',
      '단기 투자 성공에 집착하면 오히려 실패 확률이 높아지는 경향이 있어요',
    ],
    attitude: '실력을 쌓고, 그 실력을 바탕으로 보수를 받는 구조를 천천히 설계해가세요.',
    investmentStyle: '자기계발 투자에 먼저 집중하고, 여유 자금은 보수적인 저축·우량 ETF로 두시는 게 어울려요',
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
