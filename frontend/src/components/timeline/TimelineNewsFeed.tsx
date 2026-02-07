import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Home, ExternalLink } from "lucide-react";
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
  emoji: string;
  startHour: number;
  endHour: number;
  color: string;
  bgColor: string;
}

const timeSlots: TimeSlot[] = [
  { id: "morning", label: "아침", emoji: "🌅", startHour: 6, endHour: 10, color: "#F59E0B", bgColor: "#FEF3C7" },
  { id: "midday", label: "점심", emoji: "☀️", startHour: 10, endHour: 14, color: "#EAB308", bgColor: "#FEF9C3" },
  { id: "afternoon", label: "오후", emoji: "🌤️", startHour: 14, endHour: 18, color: "#F97316", bgColor: "#FFEDD5" },
  { id: "evening", label: "저녁", emoji: "🌆", startHour: 18, endHour: 22, color: "#EC4899", bgColor: "#FCE7F3" },
  { id: "night", label: "밤", emoji: "🌙", startHour: 22, endHour: 6, color: "#6366F1", bgColor: "#E0E7FF" },
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

function getBodyText(body: string | string[]): string {
  const text = Array.isArray(body) ? body.join("\n\n") : body;
  const clean = text.replace(/\*\*/g, "");
  const paragraphs = clean.split("\n\n").filter(p => p.trim());

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) continue;
    if (trimmed.startsWith("■")) continue;
    if (trimmed.includes("|")) continue;
    if (trimmed.startsWith("---")) continue;
    if (trimmed.length < 20) continue;
    return trimmed;
  }
  return "";
}

interface Props {
  userGroup: MbtiGroupId;
  userTags: string[];
  onChangeGroup: () => void;
}

