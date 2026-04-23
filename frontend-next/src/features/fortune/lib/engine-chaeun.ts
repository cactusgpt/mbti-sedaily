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
      '본업과 부수입을 함께 챙기는 체력이 받쳐줘요',
    ],
    cautions: [
      '과도한 확장은 오히려 피로가 쌓이기 쉬워요',
      '공격적인 단기 투자는 들이는 노력에 비해 효율이 낮은 편이에요',
      '세금·상속처럼 보이지 않는 유출 구멍은 한 번쯤 점검해보시면 좋아요',
    ],
    attitude: [
      '당장의 큰 수익보다 복리로 천천히 불어나는 흐름을 신뢰해보세요',
      '수입·지출·투자 규칙을 문서로 정리해 루틴으로 만드시면 잘 맞아요',
      '기회가 와도 한 번 더 점검하고 움직이는 속도가 오히려 효율적이에요',
      '충동 소비보다 연간 예산·목표 중심의 재정 계획이 어울려요',
    ],
    investmentStyle: [
      '저축·우량 배당주·장기 ETF 같은 안정 자산을 코어(70%) 이상으로',
      '부동산·REITs 같은 실물 자산과도 궁합이 잘 맞는 편이에요',
      '단기 매매보다 분기·연 단위 리밸런싱이 손실 방어에 유리해요',
      '보험·연금 같은 장기 리스크 헷지 상품도 일찍부터 설계해두시면 좋아요',
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
      '사업·영업·프리랜스처럼 소득 원천을 넓히는 쪽이 잘 맞아요',
      '재성 세운이 오면 눈에 띄는 도약을 이루기 좋아요',
    ],
    cautions: [
      '재성이 약해 꾸준한 자산 관리 습관이 흐트러지기 쉬운 편이에요',
      '기회가 왔을 때 준비가 덜 되어 있으면 놓치기 쉬워요',
      '사람·네트워크에 기대는 구조라, 평소 인연 관리가 중요해요',
    ],
    attitude: [
      '평소엔 조용히 준비하고, 기회가 왔을 때는 과감히 움직여보세요',
      '관계·신용을 자산이라 생각하고 꾸준히 인연을 정성껏 챙기면 좋아요',
      '성공한 친구·선배의 루틴을 벤치마킹해 내 방식으로 소화해보시면 도움이 돼요',
      '실패도 데이터로 남기는 습관이 다음 기회에서 진가를 발휘해요',
    ],
    investmentStyle: [
      '성장주·테마주·사업 재투자처럼 업사이드가 큰 자산이 어울려요',
      '부업·사이드 프로젝트·신규 수익 채널을 여러 개 병행하는 방식이 잘 맞아요',
      '현금 흐름(cash flow)이 생기는 자산(임대·배당·구독)으로 베이스를 먼저 까세요',
      '재성 세운이 드는 해에는 과감한 실행을 허용할 여유 자금을 따로 둬보세요',
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
      '일간의 세력이 치우치지 않아, 상황에 따라 유연하게 대응할 수 있어요',
      '재성이 받쳐줘서 공격(확장)과 수비(관리)를 자유롭게 오갈 수 있어요',
      '단기 변동에도 크게 흔들리지 않는 안정감이 있어요',
    ],
    cautions: [
      '특화된 포인트가 약해 임팩트가 작게 느껴질 수 있어, 선택과 집중이 가끔 필요해요',
      '균형을 맞추려다 판단이 늦어지는 때가 있어요',
      '리스크를 너무 피하면 성장 기회를 놓치기도 해요',
    ],
    attitude: [
      '전반적인 균형을 지키되, 분기마다 공격 포인트 하나쯤 정해 두시면 좋아요',
      '여러 선택지 앞에서 지나치게 고민하기보다 정해진 원칙에 따라 빠르게 결정해보세요',
      '보수·공격의 비율을 매년 점검하며 조금씩 조정하는 리듬이 어울려요',
      '감이 오는 순간엔 기록해뒀다가 조건이 맞을 때 실행하는 습관이 강점이에요',
    ],
    investmentStyle: [
      '안정(코어) 60% + 공격(위성) 40% 하이브리드가 기본 세팅이 잘 맞아요',
      '분기별·반기별 리밸런싱을 엄격하게 지키는 것만으로도 꽤 좋은 성과가 나요',
      '국내·해외, 주식·채권, 성장·가치 같은 대립 축을 의식적으로 섞어보세요',
      '재성 세운에는 공격 비중을 10~15%P 올리는 정도의 유연한 조정이 자연스러워요',
    ],
    avoid: [
      '균형이라는 이름으로 결정을 무한정 미루는 습관',
      '모든 자산에 조금씩만 넣어 어느 쪽도 의미 있는 수익이 없는 상태',
      '리밸런싱 원칙 없이 감정에 따라 비중을 조정하는 일',
    ],
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
    attitude: [
      '때를 기다리되, 와 닿는 순간엔 망설임 없이 움직여보세요',
      '정보 수집을 일상 루틴으로 만드시면 작은 기회도 놓치지 않게 돼요',
      '자격·네트워크·평판을 꾸준히 쌓아 기회가 왔을 때 받을 준비를 해두세요',
      '혼자 판단하기 어려운 건 신뢰할 수 있는 사람에게 의견을 구해보세요',
    ],
    investmentStyle: [
      '여유 자금의 60~70%는 예금·단기 채권 같은 방어 자산으로 두시면 안정적이에요',
      '정보를 바탕으로 한 스윙 트레이딩·테마주 소액 투자 정도가 어울려요',
      '자기계발·자격증·인맥 투자처럼 무형 자산 쪽에도 꾸준히 분산해두세요',
      '수익 극대화보다 손실 최소화를 우선 원칙으로 잡으시면 체질에 맞아요',
    ],
    avoid: [
      '기회가 와도 주저하다가 타이밍을 완전히 놓쳐버리는 패턴',
      '한 번도 안 해본 고위험 투자에 여유 자금 전부를 거는 행동',
      '외부 정보 없이 혼자 판단만 붙들고 있는 고립형 의사결정',
    ],
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
    attitude: [
      '욕심을 조금 줄이고, 혼자 짊어지기보다 위임하고 나눠 담아보세요',
      '숫자를 다루는 일을 위임하면서도 의사결정 권한은 본인이 쥐는 구조가 좋아요',
      '수면·식사·운동 같은 체력 기반을 돈만큼 신경 써서 관리해주세요',
      '사적 인간관계와 금전 관계를 분리하는 원칙을 미리 세워두시면 편해요',
    ],
    investmentStyle: [
      '분산 ETF·글로벌 인덱스 중심으로, 개별 종목 비중은 20% 이하로 낮추세요',
      '투자 결정은 전문가(재무설계사·세무사)의 2차 리뷰를 거치는 프로세스를 만드세요',
      '비상금을 평소보다 넉넉하게(6개월치 이상) 유지하면 심리적 안정감이 좋아져요',
      '건강·교육 같은 자기 보호성 지출에는 아끼지 않는 편이 장기 관점에 유리해요',
    ],
    avoid: [
      '지인·가족 대상 금전 대출이나 연대 보증 서는 일',
      '큰 돈이 보인다고 무리하게 가져오려는 확장 시도 (체력 고갈 위험)',
      '혼자 판단해 큰 계약을 즉흥적으로 체결하는 행동',
    ],
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
    attitude: [
      '실력을 쌓고, 그 실력을 바탕으로 보수를 받는 구조를 천천히 설계해가세요',
      '자격·학위·저술 같은 무형 자산이 오래 가는 복리라고 생각하시면 좋아요',
      '내 전문성을 알릴 채널(블로그·뉴스레터·SNS)을 하나씩 키워보세요',
      '수익화 스트레스가 오면 한 걸음 물러나 본업부터 탄탄히 다지는 게 좋아요',
    ],
    investmentStyle: [
      '자기계발·교육·도서·세미나 투자를 먼저 충분히 배분하세요',
      '여유 자금은 보수적인 저축·우량 ETF 같은 저관리 자산으로 두시는 게 편해요',
      '부업·사이드 수익은 본업 전문성의 연장선에서 설계하면 상승 작용이 커요',
      '단기 매매보다 10년 이상 바라보는 장기 분산 투자가 체질에 맞아요',
    ],
    avoid: [
      '전문성과 무관한 테마주·단기 트레이딩에 여유 자금을 집중하는 일',
      '수익화 조급함에 검증 안 된 사업·코인·파생 상품으로 뛰어드는 행동',
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
