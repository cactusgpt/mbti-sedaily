import { useState, useEffect } from 'react';
import { isBeforeLichun, getSajuMonth } from '@fullstackfamily/manseryeok';
import { CG_OH, JJ_OH, OH_HJ, JJG, sipsung, unsung, buildStructureAnalysis, detectDayHapChung, evaluateForYongsin, generateDailyInsights, type Pillar, type ChongunResult, type TodayFortuneResult, type DaeunEntry, type YeonunEntry, type WolunEntry, type YongsinRating } from '../lib/engine';
import { SajuTable } from './SajuTable';
import { DailyCalendar } from './DailyCalendar';

type MbtiGroup = 'NT' | 'NF' | 'ST' | 'SF';

const EL_COLORS: Record<string, string> = {
  '목': 'text-green-600', '화': 'text-red-500', '토': 'text-yellow-600',
  '금': 'text-gray-500', '수': 'text-blue-600',
};

interface Props {
  data: {
    pillars: Pillar[]; ilgan: string;
    year: number; month: number; day: number; gender: string;
    chongun: ChongunResult | null; todayFortune: TodayFortuneResult | null;
    daeuns: DaeunEntry[]; yeonuns: YeonunEntry[]; woluns: WolunEntry[];
    correctedTime?: { hour: number; minute: number };
  };
  mbtiGroup?: MbtiGroup;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
      <h3 className="text-[14px] font-bold text-gray-900 mb-3">{title}</h3>
      <div className="text-[13px] text-gray-600 leading-relaxed">{children}</div>
    </div>
  );
}

