import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  emoji: string;
  startHour: number;
  endHour: number;
  color: string;
  bgColor: string;
  gradient: string;
}

const timeSlots: TimeSlot[] = [
  { id: "morning", label: "아침", emoji: "🌅", startHour: 6, endHour: 10, color: "#F59E0B", bgColor: "#FEF3C7", gradient: "from-amber-50 to-orange-50" },
  { id: "midday", label: "점심", emoji: "☀️", startHour: 10, endHour: 14, color: "#EAB308", bgColor: "#FEF9C3", gradient: "from-yellow-50 to-amber-50" },
  { id: "afternoon", label: "오후", emoji: "🌤️", startHour: 14, endHour: 18, color: "#F97316", bgColor: "#FFEDD5", gradient: "from-orange-50 to-rose-50" },
  { id: "evening", label: "저녁", emoji: "🌆", startHour: 18, endHour: 22, color: "#EC4899", bgColor: "#FCE7F3", gradient: "from-pink-50 to-purple-50" },
  { id: "night", label: "밤", emoji: "🌙", startHour: 22, endHour: 6, color: "#6366F1", bgColor: "#E0E7FF", gradient: "from-indigo-50 to-blue-50" },
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

interface Props {
  userGroup: MbtiGroupId;
  userTags: string[];
  onChangeGroup: () => void;
}

export function TimelineNewsFeed({ userGroup, onChangeGroup }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

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

  const groupColors = {
    NT: { bg: "bg-blue-500", text: "text-blue-600", light: "bg-blue-50" },
    NF: { bg: "bg-violet-500", text: "text-violet-600", light: "bg-violet-50" },
    ST: { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50" },
    SF: { bg: "bg-orange-500", text: "text-orange-600", light: "bg-orange-50" },
  };
  const colors = groupColors[userGroup];

  // Group articles by time slot
  const articlesBySlot = timeSlots.reduce((acc, slot) => {
    acc[slot.id] = articles.filter(a => getTimeSlot(a.published_at).id === slot.id);
    return acc;
  }, {} as Record<string, Article[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="홈으로"
              >
                <Home className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-gray-900">뉴스 타임라인</h1>
                <p className="text-xs text-gray-500">하루의 뉴스를 한눈에</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onChangeGroup}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${colors.light} ${colors.text} hover:opacity-80 transition-opacity`}
              >
                {userGroup} 스타일
              </button>

              <div className="flex items-center bg-gray-100 rounded-full">
                <button
                  onClick={goToPrevDay}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>

                <button
                  onClick={goToToday}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                    isToday
                      ? `${colors.bg} text-white`
                      : "hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  {formatDate(currentDate)}
                </button>

                <button
                  onClick={goToNextDay}
                  disabled={isToday}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full" />
              <p className="text-gray-500 text-sm">불러오는 중...</p>
            </div>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📰</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">이 날의 뉴스가 없어요</h3>
            <p className="text-gray-500 mb-4 text-sm">다른 날짜를 선택해보세요</p>
            <button
              onClick={goToToday}
              className={`px-4 py-2 ${colors.bg} text-white rounded-full text-sm font-medium`}
            >
              오늘로 이동
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Timeline Sections */}
            {timeSlots.map(slot => {
              const slotArticles = articlesBySlot[slot.id];
              if (slotArticles.length === 0) return null;

              return (
                <section
                  key={slot.id}
                  className="rounded-2xl p-6 transition-all duration-300"
                  style={{
                    background: `linear-gradient(135deg, ${slot.bgColor}80, ${slot.bgColor}40)`,
                    borderTop: `4px solid ${slot.color}`,
                  }}
                >
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-md"
                        style={{ backgroundColor: slot.color, color: "white" }}
                      >
                        {slot.emoji}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold" style={{ color: slot.color }}>{slot.label}</h2>
                        <p className="text-xs text-gray-500">
                          {slot.startHour}:00 - {slot.endHour === 6 ? "06" : slot.endHour}:00
                        </p>
                      </div>
                    </div>
                    <div
                      className="px-3 py-1 rounded-full text-sm font-bold"
                      style={{ backgroundColor: slot.color, color: "white" }}
                    >
                      {slotArticles.length}개
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
                          className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-1"
                          style={{
                            borderLeft: `3px solid ${slot.color}`,
                          }}
                        >
                          {/* Thumbnail */}
                          {article.image_url && (
                            <div className="relative h-32 overflow-hidden">
                              <img
                                src={article.image_url}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div
                                className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                                style={{ background: `linear-gradient(to top, ${slot.color}, transparent)` }}
                              />
                              <span
                                className="absolute bottom-2 left-2 px-2 py-0.5 text-[10px] font-bold text-white rounded"
                                style={{ backgroundColor: slot.color }}
                              >
                                {article.category}
                              </span>
                            </div>
                          )}

                          {/* Content */}
                          <div className="p-3">
                            <div className="flex items-center gap-1.5 text-[10px] mb-1" style={{ color: slot.color }}>
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(article.published_at)}</span>
                              <span>·</span>
                              <span>{article.provider}</span>
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-gray-700">
                              {v.title}
                            </h3>
                          </div>

                          {/* Footer */}
                          <div className="px-3 pb-3">
                            <div
                              className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors"
                              style={{
                                backgroundColor: slot.bgColor,
                                color: slot.color,
                              }}
                            >
                              <ExternalLink className="w-3 h-3" />
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
            <div className="text-center py-4 text-sm text-gray-400">
              총 {articles.length}개 기사
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-8 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-gray-400">© 서울경제신문 · K-Stock Insight</p>
        </div>
      </footer>
    </div>
  );
}
