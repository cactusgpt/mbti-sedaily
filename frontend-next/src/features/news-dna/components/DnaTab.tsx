'use client';

import { useState, useEffect } from "react";
import { Calendar, Newspaper, Users, Camera, TrendingUp, Flame, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MbtiGroupId } from "@/shared/data/mbtiGroups";
import type { TabType, DnaSubTab, DnaViewMode, Persona } from "@/shared/types/mbti";
import { useAuth } from "@/features/auth";
import {
  getAnalysis,
  getRecommendations,
  type AnalysisResponse,
  type RecommendedArticle,
} from "@/shared/lib/recommendApi";

export interface NewsDNA {
  economy: number;
  tech: number;
  world: number;
  society: number;
  culture: number;
  politics: number;
}

interface Props {
  dnaSubTab: DnaSubTab;
  setDnaSubTab: (tab: DnaSubTab) => void;
  dnaViewMode: DnaViewMode;
  setDnaViewMode: (mode: DnaViewMode) => void;
  birthdayInput: string;
  setBirthdayInput: (value: string) => void;
  newsDNA: NewsDNA;  // fallback for anonymous users
  persona: Persona;
  selectedGroup: MbtiGroupId;
  setActiveTab: (tab: TabType) => void;
}

export function DnaTab({
  dnaSubTab,
  setDnaSubTab,
  dnaViewMode,
  setDnaViewMode,
  birthdayInput,
  setBirthdayInput,
  newsDNA: fallbackDNA,
  persona,
  selectedGroup,
  setActiveTab,
}: Props) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  // Real data from API
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);

  // Active DNA values: real if available, fallback otherwise
  const newsDNA: NewsDNA = analysis ? {
    economy: analysis.interest_scores.economy,
    tech: analysis.interest_scores.tech,
    world: analysis.interest_scores.world,
    society: analysis.interest_scores.society,
    culture: analysis.interest_scores.culture,
    politics: analysis.interest_scores.politics,
  } : fallbackDNA;

  const hasRealData = analysis !== null;

  // Fetch analysis from server
  useEffect(() => {
    if (!isAuthenticated || !user?.userId) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const data = await getAnalysis(user!.userId);
        if (!cancelled) setAnalysis(data);
      } catch {
        // Keep fallback
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.userId]);

  // Fetch recommendations
  useEffect(() => {
    if (!isAuthenticated || !user?.userId) return;

    let cancelled = false;

    async function load() {
      setRecsLoading(true);
      try {
        const data = await getRecommendations(user!.userId, 5);
        if (!cancelled && data) {
          setRecommendations(data.recommendations);
        }
      } catch {
        // Keep empty
      } finally {
        if (!cancelled) setRecsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.userId]);

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <div className="text-center mb-6">
        <h2 className="text-[24px] font-bold text-gray-900 mb-2">나의 뉴스 DNA</h2>
        <p className="text-[15px] text-gray-500">
          {hasRealData ? '당신의 읽기 패턴이 보여주는 관심 지도' : '당신이 관심 갖는 세상의 모습'}
        </p>
      </div>

      {/* DNA 서브 탭 */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setDnaSubTab("analysis")}
            className={`px-6 py-2.5 text-[14px] font-medium rounded-lg transition-all ${
              dnaSubTab === "analysis"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            나의 분석
          </button>
          <button
            onClick={() => setDnaSubTab("birthday")}
            className={`px-6 py-2.5 text-[14px] font-medium rounded-lg transition-all ${
              dnaSubTab === "birthday"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            생일 기록
          </button>
        </div>
      </div>

      {/* 나의 분석 탭 */}
      {dnaSubTab === "analysis" && (
      <div className="space-y-6">

        {/* Reading Stats (logged-in with real data) */}
        {hasRealData && analysis && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
              <div className="w-10 h-10 mx-auto mb-2 bg-blue-50 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-[20px] font-bold text-gray-900">{analysis.total_articles_read}</p>
              <p className="text-[12px] text-gray-400">읽은 기사</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
              <div className="w-10 h-10 mx-auto mb-2 bg-orange-50 rounded-xl flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-[20px] font-bold text-gray-900">{analysis.reading_streak}</p>
              <p className="text-[12px] text-gray-400">연속 일</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
              <div className="w-10 h-10 mx-auto mb-2 bg-violet-50 rounded-xl flex items-center justify-center">
                <Newspaper className="w-5 h-5 text-violet-500" />
              </div>
              <p className="text-[20px] font-bold text-gray-900">{analysis.unique_articles}</p>
              <p className="text-[12px] text-gray-400">고유 기사</p>
            </div>
          </div>
        )}

        {/* No data prompt (logged-in but no history) */}
        {isAuthenticated && !hasRealData && !isLoading && (
          <div className="bg-blue-50 rounded-2xl p-6 text-center">
            <BookOpen className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <p className="text-[15px] font-medium text-blue-800 mb-1">아직 분석할 데이터가 없어요</p>
            <p className="text-[13px] text-blue-600">기사를 읽으면 관심사가 자동으로 분석됩니다</p>
            <button
              onClick={() => setActiveTab("feed")}
              className="mt-4 px-5 py-2.5 bg-blue-500 text-white text-[13px] font-medium rounded-xl hover:bg-blue-600 transition-colors"
            >
              뉴스 읽으러 가기
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-100 rounded-2xl h-[300px] animate-pulse" />
            <div className="bg-gray-100 rounded-2xl h-[200px] animate-pulse" />
          </div>
        )}

        {/* Radar + chart grid */}
        {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 관심 분야 분석 */}
          <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">관심 분야 분석</h3>
                {!hasRealData && !isAuthenticated && (
                  <p className="text-[11px] text-gray-400 mt-0.5">로그인하면 실제 데이터로 분석</p>
                )}
              </div>
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setDnaViewMode("radar")}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${
                    dnaViewMode === "radar"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  시각화
                </button>
                <button
                  onClick={() => setDnaViewMode("chart")}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${
                    dnaViewMode === "chart"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  차트
                </button>
              </div>
            </div>

            {/* 레이더 차트 */}
            {dnaViewMode === "radar" && (
              <div className="flex flex-col items-center">
                <div className="relative w-full aspect-square max-w-[240px] mx-auto" style={{ perspective: '500px' }}>
                  <svg
                    viewBox="0 0 200 200"
                    className="w-full h-full"
                    style={{ transform: 'rotateX(8deg)' }}
                  >
                    <defs>
                      <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={
                          persona.colorClass === 'bg-emerald-500' ? '#86efac' :
                          persona.colorClass === 'bg-blue-500' ? '#93c5fd' :
                          persona.colorClass === 'bg-violet-500' ? '#c4b5fd' : '#fed7aa'
                        } stopOpacity="0.6" />
                        <stop offset="100%" stopColor={
                          persona.colorClass === 'bg-emerald-500' ? '#4ade80' :
                          persona.colorClass === 'bg-blue-500' ? '#60a5fa' :
                          persona.colorClass === 'bg-violet-500' ? '#a78bfa' : '#fb923c'
                        } stopOpacity="0.4" />
                      </linearGradient>
                    </defs>

                    {[85, 68, 51, 34, 17].map((size, i) => {
                      const points = Array.from({ length: 6 }, (_, j) => {
                        const angle = (j * 60 - 90) * (Math.PI / 180);
                        return `${100 + size * Math.cos(angle)},${100 + size * Math.sin(angle)}`;
                      }).join(' ');
                      return <polygon key={i} points={points} fill="none" stroke="#e5e7eb" strokeWidth={i === 0 ? "0.75" : "0.5"} />;
                    })}

                    {Array.from({ length: 6 }, (_, i) => {
                      const angle = (i * 60 - 90) * (Math.PI / 180);
                      return <line key={i} x1="100" y1="100" x2={100 + 85 * Math.cos(angle)} y2={100 + 85 * Math.sin(angle)} stroke="#f3f4f6" strokeWidth="0.5" />;
                    })}

                    {(() => {
                      const values = [newsDNA.economy, newsDNA.tech, newsDNA.politics, newsDNA.society, newsDNA.culture, newsDNA.world];
                      const points = values.map((val, i) => {
                        const angle = (i * 60 - 90) * (Math.PI / 180);
                        const r = (val / 100) * 80;
                        return `${100 + r * Math.cos(angle)},${100 + r * Math.sin(angle)}`;
                      }).join(' ');

                      const strokeColor = persona.colorClass === 'bg-emerald-500' ? '#16a34a' :
                                          persona.colorClass === 'bg-blue-500' ? '#2563eb' :
                                          persona.colorClass === 'bg-violet-500' ? '#7c3aed' : '#ea580c';

                      return (
                        <>
                          <polygon points={points} fill="url(#areaGradient)" stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" className="transition-all duration-500" />
                          {values.map((val, i) => {
                            const angle = (i * 60 - 90) * (Math.PI / 180);
                            const r = (val / 100) * 80;
                            return <circle key={i} cx={100 + r * Math.cos(angle)} cy={100 + r * Math.sin(angle)} r="4" fill="white" stroke={strokeColor} strokeWidth="1.5" />;
                          })}
                        </>
                      );
                    })()}
                  </svg>

                  <div className="absolute -top-5 left-1/2 -translate-x-1/2"><span className="text-[12px] font-semibold text-slate-600">경제</span></div>
                  <div className="absolute top-[15%] -right-6"><span className="text-[12px] font-semibold text-slate-600">테크</span></div>
                  <div className="absolute bottom-[15%] -right-6"><span className="text-[12px] font-semibold text-slate-600">정치</span></div>
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2"><span className="text-[12px] font-semibold text-slate-600">사회</span></div>
                  <div className="absolute bottom-[15%] -left-6"><span className="text-[12px] font-semibold text-slate-600">문화</span></div>
                  <div className="absolute top-[15%] -left-6"><span className="text-[12px] font-semibold text-slate-600">세계</span></div>
                </div>

                <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
                  <div className={`w-3 h-3 rounded-full ${persona.colorClass}`} />
                  <span className="text-[13px] text-gray-700 font-medium">
                    {hasRealData ? '나의 관심사 (실제 데이터)' : `${selectedGroup} 유형 관심사`}
                  </span>
                </div>
              </div>
            )}

            {/* 바 차트 */}
            {dnaViewMode === "chart" && (
              <div className="space-y-3.5 py-2">
                {Object.entries(newsDNA).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-[13px] text-gray-500 w-8">
                      {key === "economy" ? "경제" :
                       key === "tech" ? "테크" :
                       key === "world" ? "세계" :
                       key === "society" ? "사회" :
                       key === "culture" ? "문화" : "정치"}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          persona.colorClass === 'bg-emerald-500' ? 'bg-emerald-400' :
                          persona.colorClass === 'bg-blue-500' ? 'bg-blue-400' :
                          persona.colorClass === 'bg-violet-500' ? 'bg-violet-400' : 'bg-orange-400'
                        }`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-gray-400 w-9 text-right">{value}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 맞춤 추천 기사 */}
          <div className="space-y-4">
            {/* Recommendations */}
            {(recommendations.length > 0 || recsLoading) && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100/80 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[15px] font-bold text-gray-900">맞춤 추천 기사</h3>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-semibold rounded-full">AI</span>
                </div>

                {recsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recommendations.map((article) => (
                      <button
                        key={article.news_id}
                        onClick={() => {
                          setActiveTab("feed");
                        }}
                        className="w-full text-left p-3.5 bg-gray-50 hover:bg-blue-50 rounded-xl transition-all group"
                      >
                        <p className="text-[13px] font-medium text-gray-800 line-clamp-2 group-hover:text-blue-700 transition-colors">
                          {article.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[11px] text-gray-400">{article.category}</span>
                          {article._source && (
                            <>
                              <span className="w-1 h-1 bg-gray-200 rounded-full" />
                              <span className="text-[11px] text-blue-500">
                                {article._source === 'category' ? '관심 카테고리' : '유사도 매칭'}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 비슷한 DNA */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100/80 shadow-sm">
              <h3 className="text-[15px] font-bold text-gray-900 mb-3">비슷한 DNA를 가진 사람들</h3>
              <p className="text-[14px] text-gray-500 mb-5">
                {hasRealData
                  ? `${analysis!.top_categories?.[0] || '경제'} 관심자 그룹에 속해 있어요`
                  : '1,234명이 비슷한 관심사를 가지고 있어요'}
              </p>
              <button
                onClick={() => setActiveTab("community")}
                className="w-full py-3.5 bg-blue-500 rounded-xl text-[14px] font-medium text-white hover:bg-blue-600 transition-colors"
              >
                커뮤니티 둘러보기
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {/* 생일 기록 탭 */}
      {dnaSubTab === "birthday" && (() => {
        const savedBirthday = typeof window !== 'undefined' ? localStorage.getItem("user_birthday") : null;
        const todayStr = new Date().toISOString().split("T")[0];

        const handleSaveBirthday = () => {
          if (birthdayInput) {
            localStorage.setItem("user_birthday", birthdayInput);
            router.push(`/timemachine?date=${birthdayInput}&mode=birthday`);
          }
        };

        const handleViewBirthday = () => {
          if (savedBirthday) {
            router.push(`/timemachine?date=${savedBirthday}&mode=birthday`);
          }
        };

        const handleClearBirthday = () => {
          localStorage.removeItem("user_birthday");
          setBirthdayInput("");
        };

        return (
        <div className="max-w-[520px] mx-auto">
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-2">내 생일의 기록</h3>
              <p className="text-[14px] text-gray-500">그날, 세상은 어땠을까요?</p>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { icon: Newspaper, label: '뉴스' },
                { icon: Users, label: '유명인' },
                { icon: Camera, label: '사진' },
                { icon: TrendingUp, label: '투자' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 bg-gray-50 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <p className="text-[12px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {savedBirthday ? (
              <>
                <div className="bg-blue-50 rounded-xl p-4 mb-6">
                  <p className="text-[13px] text-blue-600 text-center">
                    내 생일: <span className="font-semibold">{new Date(savedBirthday).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
                  </p>
                </div>
                <button
                  onClick={handleViewBirthday}
                  className="w-full py-3.5 bg-blue-500 rounded-xl text-[14px] font-medium text-white hover:bg-blue-600 transition-colors mb-3"
                >
                  내 생일 기록 보기
                </button>
                <button
                  onClick={handleClearBirthday}
                  className="w-full py-2.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  생일 변경하기
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-gray-500 text-center mb-4">
                  생일을 입력하면 그날의 기록을 볼 수 있어요
                </p>
                <input
                  type="date"
                  value={birthdayInput}
                  max={todayStr}
                  min="1950-01-01"
                  onChange={(e) => setBirthdayInput(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-gray-800 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 mb-4"
                />
                <button
                  onClick={handleSaveBirthday}
                  disabled={!birthdayInput}
                  className="w-full py-3.5 bg-blue-500 rounded-xl text-[14px] font-medium text-white hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  내 생일 기록 확인하기
                </button>
              </>
            )}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push("/timemachine")}
              className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              다른 날짜 탐색하기 →
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
