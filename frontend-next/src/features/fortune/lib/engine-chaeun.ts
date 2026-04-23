/**
 * 재운 심화 모듈 v1 — 재성 프로파일 · 4분면 진단 · 대운 재물 타임라인
 * engine.ts 의존 (CG_OH, JJG, sipsung, DaeunEntry, Pillar, SinGangYakResult)
 */
import {
  CG_OH,
  CHEONUL,
  JJG,
  sipsung,
  unsung,
  calcYeonun,
  calcWolun,
  getGapja,
  type Pillar,
  type DaeunEntry,
  type SinGangYakResult,
} from './engine';

const OH_LIST = ['목', '화', '토', '금', '수'] as const;
const YANG_CG = new Set(['甲', '丙', '戊', '庚', '壬']);

// ── 돈이 들어오는 5가지 경로 (십성군 × 강도) ──
export type WealthPathKey = '재성' | '인성' | '식상' | '관성' | '비겁';

export interface WealthPath {
  key: WealthPathKey;
  oh: string;         // 해당 오행
  count: number;      // 천간 + 지지 본기 합
  rootStrength: number; // 지장간 가중합 (본기3·중기2·여기1)
  strength: number;   // 0~100 종합
  label: string;      // '직접 재물' 같은 평어
  desc: string;       // 한 줄 설명
}

export interface WealthPathsResult {
  paths: WealthPath[];  // 강도 내림차순 정렬
  dominant: WealthPath; // 가장 강한 경로
  fallback: boolean;    // 모든 경로가 극히 약한 경우 true
}

const PATH_META: Record<WealthPathKey, { label: string; desc: string }> = {
  '재성': { label: '직접 재물', desc: '내가 직접 돈·자산·고객을 다루는 경로 (사업·투자·영업)' },
  '인성': { label: '실력·전문성', desc: '학문·자격·지식이 그대로 수익 원천이 되는 경로 (학자·연구·컨설팅)' },
  '식상': { label: '창작·서비스', desc: '내 재능·표현·서비스를 가치로 환산하는 경로 (프리랜스·콘텐츠·강의)' },
  '관성': { label: '직책·명예', desc: '직장·조직·사회적 지위에서 안정 수익이 오는 경로 (회사원·공직·전문직)' },
  '비겁': { label: '동료·협업', desc: '친구·동료·협력자와의 관계에서 기회·수익이 만들어지는 경로 (네트워크·공동사업)' },
};

function countOhInChart(ps: Pillar[], targetOh: string, excludeDayGan: boolean): { count: number; root: number } {
  let count = 0;
  let root = 0;
  for (let i = 0; i < ps.length; i++) {
    if (excludeDayGan && i === 1) continue;
    const c = ps[i]?.c;
    if (c && CG_OH[c] === targetOh) count++;
  }
  for (const p of ps) {
    const j = p?.j;
    if (!j) continue;
    const arr = JJG[j] || [];
    const main = arr[arr.length - 1];
    if (main && CG_OH[main] === targetOh) count++;
  }
  for (const p of ps) {
    const j = p?.j;
    if (!j) continue;
    const arr = JJG[j] || [];
    const weights = arr.length === 1 ? [3] : arr.length === 2 ? [1, 3] : [1, 2, 3];
    arr.forEach((h, i) => {
      if (CG_OH[h] === targetOh) root += weights[i];
    });
  }
  return { count, root };
}

// ── 시기별 재운 (세운/월운/일진) ──
// 특정 시기의 간지(천간+지지)가 일간에게 어떤 재운 영향을 주는지 평가

const SS_TO_PATH: Record<string, WealthPathKey> = {
  '비견': '비겁', '겁재': '비겁',
  '식신': '식상', '상관': '식상',
  '편재': '재성', '정재': '재성',
  '편관': '관성', '정관': '관성',
  '편인': '인성', '정인': '인성',
};

const PATH_SHORT: Record<WealthPathKey, string> = {
  '재성': '재성',
  '인성': '인성',
  '식상': '식상',
  '관성': '관성',
  '비겁': '비겁',
};

export interface LottoBreakdown {
  label: string;       // '편재 투출' 같은 항목 이름
  points: number;      // 가감 점수
  note: string;        // 한 줄 설명
  met: boolean;        // 조건 충족 여부
}

export interface LottoRating {
  stars: number;   // 1~5
  score: number;   // 0~100
  label: string;   // '로또 한 장?' 같은 짧은 라벨
  note: string;    // 한 줄 설명
  breakdown: LottoBreakdown[];  // 점수 내역 (투명 공개)
  disclaimer: string; // 면책 문구
}

