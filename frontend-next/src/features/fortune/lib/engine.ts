/**
 * 사주 해석 엔진 — 데이터 + 순수 계산 로직
 * DOM 의존 없음
 */
import { calculateSaju, getGapja, getSolarTermsByYear } from '@fullstackfamily/manseryeok';

// ── 매핑 데이터 ──
export const CG_OH: Record<string, string> = {'甲':'목','乙':'목','丙':'화','丁':'화','戊':'토','己':'토','庚':'금','辛':'금','壬':'수','癸':'수'};
export const JJ_OH: Record<string, string> = {'子':'수','丑':'토','寅':'목','卯':'목','辰':'토','巳':'화','午':'화','未':'토','申':'금','酉':'금','戌':'토','亥':'수'};
const H2C: Record<string, string> = {'갑':'甲','을':'乙','병':'丙','정':'丁','무':'戊','기':'己','경':'庚','신':'辛','임':'壬','계':'癸'};
const H2J: Record<string, string> = {'자':'子','축':'丑','인':'寅','묘':'卯','진':'辰','사':'巳','오':'午','미':'未','신':'申','유':'酉','술':'戌','해':'亥'};
export const OH_HJ: Record<string, string> = {'목':'木','화':'火','토':'土','금':'金','수':'水'};
const OI: Record<string, number> = {'목':0,'화':1,'토':2,'금':3,'수':4};
export const JJG: Record<string, string[]> = {
  '子':['癸'],'丑':['癸','辛','己'],'寅':['戊','丙','甲'],'卯':['乙'],
  '辰':['乙','癸','戊'],'巳':['戊','庚','丙'],'午':['丙','己','丁'],'未':['丁','乙','己'],
  '申':['戊','壬','庚'],'酉':['辛'],'戌':['辛','丁','戊'],'亥':['戊','甲','壬'],
};
const UN = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'];
// 12운성 포태법: 각 천간의 장생(長生) 위치 (지지 인덱스 기준)
// 양간(甲丙戊庚壬)은 순행, 음간(乙丁己辛癸)은 역행
// 戊·己는 火土同宮論에 따라 丙·丁과 동일 적용
const US: Record<string, number> = {
  '甲': 11, // 亥
  '乙': 6,  // 午
  '丙': 2,  // 寅
  '丁': 9,  // 酉
  '戊': 2,  // 寅 (火土同宮)
  '己': 9,  // 酉 (火土同宮)
  '庚': 5,  // 巳
  '辛': 0,  // 子
  '壬': 8,  // 申
  '癸': 3,  // 卯
};
const JO = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const JI: Record<string, number> = {}; JO.forEach((j,i)=>JI[j]=i);

// 60갑자
const CG10 = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JJ12 = JO;
const CG10K = ['갑','을','병','정','무','기','경','신','임','계'];
const JJ12K = ['자','축','인','묘','진','사','오','미','신','유','술','해'];

export interface GapjaEntry { c: string; j: string; ck: string; jk: string; }
const G60: GapjaEntry[] = [];
for (let i=0;i<60;i++) G60.push({ c:CG10[i%10], j:JJ12[i%12], ck:CG10K[i%10], jk:JJ12K[i%12] });
function g60idx(c: string, j: string) { return G60.findIndex(g=>g.c===c&&g.j===j); }

// ── 기본 계산 함수 ──
export { calculateSaju, getGapja };

export function elClass(oh: string) { return oh ? `el-${oh}` : ''; }

export function unsung(c: string, j: string): string {
  if(!c||!j) return '';
  const s=US[c]; if(s===undefined) return '';
  const y=['甲','丙','戊','庚','壬'].includes(c);
  const o = y ? (JI[j]-s+12)%12 : (s-JI[j]+12)%12;
  return UN[o];
}

const SSN=[['비견','겁재'],['식신','상관'],['편재','정재'],['편관','정관'],['편인','정인']];
export function sipsung(i: string, t: string): string {
  if(!i||!t) return '';
  const m=OI[CG_OH[i]], x=OI[CG_OH[t]||JJ_OH[t]];
  if(m===undefined||x===undefined) return '';
  const d=(x-m+5)%5;
  const mY=['乙','丁','己','辛','癸'].includes(i);
  const tY=['乙','丁','己','辛','癸','丑','卯','巳','未','酉','亥'].includes(t);
  return SSN[d][mY===tY?0:1];
}

export interface Pillar { c: string; j: string; ck: string; jk: string; co: string; jo: string; }

export function parsePillar(hg: string, hj: string): Pillar {
  let c='',j='',ck='',jk='';
  if(hj?.length===2){c=hj[0];j=hj[1];}
  if(hg?.length===2){ck=hg[0];jk=hg[1];if(!c)c=H2C[ck]||'';if(!j)j=H2J[jk]||'';}
  return {c,j,ck,jk,co:CG_OH[c]||'',jo:JJ_OH[j]||''};
}

// ── JSON DB import ──
import cheonganDB from './cheongan_db.json';
import jijiDB from './jiji_db.json';

// ── 총운 (JSON DB 기반) ──
const CHEONGAN = cheonganDB.CHEONGAN as Record<string, { 한글: string; 음양: string; 오행: string; 상징: string; 성향: string; 키워드: string[] }>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ILGAN_DETAIL = cheonganDB.ILGAN_DETAIL as Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const JIJI = jijiDB.JIJI as Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ILJI_DETAIL = jijiDB.ILJI_DETAIL as Record<string, any>;

const WOLJI_SEASON: Record<string, { 계절: string; 기운: string }> = {};
const WOLJI_MAP: Record<string, { branch: string; season: string }> = {
  '寅': { branch: '寅', season: '봄(초춘)' }, '卯': { branch: '卯', season: '봄(중춘)' }, '辰': { branch: '辰', season: '봄(늦봄)' },
  '巳': { branch: '巳', season: '여름(초하)' }, '午': { branch: '午', season: '여름(한여름)' }, '未': { branch: '未', season: '여름(늦여름)' },
  '申': { branch: '申', season: '가을(초추)' }, '酉': { branch: '酉', season: '가을(한가을)' }, '戌': { branch: '戌', season: '가을(늦가을)' },
  '亥': { branch: '亥', season: '겨울(초동)' }, '子': { branch: '子', season: '겨울(한겨울)' }, '丑': { branch: '丑', season: '겨울(늦겨울)' },
};
for (const [key, val] of Object.entries(WOLJI_MAP)) {
  const jiji = JIJI[val.branch];
  WOLJI_SEASON[key] = { 계절: val.season, 기운: jiji ? `${jiji.상징}의 시기입니다. ${jiji.성향.split('.')[0]}.` : '' };
}

