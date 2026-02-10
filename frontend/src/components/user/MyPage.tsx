import { useState, useEffect, useMemo } from "react";
import { getReadingStats, getMonthlyReadings, type ReadingStats } from "@/lib/readingTracker";

interface Props {
  onClose: () => void;
}

export function MyPage({ onClose }: Props) {
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    setStats(getReadingStats());
  }, []);

  const monthlyData = useMemo(() => {
    return getMonthlyReadings(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // 지난 주 대비
  const weekDiff = useMemo(() => {
    if (!stats) return 0;
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

    const lastWeekArticles = stats.dailyReadings
      .filter(r => r.date >= lastWeekStart.toISOString().split('T')[0] && r.date <= lastWeekEnd.toISOString().split('T')[0])
      .reduce((sum, r) => sum + r.count, 0);

    return stats.thisWeekArticles - lastWeekArticles;
  }, [stats]);

  // 연속 주
  const weeks = stats ? Math.floor(stats.currentStreak / 7) : 0;

  // 캘린더
  const calendar = useMemo(() => {
    const first = new Date(currentYear, currentMonth - 1, 1);
    const last = new Date(currentYear, currentMonth, 0);
    let start = first.getDay() - 1;
    if (start < 0) start = 6;

    const days: (number | null)[] = [];
    for (let i = 0; i < start; i++) days.push(null);
    for (let i = 1; i <= last.getDate(); i++) days.push(i);
    return days;
  }, [currentYear, currentMonth]);

  const prevMonth = () => {
    if (currentMonth === 1) { setCurrentYear(y => y - 1); setCurrentMonth(12); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 12) { setCurrentYear(y => y + 1); setCurrentMonth(1); }
    else setCurrentMonth(m => m + 1);
  };

  const today = new Date();
  const isThisMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1;

  return (
    <div className="fixed inset-0 bg-[#111] z-50 overflow-auto">
      {/* Header */}
      <header className="sticky top-0 bg-[#111] z-10 px-4 py-3">
        <button onClick={onClose} className="text-white/60 hover:text-white p-2 -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </header>

      {/* Main Stats */}
      <div className="px-6 pb-10">
        <p className="text-white/40 text-sm mb-2">연속 {weeks}주 동안</p>

        <div className="flex items-end gap-2 mb-5">
          <span className="text-5xl">🔥</span>
          <span className="text-white text-7xl font-bold">{stats?.thisWeekArticles || 0}</span>
          <span className="text-white/40 text-2xl mb-2">기사</span>
        </div>

        <span className={`inline-block px-4 py-2 rounded-full text-sm ${
          weekDiff >= 0 ? 'bg-white/10 text-white/60' : 'bg-red-500/20 text-red-400'
        }`}>
          지난 주 대비 <span className="font-semibold">{weekDiff >= 0 ? '+' : ''}{weekDiff}</span>
        </span>
      </div>

      {/* Calendar */}
      <div className="mx-4 bg-[#1a1a1a] rounded-2xl p-5">
        {/* Month Nav */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="text-white/40 hover:text-white p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-white font-medium">{currentYear}년 {currentMonth}월</span>
          <button onClick={nextMonth} className="text-white/40 hover:text-white p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Weekdays */}
        <div className="grid grid-cols-7 mb-2">
          {['월', '화', '수', '목', '금', '토', '일'].map(d => (
            <div key={d} className="text-center text-white/30 text-xs py-2">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-y-2">
          {calendar.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;

            const count = monthlyData.get(day) || 0;
            const isToday = isThisMonth && day === today.getDate();

            return (
              <div key={day} className="flex flex-col items-center py-2">
                {count > 0 ? (
                  <>
                    <span className="text-2xl">🔥</span>
                    <span className="text-white/50 text-[10px]">{count}</span>
                  </>
                ) : (
                  <span className={`text-sm ${isToday ? 'text-white font-bold' : 'text-white/30'}`}>
                    {day}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom padding */}
      <div className="h-10" />
    </div>
  );
}