export interface PeriodChaeunInfo {
  ganji: string;
  ganjiHanja: string;
  cgSS: string;
  jjSS: string;
  categories: WealthPathKey[];
  themeLine: string;
  note: string;
  lotto: LottoRating;
}

const LOTTO_DISCLAIMER = '전통 명리의 참고 지표를 단순 점수화한 재미용 수치예요. 실제 당첨 확률과는 무관합니다.';

/** 일진 간지 기반 100점 만점 로또/횡재 운 산정
 *  편재 투출(+30) / 천을귀인(+20) / 12운성 생·왕·관(+20, 사·묘·절 -10) / 일진 재성(+15) / 오행 균형(+15)
 */
function calcLottoRating(
  ilgan: string,
  cgSS: string,
  jjSS: string,
  pillars: Pillar[],
  dayJj: string,
): LottoRating {
  const breakdown: LottoBreakdown[] = [];
  let score = 0;

  // 1) 편재 투출 — 원국 천간(일간 제외)에 편재가 드러나 있는지
  const ilganYang = ['甲', '丙', '戊', '庚', '壬'].includes(ilgan);
  const ilganOh = CG_OH[ilgan];
  const OH_LIST_TMP = ['목', '화', '토', '금', '수'];
  const chaeOh = OH_LIST_TMP[(OH_LIST_TMP.indexOf(ilganOh) + 2) % 5];
  let pyeonJaeVisible = false;
  for (let i = 0; i < pillars.length; i++) {
    if (i === 1) continue;
    const c = pillars[i]?.c;
    if (!c || CG_OH[c] !== chaeOh) continue;
    const isYang = ['甲', '丙', '戊', '庚', '壬'].includes(c);
    if (isYang !== ilganYang) { pyeonJaeVisible = true; break; }
  }
  breakdown.push({
    label: '편재 투출',
    points: pyeonJaeVisible ? 30 : 0,
    note: pyeonJaeVisible ? '원국 천간에 편재가 드러나 횡재 기운 자극에 민감한 구조' : '원국 천간에 편재가 드러나지 않음',
    met: pyeonJaeVisible,
  });
  if (pyeonJaeVisible) score += 30;

  // 2) 천을귀인 — 오늘 일진 지지가 내 일간의 천을귀인 지지인지
  const cheonulList = CHEONUL[ilgan] || [];
  const cheonulHit = !!dayJj && cheonulList.includes(dayJj);
  breakdown.push({
    label: '천을귀인',
    points: cheonulHit ? 20 : 0,
    note: cheonulHit ? `오늘 일진 지지 ${dayJj}가 일간 ${ilgan}의 천을귀인` : '오늘 일진에 천을귀인 해당 없음',
    met: cheonulHit,
  });
  if (cheonulHit) score += 20;

  // 3) 12운성 — 오늘 일진 지지의 12운성
  const us = ilgan && dayJj ? unsung(ilgan, dayJj) : '';
  const wangPos = ['장생', '관대', '건록', '제왕'].includes(us); // 생·왕·관
  const deathPos = ['사', '묘', '절'].includes(us);
  const usScore = wangPos ? 20 : deathPos ? -10 : 0;
  breakdown.push({
    label: `12운성 ${us || '—'}`,
    points: usScore,
    note: wangPos ? '운기 상승 구간 (장생·관대·건록·제왕)'
          : deathPos ? '운기 하강 구간 (사·묘·절)'
          : '중립 구간',
    met: wangPos,
  });
  score += usScore;

  // 4) 일진 재성 — 오늘 일진의 천간/지지 본기에 재성(편재·정재) 유무
  const bothSS = [cgSS, jjSS];
  const dayHasJae = bothSS.includes('편재') || bothSS.includes('정재');
  breakdown.push({
    label: '일진 재성',
    points: dayHasJae ? 15 : 0,
    note: dayHasJae ? '오늘 일진에 재성이 실려 재물 기운이 활성' : '오늘 일진에 재성 없음',
    met: dayHasJae,
  });
  if (dayHasJae) score += 15;

  // 5) 오행 균형도 — 원국 5오행 모두 1개 이상이면 균형
  const ohCounts: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const p of pillars) {
    if (p.c && CG_OH[p.c]) ohCounts[CG_OH[p.c]]++;
    if (p.j) {
      const arr = JJG[p.j] || [];
      const main = arr[arr.length - 1];
      if (main && CG_OH[main]) ohCounts[CG_OH[main]]++;
    }
  }
  const presentCount = Object.values(ohCounts).filter(c => c > 0).length;
  const balanceScore = presentCount === 5 ? 15 : presentCount === 4 ? 10 : presentCount === 3 ? 5 : 0;
  breakdown.push({
    label: '오행 균형',
    points: balanceScore,
    note: `원국 오행 ${presentCount}/5종 보유 (5종 완성 +15, 4종 +10, 3종 +5)`,
    met: presentCount >= 4,
  });
  score += balanceScore;

  // 총점 0~100 clamp
  score = Math.max(0, Math.min(100, score));

  // 별점 매핑
  const stars =
    score >= 80 ? 5 :
    score >= 60 ? 4 :
    score >= 40 ? 3 :
    score >= 20 ? 2 : 1;

  const LABELS: Record<number, { label: string; note: string }> = {
    5: { label: '로또 한 장쯤?', note: '편재·귀인·운기가 맞물려 평소보다 재물 감도가 가장 높은 날이에요.' },
    4: { label: '평소보다 운 좋음', note: '재물 감도가 올라간 흐름. 단, 생활비까지 거는 건 금물.' },
    3: { label: '평범', note: '딱히 트이지도 막히지도 않는 평범한 흐름이에요.' },
    2: { label: '횡재 기대 말기', note: '운성이 낮거나 귀인이 없는 날. 소비 관리에 집중.' },
    1: { label: '통장에 고이 두기', note: '여러 지표가 낮게 나오는 흐름. 이번엔 패스하는 게 현명해요.' },
  };

  return {
    stars,
    score,
    label: LABELS[stars].label,
    note: LABELS[stars].note,
    breakdown,
    disclaimer: LOTTO_DISCLAIMER,
  };
}