function getSeasonRelation(ilganOh: string, woljiOh: string): string {
  if (ilganOh === woljiOh) return '비화(比和) 관계로, 자기 계절을 만나 기운이 왕성합니다. 본래 기질이 강하게 발현되며 자신감이 넘칩니다.';
  const diff = (OI[woljiOh] - OI[ilganOh] + 5) % 5;
  if (diff === 1) return '식상(食傷)의 계절로, 자기 표현과 재능 발휘에 유리합니다. 창의력이 발현되고 활동적인 시기입니다.';
  if (diff === 2) return '재성(財星)의 계절로, 재물과 현실적 성과를 거두기 좋습니다. 부지런히 움직이면 결실을 얻습니다.';
  if (diff === 3) return '관성(官星)의 계절로, 규율과 책임이 따르는 시기입니다. 사회적 인정을 받을 수 있으나 압박감도 있습니다.';
  if (diff === 4) return '인성(印星)의 계절로, 학습과 성장에 유리합니다. 귀인의 도움을 받기 쉽고 내적 성숙이 이루어집니다.';
  return '';
}

function getIljuReading(cgH: string, jjH: string): string {
  if (!cgH || !jjH) return '';
  const cgOh = CG_OH[cgH]; const jjOh = JJ_OH[jjH];
  const HJ2HG_CG: Record<string, string> = {'甲':'갑','乙':'을','丙':'병','丁':'정','戊':'무','己':'기','庚':'경','辛':'신','壬':'임','癸':'계'};
  const HJ2HG_JJ: Record<string, string> = {'子':'자','丑':'축','寅':'인','卯':'묘','辰':'진','巳':'사','午':'오','未':'미','申':'신','酉':'유','戌':'술','亥':'해'};
  const diff = (OI[jjOh] - OI[cgOh] + 5) % 5;
  const descs: Record<string, string> = {
    '비겁':'일지에 자신과 같은 기운이 있어 독립심과 자주성이 강합니다. 배우자궁에 비겁이 있으니 동반자와 대등한 관계를 추구하며, 혼자서도 잘 해나가는 자립심이 있습니다.',
    '식상':'일지에 식상이 있어 표현력과 재능이 풍부합니다. 배우자궁에 식상이 있으니 자유로운 관계를 원하며, 창작이나 말로 하는 일에 재능을 보입니다.',
    '재성':'일지에 재성이 있어 현실 감각과 관리 능력이 뛰어납니다. 배우자궁에 재성이 있으니 가정적이고 실속을 중시하며, 재물을 다루는 감각이 좋습니다.',
    '관성':'일지에 관성이 있어 책임감과 자기 통제력이 강합니다. 배우자궁에 관성이 있으니 격식을 중시하고 사회적 체면을 신경 쓰며, 절제력이 있습니다.',
    '인성':'일지에 인성이 있어 학습 능력과 내적 안정감이 있습니다. 배우자궁에 인성이 있으니 배우자나 가까운 사람에게서 정서적 지지를 받으며, 사색적이고 깊이가 있습니다.',
  };
  const rel = ['비겁','식상','재성','관성','인성'][diff];
  let r = `${HJ2HG_CG[cgH]}${cgH}일간이 ${HJ2HG_JJ[jjH]}${jjH} 위에 앉아있는 일주입니다. `;
  return r + (descs[rel]||'');
}

export interface ChongunResult {
  symbol: string; yinyang: string; element: string; nature: string; keywords: string[];
  detail?: { summary: string; behavior: string; social: string; strengths: string[]; weaknesses: string[]; improvement: string; jobs: { field: string; role: string; reason: string }[]; conclusion: string };
  season?: { name: string; desc: string }; seasonRelation?: string; iljuReading?: string;
  iljiDetail?: { summary: string; strengths: string[]; weaknesses: string[]; conclusion: string };
}

export function buildChongun(ps: Pillar[]): ChongunResult | null {
  const ilgan = ps[1].c; const ilji = ps[1].j; const wolji = ps[2].j;
  if (!ilgan) return null;
  const cg = CHEONGAN[ilgan]; if (!cg) return null;
  const ilganOh = CG_OH[ilgan]; const woljiOh = wolji ? JJ_OH[wolji] : null;
  const season = wolji ? WOLJI_SEASON[wolji] : null;

  const result: ChongunResult = {
    symbol: cg.상징, yinyang: cg.음양, element: cg.오행, nature: cg.성향, keywords: cg.키워드,
  };

  // ILGAN_DETAIL 상세 해석
  const detail = ILGAN_DETAIL[ilgan];
  if (detail) {
    result.detail = {
      summary: detail.특성_총평, behavior: detail.표현_행동양식, social: detail.교류방식,
      strengths: detail.강점, weaknesses: detail.약점, improvement: detail.개선방안,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jobs: detail.추천직업.map((j: any) => ({ field: j.분야, role: j.역할, reason: j.이유 })),
      conclusion: typeof detail.종합요약 === 'string' ? detail.종합요약 : `${detail.종합요약?.강점_살리기 || ''} ${detail.종합요약?.약점_보완하기 || ''}`.trim(),
    };
  }

  if (season) {
    result.season = { name: season.계절, desc: season.기운 };
    if (woljiOh) result.seasonRelation = getSeasonRelation(ilganOh, woljiOh);
  }
  if (ilji) {
    result.iljuReading = getIljuReading(ilgan, ilji);
    // ILJI_DETAIL 상세 해석
    const ijd = ILJI_DETAIL[ilji];
    if (ijd) {
      const ijdConclusion = typeof ijd.종합요약 === 'string' ? ijd.종합요약 : `${ijd.종합요약?.강점_살리기 || ''} ${ijd.종합요약?.약점_보완하기 || ''}`.trim();
      result.iljiDetail = { summary: ijd.특성_총평, strengths: ijd.강점, weaknesses: ijd.약점, conclusion: ijdConclusion };
    }
  }
  return result;
}

