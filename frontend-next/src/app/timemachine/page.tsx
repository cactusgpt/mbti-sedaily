'use client';

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getFamousBirthdays, type FamousPerson } from "@/data/famousBirthdays";
import { getSnapshotByDate, CURRENT_SNAPSHOT } from "@/data/economicSnapshots";
import { INVESTMENT_OPTIONS, calcInvestment, getParallelUniverses } from "@/data/investmentScenarios";
import { fetchTimeMachineData } from "@/api/timeMachineApi";
import type { DayNews, HistoricalEvent } from "@/types/timeMachine";
import { Newspaper, Users, Camera, TrendingUp, ArrowLeft, Sparkles, Calendar, Home, Clock, Building, Landmark, Coins, PiggyBank, Car, Store, Bitcoin, Trophy, Award, BarChart2, Building2, Smartphone, Coffee, Crown, Mic2, Palette, Film, BookOpen, Globe, Briefcase, Music, Pen, Gamepad2, Medal, Rocket, type LucideIcon } from "lucide-react";

// 투자 옵션 아이콘 매핑
const INVESTMENT_ICONS: Record<string, LucideIcon> = {
  kospi: BarChart2,
  bitcoin: Bitcoin,
  cash: Landmark,
  gangnam: Building2,
  samsung: Smartphone,
  starbucks_coffee: Coffee,
};

// 분야별 아이콘 매핑
const FIELD_ICONS: Record<string, LucideIcon> = {
  "정치인": Crown,
  "정치": Crown,
  "가수": Mic2,
  "음악가": Music,
  "음악": Music,
  "배우": Film,
  "영화": Film,
  "감독": Film,
  "작가": Pen,
  "문학": BookOpen,
  "과학자": Rocket,
  "과학": Rocket,
  "사업가": Briefcase,
  "기업인": Briefcase,
  "경제": Briefcase,
  "예술가": Palette,
  "미술": Palette,
  "스포츠": Medal,
  "운동선수": Medal,
  "게임": Gamepad2,
  "국제": Globe,
};

type Step = "input" | "loading" | "result" | "invest-result";
type ResultTab = "news" | "celebs" | "photos" | "invest";

function getRandomDate(): string {
  const start = new Date("1990-01-01").getTime();
  const end = new Date(Date.now() - 86400000).getTime();
  return new Date(start + Math.random() * (end - start)).toISOString().split("T")[0];
}



const CATEGORY_COLOR: Record<string, string> = {
  경제: "bg-blue-100 text-blue-600", IT: "bg-violet-100 text-violet-600",
  사회: "bg-orange-100 text-orange-600", 역사: "bg-amber-100 text-amber-700",
  국제: "bg-emerald-100 text-emerald-600", 문화: "bg-pink-100 text-pink-600",
  스포츠: "bg-red-100 text-red-600",
};

