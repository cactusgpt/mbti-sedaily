import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Home, ExternalLink, Clock } from "lucide-react";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { API_URL } from "@/config/api";

interface MbtiVersion {
  title: string;
  subtitle: string;
  body: string | string[];
  key_points?: string[];
}

interface Article {
  news_id: string;
  title: string;
  published_at: string;
  category: string;
  provider: string;
  image_url: string | null;
  original_link: string;
  versions: Record<string, MbtiVersion>;
}

interface TimeSlot {
  id: string;
  label: string;
  labelEn: string;
  startHour: number;
  endHour: number;
  // Ambient colors for full page background
  bgGradient: string;
  textColor: string;
  accentColor: string;
  cardBg: string;
  headerBg: string;
}

// Professional time-based color system inspired by actual sky colors
const timeSlots: TimeSlot[] = [
  {
    id: "morning",
    label: "아침",
    labelEn: "MORNING",
    startHour: 6,
    endHour: 10,
    bgGradient: "linear-gradient(180deg, #FDF4E3 0%, #FFECD2 50%, #FCB69F 100%)",
    textColor: "#8B5A2B",
    accentColor: "#D4845C",
    cardBg: "rgba(255, 255, 255, 0.85)",
    headerBg: "rgba(253, 244, 227, 0.95)",
  },
  {
    id: "midday",
    label: "점심",
    labelEn: "MIDDAY",
    startHour: 10,
    endHour: 14,
    bgGradient: "linear-gradient(180deg, #E8F4FD 0%, #D4E7F7 50%, #B8D4ED 100%)",
    textColor: "#2C5282",
    accentColor: "#4A90B8",
    cardBg: "rgba(255, 255, 255, 0.9)",
    headerBg: "rgba(232, 244, 253, 0.95)",
  },
  {
    id: "afternoon",
    label: "오후",
    labelEn: "AFTERNOON",
    startHour: 14,
    endHour: 18,
    bgGradient: "linear-gradient(180deg, #FFF5E6 0%, #FFE4C4 50%, #FFD4A3 100%)",
    textColor: "#9C4221",
    accentColor: "#C96B3C",
    cardBg: "rgba(255, 255, 255, 0.88)",
    headerBg: "rgba(255, 245, 230, 0.95)",
  },
  {
    id: "evening",
    label: "저녁",
    labelEn: "EVENING",
    startHour: 18,
    endHour: 22,
    bgGradient: "linear-gradient(180deg, #E8D5E4 0%, #C9A7C7 50%, #9B6B9E 100%)",
    textColor: "#5B3A5D",
    accentColor: "#8B5A8D",
    cardBg: "rgba(255, 255, 255, 0.82)",
    headerBg: "rgba(232, 213, 228, 0.95)",
  },
  {
    id: "night",
    label: "밤",
    labelEn: "NIGHT",
    startHour: 22,
    endHour: 6,
    bgGradient: "linear-gradient(180deg, #1A1F3C 0%, #2D3561 50%, #1E2243 100%)",
    textColor: "#C9D1E3",
    accentColor: "#7B8CBA",
    cardBg: "rgba(45, 53, 97, 0.7)",
    headerBg: "rgba(26, 31, 60, 0.95)",
  },
];

function getTimeSlot(dateStr: string): TimeSlot {
  const date = new Date(dateStr);
  const hour = date.getHours();

  for (const slot of timeSlots) {
    if (slot.id === "night") {
      if (hour >= 22 || hour < 6) return slot;
    } else if (hour >= slot.startHour && hour < slot.endHour) {
      return slot;
    }
  }
  return timeSlots[0];
}

function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