// ── 오늘의 운세 (신살) ──
const CHEONUL: Record<string, string[]> = {'甲':['丑','未'],'戊':['丑','未'],'乙':['子','申'],'己':['子','申'],'丙':['亥','酉'],'丁':['亥','酉'],'庚':['午','寅'],'辛':['午','寅'],'壬':['巳','卯'],'癸':['巳','卯']};
const MUNCHANG: Record<string, string> = {'甲':'巳','乙':'午','丙':'申','丁':'酉','戊':'申','己':'酉','庚':'亥','辛':'子','壬':'寅','癸':'卯'};
const YEOKMA: Record<string, string> = {'寅':'申','午':'申','戌':'申','申':'寅','子':'寅','辰':'寅','巳':'亥','酉':'亥','丑':'亥','亥':'巳','卯':'巳','未':'巳'};
const DOHWA: Record<string, string> = {'寅':'卯','午':'卯','戌':'卯','申':'酉','子':'酉','辰':'酉','巳':'午','酉':'午','丑':'午','亥':'子','卯':'子','未':'子'};
const HWAGAE: Record<string, string> = {'寅':'戌','午':'戌','戌':'戌','申':'辰','子':'辰','辰':'辰','巳':'丑','酉':'丑','丑':'丑','亥':'未','卯':'未','未':'未'};
const GEOBSAL: Record<string, string> = {'寅':'亥','午':'亥','戌':'亥','申':'巳','子':'巳','辰':'巳','巳':'寅','酉':'寅','丑':'寅','亥':'申','卯':'申','未':'申'};
const JAESAL: Record<string, string> = {'寅':'子','午':'子','戌':'子','申':'午','子':'午','辰':'午','巳':'卯','酉':'卯','丑':'卯','亥':'酉','卯':'酉','未':'酉'};

export interface SinsalInfo { name: string; good: boolean | null; desc: string; }

const SINSAL_DESC: Record<string, { good: boolean | null; desc: string }> = {
  '천을귀인': { good: true, desc: '귀인의 도움이 있는 날입니다. 어려운 일이 있어도 누군가의 도움으로 풀려나갈 수 있으며, 새로운 인연이 좋은 기회로 이어질 수 있습니다.' },
  '문창귀인': { good: true, desc: '학업과 시험에 유리한 날입니다. 문서 작업, 공부, 자격증, 계약서 등 글과 관련된 일이 잘 풀립니다.' },
  '역마살':   { good: null, desc: '이동과 변화의 기운이 강한 날입니다. 출장, 여행, 이사 등 움직임이 생기거나 새로운 소식이 들어올 수 있습니다.' },
  '도화살':   { good: null, desc: '매력이 빛나는 날입니다. 이성 관계나 대인 관계에서 호감을 얻기 쉬우며, 사교 활동에 유리합니다. 다만 감정에 휘둘리지 않도록 주의하세요.' },
  '화개살':   { good: true, desc: '예술적 영감과 영적 감수성이 높아지는 날입니다. 창작, 명상, 독서 등 혼자만의 시간이 유익하며, 깊은 통찰을 얻을 수 있습니다.' },
  '겁살':     { good: false, desc: '예상치 못한 변수가 생길 수 있는 날입니다. 금전 거래나 중요한 결정은 신중하게 하고, 충동적인 행동은 자제하는 것이 좋습니다.' },
  '재살':     { good: false, desc: '작은 실수나 사고에 주의해야 하는 날입니다. 서두르지 말고 차분하게 행동하며, 건강과 안전에 유의하세요.' },
};

const SS_READING: Record<string, string> = {
  '비견':'나와 같은 기운이 작용하는 날입니다. 동료나 친구와의 교류가 활발하고, 경쟁 의식이 강해집니다. 자기 주장이 강해지니 협력에 신경 쓰세요.',
  '겁재':'경쟁과 도전의 기운이 있는 날입니다. 재물 지출이 생길 수 있으니 충동 소비에 주의하고, 승부욕을 긍정적 방향으로 활용하세요.',
  '식신':'여유와 즐거움이 있는 날입니다. 먹을 복이 있고 취미 활동이 잘 풀리며, 창의적 아이디어가 떠오릅니다. 편안한 마음으로 하루를 보내세요.',
  '상관':'표현력이 강해지는 날입니다. 말과 글에 힘이 실리지만, 날카로운 언행으로 갈등이 생길 수 있으니 한 템포 쉬고 말하세요.',
  '편재':'활동적 재물운이 있는 날입니다. 사업이나 투자에 움직임이 생기고, 사교 활동을 통해 기회가 올 수 있습니다.',
  '정재':'안정적인 재물운의 날입니다. 꼼꼼하게 관리하면 작은 이익이 쌓이고, 성실한 노력이 인정받습니다.',
  '편관':'긴장감과 압박이 있는 날입니다. 예상치 못한 업무나 책임이 생길 수 있으나, 잘 대처하면 인정과 성장으로 이어집니다.',
  '정관':'질서와 규율의 기운이 작용하는 날입니다. 공식적인 자리나 업무에서 좋은 성과를 낼 수 있으며, 예의와 격식을 갖추면 좋은 일이 생깁니다.',
  '편인':'직감과 영감이 강해지는 날입니다. 학습이나 연구에 몰입하기 좋고, 평소와 다른 시각에서 문제를 바라보면 해답을 얻습니다.',
  '정인':'안정과 지원의 기운이 있는 날입니다. 학업이나 자기계발에 유리하고, 어른이나 윗사람의 도움을 받을 수 있습니다.',
};

const US_READING: Record<string, string> = {
  '장생':'새로운 시작의 에너지가 있습니다. 계획을 세우고 첫 발을 내딛기 좋은 날입니다.',
  '목욕':'변화와 불안정의 기운입니다. 감정 기복에 주의하고, 중요한 결정은 내일로 미루는 것이 좋습니다.',
  '관대':'자신감이 올라가고 사회 활동이 활발한 날입니다. 적극적으로 나서면 좋은 결과를 얻습니다.',
  '건록':'에너지가 충만한 날입니다. 실력이 잘 발휘되고 성과가 나타나기 좋은 시기입니다.',
  '제왕':'기운이 최고조에 달하는 날입니다. 리더십을 발휘하기 좋으나, 과욕은 금물입니다.',
  '쇠':'기운이 서서히 빠지는 날입니다. 무리하지 말고 체력 안배에 신경 쓰세요.',
  '병':'컨디션이 저하될 수 있습니다. 휴식을 우선하고 건강 관리에 유의하세요.',
  '사':'정체와 막힘의 기운입니다. 억지로 밀어붙이지 말고 때를 기다리는 것이 현명합니다.',
  '묘':'조용히 내면을 돌아보기 좋은 날입니다. 과거를 정리하고 새 방향을 모색하세요.',
  '절':'단절과 전환의 기운입니다. 낡은 것을 버리고 새 출발을 준비하기 좋습니다.',
  '태':'잉태의 기운으로 새로운 가능성이 싹틉니다. 아이디어를 메모해 두세요.',
  '양':'성장을 준비하는 기운입니다. 아직 드러나지 않지만 좋은 흐름이 만들어지고 있습니다.',
};

export interface CategoryFortune { label: string; score: number; desc: string; }

