'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildStructureAnalysis,
  CG_OH,
  OH_HJ,
  type Pillar,
  type DaeunEntry,
} from '@/features/fortune/lib/engine';
import {
  calculateChaeseongProfile,
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
        {/* saju 없으면: 입력 폼 + 저장 목록 */}
        {!saju && (
          <>
            <SajuInputPanel initial={initialForm} onCalculated={handleCalculated} submitLabel="재운 흐름 보기" />
            <div className="mt-4 p-6 text-center bg-white border border-gray-200 rounded-[16px]">
              <p className="text-[13px] text-gray-500 leading-relaxed">
                위에서 생년월일을 입력하거나 저장된 만세력을 선택하면<br />
                아래에 재운 흐름 분석이 펼쳐져요.
              </p>
            </div>
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
        {/* 프로필 요약 — 최상단, '다시 입력' 버튼 포함 */}
        <div className="bg-white border border-gray-200 rounded-[16px] p-4 mb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-gray-400 font-medium mb-1">대상</div>
              <div className="text-[13px] font-bold text-gray-900">
                {saju.year}년 {saju.month}월 {saju.day}일 · {saju.gender}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                일간 <span className={`font-bold ${EL_TEXT[CG_OH[ilgan] || ''] || ''}`}>{pillars[1]?.ck}{ilgan}</span>
                <span className="ml-1">· {CG_OH[ilgan]}({OH_HJ[CG_OH[ilgan]] || ''})</span>
                <span className="ml-2">· 재성 오행 <b className={chaeOhTextCls}>{chaeOh}({OH_HJ[chaeOh] || ''})</b></span>
              </div>
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

        {/* 1) 재성 프로파일 */}
        <div className="bg-white border border-gray-200 rounded-[16px] p-4 sm:p-5 mb-3">
          <div className="text-[14px] font-bold text-gray-900 mb-1">재성 프로파일</div>
          <div className="text-[11px] text-gray-400 mb-4">편재·정재 개수와 강도</div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-xl p-3 text-center" style={{ background: '#F2F4F7' }}>
              <div className="text-[11px] text-gray-500 font-semibold mb-1">편재</div>
              <div className="text-[22px] font-extrabold text-gray-900 leading-none">{chaeseong!.pyeonJae}<span className="text-[12px] font-medium text-gray-400 ml-1">개</span></div>
              <div className="text-[10px] text-gray-400 mt-1">활동적 재물</div>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: '#F2F4F7' }}>
              <div className="text-[11px] text-gray-500 font-semibold mb-1">정재</div>
              <div className="text-[22px] font-extrabold text-gray-900 leading-none">{chaeseong!.jeongJae}<span className="text-[12px] font-medium text-gray-400 ml-1">개</span></div>
              <div className="text-[10px] text-gray-400 mt-1">안정된 재물</div>
            </div>
          </div>

          {/* 강도 게이지 */}
          <div className="mb-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-gray-700">재성 강도</span>
              <span className="text-[12px] text-gray-500">{chaeseong!.strength}/100</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${chaeseong!.strength}%`,
                  background: `linear-gradient(90deg, ${EL_SOLID[chaeOh] || '#5B8DF0'} 0%, ${EL_SOLID[chaeOh] || '#5B8DF0'}cc 100%)`,
                }}
              />
            </div>
          </div>

          {/* 뿌리 유무 */}
          <div className="flex items-center gap-2 text-[12px] text-gray-600">
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: chaeseong!.hasRoot ? '#E8F5E5' : '#F2F4F7',
                color: chaeseong!.hasRoot ? '#2D7A1F' : '#6B7684',
              }}
            >
              {chaeseong!.hasRoot ? '뿌리 있음' : '뿌리 없음'}
            </span>
            <span className="text-gray-500">
              지장간 재성 합산 {chaeseong!.rootStrength}점
            </span>
          </div>
        </div>

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

              <div className="rounded-xl p-3 mb-2" style={{ background: '#F9FAFB' }}>
                <div className="text-[11px] font-bold text-gray-700 mb-1">권장 태도</div>
                <p className="text-[12px] text-gray-600 leading-relaxed">{diagnosis.attitude}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: '#F9FAFB' }}>
                <div className="text-[11px] font-bold text-gray-700 mb-1">투자 스타일</div>
                <p className="text-[12px] text-gray-600 leading-relaxed">{diagnosis.investmentStyle}</p>
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