// SVG Icons for time slots - elegant and minimal
function TimeIcon({ slotId, className = "", style }: { slotId: string; className?: string; style?: React.CSSProperties }) {
  const baseClass = `${className}`;

  switch (slotId) {
    case "morning":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} style={style} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          <path d="M3 17h4l2-3 2 4 3-5 2 4h5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        </svg>
      );
    case "midday":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} style={style} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.2" />
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
        </svg>
      );
    case "afternoon":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} style={style} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="10" r="4" />
          <path d="M12 2v2M4 10h2M18 10h2M6.34 4.34l1.42 1.42M16.24 4.34l-1.42 1.42" />
          <path d="M4 18h16" strokeLinecap="round" />
          <path d="M6 22h12" strokeLinecap="round" opacity="0.5" />
        </svg>
      );
    case "evening":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} style={style} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="4" />
          <path d="M10 2v2M3 10h2M15 10h2" />
          <path d="M2 18h20" strokeLinecap="round" />
          <path d="M4 22h16" strokeLinecap="round" opacity="0.5" />
          <path d="M6 14c2-2 4-2 6 0s4 2 6 0" strokeLinecap="round" opacity="0.3" />
        </svg>
      );
    case "night":
      return (
        <svg viewBox="0 0 24 24" className={baseClass} style={style} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" opacity="0.1" />
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          <circle cx="7" cy="8" r="1" fill="currentColor" opacity="0.5" />
          <circle cx="14" cy="16" r="0.5" fill="currentColor" opacity="0.5" />
          <circle cx="17" cy="7" r="0.5" fill="currentColor" opacity="0.3" />
        </svg>
      );
    default:
      return null;
  }
}

interface Props {
  userGroup: MbtiGroupId;
  userTags: string[];
  onChangeGroup: () => void;
}