// 십성 + 12운성 기반 카테고리별 운세 산출
const CATEGORY_DATA: Record<string, Record<string, { score: number; desc: string }>> = {
  '재물운': {
    '비견': { score: 50, desc: '같은 분야에 있는 동료나 경쟁자와 부딪치면서 뜻하지 않은 지출이 생길 수 있는 날입니다. 친구나 지인의 부탁으로 돈이 나갈 수 있으니 거절할 때는 확실하게 하고, 공동 투자나 동업보다는 자기만의 판단으로 움직이는 것이 훨씬 유리합니다. 이미 시작한 재테크는 흔들지 말고 꾸준히 유지하세요.' },
    '겁재': { score: 35, desc: '충동적인 소비 욕구가 올라오고 예상치 못한 지출이 발생하기 쉬운 날입니다. 세일이나 광고에 쉽게 흔들리고, 남에게 돈을 빌려주거나 보증을 서는 일이 생기면 손해로 이어질 수 있습니다. 오늘은 큰 금액이 오가는 결정을 미루고, 카드보다 현금을 쓰며 지출 내역을 확인하세요.' },
    '식신': { score: 70, desc: '여유로운 마음에서 자연스럽게 수입이 따라오는 날입니다. 먹고 마시는 데 쓰는 비용이 늘지만 그만큼 만족감이 크고, 취미나 관심사가 수익으로 연결될 가능성도 보입니다. 기분 좋게 쓰되 기본 생활비는 먼저 떼어 두고, 남는 여윳돈으로 즐기는 습관을 유지하면 탈이 없습니다.' },
    '상관': { score: 55, desc: '아이디어나 표현력으로 돈을 벌 수 있는 기회가 열리지만, 말 한마디 실수로 계약이 어긋날 수 있는 날입니다. 계약서·견적서는 숫자와 조건을 한 번 더 확인하고, 메시지나 메일도 보내기 전에 다시 읽어보세요. 감정적으로 흥정하지 말고, 사실 기반으로 협상하면 좋은 결과가 나옵니다.' },
    '편재': { score: 85, desc: '투자·사업·부업 등 활동적인 재물의 흐름이 강해지는 날입니다. 새로운 수익원이 눈에 들어오고 사교 자리에서 좋은 기회가 연결될 수 있으니 적극적으로 움직여보세요. 다만 한 번에 큰돈을 움직이는 것은 위험하니, 감당 가능한 범위 내에서 분산해 접근하는 것이 현명합니다.' },
    '정재': { score: 80, desc: '꾸준히 쌓아온 노력이 숫자로 돌아오는 안정적인 날입니다. 월급·이자·렌트 수입 같은 정기 수입이 원활하고, 저축이나 장기 재테크에 하나를 더 얹기 좋은 타이밍입니다. 가계부를 정리하고 불필요한 자동결제를 점검하면, 작은 절약이 큰 자산으로 이어지는 것을 체감할 수 있습니다.' },
    '편관': { score: 45, desc: '예상 밖의 비용이 갑자기 튀어나올 수 있는 날입니다. 세금, 벌금, 수리비, 의료비 등 의무적 지출이 발생할 가능성이 있으니 비상금을 미리 점검해 두세요. 이럴 때일수록 할부나 대출 같은 부채성 결정은 미루고, 당장 처리해야 할 비용에만 집중하는 것이 좋습니다.' },
    '정관': { score: 60, desc: '규칙적이고 투명한 재정 관리가 빛을 발하는 날입니다. 회사나 공공 경로를 통한 수입, 계약서 기반의 거래가 안정적으로 진행되며, 공식적인 절차를 거친 돈의 흐름이 좋은 결과를 가져옵니다. 연말정산·세금·공제 관련 서류가 있다면 오늘 챙기면 향후 이익이 커집니다.' },
    '편인': { score: 55, desc: '직관이 날카로워져 평소 보이지 않던 투자 포인트가 눈에 들어올 수 있는 날입니다. 다만 근거 없이 감만으로 큰돈을 움직이면 손실로 돌아올 수 있으니, 데이터나 전문가 의견으로 한 번 더 검증하세요. 새로운 분야의 정보를 공부하기에 적합한 타이밍입니다.' },
    '정인': { score: 65, desc: '윗사람이나 부모, 스승으로부터 재정적 도움이나 조언을 받기 좋은 날입니다. 교육·자격증·책 등 지식에 쓰는 돈은 장기적으로 이자가 붙어 돌아올 가능성이 높으니 아끼지 마세요. 금융 상품도 전통적이고 검증된 것 위주로 접근하면 안정적입니다.' },
  },
  '건강운': {
    '비견': { score: 65, desc: '체력은 평소보다 좋은 편이지만, 경쟁심이나 승부욕 때문에 무리하기 쉬운 날입니다. 운동을 할 때 남과 비교해 강도를 올리기보다 본인 페이스를 지키고, 하루 중 물 섭취량을 충분히 채우세요. 어깨·허리 긴장이 쌓일 수 있으니 한두 시간마다 스트레칭을 해주면 좋습니다.' },
    '겁재': { score: 45, desc: '스트레스가 몸으로 나타날 수 있는 날입니다. 두통, 소화 불량, 장 트러블 같은 증상이 올 수 있으니 과음·과식을 피하고 자극적인 음식을 줄이세요. 짜증과 조급함이 수면의 질을 떨어뜨릴 수 있으므로, 자기 전 1시간은 스마트폰을 멀리하고 조명을 낮추는 습관을 추천합니다.' },
    '식신': { score: 85, desc: '전반적으로 컨디션이 좋고 식욕과 소화력도 원활한 날입니다. 좋아하는 사람과 함께하는 건강한 식사가 기분을 더욱 끌어올려 주고, 가벼운 산책이나 요가처럼 무리 없는 활동으로 몸을 풀어주면 최상의 하루가 됩니다. 평소 미뤄둔 건강검진을 예약하기에도 좋은 날입니다.' },
    '상관': { score: 50, desc: '신경이 예민해져 불면, 두통, 목·어깨 결림이 올 수 있는 날입니다. 말을 많이 하는 자리에서 에너지 소모가 크니 중간중간 조용한 시간을 확보해 주세요. 카페인 섭취는 오전까지만, 저녁엔 따뜻한 차와 가벼운 산책으로 자율신경을 안정시키는 것이 도움이 됩니다.' },
    '편재': { score: 70, desc: '활동량이 많아지는 날로 야외 활동이나 운동에 적합합니다. 걷기·등산·자전거 같은 유산소 운동으로 에너지를 발산하면 기분도 함께 맑아지고, 새로운 장소를 방문해 환경을 바꾸는 것도 활력을 줍니다. 다만 바깥 활동이 많은 만큼 수분 섭취와 자외선 차단에 신경 쓰세요.' },
    '정재': { score: 75, desc: '규칙적인 생활 리듬이 그대로 건강으로 이어지는 날입니다. 식사·수면 시간을 정해두고 가벼운 스트레칭이나 홈트를 꾸준히 하면 몸이 한결 가벼워집니다. 평소 챙기던 영양제나 운동 루틴을 오늘 확실하게 지키면, 작은 습관이 큰 효과로 돌아옵니다.' },
    '편관': { score: 40, desc: '긴장과 압박으로 몸이 경직되기 쉬운 날입니다. 뒷목, 어깨, 허리가 뭉치고 혈압이 오를 수 있으니 의식적으로 호흡을 깊게 하고 쉬는 시간을 자주 가지세요. 명상 앱이나 반신욕, 가벼운 폼롤러 마사지가 긴장 해소에 도움되며, 저녁 일정은 가능한 한 비워두는 것이 좋습니다.' },
    '정관': { score: 60, desc: '절제된 생활이 건강의 비결이 되는 날입니다. 정해진 시간에 식사하고 일찍 잠자리에 드는 것만으로도 컨디션이 안정적으로 유지됩니다. 규칙적 운동이 효과를 내기 시작하는 시점이니, 너무 무리하지 말고 일정한 강도로 꾸준히 해주는 것이 중요합니다.' },
    '편인': { score: 55, desc: '정신적 피로가 몸의 피로보다 크게 느껴질 수 있는 날입니다. 생각이 많아져 눈의 피로, 두통, 소화 불량이 겹쳐 올 수 있으니 스크린 타임을 줄이고, 조용한 공간에서 명상이나 호흡 연습을 해보세요. 혼자만의 사색 시간이 오히려 에너지를 충전해 줍니다.' },
    '정인': { score: 70, desc: '심신이 안정되고 회복력이 좋아지는 날입니다. 충분한 수면과 균형 잡힌 식사로 몸을 돌보면 그동안 쌓였던 피로가 풀리는 것이 느껴집니다. 책을 읽거나 따뜻한 음료를 마시며 조용히 시간을 보내는 것만으로도 자율신경이 안정되어 깊은 회복이 일어납니다.' },
  },
  '연애운': {
    '비견': { score: 45, desc: '상대와 주도권 다툼이 생기기 쉬운 날입니다. 서로 고집을 내세우면 작은 일이 크게 번질 수 있으니, 오늘은 한 발 물러서 상대의 입장을 먼저 들어주세요. 이미 틀어진 관계라면 즉답을 피하고 시간을 두는 편이 좋고, 새 인연은 경쟁자가 있을 가능성이 있으니 신중히 접근하세요.' },
    '겁재': { score: 35, desc: '연인 사이에 질투와 의심이 고개를 드는 날입니다. 상대의 사소한 행동이 크게 보일 수 있으니 감정적으로 반응하기 전 사실부터 확인하세요. 과거 일을 꺼내 싸움으로 번지기 쉬우니 오늘만큼은 과거 이야기를 미루고, 밝은 주제로 대화하는 것이 관계를 지키는 방법입니다.' },
    '식신': { score: 80, desc: '편안하고 즐거운 데이트가 어울리는 날입니다. 맛집에 가거나 함께 요리를 해보는 것만으로도 행복이 배가 되고, 가벼운 대화와 웃음이 자연스럽게 이어집니다. 솔로라면 취미 모임이나 일상 속 공간에서 호감 가는 사람과 편하게 대화를 틀 수 있는 좋은 기회가 생깁니다.' },
    '상관': { score: 50, desc: '감정 표현이 풍부해지는 날이지만, 너무 직설적이거나 비판적으로 말하면 상대에게 상처가 될 수 있습니다. 할 말이 있다면 "네가 잘못했다"가 아니라 "나는 이렇게 느꼈어" 방식으로 전달해 보세요. 감정의 기복이 크니 중요한 통보나 이별 결정은 내일로 미루는 것이 현명합니다.' },
    '편재': { score: 75, desc: '새로운 만남의 기회가 열리는 날입니다. 사교 모임, 동호회, 지인 소개 등 평소와 다른 자리에서 매력적인 인연을 만날 수 있으니 초대받은 자리에 적극적으로 나가 보세요. 연인이 있다면 평소와 다른 데이트 장소나 분위기를 시도해 권태기를 날려버리기 좋은 날입니다.' },
    '정재': { score: 70, desc: '진심과 정성이 통하는 날입니다. 화려한 이벤트보다 손편지, 도시락, 작은 선물처럼 꾸준한 마음이 드러나는 표현이 더 큰 감동을 줍니다. 이미 오래된 연인 사이라면 오늘의 작은 실천이 신뢰를 한 단계 더 끌어올리고, 앞으로의 관계 방향에 긍정적인 영향을 미칩니다.' },
    '편관': { score: 40, desc: '관계에서 부담이나 압박을 느낄 수 있는 날입니다. 상대가 원하는 만큼 응해주지 못해 미안한 마음이 들거나, 반대로 상대의 요구가 무겁게 느껴질 수 있습니다. 오늘은 서로의 공간을 인정하는 것이 오히려 관계를 깊게 만드는 길이니, 거리감을 죄책감 없이 유지해 보세요.' },
    '정관': { score: 60, desc: '격식을 갖춘 만남, 진지한 대화가 잘 어울리는 날입니다. 상견례, 가족 모임, 미래를 논의하는 진중한 자리라면 좋은 인상을 남기기 쉽습니다. 오늘 한 약속이나 다짐은 쉽게 무너지지 않으니, 중요한 결정이 있다면 신중하게 말하되 확실하게 정리하는 편이 좋습니다.' },
    '편인': { score: 55, desc: '상대방의 내면을 깊이 이해하게 되는 특별한 날입니다. 조용한 카페, 산책길, 별을 보는 곳처럼 차분한 분위기에서 둘만의 대화가 예상보다 깊어질 수 있습니다. 겉으로 드러나지 않던 상대의 아픔이나 꿈을 알게 될 수 있으니, 판단하기보다 들어주는 자세가 관계를 성장시킵니다.' },
    '정인': { score: 65, desc: '따뜻한 감정이 자연스럽게 흐르는 날입니다. 연인과 가족 같은 편안함이 느껴지고, 함께 있는 것만으로 안정감이 커집니다. 상대의 부모나 가까운 지인을 만나 인사하기에도 좋은 타이밍이며, 상대에게 무언가를 배우거나 반대로 가르쳐주는 경험도 관계를 돈독하게 만듭니다.' },
  },
  '직장운': {
    '비견': { score: 55, desc: '동료와 협업하며 역할을 나눠 일하기 좋은 날입니다. 각자 잘하는 영역을 명확히 하면 시너지가 나지만, 영역이 겹치면 갈등으로 이어지기 쉬우니 오늘 중 R&R을 다시 정리해 두세요. 경쟁 상대에게 정보를 너무 많이 공유하지 말고, 자기 성과는 스스로 드러내는 것이 중요합니다.' },
    '겁재': { score: 40, desc: '직장 내 경쟁이 심해지고, 믿었던 사람에게서 섭섭함을 느낄 수 있는 날입니다. 뒷말이나 정치적 분위기에 휘말리지 말고, 가시적인 결과물로 승부하는 것이 최선입니다. 공을 뺏기지 않도록 메일·문서에 본인 기여를 명확히 남기고, 경솔한 발언은 한 템포 쉬고 꺼내세요.' },
    '식신': { score: 75, desc: '창의적 아이디어와 여유로운 태도가 인정받는 날입니다. 브레인스토밍 미팅에서 좋은 발상이 떠오르고, 부드러운 분위기 속에서 팀 분위기도 한결 가벼워집니다. 마감에 쫓기기보다 여유를 갖고 접근할수록 질이 높아지니, 완벽보다 흐름을 타는 전략을 추천합니다.' },
    '상관': { score: 45, desc: '상사나 동료에게 날카로운 말이 튀어나올 수 있는 날입니다. 맞는 말이라도 표현이 공격적이면 반감을 사기 쉬우니, 비판은 대안과 함께 묶어서 말하세요. 회의에서 자기 주장을 내세우기보단 먼저 질문으로 상대의 생각을 끌어내는 방식이 장기적으로 더 좋은 평가를 얻습니다.' },
    '편재': { score: 70, desc: '영업·마케팅·대외 활동에서 성과가 나기 좋은 날입니다. 외부 미팅, 네트워킹 이벤트, 거래처 방문 등 사람을 만나는 일정이 생산적이며, 새 프로젝트의 기회도 이 자리에서 연결될 가능성이 높습니다. 오후엔 명함 정리와 CRM 업데이트로 오늘의 인연을 자산으로 남겨 두세요.' },
    '정재': { score: 75, desc: '꼼꼼한 실무 처리가 빛나는 날입니다. 보고서·기획안·숫자 작업에 집중하면 좋은 평가가 따라오고, 상사의 디테일한 피드백도 긍정적으로 돌아옵니다. 오늘 정리한 문서는 향후 기준 문서로 자리 잡을 가능성이 있으니 포맷과 네이밍도 나중을 생각해 꼼꼼히 다듬어 두세요.' },
    '편관': { score: 50, desc: '갑작스러운 업무 변동이나 상사의 긴급 지시가 날아올 수 있는 날입니다. 당황하지 말고 우선순위를 즉시 재정렬하고, 처리하지 못한 일은 솔직하게 커뮤니케이션해 기한을 조정하세요. 이런 위기 상황에서 유연하게 대처하는 모습은 리더에게 긍정적인 인상을 남깁니다.' },
    '정관': { score: 80, desc: '조직 안에서 인정받기 좋은 날입니다. 규정·절차를 충실히 따르며 공식적인 루트로 일을 진행하면 승진·평가·보너스로 연결될 가능성이 있습니다. 오늘 제출하거나 발표하는 자료는 기한과 형식을 엄수하고, 상위 책임자에게 중간 보고를 빠뜨리지 않으면 신뢰가 한층 높아집니다.' },
    '편인': { score: 60, desc: '새로운 기술·방법론·도구를 업무에 적용하기 좋은 날입니다. 평소 배우고 싶었던 프로그램을 공부하거나, 기존 프로세스를 개선하는 아이디어를 실험해 보세요. 당장 성과로 이어지지 않더라도 장기적 커리어 자산이 되며, 자기계발에 시간을 쓰는 것이 오늘의 최고 투자입니다.' },
    '정인': { score: 70, desc: '멘토·선배·상사의 조언이 크게 도움이 되는 날입니다. 혼자 끌어안고 고민하지 말고 믿을 만한 선배에게 커피 한 잔 청해 보세요. 예상보다 실질적인 해법이 돌아올 수 있습니다. 배움의 자세로 임하면 지금의 겸손한 태도가 미래의 기회로 반드시 되돌아옵니다.' },
  },
  '학업운': {
    '비견': { score: 55, desc: '스터디 그룹이나 토론에서 서로 자극을 주고받기 좋은 날입니다. 혼자 공부할 땐 놓쳤던 포인트를 친구들과 맞춰보며 빈틈을 채울 수 있고, 같은 목표를 가진 사람들과 나누는 시간이 집중력도 끌어올립니다. 단, 수다로 흐르지 않도록 시작 전에 오늘의 학습 목표를 정하세요.' },
    '겁재': { score: 40, desc: '집중력이 쉽게 흐트러지고 유혹이 많아지는 날입니다. SNS·게임·쇼핑 광고에 시간이 훌쩍 빠질 수 있으니, 스마트폰을 다른 방에 두거나 앱을 잠그는 장치를 활용하세요. 자기 전 5분이라도 "오늘 한 것·내일 할 것"을 정리하면 내일의 집중력 회복에 큰 도움이 됩니다.' },
    '식신': { score: 70, desc: '이해력과 흡수력이 좋아 새로운 과목에 도전하기 좋은 날입니다. 어려웠던 개념도 오늘 차분히 읽으면 술술 들어오니, 미뤄뒀던 챕터를 펼쳐 보세요. 즐기면서 배우는 태도가 가장 효과적이며, 좋아하는 음료와 함께 공부하는 작은 의식이 오히려 집중력을 높여줍니다.' },
    '상관': { score: 65, desc: '비판적 사고와 표현력이 살아나는 날입니다. 에세이, 논술, 서술형 문제에 강점을 발휘할 수 있으니 글쓰기 위주의 학습을 배치해 보세요. 다만 지나친 분석으로 결론을 못 내리기 쉬우니, 제한 시간을 두고 작성한 뒤 마지막에 한 번 다듬는 방식이 가장 효율적입니다.' },
    '편재': { score: 50, desc: '실용적인 공부가 잘 되는 날입니다. 자격증, 실무 스킬, 어학 회화 등 바로 써먹을 수 있는 분야에 시간을 투자하세요. 이론만 보기보다 문제 풀이나 시뮬레이션으로 접근하면 훨씬 잘 기억되며, 공부한 내용을 SNS나 블로그에 짧게 정리해 두면 복습 효과가 두 배가 됩니다.' },
    '정재': { score: 60, desc: '꼼꼼한 복습과 정리가 효과적인 날입니다. 암기 과목이나 공식, 개념 정리 노트 만들기에 시간을 투자하면 오래 남는 지식으로 자리 잡습니다. 하루 일정을 30분 단위로 쪼개 계획을 세우고 그대로 실행해 보세요. 작은 성취가 쌓이며 공부 자신감이 눈에 띄게 올라갑니다.' },
    '편관': { score: 45, desc: '시험 압박감이나 성적에 대한 불안이 크게 느껴질 수 있는 날입니다. 완벽을 추구하다 손도 못 대는 것보다, 출제 빈도 높은 핵심만 먼저 잡는 전략이 필요합니다. 불안이 심할 땐 10분 산책이나 가벼운 운동으로 몸을 움직여 주세요. 머리가 맑아지고 집중력이 회복됩니다.' },
    '정관': { score: 65, desc: '체계적 학습 계획이 효과를 발휘하는 날입니다. 시간표를 짜서 꾸준히 공부하면 성과가 잘 쌓이고, 정해진 틀 안에서 움직일 때 안정감을 느낄 수 있습니다. 오늘 세운 계획은 최소 1주일 이상 이어가 보세요. 습관으로 자리 잡는 첫걸음이 되어 장기적 성취로 이어집니다.' },
    '편인': { score: 80, desc: '직관과 영감이 뛰어나게 작동하는 날입니다. 창의적 문제 해결, 연구, 논문 분석, 예술 창작 등 남다른 관점이 필요한 작업에 몰입하기 좋습니다. 평소 궁금했던 분야의 책이나 강의를 펼치면 새로운 통찰이 떠오르고, 그 아이디어를 메모해 두는 것이 향후 큰 자산이 됩니다.' },
    '정인': { score: 85, desc: '학습 능력이 최고조에 이르는 날로, 새로운 지식을 흡수하기에 이보다 좋은 타이밍이 없습니다. 집중 공부로 중요한 단원을 정리하거나, 평소 어렵다고 느꼈던 분야에 도전해 보세요. 선생님·교수·멘토의 한마디가 깊이 와닿고, 그 조언대로 움직일 때 성과가 빠르게 드러납니다.' },
  },
};