function buildPeriodNote(categories: WealthPathKey[]): string {
  if (categories.length === 0) return '이번 시기는 특별한 재운 변수가 도드라지지 않는 안정 구간이에요.';
  const has = (k: WealthPathKey) => categories.includes(k);

  if (has('재성') && has('관성')) return '재성과 관성이 함께 들어와 직장·지위 기반의 수익이 확장되기 좋아요.';
  if (has('재성') && has('식상')) return '식상·재성이 같이 와서 창작·서비스로 수익이 생기기 좋은 시기예요.';
  if (has('재성') && has('비겁')) return '재성과 비겁이 만나 경쟁·협업 속에서 수익 기회가 만들어지는 시기예요.';
  if (has('재성') && has('인성')) return '재성이 오지만 인성도 받쳐줘서 실력 기반의 안정적 수익이 가능한 시기예요.';
  if (has('재성')) return '새로운 수익 채널을 시도하기 좋은 시기예요. 다만 기복이 있을 수 있으니 여유 자금을 유지하세요.';

  if (has('관성') && has('인성')) return '관성·인성이 함께 와서 직장·전문성 트랙이 돋보이는 시기예요.';
  if (has('관성')) return '직장·책임·공식 활동에서 기회가 커지는 시기예요.';

  if (has('인성') && has('식상')) return '학습·자격(인성)과 표현·창작(식상)이 동시에 활성화돼 전문성을 콘텐츠로 푸는 흐름이 좋아요.';
  if (has('인성')) return '단기 수익보다 학습·자격·전문성 투자에 집중하면 장기적으로 수익 기반이 단단해져요.';

  if (has('식상')) return '창작·표현·서비스가 빛을 발하는 시기예요. 퍼스널 브랜드·콘텐츠를 키우기 좋아요.';

  if (has('비겁')) return '협업·네트워크·공동 프로젝트가 유리한 시기예요. 다만 지출 관리는 조금 더 꼼꼼히.';
  return '—';
}

export function evaluatePeriodChaeun(
  ilgan: string,
  periodCg: string,
  periodJj: string,
  periodCk: string,
  periodJk: string,
  pillars: Pillar[],
): PeriodChaeunInfo {
  const cgSS = periodCg && ilgan ? sipsung(ilgan, periodCg) : '';
  const jjArr = periodJj ? (JJG[periodJj] || []) : [];
  const jjMain = jjArr[jjArr.length - 1] || '';
  const jjSS = jjMain && ilgan ? sipsung(ilgan, jjMain) : '';

  const categories: WealthPathKey[] = [];
  if (cgSS && SS_TO_PATH[cgSS]) categories.push(SS_TO_PATH[cgSS]);
  if (jjSS && SS_TO_PATH[jjSS] && !categories.includes(SS_TO_PATH[jjSS])) {
    categories.push(SS_TO_PATH[jjSS]);
  }

  const themeLine = categories.map(c => PATH_SHORT[c]).join(' · ') || '—';
  const note = buildPeriodNote(categories);
  const lotto = calcLottoRating(ilgan, cgSS, jjSS, pillars, periodJj);

  return {
    ganji: `${periodCk || ''}${periodJk || ''}`,
    ganjiHanja: `${periodCg || ''}${periodJj || ''}`,
    cgSS, jjSS, categories, themeLine, note, lotto,
  };
}