/** 접힘 가능한 섹션 (기본 접힘) */
function CollapsibleSection({ title, subtitle, children, defaultOpen = false }: {
  title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="text-left">
          <h3 className="text-[14px] font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <svg
          className={`text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 text-[13px] text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// 일반 사용자용 십성 풀이 (한 줄 설명)
const SS_MEANING: Record<string, string> = {
  '비견': '동료·경쟁자 기운',
  '겁재': '경쟁·지출 기운',
  '식신': '표현·여유 기운',
  '상관': '재능·비판 기운',
  '편재': '활동적 재물 기운',
  '정재': '성실한 재물 기운',
  '편관': '압박·도전 기운',
  '정관': '명예·규율 기운',
  '편인': '직관·영감 기운',
  '정인': '학문·지혜 기운',
};

// 12운성 한 줄 풀이
const US_MEANING: Record<string, string> = {
  '장생': '새로운 시작',
  '목욕': '불안정한 변화',
  '관대': '자신감·성장',
  '건록': '전성기 시작',
  '제왕': '에너지의 정점',
  '쇠': '기운이 쇠약해짐',
  '병': '쇠약한 상태',
  '사': '정체와 막힘',
  '묘': '내면의 회고',
  '절': '단절과 전환',
  '태': '잉태와 준비',
  '양': '조용한 성장',
};

const SS_DETAIL: Record<string, string> = {
  '비견': '나와 같은 기운이 작용합니다. 동료, 형제와의 관계가 부각되고 자립심이 강해집니다. 경쟁 속에서 성장하되 독선을 경계하세요.',
  '겁재': '경쟁과 도전의 기운입니다. 재물 지출에 주의하고 승부욕을 긍정적으로 활용하세요. 공동 사업보다 단독 판단이 유리합니다.',
  '식신': '여유와 창의력의 시기입니다. 먹을 복이 있고 취미가 잘 풀리며 표현력이 좋아집니다. 안정적인 수입과 건강이 따릅니다.',
  '상관': '표현욕과 재능이 폭발하는 시기입니다. 예술, 글쓰기에 좋으나 날카로운 말로 갈등이 생길 수 있으니 언행에 주의하세요.',
  '편재': '활동적 재물운과 사교의 시기입니다. 사업 기회가 오고 인맥이 넓어지지만 과욕을 부리면 손실이 생깁니다.',
  '정재': '안정적인 재물 축적의 시기입니다. 성실한 노력이 결실을 맺고, 가정 경제가 안정됩니다. 저축과 재테크에 유리합니다.',
  '편관': '변화와 도전의 시기입니다. 갑작스러운 업무나 책임이 주어지지만, 잘 넘기면 큰 성장으로 이어집니다. 건강 관리 필요.',
  '정관': '질서와 인정의 시기입니다. 사회적 지위가 올라가고 공식적인 성과가 나타납니다. 규칙을 지키면 좋은 결과가 옵니다.',
  '편인': '직관과 영감의 시기입니다. 학문이나 연구에 몰입하기 좋고 새로운 시각이 열립니다. 다만 고독감이나 건강 이상에 주의.',
  '정인': '학습과 성장의 시기입니다. 자격증, 학위 등 배움의 결실이 맺어지고 윗사람의 도움이 있습니다. 내적 성숙의 시간.',
};

const US_DETAIL: Record<string, string> = {
  '장생': '새로운 출발의 에너지입니다. 시작한 일이 순조롭게 성장하며 희망적인 기운이 감돕니다.',
  '목욕': '변화와 불안정의 시기입니다. 감정 기복이 심하고 유혹이 많으니 신중하게 행동하세요.',
  '관대': '자신감과 사회 활동이 최고조입니다. 적극적으로 나서면 인정받고 기회를 잡을 수 있습니다.',
  '건록': '실력이 완전히 발휘되는 시기입니다. 독립적으로 일을 추진하면 큰 성과를 거둡니다.',
  '제왕': '모든 기운이 정점에 달합니다. 리더십을 발휘하기 좋으나 정점 이후 하락에 대비하세요.',
  '쇠': '기운이 서서히 빠지는 시기입니다. 새로운 일보다 기존 일을 정리하고 체력을 관리하세요.',
  '병': '쇠약함의 시기입니다. 건강 관리에 집중하고 무리한 계획은 피하세요. 휴식이 최선입니다.',
  '사': '정체와 막힘의 시기입니다. 억지로 밀어붙이면 손해가 커지니 때를 기다리세요.',
  '묘': '내면을 돌아보는 시기입니다. 과거를 정리하고 다음을 준비하는 잠복기로 활용하세요.',
  '절': '단절과 전환의 시기입니다. 낡은 것을 과감히 버리고 새 방향을 모색하세요.',
  '태': '새로운 가능성이 잉태되는 시기입니다. 눈에 보이지 않지만 씨앗이 뿌려지고 있습니다.',
  '양': '성장을 준비하는 시기입니다. 조용하지만 확실한 발전이 이루어지고 있습니다.',
};

/** 마크다운 텍스트를 간단한 HTML로 변환 */
function parseBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={j}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // 빈 줄은 건너뜀 (단락 간격은 CSS mb로 처리)
    if (!trimmed) continue;
    // ### 소제목
    if (trimmed.startsWith('### ')) {
      elements.push(<h5 key={i} className="text-[13px] font-bold text-gray-700 mt-3 mb-1.5">{parseBold(trimmed.slice(4).trim())}</h5>);
    }
    // ## 제목
    else if (trimmed.startsWith('## ')) {
      elements.push(<h4 key={i} className="text-[14px] font-bold text-gray-800 mt-4 mb-2">{parseBold(trimmed.slice(3).trim())}</h4>);
    }
    // - 리스트
    else if (trimmed.startsWith('- ')) {
      elements.push(<li key={i} className="ml-4 list-disc text-[13px] mb-0.5">{parseBold(trimmed.slice(2))}</li>);
    }
    // 일반 문단
    else {
      elements.push(<p key={i} className="mb-2">{parseBold(trimmed)}</p>);
    }
  }

  return elements;
}

type CacheData = Record<MbtiGroup, string>;

interface CategoryToneBuckets {
  default?: string[];
  favor?: string[];
  caution?: string[];
}

interface TodayPartsCache {
  ss: Record<MbtiGroup, Record<string, string>>;
  us: Record<MbtiGroup, Record<string, string>>;
  // 카테고리는 톤 버킷 구조 또는 기존 array/string (하위 호환)
  category: Record<string, Record<MbtiGroup, Record<string, string | string[] | CategoryToneBuckets>>>;
}

// 12운성 → 톤 버킷 매핑
const US_TONE_BUCKET: Record<string, 'favor' | 'caution' | 'default'> = {
  '장생': 'favor', '관대': 'favor', '건록': 'favor', '제왕': 'favor', '양': 'favor', '태': 'favor',
  '쇠': 'caution', '병': 'caution', '사': 'caution', '묘': 'caution', '절': 'caution', '목욕': 'caution',
};

function UnGrid({ title, cols, ilgan, activeCheck, periodType, yongsinOh }: {
  title: string;
  cols: { c: string; j: string; ck: string; jk: string; label: string }[];
  ilgan: string;
  activeCheck?: (col: { c: string; j: string; ck: string; jk: string; label: string } & Record<string, unknown>) => boolean;
  periodType?: 'daeun' | 'yeonun' | 'wolun';
  yongsinOh?: string;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const periodName = periodType === 'daeun' ? '10년' : periodType === 'yeonun' ? '1년' : periodType === 'wolun' ? '1개월' : '이 기간';

  return (
    <div className="mb-4">
      <div className="text-[12px] font-semibold text-gray-500 mb-2">{title}</div>
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-2">
          {cols.map((col, i) => {
            const isActive = activeCheck ? activeCheck(col) : false;
            const cgOh = CG_OH[col.c] || ''; const jjOh = JJ_OH[col.j] || '';
            const cgSS = sipsung(ilgan, col.c);
            const jjMain = col.j && JJG[col.j] ? JJG[col.j][JJG[col.j].length - 1] : null;
            const jjSS = jjMain ? sipsung(ilgan, jjMain) : '';
            const us = unsung(ilgan, col.j);
            const yEval = yongsinOh ? evaluateForYongsin(col.c, col.j, yongsinOh) : null;
            const yStyle: Record<YongsinRating, string> = {
              favor: 'border-green-400 bg-green-50',
              neutral: '',
              caution: 'border-red-300 bg-red-50',
            };
            const extraCls = yEval && yEval.rating !== 'neutral' && !isActive && expandedIdx !== i
              ? yStyle[yEval.rating] : '';
            return (
              <div key={i}
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className={`flex flex-col items-center w-[72px] py-2 px-1 rounded-lg border text-center flex-shrink-0 cursor-pointer transition-all ${isActive ? 'border-gray-900 bg-gray-50' : expandedIdx === i ? 'border-blue-400 bg-blue-50' : extraCls || 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="text-[11px] text-gray-500 font-medium mb-1">{col.label}</div>
                <div className="text-[10px] text-gray-400">{cgSS}</div>
                <div className={`text-[16px] font-bold my-0.5 ${EL_COLORS[cgOh] || ''}`}>{col.ck}{col.c}</div>
                <div className={`text-[16px] font-bold my-0.5 ${EL_COLORS[jjOh] || ''}`}>{col.jk}{col.j}</div>
                <div className="text-[10px] text-gray-400">{jjSS}</div>
                <div className="text-[10px] text-gray-400">{us}</div>
                {yEval && yEval.rating !== 'neutral' && (
                  <div className={`text-[9px] font-semibold mt-0.5 ${yEval.rating === 'favor' ? 'text-green-600' : 'text-red-500'}`}>
                    {yEval.rating === 'favor' ? '용신↑' : '용신↓'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {expandedIdx !== null && (() => {
        const col = cols[expandedIdx];
        const cgOh = CG_OH[col.c] || '';
        const jjOh = JJ_OH[col.j] || '';
        const cgSS = sipsung(ilgan, col.c);
        const us = unsung(ilgan, col.j);
        const hidden = (col.j && JJG[col.j]) || [];
        const hiddenItems = hidden.map((h, i) => {
          const weight = hidden.length === 1 ? '본기' : hidden.length === 2 ? (i === 0 ? '여기' : '본기') : (i === 0 ? '여기' : i === 1 ? '중기' : '본기');
          return { hanja: h, ss: sipsung(ilgan, h), weight };
        });
        return (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-[12px] text-gray-600 leading-relaxed animate-in fade-in">
            <div className="font-semibold text-gray-800 mb-2">
              {col.label}
              <span className="text-[11px] text-gray-400 ml-1.5">({periodName} 기간)</span>
              <span className="ml-2">
                <span className={EL_COLORS[cgOh]}>{col.ck}{col.c}</span>{' '}
                <span className={EL_COLORS[jjOh]}>{col.jk}{col.j}</span>
              </span>
            </div>
            {cgSS && (
              <p className="mb-2">
                <span className="font-medium text-gray-700">천간 십성 · {cgSS}</span>
                <span className="text-[11px] text-gray-400 ml-1">({SS_MEANING[cgSS] || ''})</span>
                <br />{SS_DETAIL[cgSS] || ''}
              </p>
            )}
            {us && (
              <p className="mb-2">
                <span className="font-medium text-gray-700">12운성 · {us}</span>
                <span className="text-[11px] text-gray-400 ml-1">({US_MEANING[us] || ''})</span>
                <br />{US_DETAIL[us] || ''}
              </p>
            )}
            {hiddenItems.length > 0 && (
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="text-[11px] text-gray-500 mb-1">지지({col.j}) 속 숨은 기운:</div>
                <div className="flex flex-wrap gap-1">
                  {hiddenItems.map((h, i) => (
                    <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded border ${h.weight === '본기' ? 'border-gray-400 bg-white font-medium' : 'border-gray-200 text-gray-500'}`}>
                      <span className="text-gray-400">{h.weight}</span>{' '}
                      <span>{h.hanja}</span>{' '}
                      <span className="text-gray-600">{h.ss}</span>
                      <span className="text-gray-400 ml-0.5">· {SS_MEANING[h.ss] || ''}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export function FortuneResult({ data, mbtiGroup }: Props) {
  const { pillars, ilgan, year, month, day, gender, chongun, todayFortune, daeuns, yeonuns, woluns, correctedTime } = data;
  const oh = CG_OH[ilgan] || '';
  const now = new Date();
  const currentAge = now.getFullYear() - year;
  // 사주 연도/월은 절기 기준: 입춘 전이면 전년도, 월주는 절기 기반 사주월
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const sajuYear = isBeforeLichun(currentMonth, currentDay) ? now.getFullYear() - 1 : now.getFullYear();
  // calcWolun은 각 달력 월 15일 기준이라 사주월 N(인월=1)이 label "N+1월"과 매칭됨
  // (예: 입춘 후~경칩 전 = 사주월 1 = 인월 = 캘린더 2월 15일 월주)
  const wolunActiveMonth = (getSajuMonth(currentMonth, currentDay) % 12) + 1;

  // 캐시 JSON fetch
  const [chongunCache, setChongunCache] = useState<CacheData | null>(null);
  const [todayParts, setTodayParts] = useState<TodayPartsCache | null>(null);

  useEffect(() => {
    if (!ilgan) return;
    const ilji = pillars[1].j;
    const wolji = pillars[2].j;
    if (!ilji || !wolji) return;
    const key = `${ilgan}_${ilji}_${wolji}`;
    fetch('/saju-cache/chongun.json')
      .then(r => r.ok ? r.json() : null)
      .then(all => { if (all && all[key]) setChongunCache(all[key]); })
      .catch(() => setChongunCache(null));
  }, [ilgan, pillars]);

  // 오늘의 운세 파트별 리라이팅 JSON (한번만 로드)
  useEffect(() => {
    fetch('/saju-cache/today-parts.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => setTodayParts(d))
      .catch(() => setTodayParts(null));
  }, []);

  const structure = buildStructureAnalysis(pillars);
  const dayHapChung = todayFortune?.dayPillarHanja ? detectDayHapChung(pillars, todayFortune.dayPillarHanja) : [];
  const dailyInsights = generateDailyInsights(pillars, structure, todayFortune);
  const categoryNoteMap: Record<string, { note: string; tone: string }[]> = {};
  for (const n of dailyInsights.categoryNotes) {
    if (!categoryNoteMap[n.category]) categoryNoteMap[n.category] = [];
    categoryNoteMap[n.category].push({ note: n.note, tone: n.tone });
  }

  const chongunText = mbtiGroup && chongunCache?.[mbtiGroup] ? chongunCache[mbtiGroup] : null;
  const ssReadingText = mbtiGroup && todayParts?.ss?.[mbtiGroup]?.[todayFortune?.ss || ''] || todayFortune?.ssReading || '';
  const usReadingText = mbtiGroup && todayParts?.us?.[mbtiGroup]?.[todayFortune?.us || ''] || todayFortune?.usReading || '';
  // 날짜 기반 variant 선택 — 같은 날엔 같은 variant, 날이 바뀌면 다른 variant
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const getCategoryDesc = (catLabel: string, ss: string, fallback: string) => {
    const entry = mbtiGroup ? todayParts?.category?.[catLabel]?.[mbtiGroup]?.[ss] : undefined;
    if (!entry) return fallback;
    if (typeof entry === 'string') return entry;
    if (Array.isArray(entry)) {
      if (entry.length === 0) return fallback;
      return entry[dayOfYear % entry.length];
    }
    // 톤 버킷 구조: 오늘 12운성에 따라 favor/caution/default 선택
    const us = todayFortune?.us || '';
    const bucket = US_TONE_BUCKET[us] || 'default';
    const buckets = entry as CategoryToneBuckets;
    const arr = buckets[bucket] && buckets[bucket]!.length > 0
      ? buckets[bucket]!
      : (buckets.default && buckets.default.length > 0 ? buckets.default : []);
    if (arr.length === 0) return fallback;
    return arr[dayOfYear % arr.length];
  };

  return (
    <div className="mt-8">
      <SajuTable pillars={pillars} ilgan={ilgan} />

      {/* 기본 정보 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 text-[13px]">
        <div className="flex justify-between py-1"><span className="text-gray-400">양력</span><span>{year}년 {month}월 {day}일</span></div>
        <div className="flex justify-between py-1"><span className="text-gray-400">성별</span><span>{gender}</span></div>
        {correctedTime && <div className="flex justify-between py-1"><span className="text-gray-400">보정시간</span><span>{correctedTime.hour}시 {correctedTime.minute}분</span></div>}
        {ilgan && (
          <>
            <div className="border-t border-gray-100 my-2" />
            <div className="flex justify-between py-1">
              <span className="text-gray-400">일간</span>
              <span><strong className={EL_COLORS[oh]}>{pillars[1].ck}{ilgan}</strong> {oh}({OH_HJ[oh]})</span>
            </div>
          </>
        )}
      </div>

      {/* 오늘의 운세 — 상단 우선 배치 (일반 사용자 관심사) */}
      {todayFortune && (
        <Section title="오늘의 운세">
          <p className="mb-3">
            오늘은 <strong className={EL_COLORS[todayFortune.dayOh]}>{todayFortune.dayPillar}({todayFortune.dayPillarHanja})</strong>일입니다.
            나의 일간 기준 <strong>{todayFortune.ss}</strong>
            <span className="text-[11px] text-gray-400">({SS_MEANING[todayFortune.ss]})</span>의 날이며,
            12운성은 <strong>{todayFortune.us}</strong>
            <span className="text-[11px] text-gray-400">({US_MEANING[todayFortune.us]})</span>입니다.
          </p>
          {ssReadingText && <p className="mb-3">{ssReadingText}</p>}
          <p className={todayFortune.sinsal.length || todayFortune.hiddenSipsung?.length ? 'mb-3' : ''}>
            12운성 <strong>{todayFortune.us}</strong>
            <span className="text-[11px] text-gray-400 ml-1">— {US_MEANING[todayFortune.us]}</span>
            <br />{usReadingText}
          </p>

          {/* 일진 지지의 지장간별 십성 — 풀이 포함 */}
          {todayFortune.hiddenSipsung && todayFortune.hiddenSipsung.length > 0 && (
            <div className="border-t border-gray-100 pt-3 mb-3">
              <div className="text-[11px] text-gray-500 mb-1.5">
                천간({todayFortune.dayPillarHanja[0]})뿐 아니라 지지(<strong>{todayFortune.dayPillarHanja[1]}</strong>) 안에도 숨은 기운이 있어요:
              </div>
              <div className="space-y-1">
                {todayFortune.hiddenSipsung.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    <span className={`inline-block w-[40px] text-center px-1 py-0.5 rounded text-[10px] border ${h.weight === '본기' ? 'border-gray-400 bg-gray-50 font-semibold' : 'border-gray-200 text-gray-500'}`}>
                      {h.weight}
                    </span>
                    <span className="text-gray-700 font-semibold w-[20px]">{h.hanja}</span>
                    <span className="text-gray-600 w-[40px]">{h.ss}</span>
                    <span className="text-[11px] text-gray-400">— {SS_MEANING[h.ss] || ''}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                <span className="font-semibold text-gray-500">본기</span>가 가장 강하고 <span className="font-semibold text-gray-500">여기</span>는 약한 보조 기운입니다.
              </p>
            </div>
          )}

          {/* 원국 결핍 오행 ↔ 오늘 일진 지장간 보충 분석 */}
          {dailyInsights.complements.length > 0 && (
            <div className="border-t border-gray-100 pt-3 mb-3">
              <div className="text-[11px] font-semibold text-gray-600 mb-1.5">원국 부족 기운 보충</div>
              <div className="space-y-1.5">
                {dailyInsights.complements.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px]">
                    <span className={`inline-block shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-blue-300 bg-blue-50 ${EL_COLORS[c.lackingOh] || 'text-blue-700'}`}>
                      {c.lackingOh} 보충
                    </span>
                    <span className="text-gray-600 leading-snug">{c.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 일진 ↔ 원국 합충: 오늘 기운과 내 사주의 상호작용 */}
          {dayHapChung.length > 0 && (
            <div className="border-t border-gray-100 pt-3 mb-3">
              <div className="text-[11px] font-semibold text-gray-600 mb-1.5">오늘 기운과 내 사주의 만남</div>
              <div className="space-y-2">
                {dayHapChung.map((hc, i) => {
                  const boxCls = hc.good === true
                    ? 'border-green-200 bg-green-50'
                    : hc.good === false
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50';
                  const badgeCls = hc.good === true
                    ? 'border-green-300 text-green-700 bg-white'
                    : hc.good === false
                      ? 'border-red-300 text-red-700 bg-white'
                      : 'border-gray-300 text-gray-600 bg-white';
                  const label = hc.type === '충' ? '충돌' : hc.type === '삼합' ? '삼합' : '친화';
                  return (
                    <div key={i} className={`p-2.5 rounded-lg border ${boxCls}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeCls}`}>
                          {label} · {hc.with}
                        </span>
                        <span className="text-[11px] text-gray-400">{hc.chars}</span>
                      </div>
                      <div className="text-[12px] font-semibold text-gray-800 mb-0.5">{hc.headline}</div>
                      <p className="text-[11px] text-gray-600 leading-snug">{hc.meaning}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {todayFortune.sinsal.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              {todayFortune.sinsal.map((s, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold mr-1.5 border ${s.good === true ? 'text-green-600 border-green-200' : s.good === false ? 'text-red-500 border-red-200' : 'text-yellow-600 border-yellow-200'}`}>
                    {s.name}
                  </span>
                  <span className="text-[12px] text-gray-500">{s.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* 카테고리별 운세 — 점수 대신 정성 라벨 */}
          {todayFortune.categories && todayFortune.categories.length > 0 && (
            <div className="border-t border-gray-100 pt-4 mt-4 space-y-4">
              {todayFortune.categories.map((cat) => {
                const label =
                  cat.score >= 80 ? { text: '매우 유리', cls: 'bg-blue-100 text-blue-700 border-blue-200' } :
                  cat.score >= 65 ? { text: '유리', cls: 'bg-green-100 text-green-700 border-green-200' } :
                  cat.score >= 45 ? { text: '무난', cls: 'bg-gray-100 text-gray-600 border-gray-200' } :
                  cat.score >= 30 ? { text: '주의', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' } :
                                    { text: '강한 주의', cls: 'bg-red-100 text-red-700 border-red-200' };
                return (
                  <div key={cat.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-semibold text-gray-800">{cat.label}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${label.cls}`}>
                        {label.text}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-500 leading-relaxed">
                      {getCategoryDesc(cat.label, todayFortune.ss, cat.desc)}
                    </p>
                    {categoryNoteMap[cat.label] && categoryNoteMap[cat.label].length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {categoryNoteMap[cat.label].map((n, i) => {
                          const cls = n.tone === 'positive' ? 'border-green-200 bg-green-50 text-green-700'
                            : n.tone === 'negative' ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600';
                          const label = n.tone === 'positive' ? '오늘 플러스' : n.tone === 'negative' ? '오늘 주의' : '오늘';
                          return (
                            <div key={i} className={`text-[11px] p-1.5 rounded border ${cls} leading-snug`}>
                              <span className="font-semibold">{label}</span> · {n.note}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* 총운 — 오늘의 운세 다음 */}
      {chongun && (
        <Section title="총운">
          {chongunText ? (
            <div>{renderMarkdown(chongunText)}</div>
          ) : (
            <>
              <p className="mb-3">
                <strong className={EL_COLORS[chongun.element]}>{chongun.symbol}</strong>의 기운을 타고난 <strong>{chongun.yinyang}{chongun.element}</strong> 일간입니다. {chongun.nature}
              </p>
              {chongun.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {chongun.keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-full">{kw}</span>
                  ))}
                </div>
              )}
              {chongun.season && (
                <p className="mb-3">
                  <strong>{chongun.season.name}</strong>에 태어났습니다. {chongun.season.desc} {chongun.seasonRelation}
                </p>
              )}
              {chongun.iljuReading && <p className="mb-3">{chongun.iljuReading}</p>}
            </>
          )}
        </Section>
      )}

      {/* 상세 해석 — 총운 캐시가 있으면 숨김 (캐시에 포함됨) */}
      {!chongunText && chongun?.detail && (
        <Section title="상세 해석">
          <p className="mb-3">{chongun.detail.summary}</p>
          <div className="mb-3">
            <div className="text-[12px] font-semibold text-gray-700 mb-1">표현/행동 양식</div>
            <p>{chongun.detail.behavior}</p>
          </div>
          <div className="mb-3">
            <div className="text-[12px] font-semibold text-gray-700 mb-1">대인 관계</div>
            <p>{chongun.detail.social}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[12px] font-semibold text-green-600 mb-1">강점</div>
              <ul className="list-disc list-inside text-[12px] space-y-0.5">
                {chongun.detail.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-red-400 mb-1">약점</div>
              <ul className="list-disc list-inside text-[12px] space-y-0.5">
                {chongun.detail.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
          <div className="mb-3">
            <div className="text-[12px] font-semibold text-gray-700 mb-1">개선 방안</div>
            <p>{chongun.detail.improvement}</p>
          </div>
          {chongun.detail.jobs.length > 0 && (
            <div className="mb-3">
              <div className="text-[12px] font-semibold text-gray-700 mb-1">추천 직업</div>
              <div className="space-y-1.5">
                {chongun.detail.jobs.map((j, i) => (
                  <div key={i} className="text-[12px]"><strong>{j.field}</strong> — {j.role} <span className="text-gray-400">({j.reason})</span></div>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[12px] italic text-gray-500">{chongun.detail.conclusion}</p>
          </div>
        </Section>
      )}

      {/* 일지 상세 — 총운 캐시가 있으면 숨김 */}
      {!chongunText && chongun?.iljiDetail && (
        <Section title="일지(日支) 해석">
          <p className="mb-3">{chongun.iljiDetail.summary}</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[12px] font-semibold text-green-600 mb-1">강점</div>
              <ul className="list-disc list-inside text-[12px] space-y-0.5">
                {chongun.iljiDetail.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-red-400 mb-1">약점</div>
              <ul className="list-disc list-inside text-[12px] space-y-0.5">
                {chongun.iljiDetail.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
          <p className="text-[12px] italic text-gray-500">{chongun.iljiDetail.conclusion}</p>
        </Section>
      )}

      {/* 대운 · 연운 · 월운 */}
      {ilgan && daeuns.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <UnGrid title="대운" periodType="daeun" cols={daeuns.map(x => ({ ...x, label: `${x.age}세` }))} ilgan={ilgan}
            activeCheck={(col) => currentAge >= (col as unknown as DaeunEntry).age && currentAge < (col as unknown as DaeunEntry).age + 10} />
          <div className="border-t border-gray-100 my-3" />
          <UnGrid title="연운" periodType="yeonun" cols={yeonuns.map(x => ({ ...x, label: `${x.year}` }))} ilgan={ilgan}
            activeCheck={(col) => (col as unknown as YeonunEntry).year === sajuYear} />
          <div className="border-t border-gray-100 my-3" />
          <UnGrid title="월운" periodType="wolun" cols={woluns.map(x => ({ ...x, label: `${x.month}월` }))} ilgan={ilgan}
            yongsinOh={structure?.yongsin?.primary}
            activeCheck={(col) => (col as unknown as WolunEntry).month === wolunActiveMonth} />
          {structure?.yongsin && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
              월운 배지: <span className="text-green-600 font-semibold">용신↑</span> 내 필요한 기운이 강해지는 달 ·
              <span className="text-red-500 font-semibold ml-1">용신↓</span> 용신이 약해지는 달 (용신: <strong className={EL_COLORS[structure.yongsin.primary]}>{structure.yongsin.primary}</strong>)
            </div>
          )}
        </div>
      )}

      {/* 일진 달력 */}
      {ilgan && <DailyCalendar ilgan={ilgan} />}

      {/* 사주 구조 진단 (팔자 전체 기반) — 접힘 */}
      {structure && (
        <CollapsibleSection
          title="사주 구조 진단"
          subtitle="팔자 8글자 전체 구조 · 명리 용어 포함 (전문 분석)"
        >
          {/* 오행 분포 */}
          <div className="mb-4">
            <div className="text-[12px] font-semibold text-gray-700 mb-1.5">기운의 균형 <span className="text-[11px] font-normal text-gray-400">(오행 분포)</span></div>
            <div className="grid grid-cols-5 gap-1.5">
              {([
                { o: '목', meaning: '성장·학문' },
                { o: '화', meaning: '열정·표현' },
                { o: '토', meaning: '안정·관계' },
                { o: '금', meaning: '원칙·결단' },
                { o: '수', meaning: '지혜·소통' },
              ] as const).map(({ o, meaning }) => {
                const n = structure.distribution.counts[o];
                const isExcess = structure.distribution.excess.includes(o);
                const isLacking = structure.distribution.lacking.includes(o);
                return (
                  <div key={o} className={`text-center p-1.5 rounded border ${isExcess ? 'border-red-300 bg-red-50' : isLacking ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                    <div className={`font-bold text-[13px] ${EL_COLORS[o]}`}>{o}</div>
                    <div className="text-[10px] text-gray-400 leading-tight">{meaning}</div>
                    <div className="text-[11px] text-gray-700 mt-0.5">{n}개</div>
                    {isExcess && <div className="text-[9px] text-red-500 font-semibold">많음</div>}
                    {isLacking && <div className="text-[9px] text-blue-500 font-semibold">없음</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 신강/신약 */}
          {structure.singangyak && (() => {
            const lv = structure.singangyak.level;
            const plain =
              lv === '극신강' ? { text: '내 기운이 아주 강한 편이에요', tone: 'text-red-500' } :
              lv === '신강' ? { text: '내 기운이 강한 편이에요', tone: 'text-red-400' } :
              lv === '중화' ? { text: '내 기운이 적절히 균형 잡혀 있어요', tone: 'text-gray-700' } :
              lv === '신약' ? { text: '내 기운이 약한 편이에요', tone: 'text-blue-500' } :
                              { text: '내 기운이 매우 약한 편이에요', tone: 'text-blue-600' };
            return (
              <div className="mb-4">
                <div className="text-[12px] font-semibold text-gray-700 mb-1">내 기운의 세기 <span className="text-[11px] font-normal text-gray-400">(신강/신약)</span></div>
                <div className="text-[13px] mb-2">
                  <strong className={plain.tone}>{plain.text}</strong>
                  <span className="text-[11px] text-gray-400 ml-1.5">({lv})</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-[52px] text-center py-0.5 rounded border text-[10px] ${structure.singangyak.deukryeong ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500'}`}>
                      {structure.singangyak.deukryeong ? '득령 ✓' : '실령'}
                    </span>
                    <span className="text-gray-500">월지(태어난 달)가 {structure.singangyak.deukryeong ? '나를 도움' : '나를 돕지 않음'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-[52px] text-center py-0.5 rounded border text-[10px] ${structure.singangyak.deukji ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500'}`}>
                      {structure.singangyak.deukji ? '득지 ✓' : '실지'}
                    </span>
                    <span className="text-gray-500">일지(배우자 자리)가 {structure.singangyak.deukji ? '나를 도움' : '나를 돕지 않음'}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="inline-block w-[52px] text-center py-0.5 rounded border border-gray-300 text-gray-600 text-[10px] shrink-0">득세 {structure.singangyak.deukse}/5</span>
                    <div className="flex flex-wrap gap-1">
                      {structure.singangyak.supports.map((s, i) => (
                        <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] border ${s.helps ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400'}`}>
                          {s.position} {s.char}{s.helps ? ' ✓' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 격국 */}
          {structure.gyeokguk && (
            <div className="mb-4">
              <div className="text-[12px] font-semibold text-gray-700 mb-1">타고난 기질 <span className="text-[11px] font-normal text-gray-400">(격국)</span></div>
              <div className="text-[13px]">
                <strong>{structure.gyeokguk.name.replace(/\([^)]+\)/g, '')}</strong>
                <p className="text-[12px] text-gray-600 mt-0.5">{structure.gyeokguk.description}</p>
              </div>
            </div>
          )}

          {/* 용신 */}
          {structure.yongsin && (
            <div className="mb-4">
              <div className="text-[12px] font-semibold text-gray-700 mb-1">내게 필요한 기운 <span className="text-[11px] font-normal text-gray-400">(용신)</span></div>
              <div className="text-[13px]">
                <span>주 기운: </span>
                <strong className={EL_COLORS[structure.yongsin.primary]}>{structure.yongsin.primary}</strong>
                <span className="text-[11px] text-gray-500 ml-1">— {structure.yongsin.role}, {structure.yongsin.action}</span>
                {structure.yongsin.supportElements.length > 0 && (
                  <span className="ml-3">
                    보조:
                    {structure.yongsin.supportElements.map(e => <strong key={e} className={`${EL_COLORS[e]} ml-1`}>{e}</strong>)}
                  </span>
                )}
                <p className="text-[12px] text-gray-600 mt-1">{structure.yongsin.description}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">선택 근거: {structure.yongsin.basis}</p>
              </div>
            </div>
          )}

          {/* 합·충 */}
          {structure.hapChung.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-gray-700 mb-1">내 사주 속 관계 <span className="text-[11px] font-normal text-gray-400">(합·충)</span></div>
              <p className="text-[11px] text-gray-500 mb-2">합 = 친화·연결, 충 = 부딪침·변동이 일어나는 자리 조합</p>
              <div className="space-y-2">
                {structure.hapChung.map((hc, i) => {
                  const isChung = hc.type === '지지충';
                  const cls = isChung
                    ? 'border-red-200 bg-red-50'
                    : 'border-green-200 bg-green-50';
                  const badgeCls = isChung
                    ? 'border-red-300 text-red-700 bg-white'
                    : 'border-green-300 text-green-700 bg-white';
                  const plainType = isChung ? '충돌' : hc.type === '지지삼합' ? '삼합' : '친화';
                  const posText = hc.positions.length > 0 ? hc.positions.join(' ↔ ') : '원국 전체';
                  return (
                    <div key={i} className={`p-2.5 rounded-lg border ${cls}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeCls}`}>
                          {plainType}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {posText} <span className="text-gray-400">({hc.chars})</span>
                        </span>
                      </div>
                      <div className="text-[12px] font-semibold text-gray-800 mb-0.5">{hc.headline}</div>
                      <p className="text-[11px] text-gray-600 leading-snug">{hc.meaning}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}
    </div>
  );
}