function fmtValue(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억원`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만원`;
  return `${v.toLocaleString()}원`;
}
function fmtValueShort(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만원`;
  return `${v.toLocaleString()}원`;
}
function fmtRate(rate: number): string {
  if (rate >= 1000) return `+${(rate / 100).toFixed(0)}배`;
  return `${rate >= 0 ? "+" : ""}${rate.toFixed(0)}%`;
}


function TimeMachineContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("input");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState("");
  const [news, setNews] = useState<DayNews[]>([]);
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [birthdays, setBirthdays] = useState<FamousPerson[]>([]);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof getSnapshotByDate> | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>("news");
  const [isBirthdayMode, setIsBirthdayMode] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  const tabs: { id: ResultTab; label: string; subtitle: string; icon: typeof Newspaper }[] = [
    { id: "news", label: "그날의 뉴스", subtitle: "무슨 일이 있었나", icon: Newspaper },
    { id: "celebs", label: "같은 날 태어난", subtitle: "운명을 공유한 사람들", icon: Users },
    { id: "photos", label: "기록된 순간", subtitle: "사진으로 보는 역사", icon: Camera },
    { id: "invest", label: "만약 그때", subtitle: "투자했더라면", icon: TrendingUp },
  ];

  // URL 파라미터로 날짜가 전달되면 자동 로드
  useEffect(() => {
    const dateParam = searchParams.get("date");
    const modeParam = searchParams.get("mode");

    if (dateParam && dateParam < today) {
      setTargetDate(dateParam);
      setIsBirthdayMode(modeParam === "birthday");

      // 자동으로 데이터 로드
      const loadData = async () => {
        setStep("loading");
        const [data] = await Promise.all([
          fetchTimeMachineData(dateParam),
          new Promise((r) => setTimeout(r, 2800)),
        ]);
        setNews(data.news);
        setEvents(data.historicalEvents);
        setBirthdays(getFamousBirthdays(dateParam));
        setSnapshot(getSnapshotByDate(dateParam));
        setStep("result");
      };

      loadData();
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDate) { setError("날짜를 선택해주세요."); return; }
    if (targetDate >= today) { setError("오늘 이전 날짜를 선택해주세요."); return; }
    setError("");
    setStep("loading");
    const [data] = await Promise.all([
      fetchTimeMachineData(targetDate),
      new Promise((r) => setTimeout(r, 2800)),
    ]);
    setNews(data.news);
    setEvents(data.historicalEvents);
    setBirthdays(getFamousBirthdays(targetDate));
    setSnapshot(getSnapshotByDate(targetDate));
    setSelectedInvestment(null);
    setShowComparison(false);
    setStep("result");
  };

  const d = targetDate ? new Date(targetDate) : null;
  const formatted = d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` : "";
  const resetAll = () => { setStep("input"); setTargetDate(""); setNews([]); setEvents([]); setBirthdays([]); setSnapshot(null); setSelectedInvestment(null); setShowComparison(false); setActiveTab("news"); };

  return (
    <div className={`relative min-h-screen bg-[#e8e4dc] flex flex-col items-center px-4 py-16 ${step === "input" || step === "loading" ? "justify-center" : ""}`}>
      {/* 갤러리 벽면 텍스처 - 고급스러운 리넨/캔버스 느낌 */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")
        `,
        opacity: 0.04
      }} />
      {/* 미세한 그라데이션 빛 효과 */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-white/10 via-transparent to-black/5" />

      {step === "input" && (
        <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-[13px] text-stone-400 hover:text-stone-600 transition-colors z-10 tracking-wide">
          <Home className="w-4 h-4" />
          <span className="font-light">돌아가기</span>
        </Link>
      )}
      <div className="w-full max-w-2xl">

        {step === "input" && (
          <form onSubmit={handleSubmit} className="w-full max-w-md">
            {/* 공책/일기장 스타일 컨테이너 */}
            <div className="relative bg-[#faf8f3] rounded-lg shadow-xl overflow-hidden">
              {/* 종이 질감 */}
              <div className="absolute inset-0 opacity-[0.02]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
              }} />

              {/* 노트 라인 배경 */}
              <div className="absolute inset-0 opacity-[0.08]" style={{
                backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #94a3b8 31px, #94a3b8 32px)',
                backgroundPosition: '0 20px'
              }} />

              {/* 왼쪽 여백선 (노트 느낌) */}
              <div className="absolute left-12 top-0 bottom-0 w-px bg-rose-200/40" />

              <div className="relative p-10 pl-16">
                {/* 날짜 표시 - 손글씨 느낌 */}
                <div className="text-right text-stone-400 text-sm mb-12" style={{ fontFamily: 'Georgia, serif' }}>
                  {new Date().getFullYear()}년의 어느 날
                </div>

                {/* 제목 */}
                <h1 className="text-3xl text-stone-700 mb-4 leading-relaxed" style={{ fontFamily: 'Georgia, serif' }}>
                  그날로<br/>돌아간다면,
                </h1>

                <p className="text-stone-500 text-[15px] leading-relaxed mb-10" style={{ fontFamily: 'Georgia, serif' }}>
                  무엇이 달라졌을까요?
                </p>

                {/* 날짜 입력 */}
                <div className="mb-8">
                  <p className="text-stone-400 text-xs mb-3 tracking-wide">찾아갈 날짜</p>
                  <input
                    type="date"
                    value={targetDate}
                    min="1990-01-01"
                    max={today}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-white/50 border border-stone-200 rounded-lg px-4 py-3 text-stone-700 text-lg focus:outline-none focus:border-stone-400 transition-colors"
                    style={{ fontFamily: 'Georgia, serif' }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setTargetDate(getRandomDate())}
                    className="text-[12px] text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    아무 날이나
                  </button>

                  <button
                    type="submit"
                    className="bg-stone-800 hover:bg-stone-900 text-white px-6 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
                  >
                    <span>페이지 넘기기</span>
                    <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>

                {error && <p className="text-rose-500 text-[13px] mt-4">{error}</p>}

                {/* 하단 - 책 페이지 번호 느낌 */}
                <div className="text-center mt-16 pt-6 border-t border-stone-200/50">
                  <p className="text-stone-300 text-[10px] tracking-[0.2em]">
                    1990 — {new Date().getFullYear()}
                  </p>
                </div>
              </div>
            </div>
          </form>
        )}

        {step === "loading" && (
          <div className="w-full max-w-md mx-auto">
            <style>{`
              @keyframes turnPageReverse {
                0% { transform: rotateY(0deg); }
                25% { transform: rotateY(20deg); }
                100% { transform: rotateY(180deg); }
              }
              @keyframes showContent {
                0% { opacity: 0; transform: scale(0.98); }
                100% { opacity: 1; transform: scale(1); }
              }
              @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-3px); }
              }
              @keyframes shimmer {
                0% { opacity: 0.5; }
                50% { opacity: 0.8; }
                100% { opacity: 0.5; }
              }
            `}</style>

            {/* 펼쳐진 신문 */}
            <div
              className="relative rounded-sm overflow-hidden"
              style={{
                height: '360px',
                perspective: '1500px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)'
              }}
            >
              {/* 종이 질감 배경 */}
              <div className="absolute inset-0 bg-[#f9f7f3]" />
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
              }} />

              {/* 왼쪽 - 넘어가는 페이지들 (과거로 돌아가는 느낌) */}
              <div className="absolute left-0 top-0 bottom-0 w-1/2" style={{ transformStyle: 'preserve-3d' }}>

                {/* 넘어가는 신문 페이지들 - 좌→우로 넘어감 */}
                {Array.from({ length: 12 }, (_, i) => {
                  const year = 2024 - i * 2;
                  return (
                    <div
                      key={i}
                      className="absolute inset-0 bg-[#fdfcf9] p-4"
                      style={{
                        animation: `turnPageReverse 0.55s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.18}s forwards`,
                        transformOrigin: 'right center',
                        backfaceVisibility: 'hidden',
                        zIndex: 20 - i,
                        boxShadow: '4px 0 15px rgba(0,0,0,0.08)'
                      }}
                    >
                      <div className="border-b border-stone-200 pb-1 mb-3">
                        <p className="text-[8px] text-stone-400 font-medium text-right">{year}년</p>
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 bg-stone-200 rounded-sm w-full" />
                        <div className="h-2 bg-stone-200 rounded-sm w-2/3" />
                        <div className="h-10 bg-stone-100 rounded-sm w-full mt-2" />
                        <div className="h-1.5 bg-stone-100 rounded-sm w-full" />
                        <div className="h-1.5 bg-stone-100 rounded-sm w-4/5" />
                      </div>
                    </div>
                  );
                })}

                {/* 최종 페이지 (왼쪽) */}
                <div
                  className="absolute inset-0 bg-gradient-to-bl from-[#fdfcf9] to-[#f8f6f1] flex flex-col items-center justify-center"
                  style={{ animation: 'showContent 0.6s ease-out 2.4s both', zIndex: 0 }}
                >
                  {d && (
                    <div className="text-center" style={{ animation: 'float 2.5s ease-in-out infinite 3s' }}>
                      <div className="w-10 h-px bg-stone-300 mx-auto mb-3" />
                      <p className="text-[9px] tracking-[0.3em] text-stone-400 uppercase mb-2">Arrived</p>
                      <p className="text-5xl font-extralight text-stone-800 leading-none" style={{ fontFamily: 'Georgia, serif' }}>{d.getFullYear()}</p>
                      <p className="text-stone-500 text-sm mt-2 font-light">{d.getMonth() + 1}월 {d.getDate()}일</p>
                      <div className="w-10 h-px bg-stone-300 mx-auto mt-3" />
                    </div>
                  )}
                </div>
              </div>

              {/* 오른쪽 페이지 - 고정 (현재) */}
              <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[#fdfcf9] p-5">
                {/* 신문 헤더 */}
                <div className="border-b-2 border-stone-800 pb-2 mb-4">
                  <div className="flex justify-between items-center text-[7px] text-stone-400 mb-1">
                    <span>TIME MACHINE</span>
                    <span>2025</span>
                  </div>
                  <p className="text-xl font-black text-stone-800 text-center tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>서울경제</p>
                  <p className="text-[8px] text-stone-400 text-center mt-1">THE SEOUL ECONOMIC DAILY</p>
                </div>
                {/* 가짜 기사 라인들 */}
                <div className="space-y-2">
                  <div className="h-2.5 bg-stone-800 rounded-sm w-full" />
                  <div className="h-2 bg-stone-300 rounded-sm w-4/5" />
                  <div className="flex gap-2 mt-3">
                    <div className="w-16 h-12 bg-stone-100 rounded-sm" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-1.5 bg-stone-200 rounded-sm w-full" />
                      <div className="h-1.5 bg-stone-200 rounded-sm w-5/6" />
                      <div className="h-1.5 bg-stone-200 rounded-sm w-full" />
                    </div>
                  </div>
                  <div className="h-px bg-stone-200 my-2" />
                  <div className="h-1.5 bg-stone-100 rounded-sm w-full" />
                  <div className="h-1.5 bg-stone-100 rounded-sm w-3/4" />
                </div>
              </div>

              {/* 중앙 접힘선 + 그림자 */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[3px] bg-gradient-to-r from-stone-300 via-stone-200 to-stone-300" style={{ transform: 'translateX(-1.5px)' }} />
              <div className="absolute left-1/2 top-0 bottom-0 w-4 bg-gradient-to-l from-black/5 to-transparent" style={{ transform: 'translateX(-2px)' }} />

            </div>

            {/* 하단 텍스트 */}
            <div className="text-center mt-5">
              <p className="text-stone-500 text-xs">
                {d ? `${new Date().getFullYear() - d.getFullYear()}년의 시간을 거슬러...` : '...'}
              </p>
              <div className="flex justify-center gap-1 mt-2">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1 h-1 rounded-full bg-stone-400" style={{ animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "invest-result" && selectedInvestment && (() => {
          const year = new Date(targetDate).getFullYear();
          const opt = INVESTMENT_OPTIONS.find((o) => o.id === selectedInvestment)!;
          const result = calcInvestment(selectedInvestment, year);
          const isProfit = result.returnRate >= 0;
          const allResults = INVESTMENT_OPTIONS.map((o) => ({ opt: o, result: calcInvestment(o.id, year) }));
          const maxValue = Math.max(...allResults.map((r) => r.result.currentValue));
          const parallelUniverses = getParallelUniverses(selectedInvestment, year);
          const bestAlternative = parallelUniverses[0];
          const regretGap = bestAlternative.result.currentValue - result.currentValue;

          return (
            <div className="space-y-6">
              {/* 헤더 */}
              <div className="text-center">
                <button
                  onClick={() => { setStep("result"); setShowComparison(false); }}
                  className="inline-flex items-center gap-2 text-stone-400 hover:text-stone-600 transition-colors text-[12px] tracking-wide mb-6"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>돌아가기</span>
                </button>

                <p className="text-[11px] tracking-[0.2em] text-stone-400 uppercase mb-2">{formatted}</p>
                <div className="flex items-center justify-center gap-3">
                  {(() => {
                    const HeaderIcon = INVESTMENT_ICONS[opt.id] || Coins;
                    return (
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">
                        <HeaderIcon className="w-5 h-5 text-stone-600" />
                      </div>
                    );
                  })()}
                  <h2 className="text-xl font-light text-stone-800" style={{ fontFamily: 'Georgia, serif' }}>{opt.label}</h2>
                </div>

                {/* 장식 라인 */}
                <div className="flex items-center justify-center gap-4 mt-4">
                  <div className="h-px w-12 bg-stone-200" />
                  <div className="w-1 h-1 rounded-full bg-stone-300" />
                  <div className="h-px w-12 bg-stone-200" />
                </div>
              </div>

              {!showComparison && (
                <div className="space-y-5">
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-stone-200/60 p-6">
                    <div className="grid grid-cols-3 gap-3 text-center mb-6">
                      <div className="bg-stone-50/50 rounded-xl p-4">
                        <p className="text-stone-400 text-[10px] tracking-wide uppercase mb-1">Investment</p>
                        <p className="text-stone-800 font-medium text-[14px]">1억원</p>
                      </div>
                      <div className="bg-stone-50/50 rounded-xl p-4">
                        <p className="text-stone-400 text-[10px] tracking-wide uppercase mb-1">Current</p>
                        <p className="text-stone-800 font-medium text-[14px]">{fmtValue(result.currentValue)}</p>
                      </div>
                      <div className={`rounded-xl p-4 ${isProfit ? "bg-emerald-50/50" : "bg-rose-50/50"}`}>
                        <p className="text-stone-400 text-[10px] tracking-wide uppercase mb-1">{result.totalSpent !== undefined ? "Spent" : "Return"}</p>
                        {result.totalSpent !== undefined ? (
                          <p className="font-medium text-[14px] text-amber-600">
                            -{result.totalSpent >= 10_000 ? `${(result.totalSpent / 10_000).toFixed(0)}만원` : `${result.totalSpent.toLocaleString()}원`}
                          </p>
                        ) : (
                          <p className={`font-medium text-[14px] ${isProfit ? "text-emerald-600" : "text-rose-500"}`}>{fmtRate(result.returnRate)}</p>
                        )}
                      </div>
                    </div>
                    {result.story && (
                      <div className="bg-stone-50/50 rounded-xl p-4 mb-5">
                        <p className="text-stone-600 text-[12px] leading-relaxed">{result.story}</p>
                      </div>
                    )}
                    <div className="border-t border-stone-100 pt-4">
                      <p className="text-stone-500 text-[13px] text-center italic" style={{ fontFamily: 'Georgia, serif' }}>"{result.tagline}"</p>
                    </div>
                  </div>

                  {regretGap > 0 ? (
                    <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <Sparkles className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-amber-800 text-[12px] font-medium mb-1">다른 우주에서는...</p>
                          <p className="text-amber-700 text-[12px] leading-relaxed">
                            <strong>{bestAlternative.option.label}</strong>을 선택했다면{" "}
                            <strong>{fmtValue(regretGap)}</strong>을 더 벌었을 겁니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <Trophy className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-emerald-800 text-[12px] font-medium mb-1">최선의 선택!</p>
                          <p className="text-emerald-700 text-[12px] leading-relaxed">모든 평행우주 중에서 <strong>가장 좋은 선택</strong>을 했습니다.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button onClick={() => setShowComparison(true)} className="w-full bg-stone-800 hover:bg-stone-900 text-white py-4 rounded-xl transition-all text-[13px] tracking-wide font-light flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    모든 평행우주 보기
                  </button>
                </div>
              )}

              {showComparison && (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="text-center mb-6">
                      <p className="text-[11px] tracking-[0.2em] text-stone-500 uppercase mb-1 font-medium">Parallel Universes</p>
                      <h3 className="text-stone-900 text-base font-semibold" style={{ fontFamily: 'Georgia, serif' }}>평행우주 비교</h3>
                      <p className="text-stone-600 text-[12px] mt-1">{formatted}에 1억원을 투자했다면</p>
                    </div>
                    <div className="space-y-3">
                      {allResults
                        .sort((a, b) => b.result.currentValue - a.result.currentValue)
                        .map(({ opt: o, result: r }, rank) => {
                          const barWidth = maxValue > 0 ? Math.max(4, (r.currentValue / maxValue) * 100) : 4;
                          const profit = r.returnRate >= 0;
                          const isSelected = o.id === selectedInvestment;
                          const OptionIcon = INVESTMENT_ICONS[o.id] || Coins;
                          return (
                            <div key={o.id} className={`rounded-xl p-4 transition-all ${isSelected ? "bg-stone-900" : "bg-stone-50 border border-stone-200"}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                    rank === 0 ? "bg-amber-400 text-amber-900" :
                                    rank === 1 ? "bg-stone-300 text-stone-700" :
                                    rank === 2 ? "bg-orange-300 text-orange-800" :
                                    isSelected ? "bg-stone-700 text-stone-300" : "bg-stone-200 text-stone-600"
                                  }`}>
                                    {rank + 1}
                                  </div>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? "bg-stone-700" : "bg-white border-2 border-stone-300"}`}>
                                    <OptionIcon className={`w-4 h-4 ${isSelected ? "text-white" : "text-stone-700"}`} />
                                  </div>
                                  <div>
                                    <span className={`text-[14px] font-bold ${isSelected ? "text-white" : "text-stone-900"}`}>
                                      {o.label}
                                    </span>
                                    {isSelected && <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded bg-stone-700 text-stone-300">내 선택</span>}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`text-[15px] font-bold ${isSelected ? "text-white" : profit ? "text-emerald-600" : "text-rose-600"}`}>{fmtValueShort(r.currentValue)}</p>
                                  <p className={`text-[11px] font-semibold ${isSelected ? "text-stone-400" : profit ? "text-emerald-600" : "text-rose-500"}`}>{fmtRate(r.returnRate)}</p>
                                </div>
                              </div>
                              <div className={`w-full rounded-full h-2 ${isSelected ? "bg-stone-700" : "bg-stone-200"}`}>
                                <div className={`h-2 rounded-full transition-all duration-700 ${isSelected ? "bg-white" : profit ? "bg-emerald-500" : "bg-rose-400"}`} style={{ width: `${barWidth}%` }} />
                              </div>
                              {r.story && <p className={`text-[12px] mt-3 leading-relaxed ${isSelected ? "text-stone-400" : "text-stone-600"}`}>{r.story}</p>}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm p-6">
                    <p className="text-stone-700 text-[13px] mb-4 text-center font-medium">다른 선택을 해볼까요?</p>
                    <div className="grid grid-cols-3 gap-3">
                      {INVESTMENT_OPTIONS.filter((o) => o.id !== selectedInvestment).map((o) => {
                        const AltIcon = INVESTMENT_ICONS[o.id] || Coins;
                        return (
                          <button key={o.id} onClick={() => { setSelectedInvestment(o.id); setShowComparison(false); }}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-stone-100 hover:bg-stone-200 transition-all text-center">
                            <div className="w-9 h-9 rounded-full bg-white border-2 border-stone-300 flex items-center justify-center">
                              <AltIcon className="w-4 h-4 text-stone-700" />
                            </div>
                            <p className="text-stone-800 font-semibold text-[11px] leading-snug">{o.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button onClick={() => setShowComparison(false)} className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium py-3.5 rounded-xl transition-all text-[13px]">
                    내 결과만 보기
                  </button>
                </div>
              )}

              <button onClick={resetAll} className="w-full bg-transparent hover:bg-stone-100/50 text-stone-400 py-3 rounded-xl transition-all text-[12px] border border-stone-200/40">
                다른 날짜로 이동
              </button>
            </div>
          );
        })()}

        {step === "result" && (
          <div className="space-y-8">
            {/* 헤더 - 내러티브 스타일 */}
            <div className="text-center py-4">
              <Link
                href={isBirthdayMode ? "/" : "#"}
                onClick={isBirthdayMode ? undefined : resetAll}
                className="inline-flex items-center gap-2 text-stone-400 hover:text-stone-600 transition-colors text-[12px] mb-8"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isBirthdayMode ? "돌아가기" : "다른 날짜로"}</span>
              </Link>

              {/* 날짜와 내러티브 */}
              <div className="mb-4">
                {isBirthdayMode ? (
                  <p className="text-stone-400 text-[13px] font-light mb-3">당신이 태어난 날</p>
                ) : (
                  <p className="text-stone-400 text-[13px] font-light mb-3">
                    {d && (new Date().getFullYear() - d.getFullYear())}년 전, 그날
                  </p>
                )}
                <h2 className="text-4xl font-extralight text-stone-800" style={{ fontFamily: 'Georgia, serif' }}>
                  {d && d.getFullYear()}
                </h2>
                <p className="text-lg text-stone-500 font-light mt-1">
                  {d && `${d.getMonth() + 1}월 ${d.getDate()}일`}
                </p>
              </div>

              {/* 구분선 */}
              <div className="h-px w-16 bg-stone-200 mx-auto mt-6" />
            </div>

            {/* 탭 네비게이션 - 텍스트 중심, 미니멀 */}
            <div className="flex justify-center gap-8 border-b border-stone-100 pb-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative pb-3 text-[13px] transition-all ${
                      isActive
                        ? "text-stone-800"
                        : "text-stone-400 hover:text-stone-600"
                    }`}
                  >
                    <span className="font-medium">{tab.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-800 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 경제 스냅샷 - 투자 탭에서만 표시 */}
            {activeTab === "invest" && snapshot && (
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-stone-200/60 px-6 py-5">
                <p className="text-[11px] text-stone-400 mb-4 flex items-center gap-2 tracking-wide uppercase">
                  <TrendingUp className="w-3.5 h-3.5" /> Then vs Now
                </p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: "KOSPI", then: snapshot.kospi.toLocaleString(), now: CURRENT_SNAPSHOT.kospi.toLocaleString(), unit: "" },
                    { label: "USD/KRW", then: snapshot.usdKrw.toLocaleString(), now: CURRENT_SNAPSHOT.usdKrw.toLocaleString(), unit: "" },
                    { label: "기준금리", then: snapshot.baseRate.toFixed(2), now: CURRENT_SNAPSHOT.baseRate.toFixed(2), unit: "%" },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-xl bg-stone-50/50">
                      <p className="text-[10px] text-stone-400 mb-2 tracking-wide">{item.label}</p>
                      <div className="hidden sm:flex items-center justify-center gap-2">
                        <span className="text-[13px] font-medium text-stone-600">{item.then}{item.unit}</span>
                        <span className="text-stone-300 text-xs">→</span>
                        <span className="text-[13px] font-medium text-stone-800">{item.now}{item.unit}</span>
                      </div>
                      <div className="flex sm:hidden flex-col items-center gap-0.5">
                        <span className="text-[13px] font-medium text-stone-600">{item.then}{item.unit}</span>
                        <span className="text-stone-300 text-[10px]">↓</span>
                        <span className="text-[13px] font-medium text-stone-800">{item.now}{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 뉴스 탭 */}
            {activeTab === "news" && (
              <div className="py-6">
                <div className="text-center mb-10">
                  <p className="text-[11px] tracking-[0.3em] text-stone-500 uppercase mb-2 font-medium">Headlines</p>
                  <h3 className="text-stone-900 text-lg font-medium" style={{ fontFamily: 'Georgia, serif' }}>
                    {d && d.getFullYear()}년의 뉴스
                  </h3>
                </div>
                {new Date(targetDate).getFullYear() < 1995 ? (
                  <div className="py-16 text-center">
                    <p className="text-stone-500 text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                      1995년 이전의 기록은<br/>아직 디지털로 옮겨지지 않았습니다
                    </p>
                  </div>
                ) : news.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-stone-500 text-sm">
                      그날의 뉴스를 찾지 못했습니다
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {news.map((item, i) => (
                      <div key={i} className="group bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start gap-4">
                          <span className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-stone-800 text-white shrink-0">{item.category}</span>
                          <div className="flex-1">
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-stone-900 text-[15px] font-semibold leading-relaxed hover:text-stone-600 transition-colors block">{item.title}</a>
                            ) : (
                              <p className="text-stone-900 text-[15px] font-semibold leading-relaxed">{item.title}</p>
                            )}
                            {item.summary && <p className="text-stone-600 text-[13px] mt-2 leading-relaxed">{item.summary}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 역사 속 이슈 - 캐러셀 */}
                {events.length > 0 && (
                  <div className="mt-16 pt-12 border-t border-stone-300">
                    {/* 헤더 */}
                    <div className="text-center mb-8">
                      <p className="text-[11px] tracking-[0.3em] text-stone-500 uppercase mb-2 font-medium">On This Day</p>
                      <h3 className="text-stone-900 text-lg font-medium" style={{ fontFamily: 'Georgia, serif' }}>
                        같은 날, 다른 해
                      </h3>
                    </div>

                    {/* 캐러셀 */}
                    <div className="relative">
                      {/* 메인 카드 */}
                      <div className="overflow-hidden">
                        {events.map((ev, i) => {
                          const mockImages = [
                            "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80",
                            "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=400&q=80",
                            "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=400&q=80",
                            "https://images.unsplash.com/photo-1444653614773-995cb1ef9efa?w=400&q=80",
                            "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80",
                          ];
                          const displayImage = ev.images?.[0] ?? ev.image ?? mockImages[i % mockImages.length];
                          if (i !== carouselIndex) return null;
                          return (
                            <div key={i} className="bg-white rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                              <img
                                src={displayImage}
                                alt={ev.title}
                                className="w-full h-48 object-cover"
                              />
                              <div className="p-5">
                                <div className="flex items-center gap-3 mb-3">
                                  <span className="text-stone-900 text-2xl font-medium" style={{ fontFamily: 'Georgia, serif' }}>{ev.year}</span>
                                  <span className="text-[12px] px-3 py-1 rounded-full bg-stone-800 text-white font-semibold">{ev.category}</span>
                                </div>
                                <p className="text-stone-900 text-[15px] font-semibold leading-relaxed">{ev.title}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 네비게이션 */}
                      <div className="flex items-center justify-center gap-4 mt-6">
                        <button
                          onClick={() => setCarouselIndex(i => Math.max(0, i - 1))}
                          disabled={carouselIndex === 0}
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                            carouselIndex === 0
                              ? 'border-stone-300 text-stone-400'
                              : 'border-stone-700 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>

                        {/* 인디케이터 */}
                        <div className="flex items-center gap-2">
                          {events.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setCarouselIndex(i)}
                              className={`rounded-full transition-all ${
                                i === carouselIndex ? 'w-3 h-3 bg-stone-800' : 'w-2 h-2 bg-stone-400'
                              }`}
                            />
                          ))}
                        </div>

                        <button
                          onClick={() => setCarouselIndex(i => Math.min(events.length - 1, i + 1))}
                          disabled={carouselIndex >= events.length - 1}
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                            carouselIndex >= events.length - 1
                              ? 'border-stone-300 text-stone-400'
                              : 'border-stone-700 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <ArrowLeft className="w-4 h-4 rotate-180" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 유명인 탭 - 미니멀 */}
            {activeTab === "celebs" && (
              <div className="py-6">
                {/* 섹션 헤더 */}
                <div className="text-center mb-10">
                  <p className="text-[11px] tracking-[0.3em] text-stone-500 uppercase mb-2 font-medium">Born on this day</p>
                  <h3 className="text-stone-900 text-lg font-medium" style={{ fontFamily: 'Georgia, serif' }}>
                    같은 날 태어난 사람들
                  </h3>
                </div>

                {birthdays.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-stone-500 text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                      해당 날짜에 태어난 유명인 정보가 없습니다
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {birthdays.map((person, i) => {
                      const FieldIcon = FIELD_ICONS[person.field] || Users;
                      return (
                        <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
                          <div className="flex items-start gap-4">
                            {/* 아이콘 */}
                            <div className="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center shrink-0">
                              <FieldIcon className="w-5 h-5 text-white" />
                            </div>

                            {/* 정보 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <h4 className="text-stone-900 text-base font-bold">
                                  {person.name}
                                </h4>
                                <span className="text-[11px] px-2.5 py-1 rounded-full bg-stone-200 text-stone-700 font-semibold">
                                  {person.field}
                                </span>
                              </div>
                              <p className="text-stone-700 text-[13px] leading-relaxed mb-2">
                                {person.description}
                              </p>
                              <p className="text-stone-500 text-[12px] font-medium">
                                {person.birthYear}년생
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 사진 탭 - 미니멀 갤러리 */}
            {activeTab === "photos" && (
              <div className="py-6">
                {/* 섹션 헤더 */}
                <div className="text-center mb-10">
                  <p className="text-[11px] tracking-[0.3em] text-stone-500 uppercase mb-2 font-medium">Archives</p>
                  <h3 className="text-stone-900 text-lg font-medium" style={{ fontFamily: 'Georgia, serif' }}>
                    기록된 순간
                  </h3>
                </div>

                {events.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-stone-500 text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                      해당 날짜의 사진 기록이 없습니다
                    </p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {events.map((ev, i) => {
                      const mockImages = [
                        "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=80",
                        "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600&q=80",
                        "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600&q=80",
                        "https://images.unsplash.com/photo-1444653614773-995cb1ef9efa?w=600&q=80",
                        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80",
                      ];
                      const displayImage = ev.images?.[0] ?? ev.image ?? mockImages[i % mockImages.length];
                      return (
                        <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
                          {/* 이미지 */}
                          <img
                            src={displayImage}
                            alt={ev.title}
                            className="w-full h-56 object-cover"
                          />
                          {/* 캡션 */}
                          <div className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-stone-900 text-2xl font-medium" style={{ fontFamily: 'Georgia, serif' }}>
                                {ev.year}
                              </span>
                              <span className="text-[12px] px-3 py-1 rounded-full bg-stone-800 text-white font-semibold">
                                {ev.category}
                              </span>
                            </div>
                            <h4 className="text-stone-900 text-[15px] font-semibold leading-relaxed">
                              {ev.title}
                            </h4>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 하단 */}
                {events.length > 0 && (
                  <div className="mt-10 pt-6 border-t border-stone-300 text-center">
                    <p className="text-[11px] tracking-[0.2em] text-stone-500 uppercase font-medium">
                      {events.length} photographs from the archives
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 투자 탭 - 프리미엄 금융 스타일 */}
            {activeTab === "invest" && (
              <div className="py-6">
                {/* 섹션 헤더 */}
                <div className="text-center mb-10">
                  <div className="flex items-center justify-center gap-4 mb-3">
                    <div className="h-px w-12 bg-stone-300" />
                    <TrendingUp className="w-4 h-4 text-stone-400" />
                    <div className="h-px w-12 bg-stone-300" />
                  </div>
                  <p className="text-stone-500 text-sm mb-2" style={{ fontFamily: 'Georgia, serif' }}>
                    만약 그때로 돌아간다면
                  </p>
                  <p className="text-stone-400 text-xs">
                    1억원을 어디에 투자하시겠습니까?
                  </p>
                </div>

                {/* 투자 옵션 그리드 */}
                <div className="grid grid-cols-2 gap-4">
                  {INVESTMENT_OPTIONS.map((opt, index) => {
                    const Icon = INVESTMENT_ICONS[opt.id] || Coins;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => { setSelectedInvestment(opt.id); setShowComparison(false); setStep("invest-result"); }}
                        className="group relative bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] transition-all duration-300 text-left overflow-hidden"
                      >
                        {/* 배경 장식 */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-stone-50 to-transparent rounded-bl-full opacity-60" />

                        {/* 번호 뱃지 */}
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center">
                          <span className="text-[10px] text-stone-400 font-medium">{String(index + 1).padStart(2, '0')}</span>
                        </div>

                        {/* 아이콘 */}
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-stone-100 to-stone-50 border border-stone-200 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                          <Icon className="w-6 h-6 text-stone-700" />
                        </div>

                        {/* 텍스트 */}
                        <h4 className="text-stone-900 font-semibold text-[15px] mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                          {opt.label}
                        </h4>
                        <p className="text-stone-500 text-xs leading-relaxed">
                          {opt.description}
                        </p>

                        {/* 호버 시 화살표 */}
                        <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                          <ArrowLeft className="w-4 h-4 text-white rotate-180" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 하단 안내 */}
                <div className="mt-8 text-center">
                  <p className="text-stone-400 text-[11px] tracking-wide">
                    * 과거 데이터 기반 시뮬레이션입니다
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimeMachinePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-400"></div></div>}>
      <TimeMachineContent />
    </Suspense>
  );
}