export interface CurrentPeriodChaeun {
  yeonun: (PeriodChaeunInfo & { year: number }) | null;
  wolun: (PeriodChaeunInfo & { month: number }) | null;
  iljin: (PeriodChaeunInfo & { dateLabel: string }) | null;
}

/** 오늘 기준 올해 세운 · 이번 달 월운 · 오늘 일진의 재운 영향 평가 */
export function computeCurrentPeriodChaeun(ilgan: string, pillars: Pillar[] = []): CurrentPeriodChaeun {
  if (!ilgan) return { yeonun: null, wolun: null, iljin: null };
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  // 세운
  const yeonuns = calcYeonun();
  const yr = yeonuns.find(v => v.year === y);
  const yeonun = yr
    ? { ...evaluatePeriodChaeun(ilgan, yr.c, yr.j, yr.ck, yr.jk, pillars), year: yr.year }
    : null;

  // 월운
  const woluns = calcWolun();
  const mo = woluns.find(v => v.month === m);
  const wolun = mo
    ? { ...evaluatePeriodChaeun(ilgan, mo.c, mo.j, mo.ck, mo.jk, pillars), month: mo.month }
    : null;

  // 일진
  let iljin: CurrentPeriodChaeun['iljin'] = null;
  try {
    const g = getGapja(y, m, d);
    const dateLabel = `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
    iljin = {
      ...evaluatePeriodChaeun(ilgan, g.dayPillarHanja[0], g.dayPillarHanja[1], g.dayPillar[0], g.dayPillar[1], pillars),
      dateLabel,
    };
  } catch {}

  return { yeonun, wolun, iljin };
}

export function calculateWealthPaths(ps: Pillar[]): WealthPathsResult | null {
  const ilgan = ps[1]?.c;
  const ilganOh = CG_OH[ilgan || ''];
  if (!ilgan || !ilganOh) return null;
  const idx = OH_LIST.indexOf(ilganOh as (typeof OH_LIST)[number]);

  const pathOh: Record<WealthPathKey, string> = {
    '비겁': ilganOh,
    '식상': OH_LIST[(idx + 1) % 5],
    '재성': OH_LIST[(idx + 2) % 5],
    '관성': OH_LIST[(idx + 3) % 5],
    '인성': OH_LIST[(idx + 4) % 5],
  };

  const paths: WealthPath[] = (Object.keys(pathOh) as WealthPathKey[]).map(key => {
    const oh = pathOh[key];
    const { count, root } = countOhInChart(ps, oh, key === '비겁');
    const strength = Math.max(0, Math.min(100, count * 10 + root * 5));
    return {
      key, oh, count, rootStrength: root, strength,
      label: PATH_META[key].label,
      desc: PATH_META[key].desc,
    };
  });

  const sorted = [...paths].sort((a, b) => b.strength - a.strength);
  const dominant = sorted[0];
  const fallback = dominant.strength < 20;

  return { paths: sorted, dominant, fallback };
}

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
  attitude: string[];
  investmentStyle: string[];
  avoid: string[];
}

const CHAEUN_DIAGNOSES: Record<ChaeunType, Omit<ChaeunDiagnosis, 'type'>> = {
  '관리형': {
    headline: '자수성가형 · 꾸준히 쌓아가는 축적의 구조예요',
    strengths: [
      '재물을 스스로 다룰 힘이 있어 체계적인 자산 관리에 강점이 있어요',
      '장기 저축·부동산·우량주 같은 안정 자산과 잘 맞는 편이에요',
      '본업과 부수입을 함께 챙기는 체력이 받쳐주는 체질이에요',
    ],
    cautions: [
      '과도한 확장은 오히려 피로가 쌓이기 쉬운 구조예요',
      '공격적인 단기 투자는 들이는 노력에 비해 효율이 낮은 편이에요',
      '세금·상속처럼 보이지 않는 유출 구멍이 생기기 쉬운 특성이 있어요',
    ],
    attitude: [
      '당장의 큰 수익보다 복리로 천천히 불어나는 흐름을 신뢰해보세요',
      '수입·지출·투자 규칙을 문서로 정리해 루틴으로 만들어보세요',
      '기회가 와도 한 번 더 점검하고 움직이는 속도가 오히려 효율적이에요',
      '충동 소비보다 연간 예산·목표 중심의 재정 계획을 세워보세요',
    ],
    investmentStyle: [
      '저축·우량 배당주·장기 ETF 같은 안정 자산을 코어(70%) 이상으로 가져가세요',
      '부동산·REITs 같은 실물 자산과도 궁합이 잘 맞는 편이에요',
      '단기 매매보다 분기·연 단위 리밸런싱으로 손실을 방어하세요',
      '보험·연금 같은 장기 리스크 헷지 상품을 일찍부터 설계해두세요',
    ],
    avoid: [
      '레버리지(신용·미수)를 과하게 쓰는 단기 투자',
      '관리 가능한 범위를 넘는 다중 사업·중개 활동',
      '세금·상속 계획을 미루고 덩치만 키우는 자산 증식',
    ],
  },
  '확장형': {
    headline: '기회를 만들어가는 구조예요 · 재성이 용신/희신 역할',
    strengths: [
      '재물에 대한 갈증이 실행력으로 이어져, 기회를 포착하면 빠르게 움직이는 편이에요',
      '사업·영업·프리랜스처럼 소득 원천을 넓히는 쪽이 잘 맞는 체질이에요',
      '재성 세운이 오면 눈에 띄는 도약을 이루기 좋은 구조예요',
    ],
    cautions: [
      '재성이 약해 꾸준한 자산 관리 습관이 흐트러지기 쉬운 편이에요',
      '기회가 왔을 때 준비가 덜 되어 있으면 놓치기 쉬운 흐름이에요',
      '사람·네트워크에 기대는 구조라, 인연 관리가 곧 재운에 직결돼요',
    ],
    attitude: [
      '평소엔 조용히 준비하고, 기회가 왔을 때는 과감히 움직여보세요',
      '관계·신용을 자산이라 생각하고 인연을 꾸준히 정성껏 챙겨보세요',
      '성공한 선배·친구의 루틴을 벤치마킹해 내 방식으로 소화해보세요',
      '실패도 데이터로 남기는 습관을 만들어두세요',
    ],
    investmentStyle: [
      '성장주·테마주·사업 재투자처럼 업사이드가 큰 자산으로 공격해보세요',
      '부업·사이드 프로젝트·신규 수익 채널을 여러 개 병행해보세요',
      '현금 흐름(cash flow)이 나오는 자산(임대·배당·구독)으로 베이스를 먼저 깔아두세요',
      '재성 세운이 드는 해에는 과감한 실행을 허용할 여유 자금을 따로 확보해두세요',
    ],
    avoid: [
      '준비 없이 큰 돈을 운용하는 일시적 대박 시도',
      '고정 지출을 늘리는 장기 약정·고정비 계약',
      '혼자 감당 어려운 고위험 단기 투자 (레버리지·선물·옵션 등)',
    ],
  },
  '균형형': {
    headline: '중화된 바탕에 재성이 넉넉한 구조예요 · 공수 양면에 자유로움',
    strengths: [
      '일간의 세력이 치우치지 않아, 상황에 따라 유연하게 대응할 수 있는 체질이에요',
      '재성이 받쳐줘서 공격(확장)과 수비(관리)를 자유롭게 오갈 수 있는 구조예요',
      '단기 변동에도 크게 흔들리지 않는 안정감이 있는 편이에요',
    ],
    cautions: [
      '특화된 포인트가 약해 임팩트가 작게 느껴질 수 있는 구조예요',
      '균형을 맞추려다 판단이 늦어지는 때가 있는 편이에요',
      '리스크를 너무 피하면 성장 기회를 놓치기 쉬운 흐름이에요',
    ],
    attitude: [
      '전반적인 균형을 지키되, 분기마다 공격 포인트 하나씩 정해보세요',
      '여러 선택지 앞에서 고민하기보다 정해진 원칙대로 빠르게 결정해보세요',
      '보수·공격 비율을 매년 점검하며 조금씩 조정해보세요',
      '감이 오는 순간은 기록해뒀다가 조건이 맞을 때 실행해보세요',
    ],
    investmentStyle: [
      '안정(코어) 60% + 공격(위성) 40% 하이브리드로 기본 세팅하세요',
      '분기별·반기별 리밸런싱을 엄격하게 지키세요',
      '국내·해외, 주식·채권, 성장·가치 같은 대립 축을 의식적으로 섞어보세요',
      '재성 세운에는 공격 비중을 10~15%P 올려 유연하게 조정해보세요',
    ],
    avoid: [
      '균형이라는 이름으로 결정을 무한정 미루는 습관',
      '모든 자산에 조금씩만 넣어 어느 쪽도 수익이 안 되는 상태',
      '리밸런싱 원칙 없이 감정에 따라 비중을 조정하는 일',
    ],
  },
  '기회형': {
    headline: '중화된 구조지만 재성이 약한 편 · 외부 기회를 잡아내는 게 재운의 핵심이에요',
    strengths: [
      '감정 기복이 적어 기회를 침착하게 판단할 수 있는 구조예요',
      '사람·정보를 잘 엮어내는 감각이 수익 설계에 도움이 되는 편이에요',
      '실수가 적어 장기적으로 신뢰 자산이 쌓이기 좋은 체질이에요',
    ],
    cautions: [
      '먼저 움직이지 않으면 기회가 그냥 지나갈 수 있는 흐름이에요',
      '안전주의가 지나치면 작은 기회까지 놓치기 쉬운 구조예요',
      '재성이 약한 편이라 꾸준한 소득 채널을 만드는 게 핵심이에요',
    ],
    attitude: [
      '때를 기다리되, 와 닿는 순간엔 망설이지 말고 움직여보세요',
      '정보 수집을 일상 루틴으로 만들어보세요',
      '자격·네트워크·평판을 꾸준히 쌓아 기회가 왔을 때 받을 준비를 해보세요',
      '혼자 판단하기 어려운 건 신뢰할 수 있는 사람에게 의견을 구해보세요',
    ],
    investmentStyle: [
      '여유 자금의 60~70%는 예금·단기 채권 같은 방어 자산으로 두세요',
      '정보 기반 스윙 트레이딩·테마주 소액 투자 정도로 공격 비중을 조절하세요',
      '자기계발·자격증·인맥 투자처럼 무형 자산에도 꾸준히 분산해두세요',
      '수익 극대화보다 손실 최소화를 우선 원칙으로 잡으세요',
    ],
    avoid: [
      '기회가 와도 주저하다가 타이밍을 놓치는 패턴',
      '한 번도 안 해본 고위험 투자에 여유 자금 전부를 거는 행동',
      '외부 정보 없이 혼자 판단만 붙들고 있는 고립형 의사결정',
    ],
  },
  '재다신약': {
    headline: '돈은 많이 보이지만, 혼자 감당하기는 버거운 구조예요',
    strengths: [
      '큰 돈이 오가는 환경에 자연스럽게 노출되는 편이에요',
      '재무·금융 흐름을 읽어내는 감각이 발달해 있는 체질이에요',
      '중개·유통처럼 돈을 거쳐가게 하는 일에서 강점이 드러나요',
    ],
    cautions: [
      '직접 운용하기보다는 전문가에게 맡기거나 분산 투자하는 쪽이 안전한 구조예요',
      '대출·보증처럼 타인 돈과 얽히는 관계에서 손실이 생기기 쉬운 흐름이에요',
      '건강이 곧 재물 — 몸을 무리하게 쓰면 재운도 같이 빠지는 체질이에요',
    ],
    attitude: [
      '욕심을 조금 줄이고, 혼자 짊어지기보다 위임하고 나눠 담아보세요',
      '숫자 작업은 위임하되 의사결정 권한은 본인이 쥐어두세요',
      '수면·식사·운동 같은 체력 기반을 돈만큼 챙겨보세요',
      '사적 인간관계와 금전 관계를 분리하는 원칙을 미리 세워두세요',
    ],
    investmentStyle: [
      '분산 ETF·글로벌 인덱스 중심으로, 개별 종목 비중은 20% 이하로 낮추세요',
      '투자 결정은 전문가(재무설계사·세무사)의 2차 리뷰를 거치는 프로세스를 만드세요',
      '비상금을 평소보다 넉넉히(6개월치 이상) 유지하세요',
      '건강·교육 같은 자기 보호성 지출은 아끼지 말고 챙기세요',
    ],
    avoid: [
      '지인·가족 대상 금전 대출이나 연대 보증',
      '큰 돈이 보인다고 무리하게 가져오려는 확장 시도',
      '혼자 판단해 큰 계약을 즉흥적으로 체결하는 행동',
    ],
  },
  '우회축적': {
    headline: '재물보다 지식·전문직으로 우회하며 쌓아가는 구조예요',
    strengths: [
      '인성·식상이 강해 전문성·자격·브랜드가 그대로 소득으로 이어지는 체질이에요',
      '학업·연구·창작 같은 무형 자산이 곧 재물의 뿌리가 되는 구조예요',
      '큰 기복 없이 안정적으로 소득이 쌓이는 흐름이에요',
    ],
    cautions: [
      '직접적인 재성이 약해 큰 재물 기회는 상대적으로 적은 편이에요',
      '지식을 돈으로 바꾸는 채널을 의식적으로 설계하지 않으면 정체되기 쉬워요',
      '단기 투자 성공에 집착하면 오히려 실패 확률이 높아지는 흐름이에요',
    ],
    attitude: [
      '실력을 쌓고, 그 실력을 바탕으로 보수를 받는 구조를 천천히 설계해보세요',
      '자격·학위·저술 같은 무형 자산을 오래 가는 복리로 여겨보세요',
      '내 전문성을 알릴 채널(블로그·뉴스레터·SNS)을 하나씩 키워보세요',
      '수익화 스트레스가 올 땐 한 걸음 물러나 본업부터 탄탄히 다져보세요',
    ],
    investmentStyle: [
      '자기계발·교육·도서·세미나 투자를 먼저 충분히 배분하세요',
      '여유 자금은 보수적인 저축·우량 ETF 같은 저관리 자산으로 두세요',
      '부업·사이드 수익은 본업 전문성의 연장선에서 설계하세요',
      '단기 매매보다 10년 이상 바라보는 장기 분산 투자를 택하세요',
    ],
    avoid: [
      '전문성과 무관한 테마주·단기 트레이딩에 여유 자금 집중 투입',
      '수익화 조급함에 검증 안 된 사업·코인·파생 상품 진입',
      '내 전문 영역을 버리고 유행 따라 경력 방향을 급하게 바꾸는 선택',
    ],
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

// 대운 테마별 노트 풀 — 같은 테마라도 여러 변주로 다양하게
const DAEUN_NOTE_POOLS: Record<string, string[]> = {
  '직장 재물': [
    '재성과 관성이 함께 들어와 직장·지위 기반의 수익이 확장되는 시기.',
    '조직에서 책임이 커지면서 보상도 자연스레 따라오는 구간.',
    '승진·이직·프로젝트 리더십이 곧 재물로 이어지는 흐름.',
    '직책과 실력이 모두 올라가며 고정 수입이 크게 도약하기 좋음.',
  ],
  '재물 확장 편재': [
    '편재가 들어와 사업·투자·유동 자금이 활발히 돌아가는 구간.',
    '새로운 수익 채널을 여러 개 시도하기 좋은 편재 대운.',
    '활동 반경이 넓어지며 기회가 쏟아지듯 열리는 구간. 선택과 집중이 열쇠.',
    '큰 돈이 드나드는 흐름이 강해짐. 관리만 잘하면 크게 도약 가능.',
  ],
  '재물 확장 정재': [
    '정재가 들어와 성실한 노력이 안정 수익으로 결실 맺는 구간.',
    '꾸준한 축적·저축·부동산 운용에 유리한 정재 대운.',
    '한 분야에 집중해 복리로 쌓아가기 최적의 시기.',
    '지루할 수 있지만 장기적으로 체질에 가장 맞는 재물 경로가 열림.',
  ],
  '재물 유출 주의 초입': [
    '겁재 대운 초입 — 충동 지출·보증·공동투자 주의가 특히 강한 시기.',
    '대운이 바뀌며 겁재가 처음 들어와 심리적 흔들림이 크니 보수적 운영을.',
    '초기 5년이 고비. 큰 결정 전 한 번 더 검토하는 습관이 안전망.',
  ],
  '재물 유출 주의': [
    '겁재가 들어와 지출·경쟁이 늘어나는 구간. 보수적 재정 운영이 안전.',
    '남과 얽히는 금전 관계에서 손실이 발생하기 쉬운 대운.',
    '동업·보증·공동 투자는 특히 신중히. 단독 판단을 우선.',
    '수입은 있어도 빠져나가는 구멍이 보이니 가계부 점검이 중요.',
  ],
  '경쟁·분재': [
    '비견이 들어와 동료·경쟁자와 얽히는 구간. 독자 판단이 유리.',
    '같은 길을 걷는 사람들과 겹치는 시기. 차별화가 재운을 가름.',
    '협력 기회와 경쟁 갈등이 섞이는 구간. 관계 설계가 핵심.',
    '내 자리·내 몫을 지키는 의식적 노력이 필요한 대운.',
  ],
  '직장·책임 편관': [
    '편관이 들어와 도전적 직무·책임이 커지는 구간. 스트레스와 성장이 공존.',
    '압박 속에서 역량이 빠르게 크는 편관 대운. 버티면 평가가 따라옴.',
    '큰 프로젝트·위기 대응 같은 고강도 업무가 주어지는 시기.',
  ],
  '직장·책임 정관': [
    '정관이 들어와 안정된 직위·공식 인정이 커지는 구간.',
    '조직 내 질서와 명예가 동시에 올라가는 정관 대운. 승진에 유리.',
    '공적인 자리·대외 활동이 늘며 평판 자산이 축적되는 시기.',
  ],
  '전문성 기반 정인': [
    '정인이 들어와 학습·자격·정통 지식이 재물의 뿌리가 되는 구간.',
    '멘토·상급자의 지원이 커지는 정인 대운. 배움에 집중하기 좋음.',
    '학위·자격증·정규 교육이 큰 성과로 이어지는 시기.',
  ],
  '전문성 기반 편인': [
    '편인이 들어와 독창적 시각·비정통 전문성이 힘을 발휘하는 구간.',
    '비주류·틈새 분야의 지식이 수익이 되는 편인 대운.',
    '직관과 영감으로 새로운 영역을 개척하기 좋은 시기.',
  ],
  '재물 생산 식신': [
    '식신이 들어와 여유·취미·표현이 자연스럽게 수익으로 이어지는 구간.',
    '음식·콘텐츠·서비스 분야에서 꾸준한 수익이 만들어지는 식신 대운.',
    '즐기는 일이 곧 돈이 되는, 편안한 생산성의 시기.',
  ],
  '재물 생산 상관': [
    '상관이 들어와 재능·창의력이 폭발적으로 드러나는 구간.',
    '표현력·퍼스널 브랜드가 곧 수익이 되는 상관 대운.',
    '콘텐츠·강연·프리랜스 같은 무형 자산이 크게 성장하는 시기.',
  ],
  '안정 유지': [
    '별다른 큰 변수 없이 기존 흐름이 이어지는 안정 구간.',
    '내실을 다지기 좋은 조용한 대운. 큰 확장보다 체질 관리 시기.',
    '눈에 띄는 도약은 적지만 기반이 단단해지는 시기.',
  ],
};

// 결정론적 variant 선택 (간지+나이 해시)
function pickNoteVariant(pool: string[], age: number, ganjiHanja: string): string {
  if (!pool || pool.length === 0) return '';
  let seed = age;
  for (let i = 0; i < ganjiHanja.length; i++) seed = seed * 31 + ganjiHanja.charCodeAt(i);
  return pool[Math.abs(seed) % pool.length];
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
    let poolKey = '안정 유지';

    const hasPyeonJae = bothSS.includes('편재');
    const hasJeongJae = bothSS.includes('정재');
    const hasChaeseong = hasPyeonJae || hasJeongJae;
    const hasGeobjae = bothSS.includes('겁재');
    const hasBigyeon = bothSS.includes('비견');
    const hasPyeonGwan = bothSS.includes('편관');
    const hasJeongGwan = bothSS.includes('정관');
    const hasGwansung = hasPyeonGwan || hasJeongGwan;
    const hasPyeonIn = bothSS.includes('편인');
    const hasJeongIn = bothSS.includes('정인');
    const hasInsung = hasPyeonIn || hasJeongIn;
    const hasSikshin = bothSS.includes('식신');
    const hasSanggwan = bothSS.includes('상관');
    const hasSiksang = hasSikshin || hasSanggwan;

    if (hasChaeseong && hasGwansung) {
      theme = '직장 재물';
      rating = 'strong';
      poolKey = '직장 재물';
    } else if (hasPyeonJae) {
      theme = '재물 확장';
      rating = 'strong';
      poolKey = '재물 확장 편재';
    } else if (hasJeongJae) {
      theme = '재물 확장';
      rating = 'strong';
      poolKey = '재물 확장 정재';
    } else if (hasGeobjae) {
      theme = '재물 유출 주의';
      rating = 'caution';
      poolKey = i === 0 ? '재물 유출 주의 초입' : '재물 유출 주의';
    } else if (hasBigyeon) {
      theme = '경쟁·분재';
      rating = 'mixed';
      poolKey = '경쟁·분재';
    } else if (hasPyeonGwan) {
      theme = '직장·책임';
      rating = 'mixed';
      poolKey = '직장·책임 편관';
    } else if (hasJeongGwan) {
      theme = '직장·책임';
      rating = 'mixed';
      poolKey = '직장·책임 정관';
    } else if (hasJeongIn) {
      theme = '전문성 기반';
      rating = 'mixed';
      poolKey = '전문성 기반 정인';
    } else if (hasPyeonIn) {
      theme = '전문성 기반';
      rating = 'mixed';
      poolKey = '전문성 기반 편인';
    } else if (hasSikshin) {
      theme = '재물 생산';
      rating = 'strong';
      poolKey = '재물 생산 식신';
    } else if (hasSanggwan) {
      theme = '재물 생산';
      rating = 'strong';
      poolKey = '재물 생산 상관';
    }

    const ganjiHanja = `${d.c}${d.j}`;
    const note = pickNoteVariant(DAEUN_NOTE_POOLS[poolKey] || [], d.age, ganjiHanja);

    return {
      age: d.age,
      ganji: `${d.ck}${d.jk}`,
      ganjiHanja,
      theme,
      rating,
      note,
    };
  });
}
