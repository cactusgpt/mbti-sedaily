'use client';

import { useState, useMemo } from 'react';
import { getGapja, CG_OH, JJ_OH, JJG, sipsung, unsung } from '../lib/engine';

const EL_COLORS: Record<string, string> = {
  '목': 'text-green-600', '화': 'text-red-500', '토': 'text-yellow-600',
  '금': 'text-gray-500', '수': 'text-blue-600',
};

const SS_MEANING: Record<string, string> = {
  '비견': '동료·경쟁자',
  '겁재': '경쟁·지출',
  '식신': '표현·여유',
  '상관': '재능·비판',
  '편재': '활동적 재물',
  '정재': '성실한 재물',
  '편관': '압박·도전',
  '정관': '명예·규율',
  '편인': '직관·영감',
  '정인': '학문·지혜',
};

const US_MEANING: Record<string, string> = {
  '장생': '새로운 시작', '목욕': '변화·불안정', '관대': '자신감·성장',
  '건록': '전성기 시작', '제왕': '에너지 정점', '쇠': '기운 쇠약',
  '병': '쇠약 상태', '사': '정체·막힘', '묘': '내면 회고',
  '절': '단절·전환', '태': '잉태·준비', '양': '조용한 성장',
};

const DOWS = ['일', '월', '화', '수', '목', '금', '토'];

interface Props { ilgan: string; }

interface DayInfo {
  day: number; dow: number;
  ganji: string; ganjiHanja: string;
  cgOh: string; jjOh: string;
  ss: string; us: string;
  isToday: boolean;
}

export function DailyCalendar({ ilgan }: Props) {
  const now = new Date();
  const [viewY, setViewY] = useState(now.getFullYear());
  const [viewM, setViewM] = useState(now.getMonth() + 1);
  const [showUs, setShowUs] = useState(false);  // false: 십성 / true: 12운성
  const [selectedDay, setSelectedDay] = useState<DayInfo | null>(null);

  const calData = useMemo(() => {
    const daysInMonth = new Date(viewY, viewM, 0).getDate();
    const firstDow = new Date(viewY, viewM - 1, 1).getDay();
    const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const days: DayInfo[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dow = (firstDow + d - 1) % 7;
      let ganji = '', ganjiHanja = '', cgOh = '', jjOh = '', ss = '', us = '';
      try {
        const g = getGapja(viewY, viewM, d);
        ganji = g.dayPillar;
        ganjiHanja = g.dayPillarHanja;
        cgOh = CG_OH[ganjiHanja[0]] || '';
        jjOh = JJ_OH[ganjiHanja[1]] || '';
        if (ilgan && ganjiHanja.length === 2) {
          ss = sipsung(ilgan, ganjiHanja[0]);
          us = unsung(ilgan, ganjiHanja[1]);
        }
      } catch {}
      days.push({
        day: d, dow, ganji, ganjiHanja, cgOh, jjOh, ss, us,
        isToday: `${viewY}-${viewM}-${d}` === todayStr,
      });
    }
    return { days, firstDow, daysInMonth };
  }, [viewY, viewM, now.getFullYear(), now.getMonth(), now.getDate(), ilgan]);

  const prevMonth = () => {
    if (viewM === 1) { setViewM(12); setViewY(viewY - 1); }
    else setViewM(viewM - 1);
  };
  const nextMonth = () => {
    if (viewM === 12) { setViewM(1); setViewY(viewY + 1); }
    else setViewM(viewM + 1);
  };
  const goToday = () => {
    setViewY(now.getFullYear());
    setViewM(now.getMonth() + 1);
  };
  const isCurrentMonth = viewY === now.getFullYear() && viewM === now.getMonth() + 1;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold text-gray-900">{viewY}년 {viewM}월 일진</h3>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <button onClick={goToday} className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded transition-colors">
              오늘
            </button>
          )}
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">&lsaquo;</button>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">&rsaquo;</button>
        </div>
      </div>

      {/* 표시 토글 */}
      <div className="flex gap-1 mb-3">
        <button onClick={() => setShowUs(false)}
          className={`px-2.5 py-1 text-[11px] rounded transition-colors ${!showUs ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}>
          십성 보기
        </button>
        <button onClick={() => setShowUs(true)}
          className={`px-2.5 py-1 text-[11px] rounded transition-colors ${showUs ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}>
          12운성 보기
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {DOWS.map((d, i) => (
          <div key={d} className={`text-center text-[11px] font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: calData.firstDow }).map((_, i) => (
          <div key={`empty-${i}`} className="py-1.5" />
        ))}
        {calData.days.map((info) => {
          const { day, dow, ganji, ss, us, isToday } = info;
          const subtitle = showUs ? us : ss;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(info)}
              className={`py-1.5 text-center rounded-lg transition-colors cursor-pointer ${isToday ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}>
              <div className={`text-[12px] font-medium ${isToday ? 'text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-700'}`}>
                {day}
              </div>
              <div className={`text-[11px] font-bold ${isToday ? 'text-gray-300' : 'text-gray-500'}`}>
                {ganji}
              </div>
              {subtitle && (
                <div className={`text-[9px] ${isToday ? 'text-gray-400' : 'text-gray-400'}`}>
                  {subtitle}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 선택된 날짜 상세 모달 */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4"
          onClick={() => setSelectedDay(null)}>
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-[15px] font-bold text-gray-900">
                  {viewY}년 {viewM}월 {selectedDay.day}일 ({DOWS[selectedDay.dow]})
                </h4>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  일진 <span className={`font-bold ${EL_COLORS[selectedDay.cgOh]}`}>{selectedDay.ganji}</span>
                  <span className="text-gray-400 ml-1.5">({selectedDay.ganjiHanja})</span>
                </p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {selectedDay.ss && (
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-gray-500 mb-0.5">십성</div>
                <div className="text-[13px]">
                  <strong>{selectedDay.ss}</strong>
                  <span className="text-[11px] text-gray-400 ml-1.5">{SS_MEANING[selectedDay.ss] || ''}</span>
                </div>
              </div>
            )}
            {selectedDay.us && (
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-gray-500 mb-0.5">12운성</div>
                <div className="text-[13px]">
                  <strong>{selectedDay.us}</strong>
                  <span className="text-[11px] text-gray-400 ml-1.5">{US_MEANING[selectedDay.us] || ''}</span>
                </div>
              </div>
            )}
            {selectedDay.ganjiHanja && JJG[selectedDay.ganjiHanja[1]] && (
              <div>
                <div className="text-[11px] font-semibold text-gray-500 mb-0.5">
                  지지({selectedDay.ganjiHanja[1]}) 속 숨은 기운
                </div>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  {JJG[selectedDay.ganjiHanja[1]].map((h, i, arr) => {
                    const weight = arr.length === 1 ? '본기' : arr.length === 2 ? (i === 0 ? '여기' : '본기') : (i === 0 ? '여기' : i === 1 ? '중기' : '본기');
                    const hss = ilgan ? sipsung(ilgan, h) : '';
                    return (
                      <span key={i} className={`px-1.5 py-0.5 rounded border ${weight === '본기' ? 'border-gray-400 bg-gray-50 font-medium' : 'border-gray-200 text-gray-500'}`}>
                        <span className="text-gray-400">{weight}</span>{' '}
                        <span>{h}</span>{' '}
                        {hss && <span className="text-gray-600">{hss}</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