// 12운성에 의한 점수 보정
const US_SCORE_MOD: Record<string, number> = {
  '장생': 5, '목욕': -5, '관대': 10, '건록': 15, '제왕': 10,
  '쇠': -5, '병': -10, '사': -15, '묘': -10, '절': -5, '태': 0, '양': 5,
};

function buildCategoryFortunes(ss: string, us: string, sinsal: SinsalInfo[]): CategoryFortune[] {
  const labels = ['재물운', '건강운', '연애운', '직장운', '학업운'];
  const usMod = US_SCORE_MOD[us] || 0;

  // 신살 보정
  const sinsalNames = sinsal.map(s => s.name);
  const sinsalMods: Record<string, Record<string, number>> = {
    '천을귀인': { '직장운': 10, '학업운': 5, '재물운': 5 },
    '문창귀인': { '학업운': 15, '직장운': 5 },
    '역마살': { '직장운': 5, '재물운': 5 },
    '도화살': { '연애운': 15 },
    '화개살': { '학업운': 10 },
    '겁살': { '재물운': -10, '건강운': -5 },
    '재살': { '건강운': -10, '재물운': -5 },
  };

  return labels.map(label => {
    const base = CATEGORY_DATA[label]?.[ss] || { score: 50, desc: '' };
    let score = base.score + usMod;

    // 신살 보정 적용
    for (const sn of sinsalNames) {
      const mods = sinsalMods[sn];
      if (mods?.[label]) score += mods[label];
    }

    score = Math.max(10, Math.min(95, score));
    return { label, score, desc: base.desc };
  });
}

