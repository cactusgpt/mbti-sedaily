

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/config/api";

interface UserStats {
  total_articles_read: number;
  total_comments: number;
  total_reactions: number;
  streak: number;
  this_week_articles: number;
  badges: string[];
  member_since: string | null;
}

interface ReadingHistoryItem {
  article_id: string;
  article_title: string;
  first_read: string;
  last_read: string;
  read_count: number;
}

// Badge display info
const badgeInfo: Record<string, { emoji: string; name: string; desc: string }> = {
  first_login: { emoji: "👋", name: "첫 방문", desc: "K-Stock Insight에 가입했습니다" },
  reader_10: { emoji: "📚", name: "독서가", desc: "10개 기사를 읽었습니다" },
  reader_50: { emoji: "🎯", name: "열독자", desc: "50개 기사를 읽었습니다" },
  reader_100: { emoji: "🏆", name: "마스터 독자", desc: "100개 기사를 읽었습니다" },
  streak_7: { emoji: "🔥", name: "7일 연속", desc: "7일 연속 접속했습니다" },
  streak_30: { emoji: "⭐", name: "30일 연속", desc: "30일 연속 접속했습니다" },
  weekly_5: { emoji: "📖", name: "이번 주 열독", desc: "이번 주 5개 기사를 읽었습니다" },
};

interface Props {
  onClose: () => void;
}

export function MyPage({ onClose }: Props) {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"stats" | "history">("stats");

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    async function fetchUserData() {
      try {
        setLoading(true);

        // Fetch stats and history in parallel
        const [statsRes, historyRes] = await Promise.all([
          fetch(`${API_URL}/api/user/stats?user_id=${user!.userId}`),
          fetch(`${API_URL}/api/user/history?user_id=${user!.userId}`),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setHistory(historyData.history || []);
        }
      } catch (e) {
        console.error("Failed to fetch user data:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-gray-900">마이페이지</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Profile Section */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-4">
              {user.picture ? (
                <img src={user.picture} alt="" className="w-14 h-14 rounded-full" />
              ) : (
                <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-500">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <p className="text-[16px] font-semibold text-gray-900">
                  {user.name || "사용자"}
                </p>
                <p className="text-[13px] text-gray-500">{user.email}</p>
                {stats?.member_since && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    {stats.member_since} 가입
                  </p>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[13px] text-gray-500">불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-[24px] font-bold text-blue-600">
                      {stats?.streak || 0}
                    </p>
                    <p className="text-[11px] text-blue-600/70">연속 접속일</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-[24px] font-bold text-green-600">
                      {stats?.total_articles_read || 0}
                    </p>
                    <p className="text-[11px] text-green-600/70">읽은 기사</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <p className="text-[24px] font-bold text-orange-600">
                      {stats?.this_week_articles || 0}
                    </p>
                    <p className="text-[11px] text-orange-600/70">이번 주</p>
                  </div>
                </div>
              </div>

              {/* Badges */}
              {stats?.badges && stats.badges.length > 0 && (
                <div className="px-6 py-5 border-b border-gray-100">
                  <h3 className="text-[14px] font-semibold text-gray-900 mb-3">획득한 뱃지</h3>
                  <div className="flex flex-wrap gap-2">
                    {stats.badges.map((badgeId) => {
                      const badge = badgeInfo[badgeId];
                      if (!badge) return null;
                      return (
                        <div
                          key={badgeId}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full"
                          title={badge.desc}
                        >
                          <span>{badge.emoji}</span>
                          <span className="text-[12px] text-gray-700">{badge.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="px-6 border-b border-gray-100">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab("stats")}
                    className={`py-3 text-[13px] font-medium border-b-2 transition-colors ${
                      activeTab === "stats"
                        ? "border-gray-900 text-gray-900"
                        : "border-transparent text-gray-500"
                    }`}
                  >
                    통계
                  </button>
                  <button
                    onClick={() => setActiveTab("history")}
                    className={`py-3 text-[13px] font-medium border-b-2 transition-colors ${
                      activeTab === "history"
                        ? "border-gray-900 text-gray-900"
                        : "border-transparent text-gray-500"
                    }`}
                  >
                    읽은 기사
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="px-6 py-5">
                {activeTab === "stats" ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-[13px] text-gray-600">총 읽은 기사</span>
                      <span className="text-[14px] font-semibold text-gray-900">
                        {stats?.total_articles_read || 0}개
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-[13px] text-gray-600">연속 접속일</span>
                      <span className="text-[14px] font-semibold text-gray-900">
                        {stats?.streak || 0}일
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-[13px] text-gray-600">이번 주 읽은 기사</span>
                      <span className="text-[14px] font-semibold text-gray-900">
                        {stats?.this_week_articles || 0}개
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-[13px] text-gray-600">획득 뱃지</span>
                      <span className="text-[14px] font-semibold text-gray-900">
                        {stats?.badges?.length || 0}개
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    {history.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-[13px] text-gray-400">아직 읽은 기사가 없습니다</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {history.map((item) => (
                          <div
                            key={item.article_id}
                            className="p-3 bg-gray-50 rounded-lg"
                          >
                            <p className="text-[13px] font-medium text-gray-900 line-clamp-2 mb-1">
                              {item.article_title || item.article_id}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {new Date(item.last_read).toLocaleDateString("ko-KR")} · {item.read_count}회 읽음
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