export function TimelineNewsFeed({ userGroup, onChangeGroup }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState<TimeSlot>(timeSlots[0]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Track scroll position and update active time slot
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;

    // Find which section is most visible
    let mostVisibleSlot = timeSlots[0];
    let maxVisibility = 0;

    for (const slot of timeSlots) {
      const section = sectionRefs.current[slot.id];
      if (!section) continue;

      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top;
      const sectionBottom = rect.bottom;

      // Calculate how much of the section is visible
      const visibleTop = Math.max(0, sectionTop);
      const visibleBottom = Math.min(viewportHeight, sectionBottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      // Weight by position (prefer sections closer to top of viewport)
      const centerOffset = Math.abs((sectionTop + sectionBottom) / 2 - viewportHeight / 2);
      const visibility = visibleHeight * (1 - centerOffset / viewportHeight);

      if (visibility > maxVisibility) {
        maxVisibility = visibility;
        mostVisibleSlot = slot;
      }
    }

    setActiveSlot(mostVisibleSlot);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll, articles]);

  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      try {
        const dateStr = currentDate.toISOString().slice(0, 10);
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);

        const res = await fetch(`${API_URL}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "*",
            filters: {
              published_from: dateStr,
              published_until: nextDate.toISOString().slice(0, 10),
            },
            page: 1,
            page_size: 50,
          }),
        });
        const data = await res.json();
        const withVersions = (data.articles || []).filter(
          (a: Article) => a.versions && Object.keys(a.versions).length === 4
        );
        withVersions.sort((a: Article, b: Article) =>
          new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
        );
        setArticles(withVersions);
      } catch (e) {
        console.error("Failed to fetch:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [currentDate]);

  const goToPrevDay = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  };

  const goToNextDay = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (currentDate < tomorrow) {
      setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setDate(newDate.getDate() + 1);
        return newDate;
      });
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const isToday = currentDate.toDateString() === new Date().toDateString();
  const isNightMode = activeSlot.id === "night";

  // Group articles by time slot
  const articlesBySlot = timeSlots.reduce((acc, slot) => {
    acc[slot.id] = articles.filter(a => getTimeSlot(a.published_at).id === slot.id);
    return acc;
  }, {} as Record<string, Article[]>);

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col transition-all duration-1000 ease-in-out"
      style={{ background: activeSlot.bgGradient }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md border-b transition-all duration-700"
        style={{
          backgroundColor: activeSlot.headerBg,
          borderColor: isNightMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
               	href="/"
                className="p-2 rounded-lg transition-colors"
                style={{
                  color: activeSlot.textColor,
                  backgroundColor: isNightMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                }}
                title="홈으로"
              >
                <Home className="w-5 h-5" />
              </Link>
              <div>
                <h1
                  className="text-lg font-bold transition-colors duration-700"
                  style={{ color: activeSlot.textColor }}
                >
                  뉴스 타임라인
                </h1>
                <p
                  className="text-xs transition-colors duration-700"
                  style={{ color: activeSlot.textColor, opacity: 0.7 }}
                >
                  하루의 뉴스를 한눈에
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onChangeGroup}
                className="px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-300"
                style={{
                  backgroundColor: isNightMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
                  color: activeSlot.textColor,
                }}
              >
                {userGroup} 스타일
              </button>

              <div
                className="flex items-center rounded-full transition-all duration-300"
                style={{
                  backgroundColor: isNightMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                }}
              >
                <button
                  onClick={goToPrevDay}
                  className="p-2 rounded-full transition-colors hover:opacity-70"
                  style={{ color: activeSlot.textColor }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 text-sm font-medium rounded-full transition-all"
                  style={{
                    backgroundColor: isToday ? activeSlot.accentColor : "transparent",
                    color: isToday ? "#fff" : activeSlot.textColor,
                  }}
                >
                  {formatDate(currentDate)}
                </button>

                <button
                  onClick={goToNextDay}
                  disabled={isToday}
                  className="p-2 rounded-full transition-colors disabled:opacity-30"
                  style={{ color: activeSlot.textColor }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Time Progress Indicator */}
      <div className="sticky top-[73px] z-40">
        <div className="max-w-5xl mx-auto px-4">
          <div
            className="flex items-center gap-1 py-2 rounded-b-xl backdrop-blur-sm"
            style={{
              backgroundColor: isNightMode ? "rgba(26,31,60,0.8)" : "rgba(255,255,255,0.6)",
            }}
          >
            {timeSlots.map((slot, index) => {
              const hasArticles = articlesBySlot[slot.id]?.length > 0;
              const isActive = activeSlot.id === slot.id;

              return (
                <button
                  key={slot.id}
                  onClick={() => {
                    const section = sectionRefs.current[slot.id];
                    if (section) {
                      section.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  disabled={!hasArticles}
                  className="flex-1 relative py-2 transition-all duration-300 disabled:opacity-30"
                >
                  <div
                    className="h-1 rounded-full mx-1 transition-all duration-500"
                    style={{
                      backgroundColor: isActive ? activeSlot.accentColor : (isNightMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"),
                      transform: isActive ? "scaleY(1.5)" : "scaleY(1)",
                    }}
                  />
                  <span
                    className="text-[10px] font-medium mt-1 block transition-all duration-300"
                    style={{
                      color: isActive ? activeSlot.accentColor : (isNightMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"),
                      fontWeight: isActive ? 700 : 400,
                    }}
                  >
                    {slot.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">
        {loading ? (
          <div className="py-20" />
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: isNightMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}
            >
              <TimeIcon slotId={activeSlot.id} className="w-8 h-8" style={{ color: activeSlot.textColor } as React.CSSProperties} />
            </div>
            <h3
              className="text-lg font-bold mb-2"
              style={{ color: activeSlot.textColor }}
            >
              이 날의 뉴스가 없어요
            </h3>
            <p
              className="mb-4 text-sm"
              style={{ color: activeSlot.textColor, opacity: 0.7 }}
            >
              다른 날짜를 선택해보세요
            </p>
            <button
              onClick={goToToday}
              className="px-4 py-2 rounded-full text-sm font-medium text-white transition-transform hover:scale-105"
              style={{ backgroundColor: activeSlot.accentColor }}
            >
              오늘로 이동
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {timeSlots.map(slot => {
              const slotArticles = articlesBySlot[slot.id];
              if (slotArticles.length === 0) return null;

              const isCurrentSlot = activeSlot.id === slot.id;

              return (
                <section
                  key={slot.id}
                  ref={el => { sectionRefs.current[slot.id] = el; }}
                  className="scroll-mt-32"
                >
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500"
                        style={{
                          backgroundColor: isCurrentSlot ? activeSlot.accentColor : (isNightMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"),
                          color: isCurrentSlot ? "#fff" : activeSlot.textColor,
                          transform: isCurrentSlot ? "scale(1.05)" : "scale(1)",
                        }}
                      >
                        <TimeIcon slotId={slot.id} className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <h2
                            className="text-2xl font-bold transition-colors duration-500"
                            style={{ color: activeSlot.textColor }}
                          >
                            {slot.label}
                          </h2>
                          <span
                            className="text-xs font-medium tracking-widest uppercase transition-colors duration-500"
                            style={{ color: activeSlot.textColor, opacity: 0.5 }}
                          >
                            {slot.labelEn}
                          </span>
                        </div>
                        <p
                          className="text-sm transition-colors duration-500"
                          style={{ color: activeSlot.textColor, opacity: 0.6 }}
                        >
                          {slot.startHour}:00 - {slot.endHour === 6 ? "06" : slot.endHour}:00
                        </p>
                      </div>
                    </div>
                    <div
                      className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300"
                      style={{
                        backgroundColor: isNightMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
                        color: activeSlot.textColor,
                      }}
                    >
                      {slotArticles.length}개 기사
                    </div>
                  </div>

                  {/* Articles Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {slotArticles.map(article => {
                      const v = article.versions[userGroup];
                      if (!v) return null;

                      return (
                        <a
                          key={article.news_id}
                          href={article.original_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                          style={{
                            backgroundColor: activeSlot.cardBg,
                            backdropFilter: "blur(10px)",
                          }}
                        >
                          {/* Thumbnail */}
                          {article.image_url && (
                            <div className="relative h-36 overflow-hidden">
                              <img
                                src={article.image_url}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div
                                className="absolute inset-0 opacity-30"
                                style={{
                                  background: `linear-gradient(to top, ${activeSlot.accentColor}80, transparent)`,
                                }}
                              />
                              <span
                                className="absolute bottom-3 left-3 px-2.5 py-1 text-[11px] font-semibold text-white rounded-md backdrop-blur-sm"
                                style={{ backgroundColor: `${activeSlot.accentColor}CC` }}
                              >
                                {article.category}
                              </span>
                            </div>
                          )}

                          {/* Content */}
                          <div className="p-4">
                            <div
                              className="flex items-center gap-1.5 text-[11px] mb-2"
                              style={{ color: activeSlot.accentColor }}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span className="font-medium">{formatTime(article.published_at)}</span>
                              <span style={{ opacity: 0.5 }}>·</span>
                              <span style={{ opacity: 0.8 }}>{article.provider}</span>
                            </div>
                            <h3
                              className="text-sm font-semibold leading-snug line-clamp-2 transition-colors duration-300"
                              style={{ color: isNightMode ? "#E8ECF4" : "#1A1A1A" }}
                            >
                              {v.title}
                            </h3>
                          </div>

                          {/* Footer */}
                          <div className="px-4 pb-4">
                            <div
                              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all duration-300 group-hover:opacity-90"
                              style={{
                                backgroundColor: isNightMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                                color: activeSlot.accentColor,
                              }}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              원문 보기
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* Summary */}
            <div
              className="text-center py-8 text-sm font-medium"
              style={{ color: activeSlot.textColor, opacity: 0.5 }}
            >
              총 {articles.length}개의 기사를 확인했습니다
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="border-t transition-all duration-700 mt-auto"
        style={{
          borderColor: isNightMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
          backgroundColor: isNightMode ? "rgba(26,31,60,0.5)" : "rgba(255,255,255,0.5)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <p
            className="text-xs transition-colors duration-700"
            style={{ color: activeSlot.textColor, opacity: 0.5 }}
          >
            © 서울경제신문 · K-Stock Insight
          </p>
        </div>
      </footer>
    </div>
  );
}
