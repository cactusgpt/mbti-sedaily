'use client';

import { useState, useMemo } from 'react';
import { getGapja, CG_OH, JJ_OH, sipsung, unsung } from '../lib/engine';

const EL_COLORS: Record<string, string> = {
  '목': 'text-green-600', '화': 'text-red-500', '토': 'text-yellow-600',
  '금': 'text-gray-500', '수': 'text-blue-600',
};

const DOWS = ['일', '월', '화', '수', '목', '금', '토'];

interface Props { ilgan: string; }

export function DailyCalendar({ ilgan }: Props) {
  const now = new Date();
  const [viewY, setViewY] = useState(now.getFullYear());
  const [viewM, setViewM] = useState(now.getMonth() + 1);

  const calData = useMemo(() => {
    const daysInMonth = new Date(viewY, viewM, 0).getDate();
    const firstDow = new Date(viewY, viewM - 1, 1).getDay();
    const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const days: { day: number; dow: number; ganji: string; ganjiHanja: string; cgOh: string; isToday: boolean }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dow = (firstDow + d - 1) % 7;
      let ganji = '', ganjiHanja = '', cgOh = '';
      try {
        const g = getGapja(viewY, viewM, d);
        ganji = g.dayPillar;
        ganjiHanja = g.dayPillarHanja;
        cgOh = CG_OH[ganjiHanja[0]] || '';
      } catch {}
      days.push({ day: d, dow, ganji, ganjiHanja, cgOh, isToday: `${viewY}-${viewM}-${d}` === todayStr });
    }
    return { days, firstDow, daysInMonth };
  }, [viewY, viewM, now.getFullYear(), now.getMonth(), now.getDate()]);

  const prevMonth = () => {
    if (viewM === 1) { setViewM(12); setViewY(viewY - 1); }
    else setViewM(viewM - 1);
  };
  const nextMonth = () => {
    if (viewM === 12) { setViewM(1); setViewY(viewY + 1); }
    else setViewM(viewM + 1);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-gray-900">{viewY}년 {viewM}월 일진</h3>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">&lsaquo;</button>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">&rsaquo;</button>
        </div>
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
      <div className="grid grid-cols-7">
        {/* 빈 칸 */}
        {Array.from({ length: calData.firstDow }).map((_, i) => (
          <div key={`empty-${i}`} className="py-1.5" />
        ))}
        {/* 날짜 */}
        {calData.days.map(({ day, dow, ganji, cgOh, isToday }) => {
          const ss = ilgan && ganji ? sipsung(ilgan, ganji.length === 2 ? ganji[1] : '') : '';
          return (
            <div key={day} className={`py-1.5 text-center rounded-lg transition-colors ${isToday ? 'bg-gray-900 text-white' : ''}`}>
              <div className={`text-[12px] font-medium ${isToday ? 'text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-700'}`}>
                {day}
              </div>
              <div className={`text-[11px] font-bold ${isToday ? 'text-gray-300' : EL_COLORS[cgOh] || 'text-gray-500'}`}>
                {ganji}
              </div>
              {ss && (
                <div className={`text-[9px] ${isToday ? 'text-gray-400' : 'text-gray-400'}`}>
                  {ss}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
