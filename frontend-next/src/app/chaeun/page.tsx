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

        {/* 1) 돈이 들어오는 5가지 경로 */}
        {wealthPaths && (() => {
          const PATH_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
            '재성': { bg: '#FEF3C7', bar: '#D97706', text: '#92400E' },
            '인성': { bg: '#E8F2FF', bar: '#3182F6', text: '#1E3A8A' },
            '식상': { bg: '#E8F5E5', bar: '#2D7A1F', text: '#1B5E20' },
            '관성': { bg: '#EDE9FE', bar: '#7C3AED', text: '#5B21B6' },
            '비겁': { bg: '#FEE7E2', bar: '#C33A1F', text: '#991B1B' },
          };
          const maxStrength = Math.max(...wealthPaths.paths.map(p => p.strength), 1);
          const dom = wealthPaths.dominant;
          const domColor = PATH_COLORS[dom.key];
          return (
            <div className="bg-white border border-gray-200 rounded-[16px] p-4 sm:p-5 mb-3">
              <div className="text-[14px] font-bold text-gray-900 mb-1">돈이 들어오는 5가지 경로</div>
              <div className="text-[11px] text-gray-500 mb-4 leading-relaxed">
                재물이 내 사주로 흘러 들어오는 방식은 한 가지가 아니에요. 아래 5경로 중 가장 강한 쪽이 나의 주 수익 채널이 됩니다.
              </div>

              {/* 5 경로 게이지 (강도 내림차순) */}
              <div className="space-y-3 mb-5">
                {wealthPaths.paths.map((p, i) => {
                  const isDominant = i === 0 && p.strength > 0;
                  const c = PATH_COLORS[p.key];
                  const barPct = maxStrength > 0 ? (p.strength / maxStrength) * 100 : 0;
                  return (
                    <div key={p.key}>
                      <div className="flex items-baseline justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ background: c.bg, color: c.text }}
                          >
                            {p.key}
                          </span>
                          <span className="text-[12px] font-semibold text-gray-800">{p.label}</span>
                          {isDominant && (
                            <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: c.bar, color: '#fff' }}>
                              주 경로
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500">{p.strength}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${barPct}%`,
                            background: c.bar,
                            opacity: isDominant ? 1 : 0.7,
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 leading-snug">{p.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* 주 경로 기반 한 줄 요약 */}
              <div className="rounded-xl p-3 mb-2" style={{ background: domColor.bg, borderLeft: `3px solid ${domColor.bar}` }}>
                <div className="text-[11px] font-bold mb-1" style={{ color: domColor.text }}>
                  주 경로: {dom.label} ({dom.key})
                </div>
                <div className="text-[12px] leading-relaxed" style={{ color: domColor.text }}>
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
          const tc = TYPE_COLORS[diagnosis.type];

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
              <div className="text-[11px] text-gray-400 mb-4">신강/중화/신약 × 재성 강약 6타입</div>

              <div className="mb-4">
                <div className="flex items-center flex-wrap gap-1.5 mb-3">
                  <span
                    className="inline-block rounded-full px-3 py-1 text-[12px] font-bold"
                    style={{ background: tc.solid, color: '#fff' }}
                  >
                    {diagnosis.type}
                  </span>
                  {bodyTag && (
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: bodyTag.bg, color: bodyTag.color }}
                    >
                      {bodyTag.text}
                    </span>
                  )}
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: dominTag.bg, color: dominTag.color }}
                  >
                    {dominTag.text}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-gray-800 leading-relaxed">
                  {diagnosis.headline}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                <div className="rounded-xl p-3" style={{ background: '#E8F5E5' }}>
                  <div className="text-[11px] font-bold text-green-700 mb-2">강점</div>
                  <ul className="space-y-1">
                    {diagnosis.strengths.map((s, i) => (
                      <li key={i} className="text-[11px] text-green-800 leading-snug">· {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl p-3" style={{ background: '#FEE7E2' }}>
                  <div className="text-[11px] font-bold text-red-700 mb-2">주의</div>
                  <ul className="space-y-1">
                    {diagnosis.cautions.map((s, i) => (
                      <li key={i} className="text-[11px] text-red-800 leading-snug">· {s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="text-[11px] font-bold text-gray-700 mb-2">권장 태도</div>
                <ul className="space-y-1.5">
                  {diagnosis.attitude.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 leading-relaxed">· {s}</li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="text-[11px] font-bold text-gray-700 mb-2">투자 스타일</div>
                <ul className="space-y-1.5">
                  {diagnosis.investmentStyle.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 leading-relaxed">· {s}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl p-3" style={{ background: '#FEF7ED' }}>
                <div className="text-[11px] font-bold text-orange-700 mb-2">피해야 할 행동</div>
                <ul className="space-y-1.5">
                  {diagnosis.avoid.map((s, i) => (
                    <li key={i} className="text-[12px] text-orange-900 leading-relaxed">· {s}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        {/* 3) 투자 성향 미터 */}
        {chaeseong!.totalCount > 0 && (
          <div className="bg-white border border-gray-200 rounded-[16px] p-4 sm:p-5 mb-3">
            <div className="text-[14px] font-bold text-gray-900 mb-1">투자 성향 미터</div>
            <div className="text-[11px] text-gray-400 mb-4">편재 ↔ 정재 비율</div>

            <div className="flex items-center gap-2 text-[11px] font-semibold mb-2">
              <span className="text-red-600">적극적 편재 {chaeseong!.pyeonJae}</span>
              <div className="flex-1" />
              <span className="text-blue-600">안정적 정재 {chaeseong!.jeongJae}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex">
              <div style={{ width: `${pyeonPct}%`, background: '#EF4444' }} />
              <div style={{ width: `${jeongPct}%`, background: '#3B82F6' }} />
            </div>
            <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
              {chaeseong!.dominantType === '편재' && '활동적 재물(편재) 비중이 높아 기회 포착·확장에 유리하지만 변동폭이 큽니다.'}
              {chaeseong!.dominantType === '정재' && '안정적 재물(정재) 비중이 높아 꾸준한 축적·저축에 유리합니다.'}
              {chaeseong!.dominantType === '균형' && '편재·정재가 균형을 이뤄 공격과 수비를 오가는 포트폴리오가 어울립니다.'}
              {chaeseong!.dominantType === '없음' && '원국에 재성이 약해 인성·식상 경로의 우회 축적이 어울립니다.'}
            </p>
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
        <div
          className="rounded-[12px] mt-6"
          style={{ background: '#EFF4FF', padding: '12px 14px', borderLeft: '3px solid #3B82F6' }}
        >
          <div className="text-[11px] font-bold text-blue-700 mb-1">다음 업데이트 예정</div>
          <div className="text-[11px] text-blue-900 leading-relaxed">
            AI 기반 개인 재운 전략 · 세운/월운 재물 세분화 · 재테크 유형 추천 매트릭스.
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
}