export interface TodayFortuneResult {
  dayPillar: string; dayPillarHanja: string; dayOh: string;
  ss: string; us: string; ssReading: string; usReading: string;
  sinsal: SinsalInfo[];
  categories: CategoryFortune[];
}

export function buildTodayFortune(ps: Pillar[]): TodayFortuneResult | null {
  const ilgan = ps[1].c; const ilji = ps[1].j;
  if (!ilgan) return null;
  const now = new Date();
  const tg = getGapja(now.getFullYear(), now.getMonth()+1, now.getDate());
  const tCg = tg.dayPillarHanja[0]; const tJj = tg.dayPillarHanja[1];
  const tSS = sipsung(ilgan, tCg); const tUS = unsung(ilgan, tJj);
  const tOh = CG_OH[tCg];

  const sinsal: SinsalInfo[] = [];
  if (CHEONUL[ilgan]?.includes(tJj)) sinsal.push({ name: '천을귀인', ...SINSAL_DESC['천을귀인'] });
  if (MUNCHANG[ilgan]===tJj) sinsal.push({ name: '문창귀인', ...SINSAL_DESC['문창귀인'] });
  if (ilji && YEOKMA[ilji]===tJj) sinsal.push({ name: '역마살', ...SINSAL_DESC['역마살'] });
  if (ilji && DOHWA[ilji]===tJj) sinsal.push({ name: '도화살', ...SINSAL_DESC['도화살'] });
  if (ilji && HWAGAE[ilji]===tJj) sinsal.push({ name: '화개살', ...SINSAL_DESC['화개살'] });
  if (ilji && GEOBSAL[ilji]===tJj) sinsal.push({ name: '겁살', ...SINSAL_DESC['겁살'] });
  if (ilji && JAESAL[ilji]===tJj) sinsal.push({ name: '재살', ...SINSAL_DESC['재살'] });

  // ── 카테고리별 운세 (재물운, 건강운, 연애운, 직장운, 학업운) ──
  const categories = buildCategoryFortunes(tSS, tUS, sinsal);

  return {
    dayPillar: tg.dayPillar, dayPillarHanja: tg.dayPillarHanja, dayOh: tOh,
    ss: tSS, us: tUS, ssReading: SS_READING[tSS] || '', usReading: US_READING[tUS] || '',
    sinsal, categories,
  };
}