export function TimelineNewsFeed({ userGroup, userTags, onChangeGroup }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

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
            page_size: 30,
          }),
        });
        const data = await res.json();
        const withVersions = (data.articles || []).filter(
          (a: Article) => a.versions && Object.keys(a.versions).length === 4
        );
        // Sort by published time
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

  const groupColors = {
    NT: { bg: "bg-blue-500", text: "text-blue-600", light: "bg-blue-50" },
    NF: { bg: "bg-violet-500", text: "text-violet-600", light: "bg-violet-50" },
    ST: { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50" },
    SF: { bg: "bg-orange-500", text: "text-orange-600", light: "bg-orange-50" },
  };
  const colors = groupColors[userGroup];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
                title="홈으로"
              >
                <Home className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                  뉴스 타임라인
                </h1>
                <p className="text-xs text-gray-500">하루의 뉴스를 한눈에</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onChangeGroup}
                className={`px-4 py-2 text-sm font-semibold rounded-full ${colors.light} ${colors.text} hover:opacity-80 transition-opacity`}
              >
                {userGroup} 스타일
              </button>

              {/* Date Navigation */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                <button
                  onClick={goToPrevDay}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>

                <button
                  onClick={goToToday}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                    isToday
                      ? `${colors.bg} text-white shadow-lg`
                      : "hover:bg-white text-gray-700"
                  }`}
                >
                  {formatDate(currentDate)}
                </button>

                <button
                  onClick={goToNextDay}
                  disabled={isToday}
                  className="p-2 hover:bg-white rounded-full transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-12">
        {loading ? (
          <div className="flex justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin w-10 h-10 border-3 border-gray-200 border-t-gray-800 rounded-full" />
              <p className="text-gray-500 text-sm">타임라인 불러오는 중...</p>
            </div>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-32">
            <div className="text-6xl mb-6">📰</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              이 날의 뉴스가 없어요
            </h3>
            <p className="text-gray-500 mb-6">다른 날짜를 선택해보세요</p>
            <button
              onClick={goToToday}
              className={`px-6 py-3 ${colors.bg} text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-shadow`}
            >
              오늘로 이동
            </button>
          </div>
        ) : (
          <div className="relative" ref={timelineRef}>
            {/* Timeline Title */}
            <div className="text-center mb-16">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                TODAY'S NEWS TIMELINE
              </h2>
              <div className="w-24 h-1 bg-gray-900 mx-auto rounded-full" />
            </div>

            {/* Horizontal Timeline */}
            <div className="relative max-w-6xl mx-auto px-8">
              {/* Timeline Line */}
              <div className="absolute left-8 right-8 top-1/2 h-1 bg-gradient-to-r from-amber-400 via-orange-400 via-pink-400 to-indigo-400 rounded-full transform -translate-y-1/2 z-0" />

              {/* Time Slot Markers */}
              <div className="absolute left-8 right-8 top-1/2 transform -translate-y-1/2 flex justify-between z-10">
                {timeSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex flex-col items-center"
                    style={{ width: "80px" }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg border-4 border-white"
                      style={{ backgroundColor: slot.bgColor }}
                    >
                      {slot.emoji}
                    </div>
                    <span className="mt-2 text-xs font-bold text-gray-700">{slot.label}</span>
                    <span className="text-[10px] text-gray-400">
                      {slot.startHour}:00-{slot.endHour === 6 ? "06" : slot.endHour}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Articles - Alternating Top/Bottom */}
              <div className="relative pt-32 pb-32">
                {articles.map((article, index) => {
                  const v = article.versions[userGroup];
                  if (!v) return null;

                  const slot = getTimeSlot(article.published_at);
                  const isTop = index % 2 === 0;
                  const isHovered = hoveredId === article.news_id;

                  // Calculate horizontal position based on time
                  const articleDate = new Date(article.published_at);
                  const hour = articleDate.getHours();
                  const minute = articleDate.getMinutes();
                  const totalMinutes = hour * 60 + minute;
                  // Map 6:00 (360 min) to 0% and 30:00 (1800 min, next day 6:00) to 100%
                  const adjustedMinutes = totalMinutes < 360 ? totalMinutes + 1440 : totalMinutes;
                  const leftPercent = Math.min(95, Math.max(5, ((adjustedMinutes - 360) / 1200) * 100));

                  return (
                    <div
                      key={article.news_id}
                      className={`absolute transition-all duration-300 ${isTop ? "bottom-1/2 mb-8" : "top-1/2 mt-8"}`}
                      style={{
                        left: `${leftPercent}%`,
                        transform: "translateX(-50%)",
                        zIndex: isHovered ? 30 : 10
                      }}
                      onMouseEnter={() => setHoveredId(article.news_id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* Connector Line */}
                      <div
                        className={`absolute left-1/2 w-0.5 bg-gray-300 transform -translate-x-1/2 ${
                          isTop ? "bottom-0 h-8 translate-y-full" : "top-0 h-8 -translate-y-full"
                        }`}
                      />

                      {/* Node Dot */}
                      <div
                        className={`absolute left-1/2 w-4 h-4 rounded-full border-4 border-white shadow-md transform -translate-x-1/2 ${
                          isTop ? "-bottom-10" : "-top-10"
                        }`}
                        style={{ backgroundColor: slot.color }}
                      />

                      {/* Article Card */}
                      <a
                        href={article.original_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block w-56 bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 ${
                          isHovered ? "shadow-2xl scale-105" : "hover:shadow-lg"
                        }`}
                      >
                        {/* Thumbnail */}
                        {article.image_url && (
                          <div className="relative h-32 overflow-hidden">
                            <img
                              src={article.image_url}
                              alt=""
                              className={`w-full h-full object-cover transition-transform duration-500 ${
                                isHovered ? "scale-110" : ""
                              }`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                            <span
                              className="absolute bottom-2 left-2 px-2 py-1 text-[10px] font-bold text-white rounded-full"
                              style={{ backgroundColor: slot.color }}
                            >
                              {article.category}
                            </span>
                          </div>
                        )}

                        {/* Content */}
                        <div className="p-4">
                          <p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                            <span>{formatTime(article.published_at)}</span>
                            <span>·</span>
                            <span>{article.provider}</span>
                          </p>
                          <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 mb-2">
                            {v.title}
                          </h3>
                          {isHovered && (
                            <p className="text-xs text-gray-500 line-clamp-2 animate-fadeIn">
                              {getBodyText(v.body).slice(0, 60)}...
                            </p>
                          )}
                        </div>

                        {/* Hover Action */}
                        {isHovered && (
                          <div className="px-4 pb-3 animate-fadeIn">
                            <div className="flex items-center justify-center gap-1 py-2 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
                              <ExternalLink className="w-3 h-3" />
                              원문 보기
                            </div>
                          </div>
                        )}
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scroll Hint */}
            {articles.length > 5 && (
              <div className="text-center mt-8 text-gray-400 text-sm">
                ← 좌우로 스크롤하여 더 많은 뉴스를 확인하세요 →
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          <p className="text-sm text-gray-400">© 서울경제신문 · K-Stock Insight</p>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
