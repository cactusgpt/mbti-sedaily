'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildStructureAnalysis,
  CG_OH,
  OH_HJ,
  REGION_OPTIONS,
  type Pillar,
  type DaeunEntry,
} from '@/features/fortune/lib/engine';
import {
  calculateChaeseongProfile,
  calculateWealthPaths,
  computeCurrentPeriodChaeun,
  diagnoseChaeun,
  evaluateDaeunChaeun,
} from '@/features/fortune/lib/engine-chaeun';
import { SajuInputPanel, type SajuCalcResult } from '@/features/fortune/components/SajuInputPanel';

interface CurrentSaju {
  year: number;
  month: number;
  day: number;
  gender: string;
  timeInput: string;
  region: string;
  pillars: Pillar[];
  ilgan: string;
  correctedTime?: { hour: number; minute: number };
  daeuns: DaeunEntry[];
}

const EL_TEXT: Record<string, string> = {
  '목': 'text-green-600', '화': 'text-red-500', '토': 'text-yellow-600',
  '금': 'text-gray-500', '수': 'text-blue-600',
};
const EL_BG: Record<string, string> = {
  '목': '#E8F5E5', '화': '#FEE7E2', '토': '#FBF1D6', '금': '#F2F4F7', '수': '#E8F2FF',
};
const EL_SOLID: Record<string, string> = {
  '목': '#2D7A1F', '화': '#C33A1F', '토': '#A97C1F', '금': '#4E5968', '수': '#3182F6',
};

const MAIN_TABS = [
  { id: 'question', name: '오늘의 질문' },
  { id: 'feed', name: '뉴스피드' },
  { id: 'community', name: '커뮤니티' },
  { id: 'archive', name: '내 서랍' },
  { id: 'dna', name: '나의 DNA' },
  { id: 'fortune', name: '오늘의 운세' },
];

function goToMain(tab?: string) {
  window.location.href = tab ? `/?tab=${tab}` : '/';
}