// ── 대운 · 연운 · 월운 ──
export interface DaeunEntry extends GapjaEntry { age: number; }
export interface DaeunResult { daeuns: DaeunEntry[]; daeunsu: number; }

// 절기(節氣) 근사 날짜 - 월별 절입일 (양력 기준 평균)
// 라이브러리 지원 범위(2020~2030) 밖 연도용 폴백
// 인월(寅)=입춘~, 묘월(卯)=경칩~, ... 축월(丑)=소한~
const JEOLGI_APPROX: [number, number][] = [
  [2, 4],   // 1: 입춘 (인월 시작)
  [3, 6],   // 2: 경칩 (묘월)
  [4, 5],   // 3: 청명 (진월)
  [5, 6],   // 4: 입하 (사월)
  [6, 6],   // 5: 망종 (오월)
  [7, 7],   // 6: 소서 (미월)
  [8, 8],   // 7: 입추 (신월)
  [9, 8],   // 8: 백로 (유월)
  [10, 8],  // 9: 한로 (술월)
  [11, 7],  // 10: 입동 (해월)
  [12, 7],  // 11: 대설 (자월)
  [1, 6],   // 12: 소한 (축월)
];

function getJeolgiApproxDates(year: number): Date[] {
  const dates: Date[] = [];
  for (const [m, d] of JEOLGI_APPROX) {
    const y = m === 1 ? year + 1 : year; // 소한은 다음해 1월
    dates.push(new Date(y, m - 1, d));
  }
  for (const [m, d] of JEOLGI_APPROX) {
    const y = m === 1 ? year : year - 1;
    dates.push(new Date(y, m - 1, d));
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/** 출생 연도 기준 전/당/다음 연도의 절기(節氣) 시각을 정확히 조회.
 *  라이브러리 범위 밖이면 근사 날짜로 폴백. */
function getJeolgiDates(year: number): Date[] {
  const dates: Date[] = [];
  for (const y of [year - 1, year, year + 1]) {
    try {
      const terms = getSolarTermsByYear(y);
      for (const t of terms) {
        if (t.type !== 'jeolgi') continue;
        dates.push(new Date(t.year, t.month - 1, t.day, t.hour, t.minute));
      }
    } catch {
      // 범위 밖: 근사치 사용
      return getJeolgiApproxDates(year);
    }
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

export function calcDaeun(saju: ReturnType<typeof calculateSaju>, gender: string, bY: number, bM: number, bD: number): DaeunResult {
  const yCg = saju.yearPillarHanja[0];
  const mCg = saju.monthPillarHanja[0]; const mJj = saju.monthPillarHanja[1];
  const yang = ['甲','丙','戊','庚','壬'].includes(yCg);
  const fwd = (yang && gender==='남') || (!yang && gender==='여');
  const mIdx = g60idx(mCg, mJj);
  const bDate = new Date(bY, bM-1, bD);
  let daeunsu = 5;

  // 절기 기반 대운수 계산
  const jeolgiDates = getJeolgiDates(bY);
  if (fwd) {
    const next = jeolgiDates.find(d => d > bDate);
    if (next) daeunsu = Math.floor((next.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24) / 3);
  } else {
    const prev = [...jeolgiDates].reverse().find(d => d <= bDate);
    if (prev) daeunsu = Math.floor((bDate.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24) / 3);
  }

  if(daeunsu<1)daeunsu=1; if(daeunsu>10)daeunsu=10;
  const result: DaeunEntry[]=[];
  for(let i=1;i<=10;i++){const off=fwd?i:-i;const idx=((mIdx+off)%60+60)%60;result.push({age:daeunsu+(i-1)*10,...G60[idx]});}
  return {daeuns:result,daeunsu};
}

export interface YeonunEntry extends GapjaEntry { year: number; }

export function calcYeonun(): YeonunEntry[] {
  const cY = new Date().getFullYear(); const r: YeonunEntry[]=[];
  for(let y=cY+2;y>=cY-7;y--){try{const g=getGapja(y,7,1);r.push({year:y,c:g.yearPillarHanja[0],j:g.yearPillarHanja[1],ck:g.yearPillar[0],jk:g.yearPillar[1]});}catch{}}
  return r;
}

export interface WolunEntry extends GapjaEntry { month: number; }

export function calcWolun(): WolunEntry[] {
  const cY=new Date().getFullYear(); const r: WolunEntry[]=[];
  for(let m=12;m>=1;m--){try{const g=getGapja(cY,m,15);r.push({month:m,c:g.monthPillarHanja[0],j:g.monthPillarHanja[1],ck:g.monthPillar[0],jk:g.monthPillar[1]});}catch{}}
  return r;
}

// ── 시진 매핑 ──
export interface Sijin { start: number; end: number; label: string; value: number; }

export const SIJIN_LIST: Sijin[] = [
  { start:23, end:1,  label:'23:00 ~ 01:00', value:0  },
  { start:1,  end:3,  label:'01:00 ~ 03:00', value:1  },
  { start:3,  end:5,  label:'03:00 ~ 05:00', value:3  },
  { start:5,  end:7,  label:'05:00 ~ 07:00', value:5  },
  { start:7,  end:9,  label:'07:00 ~ 09:00', value:7  },
  { start:9,  end:11, label:'09:00 ~ 11:00', value:9  },
  { start:11, end:13, label:'11:00 ~ 13:00', value:11 },
  { start:13, end:15, label:'13:00 ~ 15:00', value:13 },
  { start:15, end:17, label:'15:00 ~ 17:00', value:15 },
  { start:17, end:19, label:'17:00 ~ 19:00', value:17 },
  { start:19, end:21, label:'19:00 ~ 21:00', value:19 },
  { start:21, end:23, label:'21:00 ~ 23:00', value:21 },
];

export function matchSijin(h: number, m: number): Sijin | null {
  const t = h * 60 + m;
  for (const s of SIJIN_LIST) {
    if (s.start > s.end) {
      const tAdj = t < s.start * 60 ? t + 24 * 60 : t;
      if (tAdj >= s.start * 60 && tAdj < (s.end + 24) * 60) return s;
    } else {
      if (t >= s.start * 60 && t < s.end * 60) return s;
    }
  }
  return null;
}

// ── 도시 옵션 ──
export const REGION_OPTIONS = [
  { value: '', label: '보정 안함' },
  { value: '126.98', label: '서울특별시' },
  { value: '129.03', label: '부산광역시' },
  { value: '128.60', label: '대구광역시' },
  { value: '126.70', label: '인천광역시' },
  { value: '126.85', label: '광주광역시' },
  { value: '127.38', label: '대전광역시' },
  { value: '129.31', label: '울산광역시' },
  { value: '127.03', label: '세종특별자치시' },
  { value: '127.00', label: '경기도' },
  { value: '128.21', label: '강원도' },
  { value: '127.38', label: '충청북도' },
  { value: '126.80', label: '충청남도' },
  { value: '127.15', label: '전라북도' },
  { value: '126.81', label: '전라남도' },
  { value: '128.57', label: '경상북도' },
  { value: '128.68', label: '경상남도' },
  { value: '126.57', label: '제주특별자치도' },
];