function TopNav({ activeId }: { activeId?: string }) {
  return (
    <header className="sticky top-0 bg-white z-[100] border-b border-gray-100">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center h-[56px] gap-6 sm:gap-10">
          <button
            type="button"
            onClick={() => goToMain()}
            className="text-[20px] font-bold text-gray-900 tracking-tight flex-shrink-0 border-none bg-transparent cursor-pointer"
          >
            AI LENS
          </button>
          <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide">
            {MAIN_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => goToMain(t.id)}
                className={`px-2.5 lg:px-4 py-2 text-[12px] lg:text-[14px] font-medium rounded-lg transition-colors duration-200 whitespace-nowrap flex-shrink-0 ${
                  activeId === t.id
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {t.name}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

const TYPE_COLORS: Record<string, { bg: string; color: string; solid: string }> = {
  '관리형':   { bg: '#E8F5E5', color: '#2D7A1F', solid: '#2D7A1F' },
  '확장형':   { bg: '#E8F2FF', color: '#3182F6', solid: '#3182F6' },
  '균형형':   { bg: '#ECFEFF', color: '#0E7490', solid: '#0891B2' },
  '기회형':   { bg: '#FFF7ED', color: '#9A3412', solid: '#EA580C' },
  '재다신약': { bg: '#FEF3C7', color: '#92400E', solid: '#B45309' },
  '우회축적': { bg: '#EDE9FE', color: '#5B21B6', solid: '#7C3AED' },
};

export default function ChaeunPage() {
  const [saju, setSaju] = useState<CurrentSaju | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('saju_current');
      if (raw) setSaju(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  // 파생 값 (saju 없으면 기본값)
  const pillars = saju?.pillars ?? [];
  const ilgan = saju?.ilgan ?? '';
  const daeuns = saju?.daeuns ?? [];
  const year = saju?.year ?? 0;

  const structure = saju ? buildStructureAnalysis(pillars) : null;
  const chaeseong = saju ? calculateChaeseongProfile(pillars) : null;
  const wealthPaths = saju ? calculateWealthPaths(pillars) : null;
  const periodChaeun = saju && ilgan ? computeCurrentPeriodChaeun(ilgan, pillars) : null;
  const diagnosis = structure?.singangyak && chaeseong ? diagnoseChaeun(structure.singangyak, chaeseong) : null;
  const timeline = saju ? evaluateDaeunChaeun(daeuns, ilgan) : [];

  const now = new Date();
  const currentAge = year > 0 ? now.getFullYear() - year : 0;
  const currentIdx = timeline.findIndex(s => currentAge >= s.age && currentAge < s.age + 10);

  // 대운 타임라인: 현재 구간을 맨 왼쪽으로 자동 스크롤
  useEffect(() => {
    if (currentIdx < 0 || !timelineScrollRef.current) return;
    // 카드 width 112 + gap 8 = 120px
    const offset = currentIdx * 120;
    timelineScrollRef.current.scrollTo({ left: offset, behavior: 'auto' });
  }, [currentIdx]);

  // SajuInputPanel → 계산 결과를 localStorage + 로컬 state에 반영 + 폼 자동 접힘
  const handleCalculated = (r: SajuCalcResult) => {
    setSaju({
      year: r.year, month: r.month, day: r.day, gender: r.gender,
      timeInput: r.timeInput, region: r.region,
      pillars: r.pillars, ilgan: r.ilgan,
      correctedTime: r.correctedTime, daeuns: r.daeuns,
    });
    setFormOpen(false);
  };

  // 폼 프리필 값 (현재 로드된 saju가 있으면 그 값으로)
  const initialForm = saju ? {
    birthdate: `${saju.year} / ${String(saju.month).padStart(2, '0')} / ${String(saju.day).padStart(2, '0')}`,
    timeInput: saju.timeInput,
    noTime: !saju.timeInput,
    gender: saju.gender as '남' | '여',
    region: saju.region,
  } : undefined;

  if (!loaded) return null;

  // 편재/정재 비율 (saju 있을 때만 의미)
  const chaeOh = chaeseong?.chaeOh ?? '';
  const chaeOhTextCls = EL_TEXT[chaeOh] || 'text-gray-700';
  const total = chaeseong ? (chaeseong.totalCount || 1) : 1;
  const pyeonPct = chaeseong ? (chaeseong.pyeonJae / total) * 100 : 0;
  const jeongPct = chaeseong ? (chaeseong.jeongJae / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <TopNav activeId="fortune" />

      {/* 페이지 타이틀 + 뒤로가기 */}
      <div className="bg-white w-full border-b border-gray-100">
        <div className="max-w-[480px] mx-auto px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => goToMain('fortune')}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 border-none bg-transparent cursor-pointer"
            aria-label="운세 탭으로 돌아가기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4E5968" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-gray-400 font-medium">재운 심화</div>
            <div className="text-[18px] font-extrabold text-gray-900 tracking-[-0.03em]">재운 흐름 보기</div>
          </div>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-3 sm:px-[14px] pt-4 pb-10">
        {/* saju 없으면: 안내 + 입력 폼 + 저장 목록 */}
        {!saju && (
          <>
            <p className="mb-4 text-center text-[13px] text-gray-500 leading-relaxed">
              아래에서 생년월일을 입력하거나 저장된 만세력을 선택하면<br />
              재운 흐름 분석이 펼쳐져요.
            </p>
            <SajuInputPanel initial={initialForm} onCalculated={handleCalculated} submitLabel="재운 흐름 보기" />
          </>
        )}

        {/* saju 있고 폼 열림: 입력 폼만 노출 */}
        {saju && formOpen && (
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="w-full mb-3 py-2.5 text-[13px] text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors border-none cursor-pointer"
            >
              입력 취소하고 돌아가기
            </button>
            <SajuInputPanel initial={initialForm} onCalculated={handleCalculated} submitLabel="재운 흐름 보기" />
          </>
        )}

        {saju && !formOpen && chaeseong && (<>
        {/* 프로필 요약 — FortuneTab 컴팩트 카드 스타일로 통일 */}
        {(() => {
          const ilganOh = CG_OH[ilgan] || '';
          const dateLabel = `${saju.year}년 ${saju.month}월 ${saju.day}일`;
          const regionLabel = REGION_OPTIONS.find(r => r.value === saju.region)?.label || '보정 안함';
          let offsetLabel = '';
          if (saju.correctedTime && saju.timeInput) {
            const raw = saju.timeInput.replace(/[^0-9]/g, '');
            if (raw.length === 4) {
              const inMin = parseInt(raw.slice(0, 2)) * 60 + parseInt(raw.slice(2, 4));
              const outMin = saju.correctedTime.hour * 60 + saju.correctedTime.minute;
              const diff = outMin - inMin;
              if (diff !== 0) offsetLabel = ` (경도보정 ${diff > 0 ? '+' : ''}${diff}분)`;
            }
          }
          const subtitle = [saju.gender, regionLabel].filter(Boolean).join(' · ') + offsetLabel;
          return (
            <div className="bg-white border border-gray-200 rounded-[16px] p-4 mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px] font-bold shrink-0"
                  style={{
                    background: EL_BG[ilganOh] || '#F2F4F7',
                    color: EL_SOLID[ilganOh] || '#6B7684',
                  }}
                >
                  {ilgan || '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-gray-900 truncate">
                    {dateLabel}{saju.timeInput && ` ${saju.timeInput}`}
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">{subtitle}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="shrink-0 border-none rounded-lg cursor-pointer px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  다시 입력
                </button>
              </div>
            </div>
          );
        })()}

        {/* 0) 시기별 재운 흐름 (최상단) */}
        {periodChaeun && (periodChaeun.yeonun || periodChaeun.wolun || periodChaeun.iljin) && (() => {
          type LottoBreakdown = { label: string; points: number; note: string; met: boolean };
          type LottoInfo = { stars: number; score: number; label: string; note: string; breakdown: LottoBreakdown[]; disclaimer: string };
          type Row = { label: string; sub: string; ganji: string; ganjiHanja: string; themeLine: string; note: string; categories: string[]; lotto: LottoInfo };
          const rows: Row[] = [];
          if (periodChaeun.yeonun) {
            rows.push({
              label: '올해',
              sub: `${periodChaeun.yeonun.year}`,
              ganji: periodChaeun.yeonun.ganji,
              ganjiHanja: periodChaeun.yeonun.ganjiHanja,
              themeLine: periodChaeun.yeonun.themeLine,
              note: periodChaeun.yeonun.note,
              categories: periodChaeun.yeonun.categories,
              lotto: periodChaeun.yeonun.lotto,
            });
          }
          if (periodChaeun.wolun) {
            rows.push({
              label: '이번 달',
              sub: `${periodChaeun.wolun.month}월`,
              ganji: periodChaeun.wolun.ganji,
              ganjiHanja: periodChaeun.wolun.ganjiHanja,
              themeLine: periodChaeun.wolun.themeLine,
              note: periodChaeun.wolun.note,
              categories: periodChaeun.wolun.categories,
              lotto: periodChaeun.wolun.lotto,
            });
          }
          if (periodChaeun.iljin) {
            rows.push({
              label: '오늘',
              sub: periodChaeun.iljin.dateLabel,
              ganji: periodChaeun.iljin.ganji,
              ganjiHanja: periodChaeun.iljin.ganjiHanja,
              themeLine: periodChaeun.iljin.themeLine,
              note: periodChaeun.iljin.note,
              categories: periodChaeun.iljin.categories,
              lotto: periodChaeun.iljin.lotto,
            });
          }
          const PATH_COLOR: Record<string, string> = {
            '재성': '#D97706', '인성': '#3182F6', '식상': '#2D7A1F', '관성': '#7C3AED', '비겁': '#C33A1F',
          };
          const renderStars = (n: number) => {
            return (
              <span className="inline-flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} style={{ fontSize: 13, color: i <= n ? '#EA580C' : '#94A3B8', lineHeight: 1 }}>★</span>
                ))}
              </span>
            );
          };

          // 본문 핵심 키워드 자동 볼드
          const BOLD_KEYWORDS = [
            '재성', '편재', '정재',
            '관성', '편관', '정관',
            '인성', '편인', '정인',
            '식상', '식신', '상관',
            '비겁', '비견', '겁재',
            '창작·서비스', '창작·수익', '학습·자격', '사업·투자·영업',
            '직장·지위', '직장 재물', '협업', '퍼스널 브랜드', '네트워크',
            '올해', '이번 달', '오늘',
          ];
          const renderBoldNote = (text: string) => {
            const pattern = new RegExp(`(${BOLD_KEYWORDS.join('|')})`, 'g');
            return text.split(pattern).map((part, idx) =>
              BOLD_KEYWORDS.includes(part)
                ? <span key={idx} className="font-bold text-slate-900">{part}</span>
                : <span key={idx}>{part}</span>
            );
          };

          // 행별 배경: 모노톤 슬레이트 점진 (멀수록 옅음 → 오늘이 가장 선명)
          const ROW_BG: Record<string, { bg: string; border: string }> = {
            '올해': { bg: '#F8FAFC', border: '#E2E8F0' },       // slate-50
            '이번 달': { bg: '#F1F5F9', border: '#CBD5E1' },    // slate-100
            '오늘': { bg: '#FFFFFF', border: '#0F172A' },       // white + slate-900 border (강조)
          };
          return (
            <div className="bg-white border border-gray-200 rounded-[16px] p-4 sm:p-5 mb-3">
              <div className="text-[14px] font-bold text-gray-900 mb-1">시기별 재운 흐름</div>
              <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
                올해(세운) · 이번 달(월운) · 오늘(일진) 간지가 내 일간에게 가져오는 재운 영향이에요.
              </div>
              {periodChaeun.flowNarrative && (
                <div className="flex gap-3 mb-4">
                  <div className="w-[3px] rounded-full bg-slate-900 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-slate-500 mb-0.5 tracking-tight">흐름 요약</div>
                    <p className="text-[12px] text-slate-900 leading-relaxed">{periodChaeun.flowNarrative}</p>
                  </div>
                </div>
              )}
              <div className="relative pl-6">
                {/* 시간 흐름 세로선 — 슬레이트 점진 (옅음 → 진함) */}
                <div
                  className="absolute w-[2px] rounded-full"
                  style={{
                    left: 8,
                    top: 18,
                    bottom: 18,
                    background: 'linear-gradient(to bottom, #CBD5E1 0%, #64748B 50%, #0F172A 100%)',
                  }}
                />
                <div className="space-y-3">
                {rows.map((r, i) => {
                  const rowStyle = ROW_BG[r.label] || ROW_BG['오늘'];
                  const dotColor = r.label === '올해' ? '#CBD5E1' : r.label === '이번 달' ? '#64748B' : '#0F172A';
                  const isNow = r.label === '오늘';
                  return (
                  <div key={i} className="relative">
                    {/* 타임라인 노드 */}
                    <div
                      className="absolute rounded-full border-[3px] border-white"
                      style={{
                        left: -22,
                        top: 14,
                        width: isNow ? 16 : 12,
                        height: isNow ? 16 : 12,
                        background: dotColor,
                        boxShadow: `0 0 0 1.5px ${dotColor}${isNow ? '' : '66'}`,
                      }}
                    />
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: rowStyle.bg,
                      border: `${isNow ? 2 : 1}px solid ${isNow ? '#0F172A' : rowStyle.border}`,
                      boxShadow: isNow ? '0 6px 16px rgba(15, 23, 42, 0.12)' : 'none',
                    }}
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-[12px] font-bold text-gray-900 shrink-0">{r.label}</span>
                        <span className="text-[11px] text-gray-400 truncate">{r.sub}</span>
                      </div>
                      <div className="flex items-baseline gap-1 shrink-0">
                        <span className="text-[14px] font-extrabold text-gray-900 tracking-tight">{r.ganji}</span>
                        <span className="text-[10px] text-gray-400 font-mono">({r.ganjiHanja})</span>
                      </div>
                    </div>
                    {r.categories.length > 0 && (
                      <div className="flex items-center gap-1 mb-2">
                        {r.categories.map((c, ci) => (
                          <span
                            key={ci}
                            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: `${PATH_COLOR[c]}14`, color: PATH_COLOR[c] }}
                          >
                            {c} +
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[12px] text-gray-700 leading-relaxed mb-2">{renderBoldNote(r.note)}</p>

                    {/* 로또/횡재 운 — 오늘 row에만 노출 (세부 점수 공개) */}
                    {r.label === '오늘' && (
                      <div className="rounded-lg px-3 py-3" style={{ background: '#FFFBEB' }}>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-[10px] font-bold text-amber-800 shrink-0">🎲 로또 운</span>
                          {renderStars(r.lotto.stars)}
                          <span className="text-[11px] font-semibold text-amber-900 shrink-0">· {r.lotto.label}</span>
                          <span className="ml-auto text-[11px] font-bold text-amber-900">{r.lotto.score}/100</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-snug mb-2">{r.lotto.note}</p>

                        <details className="group">
                          <summary className="text-[10px] text-amber-700 cursor-pointer list-none flex items-center gap-1 hover:text-amber-900">
                            <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                            점수 내역 보기
                          </summary>
                          <div className="mt-2 space-y-1">
                            {r.lotto.breakdown.map((b, bi) => (
                              <div key={bi} className="flex items-baseline gap-2 text-[10px]">
                                <span className={`shrink-0 w-[4px] h-[4px] rounded-full mt-[5px] ${b.met ? 'bg-amber-600' : 'bg-amber-200'}`} />
                                <span className="text-amber-900 font-semibold w-[70px] shrink-0">{b.label}</span>
                                <span className={`font-bold w-[34px] shrink-0 ${b.points > 0 ? 'text-emerald-700' : b.points < 0 ? 'text-red-600' : 'text-amber-700/60'}`}>
                                  {b.points > 0 ? `+${b.points}` : b.points}
                                </span>
                                <span className="text-amber-800/80 leading-snug">{b.note}</span>
                              </div>
                            ))}
                          </div>
                        </details>

                        <p className="text-[9px] text-amber-700/70 mt-2 leading-snug italic">
                          ※ {r.lotto.disclaimer}
                        </p>
                      </div>
                    )}
                  </div>
                  </div>
                  );
                })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 1) 돈이 들어오는 5가지 경로 */}
        {wealthPaths && (() => {
          const maxStrength = Math.max(...wealthPaths.paths.map(p => p.strength), 1);
          const dom = wealthPaths.dominant;
          return (
            <div className="bg-white border border-gray-200 rounded-[16px] p-4 sm:p-5 mb-3">
              <div className="text-[14px] font-bold text-gray-900 mb-1">돈이 들어오는 5가지 경로</div>
              <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
                재물이 내 사주로 흘러 들어오는 방식은 한 가지가 아니에요. 아래 5경로 중 가장 강한 쪽이 나의 주 수익 채널이 됩니다.
              </div>

              {/* 5 경로 게이지 (강도 내림차순) */}
              <div className="space-y-3 mb-3">
                {wealthPaths.paths.map((p, i) => {
                  const isDominant = i === 0 && p.strength > 0;
                  const barPct = maxStrength > 0 ? (p.strength / maxStrength) * 100 : 0;
                  return (
                    <div key={p.key}>
                      <div className="flex items-baseline justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isDominant ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {p.key}
                          </span>
                          <span className={`text-[12px] font-semibold ${isDominant ? 'text-slate-900' : 'text-slate-600'}`}>{p.label}</span>
                          {isDominant && (
                            <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900 text-white">
                              주 경로
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] text-slate-400 font-mono">({p.count}·{p.rootStrength})</span>
                          <span className={`text-[11px] ${isDominant ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>{p.strength}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${barPct}%`,
                            background: isDominant ? '#0F172A' : '#CBD5E1',
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug">{p.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* 산출 공식 주석 */}
              <details className="group mb-4">
                <summary className="text-[10px] text-slate-500 cursor-pointer list-none flex items-center gap-1 hover:text-slate-700">
                  <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                  점수는 어떻게 계산됐나요?
                </summary>
                <div className="mt-2 rounded-lg p-3 bg-slate-50 text-[11px] text-slate-700 leading-relaxed">
                  <div className="font-semibold mb-1.5 text-slate-900">강도 = 간·지 본기 개수 × 10 + 지장간 뿌리 × 5 (최대 100)</div>
                  <ul className="space-y-1 text-[10.5px]">
                    <li>· <b>간·지 본기</b>: 원국 천간(일간 제외) + 지지 본기 중 해당 오행 개수</li>
                    <li>· <b>지장간 뿌리</b>: 지지 속 숨은 천간의 위치별 가중치 (본기 3 · 중기 2 · 여기 1) 합산</li>
                    <li>· 각 row의 <span className="font-mono">(N·M)</span> 은 <b>간·지 N개 · 뿌리 M점</b> 을 뜻해요</li>
                  </ul>
                </div>
              </details>

              {/* 주 경로 기반 한 줄 요약 — 흐름 요약과 동일한 직선 스타일 */}
              <div className="flex gap-3 mb-2">
                <div className="w-[3px] rounded-full bg-slate-900 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-slate-500 mb-0.5 tracking-tight">
                    주 경로: {dom.label} ({dom.key})
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-900">
                    {wealthPaths.fallback
                      ? '전반적으로 재물 기운이 모두 약한 편이에요. 당장의 수익보다 내공·경험을 쌓는 시기로 보고 긴 호흡을 가져가시면 좋아요.'
                      : dom.key === '재성'
                        ? '돈을 직접 다루는 힘이 가장 강한 구조예요. 사업·투자·영업 등 주도적으로 자산을 운용하는 쪽이 잘 맞아요.'
                        : dom.key === '인성'
                          ? '실력·전문성이 그대로 수익이 되는 구조예요. 학문·자격·강의·컨설팅처럼 지식을 보수로 바꾸는 채널을 키우세요.'
                          : dom.key === '식상'
                            ? '표현·창작·서비스로 가치를 만들어내는 구조예요. 콘텐츠·프리랜스·퍼스널 브랜드 쪽이 잘 풀려요.'
                            : dom.key === '관성'
                              ? '직장·조직·지위에서 안정 수익이 오는 구조예요. 회사·공직·전문직 트랙에서 꾸준히 쌓아가는 게 어울려요.'
                              : '동료·네트워크와의 협업이 돈으로 이어지는 구조예요. 공동 사업·협업 프로젝트·커뮤니티 기반 수익이 잘 맞아요.'}
                  </p>
                </div>
              </div>

              {/* 재성 상세 (재성이 있을 때만 세부 편재/정재) */}
              {chaeseong!.totalCount > 0 && (
                <div className="rounded-xl p-3 mt-3" style={{ background: '#F9FAFB' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-gray-700">재성 상세</span>
                    <span className="text-[10px] text-gray-400">
                      뿌리 {chaeseong!.hasRoot ? `있음 · ${chaeseong!.rootStrength}점` : '없음'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2.5 text-center bg-white">
                      <div className="text-[10px] text-gray-500 font-semibold mb-0.5">편재</div>
                      <div className="text-[18px] font-extrabold text-gray-900 leading-none">{chaeseong!.pyeonJae}<span className="text-[11px] font-medium text-gray-400 ml-0.5">개</span></div>
                      <div className="text-[9px] text-gray-400 mt-1 leading-tight">사업·투자<br />유동 자금</div>
                    </div>
                    <div className="rounded-lg p-2.5 text-center bg-white">
                      <div className="text-[10px] text-gray-500 font-semibold mb-0.5">정재</div>
                      <div className="text-[18px] font-extrabold text-gray-900 leading-none">{chaeseong!.jeongJae}<span className="text-[11px] font-medium text-gray-400 ml-0.5">개</span></div>
                      <div className="text-[9px] text-gray-400 mt-1 leading-tight">월급·저축<br />고정 자산</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 2) 6타입 진단 */}
        {diagnosis && (() => {
          // 보조 태그: 신강/중화/신약
          const sgyLevel = structure?.singangyak?.level;
          const bodyTag =
            sgyLevel === '극신강' ? { text: '극신강', bg: '#FEE7E2', color: '#C33A1F' } :
            sgyLevel === '신강' ? { text: '신강', bg: '#FEE7E2', color: '#C33A1F' } :
            sgyLevel === '중화' ? { text: '중화', bg: '#E8F5E5', color: '#2D7A1F' } :
            sgyLevel === '신약' ? { text: '신약', bg: '#E8F2FF', color: '#3182F6' } :
            sgyLevel === '극신약' ? { text: '극신약', bg: '#E8F2FF', color: '#3182F6' } :
            null;

          // 보조 태그: 편재/정재 우세
          const dominTag =
            chaeseong!.dominantType === '편재' ? { text: '편재 우세', bg: '#FEE7E2', color: '#C33A1F' } :
            chaeseong!.dominantType === '정재' ? { text: '정재 우세', bg: '#E8F2FF', color: '#3182F6' } :
            chaeseong!.dominantType === '균형' ? { text: '편재·정재 균형', bg: '#ECFEFF', color: '#0E7490' } :
            { text: '재성 없음', bg: '#F2F4F7', color: '#6B7684' };

          return (
            <div className="bg-white border border-gray-200 rounded-[16px] p-4 sm:p-5 mb-3">
              <div className="text-[14px] font-bold text-gray-900 mb-1">유형 진단</div>
              <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
                두 축을 교차해 6가지 유형 중 하나로 진단해요.
              </div>

              {/* 산출 기준 (접힘) */}
              <details className="group mb-4">
                <summary className="text-[11px] text-slate-500 cursor-pointer list-none flex items-center gap-1 hover:text-slate-700">
                  <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                  산출 기준 자세히 보기
                </summary>
                <div className="mt-2.5 rounded-lg p-3 bg-slate-50 space-y-2.5">
                  <div>
                    <div className="text-[11px] font-bold text-slate-800 mb-0.5">1) 일간 세력 (신강 / 중화 / 신약)</div>
                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      원국의 월지·일지·세력이 일간(나)을 얼마나 받쳐주는지로 판단해요. <b>득령</b>(월지 도움) · <b>득지</b>(일지 도움) · <b>득세</b>(주변 기운의 도움) 3가지를 점수화해서 <b>극신강 / 신강 / 중화 / 신약 / 극신약</b> 5단계로 나누고, 이를 다시 <b>신강 · 중화 · 신약</b> 3그룹으로 묶어요.
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-2.5">
                    <div className="text-[11px] font-bold text-slate-800 mb-0.5">2) 재성 강약 (강 / 약)</div>
                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      원국 천간·지지에 있는 <b>편재·정재 개수</b>와 <b>지장간 속 뿌리 강도</b>를 합산해 <b>0~100</b> 점수로 만들고, <b>40점 이상은 &apos;재성 강&apos;</b>, 미만이면 &apos;재성 약&apos;으로 분류해요.
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-2.5">
                    <div className="text-[11px] font-bold text-slate-800 mb-1.5">3) 교차 매트릭스</div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
                      <div />
                      <div className="font-bold text-slate-500 py-1">재성 강</div>
                      <div className="font-bold text-slate-500 py-1">재성 약</div>
                      <div className="font-bold text-slate-700 py-1.5 text-right pr-1">신강</div>
                      <div className="bg-white rounded py-1.5 text-slate-800 font-semibold">관리형</div>
                      <div className="bg-white rounded py-1.5 text-slate-800 font-semibold">확장형</div>
                      <div className="font-bold text-slate-700 py-1.5 text-right pr-1">중화</div>
                      <div className="bg-white rounded py-1.5 text-slate-800 font-semibold">균형형</div>
                      <div className="bg-white rounded py-1.5 text-slate-800 font-semibold">기회형</div>
                      <div className="font-bold text-slate-700 py-1.5 text-right pr-1">신약</div>
                      <div className="bg-white rounded py-1.5 text-slate-800 font-semibold">재다신약</div>
                      <div className="bg-white rounded py-1.5 text-slate-800 font-semibold">우회축적</div>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2 leading-snug">
                      내 원국 위치가 매트릭스의 어느 칸에 떨어지는지에 따라 위 6유형 중 하나로 진단돼요.
                    </div>
                  </div>
                </div>
              </details>

              <div className="mb-4">
                <div className="flex items-center flex-wrap gap-1.5 mb-3">
                  <span className="inline-block rounded-full px-3 py-1 text-[12px] font-bold bg-slate-900 text-white">
                    {diagnosis.type}
                  </span>
                  {bodyTag && (
                    <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-gray-600 border border-gray-200">
                      {bodyTag.text}
                    </span>
                  )}
                  <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-gray-600 border border-gray-200">
                    {dominTag.text}
                  </span>
                </div>
                <p className="text-[14px] font-semibold text-gray-900 leading-relaxed">
                  {diagnosis.headline}
                </p>
              </div>

              {/* 강점 */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-block w-1 h-4 rounded-sm bg-slate-900" />
                  <span className="text-[13px] font-extrabold text-gray-900 tracking-tight">강점</span>
                </div>
                <ul className="space-y-1.5">
                  {diagnosis.strengths.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-gray-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 주의 */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-block w-1 h-4 rounded-sm bg-slate-700" />
                  <span className="text-[13px] font-extrabold text-gray-900 tracking-tight">주의</span>
                </div>
                <ul className="space-y-1.5">
                  {diagnosis.cautions.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-gray-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 권장 태도 */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-block w-1 h-4 rounded-sm bg-slate-400" />
                  <span className="text-[13px] font-extrabold text-gray-900 tracking-tight">권장 태도</span>
                </div>
                <ul className="space-y-1.5">
                  {diagnosis.attitude.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-gray-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 투자 스타일 */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-block w-1 h-4 rounded-sm bg-slate-400" />
                  <span className="text-[13px] font-extrabold text-gray-900 tracking-tight">투자 스타일</span>
                </div>
                <ul className="space-y-1.5">
                  {diagnosis.investmentStyle.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-gray-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 피해야 할 행동 */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-block w-1 h-4 rounded-sm bg-red-500" />
                  <span className="text-[13px] font-extrabold text-gray-900 tracking-tight">피해야 할 행동</span>
                </div>
                <ul className="space-y-1.5">
                  {diagnosis.avoid.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-gray-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        {/* 3) 돈 쓰는 성격 (적극형 ↔ 안정형) */}
        {chaeseong!.totalCount > 0 && (
          <div className="bg-white border border-gray-200 rounded-[16px] p-4 sm:p-5 mb-3">
            <div className="text-[14px] font-bold text-gray-900 mb-1">내 돈 기운의 성격</div>
            <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
              재물(재성)은 크게 두 가지로 나뉘어요. <b>편재</b>는 큰 돈이 들락날락하는 <b>활동적</b>인 재물, <b>정재</b>는 월급처럼 꾸준히 쌓이는 <b>안정적</b>인 재물이에요. 내 사주엔 어느 쪽이 더 많을까요?
            </div>

            {/* 양쪽 라벨 */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-red-600">적극형 · 편재 {chaeseong!.pyeonJae}개</div>
                <div className="text-[10px] text-gray-400 leading-tight mt-0.5">사업·투자·영업<br />기회를 만들러 나감</div>
              </div>
              <div className="text-right min-w-0">
                <div className="text-[12px] font-bold text-blue-600">안정형 · 정재 {chaeseong!.jeongJae}개</div>
                <div className="text-[10px] text-gray-400 leading-tight mt-0.5">월급·저축·고정 자산<br />꾸준히 쌓아감</div>
              </div>
            </div>

            {/* 비율 바 */}
            <div className="h-3 rounded-full overflow-hidden flex mb-2">
              <div style={{ width: `${pyeonPct}%`, background: '#EF4444' }} />
              <div style={{ width: `${jeongPct}%`, background: '#3B82F6' }} />
            </div>

            {/* 해석 박스 */}
            <div className="rounded-xl p-3 mt-3" style={{ background: '#F9FAFB' }}>
              <div className="text-[11px] font-bold text-gray-700 mb-1.5">이렇게 읽으면 돼요</div>
              <p className="text-[12px] text-gray-600 leading-relaxed">
                {chaeseong!.dominantType === '편재' && (<>
                  <b>활동형(편재)</b>이 더 강한 구조예요. 새로운 기회가 생기면 빠르게 움직여 큰 수익을 만들 수 있지만, 수입·지출의 <b>기복이 크기 때문에</b> 여유 자금을 따로 두어 안전망을 만드는 게 중요해요.
                </>)}
                {chaeseong!.dominantType === '정재' && (<>
                  <b>안정형(정재)</b>이 더 강한 구조예요. 규칙적인 소득·저축·장기 투자로 <b>꾸준히 불려 나가는 방식</b>이 잘 맞고, 급작스러운 투기·단기 트레이딩은 체질에 맞지 않는 편이에요.
                </>)}
                {chaeseong!.dominantType === '균형' && (<>
                  <b>활동형과 안정형이 비슷하게 섞인</b> 구조예요. 상황에 따라 공격(신규 투자·사업)과 수비(저축·장기 보유)를 유연하게 전환할 수 있어요. 한쪽에 치우치지 말고 <b>비중을 조절</b>하며 운용하세요.
                </>)}
                {chaeseong!.dominantType === '없음' && (<>
                  원국에 재성이 거의 없어서 편재/정재 구분의 의미가 작아요. <b>재물 그 자체보다 인성(실력)·식상(창작)</b> 같은 다른 경로로 돈이 들어오는 구조이니, 그쪽을 키우는 데 먼저 집중하시면 좋아요.
                </>)}
              </p>
            </div>
          </div>
        )}

        {/* 4) 대운 재물 타임라인 */}
        {timeline.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-[16px] p-4 sm:p-5 mb-3">
            <div className="text-[14px] font-bold text-gray-900 mb-1">대운 재물 타임라인</div>
            <div className="text-[11px] text-gray-400 mb-4">10년 주기로 보는 평생 재물 흐름</div>

            <div ref={timelineScrollRef} className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {timeline.map((seg, i) => {
                const isCurrent = currentAge >= seg.age && currentAge < seg.age + 10;
                const ratingStyle = seg.rating === 'strong'
                  ? { bg: '#E8F5E5', label: '#2D7A1F', border: '#BFE3B3' }
                  : seg.rating === 'caution'
                    ? { bg: '#FEE7E2', label: '#C33A1F', border: '#F8C4B8' }
                    : { bg: '#F2F4F7', label: '#4E5968', border: '#D7DBE1' };
                return (
                  <div
                    key={i}
                    className="flex-shrink-0 rounded-xl p-3 text-center"
                    style={{
                      width: 112,
                      background: isCurrent ? '#fff' : ratingStyle.bg,
                      border: `2px solid ${isCurrent ? '#3182F6' : ratingStyle.border}`,
                    }}
                  >
                    <div className="text-[10px] text-gray-500 font-semibold">
                      {seg.age}세
                      {isCurrent && <span className="ml-1 text-blue-600">· 현재</span>}
                    </div>
                    <div className="text-[15px] font-extrabold text-gray-900 my-1 leading-none">
                      {seg.ganji}
                    </div>
                    <div className="text-[9px] text-gray-400 font-mono mb-2">{seg.ganjiHanja}</div>
                    <div
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold inline-block"
                      style={{ background: ratingStyle.label, color: '#fff' }}
                    >
                      {seg.theme}
                    </div>
                    {seg.note && (
                      <div className="text-[10px] text-gray-500 mt-2 leading-tight text-left">
                        {seg.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 다음 스프린트 안내 */}
        </>)}
      </div>
    </div>
  );
}
