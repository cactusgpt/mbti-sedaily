import { useState } from "react";
import { getFamousBirthdays, type FamousPerson } from "@/data/famousBirthdays";
import { getSnapshotByDate, CURRENT_SNAPSHOT } from "@/data/economicSnapshots";
import { INVESTMENT_OPTIONS, calcInvestment, getParallelUniverses } from "@/data/investmentScenarios";
import { fetchTimeMachineData } from "@/api/timeMachineApi";
import type { DayNews, HistoricalEvent } from "@/types/timeMachine";

type Step = "input" | "loading" | "result" | "invest-result";

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

function TimeMachineAnimation({ targetDate }: { targetDate: string }) {
  const d = new Date(targetDate);
  const formatted = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-8">
      <div className="relative w-36 h-36">
        <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 animate-spin" style={{ animationDuration: "4s" }} />
        <div className="absolute inset-3 rounded-full border-[3px] border-gray-300 animate-spin" style={{ animationDuration: "2.5s", animationDirection: "reverse" }} />
        <div className="absolute inset-6 rounded-full border-[3px] border-gray-200 animate-spin" style={{ animationDuration: "1.8s" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl" style={{ animation: "float 2s ease-in-out infinite" }}>🛸</span>
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-gray-400 animate-ping"
            style={{ top: `${50 + 46 * Math.sin((i * Math.PI * 2) / 6)}%`, left: `${50 + 46 * Math.cos((i * Math.PI * 2) / 6)}%`, animationDelay: `${i * 0.18}s`, animationDuration: "1.4s" }} />
        ))}
      </div>
      <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }`}</style>
      <div className="text-center">
        <p className="text-gray-800 font-bold text-lg">{formatted}으로 이동 중</p>
        <p className="text-gray-400 text-sm mt-1">시간의 흐름을 거슬러 올라가고 있어요</p>
      </div>
    </div>
  );
}

export default function TimeMachinePage() {
  const [step, setStep] = useState<Step>("input");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState("");
  const [news, setNews] = useState<DayNews[]>([]);
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [birthdays, setBirthdays] = useState<FamousPerson[]>([]);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof getSnapshotByDate> | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const today = new Date().toISOString().split("T")[0];

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
  const resetAll = () => { setStep("input"); setTargetDate(""); setNews([]); setEvents([]); setBirthdays([]); setSnapshot(null); setSelectedInvestment(null); setShowComparison(false); };

  return (
    <div className={`relative min-h-screen bg-[#faf9f6] flex flex-col items-center px-4 py-12 ${step === "input" ? "justify-center" : ""}`}>
      {step === "input" && (
        <a href="https://mbti.sedaily.ai" className="absolute top-5 left-5 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors z-10">
          ← 홈으로
        </a>
      )}
      <div className="w-full max-w-2xl">

        {step === "input" && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div className="text-center">
              <div className="text-5xl mb-3">🛸</div>
              <h1 className="text-2xl font-bold text-gray-900">타임머신</h1>
              <p className="text-gray-400 text-sm mt-1">원하는 날짜로 돌아가 그날의 뉴스를 확인하세요</p>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">여행할 날짜</label>
                <button type="button" onClick={() => setTargetDate(getRandomDate())} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                  <span>🎲</span> 랜덤 날짜
                </button>
              </div>
              <input type="date" value={targetDate} min="1990-01-01" max={today}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" className="w-full bg-gray-900 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
              <span>🛸</span> 시간 여행 시작
            </button>
          </form>
        )}

        {step === "loading" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <TimeMachineAnimation targetDate={targetDate} />
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
            <div className="space-y-5">
              <div className="space-y-3">
                <div>
                  <button onClick={() => { setStep("result"); setShowComparison(false); }} className="text-gray-400 hover:text-gray-700 transition-colors text-sm flex items-center gap-1">
                    &larr; 돌아가기
                  </button>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs">{formatted}</p>
                  <h2 className="text-gray-900 text-lg font-bold">{opt.emoji} {opt.label}</h2>
                </div>
              </div>
              {!showComparison && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="grid grid-cols-3 gap-3 text-center mb-5">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-gray-400 text-xs mb-1">투자금</p>
                        <p className="text-gray-800 font-bold text-sm">1억원</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-gray-400 text-xs mb-1">현재 가치</p>
                        <p className="text-gray-800 font-bold text-sm">{fmtValue(result.currentValue)}</p>
                      </div>
                      <div className={`rounded-xl p-3 ${isProfit ? "bg-blue-50" : "bg-red-50"}`}>
                        <p className="text-gray-400 text-xs mb-1">{result.totalSpent !== undefined ? "누적 지출" : "수익률"}</p>
                        {result.totalSpent !== undefined ? (
                          <p className="font-bold text-sm text-orange-500">
                            -{result.totalSpent >= 10_000 ? `${(result.totalSpent / 10_000).toFixed(0)}만원` : `${result.totalSpent.toLocaleString()}원`}
                          </p>
                        ) : (
                          <p className={`font-bold text-sm ${isProfit ? "text-blue-600" : "text-red-500"}`}>{fmtRate(result.returnRate)}</p>
                        )}
                      </div>
                    </div>
                    {result.story && (
                      <div className="bg-gray-50 rounded-xl p-3.5 mb-4">
                        <p className="text-gray-600 text-xs leading-relaxed">{result.story}</p>
                      </div>
                    )}
                    <p className="text-gray-500 text-sm text-center italic border-t border-gray-100 pt-4">"{result.tagline}"</p>
                  </div>

                  {regretGap > 0 ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0">😮</span>
                        <div>
                          <p className="text-amber-800 text-xs font-semibold mb-1">다른 우주에서는...</p>
                          <p className="text-amber-700 text-xs leading-relaxed">
                            {bestAlternative.option.emoji} <strong>{bestAlternative.option.label}</strong>을 선택했다면{" "}
                            <strong>{fmtValue(regretGap)}</strong>을 더 벌었을 겁니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0">🎉</span>
                        <div>
                          <p className="text-emerald-800 text-xs font-semibold mb-1">최선의 선택!</p>
                          <p className="text-emerald-700 text-xs leading-relaxed">모든 평행우주 중에서 <strong>가장 좋은 선택</strong>을 했습니다.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button onClick={() => setShowComparison(true)} className="w-full bg-gray-900 hover:bg-gray-700 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm">
                    🌌 모든 평행우주 보기
                  </button>
                </div>
              )}

              {showComparison && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-gray-800 font-bold text-sm mb-1 text-center">🌌 평행우주 비교</h3>
                    <p className="text-gray-400 text-xs text-center mb-5">{formatted}에 1억원을 투자했다면</p>
                    <div className="space-y-5">
                      {allResults
                        .sort((a, b) => b.result.currentValue - a.result.currentValue)
                        .map(({ opt: o, result: r }, rank) => {
                          const barWidth = maxValue > 0 ? Math.max(4, (r.currentValue / maxValue) * 100) : 4;
                          const profit = r.returnRate >= 0;
                          const isSelected = o.id === selectedInvestment;
                          return (
                            <div key={o.id} className={`rounded-xl p-3.5 ${isSelected ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {rank === 0 && <span className="text-xs">🥇</span>}
                                  {rank === 1 && <span className="text-xs">🥈</span>}
                                  {rank === 2 && <span className="text-xs">🥉</span>}
                                  {rank > 2 && <span className="text-xs opacity-40">#{rank + 1}</span>}
                                  <span className="text-base">{o.emoji}</span>
                                  <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-gray-800"}`}>
                                    {o.label}{isSelected && <span className="ml-1.5 text-xs font-normal opacity-70">내 선택</span>}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-bold ${isSelected ? "text-white" : profit ? "text-blue-600" : "text-red-500"}`}>{fmtValueShort(r.currentValue)}</p>
                                  <p className={`text-xs ${isSelected ? "opacity-70" : profit ? "text-blue-400" : "text-red-400"}`}>{fmtRate(r.returnRate)}</p>
                                </div>
                              </div>
                              <div className={`w-full rounded-full h-2 ${isSelected ? "bg-white/20" : "bg-gray-200"}`}>
                                <div className={`h-2 rounded-full transition-all duration-700 ${isSelected ? "bg-white" : profit ? "bg-blue-400" : "bg-red-300"}`} style={{ width: `${barWidth}%` }} />
                              </div>
                              {r.story && <p className={`text-xs mt-2 leading-relaxed ${isSelected ? "text-white/70" : "text-gray-400"}`}>{r.story}</p>}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <p className="text-gray-500 text-xs mb-3 text-center">다른 선택을 해볼까요?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {INVESTMENT_OPTIONS.filter((o) => o.id !== selectedInvestment).map((o) => (
                        <button key={o.id} onClick={() => { setSelectedInvestment(o.id); setShowComparison(false); }}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all text-center">
                          <span className="text-2xl">{o.emoji}</span>
                          <p className="text-gray-700 font-medium text-xs leading-snug">{o.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={() => setShowComparison(false)} className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition-colors text-sm border border-gray-200">
                    내 결과만 보기
                  </button>
                </div>
              )}

              <button onClick={resetAll} className="w-full bg-white hover:bg-gray-50 text-gray-400 font-medium py-3 rounded-xl transition-colors text-sm border border-gray-100">
                다른 날짜로 이동
              </button>
            </div>
          );
        })()}

        {step === "result" && (
          <div className="space-y-5">
            <div className="text-center py-2">
              <p className="text-gray-400 text-xs uppercase tracking-widest">도착했습니다</p>
              <h2 className="text-gray-900 text-2xl font-bold mt-1">{formatted}</h2>
              <div className="flex justify-center mt-3">
                <div className="w-72 h-4" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 45%, transparent 75%)", borderRadius: "50%", filter: "blur(3px)" }} />
              </div>
            </div>

            {snapshot && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                <p className="text-xs text-gray-400 mb-3">📊 그때 vs 지금</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "코스피", then: snapshot.kospi.toLocaleString(), now: CURRENT_SNAPSHOT.kospi.toLocaleString(), unit: "" },
                    { label: "원/달러", then: snapshot.usdKrw.toLocaleString(), now: CURRENT_SNAPSHOT.usdKrw.toLocaleString(), unit: "원" },
                    { label: "기준금리", then: snapshot.baseRate.toFixed(2), now: CURRENT_SNAPSHOT.baseRate.toFixed(2), unit: "%" },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                      <div className="hidden sm:flex items-center justify-center gap-1.5">
                        <span className="text-sm font-bold text-gray-800">{item.then}{item.unit}</span>
                        <span className="text-gray-300 text-xs">→</span>
                        <span className="text-sm font-bold text-blue-600">{item.now}{item.unit}</span>
                      </div>
                      <div className="flex sm:hidden flex-col items-center gap-0.5">
                        <span className="text-sm font-bold text-gray-800">{item.then}{item.unit}</span>
                        <span className="text-gray-300 text-xs">↓</span>
                        <span className="text-sm font-bold text-blue-600">{item.now}{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-gray-800 font-bold text-sm mb-4 flex items-center gap-2"><span>📰</span> 그날의 주요 뉴스</h3>
              <div className="divide-y divide-gray-50">
                {news.map((item, i) => (
                  <div key={i} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${CATEGORY_COLOR[item.category] ?? "bg-gray-100 text-gray-600"}`}>{item.category}</span>
                      <div>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-800 text-sm font-medium leading-snug hover:underline">{item.title}</a>
                        ) : (
                          <p className="text-gray-800 text-sm font-medium leading-snug">{item.title}</p>
                        )}
                        {item.summary && <p className="text-gray-400 text-xs mt-1 leading-relaxed">{item.summary}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-gray-800 font-bold text-sm mb-6 flex items-center gap-2"><span>🕰️</span> 같은 날, 역사 속 이슈</h3>
              <div className="hidden md:block overflow-x-auto">
                <div className="flex items-start min-w-max pb-2">
                  {events.map((ev, i) => (
                    <div key={i} className="flex flex-col items-center" style={{ width: 176 }}>
                      <div className="flex items-center w-full h-4 mb-2">
                        {i > 0 ? <div className="flex-1 h-px bg-gray-300" /> : <div className="flex-1" />}
                        <div className="w-3 h-3 rounded-full bg-gray-800 border-2 border-white ring-1 ring-gray-300 shrink-0" />
                        {i < events.length - 1 ? <div className="flex-1 h-px bg-gray-300" /> : <div className="flex-1" />}
                      </div>
                      <p className="text-gray-500 text-xs font-semibold mb-2">{ev.year}</p>
                      <div className="w-40 rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-all cursor-pointer">
                        <img src={ev.image} alt={ev.title} className="w-full h-24 object-cover bg-gray-100"
                          onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80"; }} />
                        <div className="p-2.5">
                          <p className="text-gray-800 text-xs font-semibold leading-snug line-clamp-2">{ev.title}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium mt-1.5 inline-block ${CATEGORY_COLOR[ev.category] ?? "bg-gray-100 text-gray-600"}`}>{ev.category}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:hidden space-y-0">
                {events.map((ev, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-800 border-2 border-white ring-1 ring-gray-300 shrink-0" />
                      {i < events.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                    </div>
                    <div className="flex gap-3 pb-4 flex-1">
                      <img src={ev.image} alt={ev.title} className="w-20 h-16 object-cover rounded-lg shrink-0 bg-gray-100"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80"; }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 text-xs font-semibold">{ev.year}</p>
                        <p className="text-gray-800 text-sm font-semibold leading-snug mt-0.5">{ev.title}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${CATEGORY_COLOR[ev.category] ?? "bg-gray-100 text-gray-600"}`}>{ev.category}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {birthdays.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-gray-800 font-bold text-sm mb-4 flex items-center gap-2"><span>🎂</span> 그날 태어난 사람은?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {birthdays.map((person, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="text-2xl shrink-0">{person.emoji}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-gray-900 text-sm font-bold">{person.name}</p>
                          <span className="text-xs text-gray-400">{person.birthYear}년생</span>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">{person.field}</span>
                        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">{person.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-gray-800 font-bold text-sm mb-1 flex items-center gap-2">
                <span>🕰️</span> 만약 그날로 돌아간다면?
              </h3>
              <p className="text-gray-400 text-xs mb-4">1억원을 어디에 투자할까요?</p>
              <div className="grid grid-cols-3 gap-2.5">
                {INVESTMENT_OPTIONS.map((opt) => (
                  <button key={opt.id}
                    onClick={() => { setSelectedInvestment(opt.id); setShowComparison(false); setStep("invest-result"); }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all text-center">
                    <span className="text-2xl">{opt.emoji}</span>
                    <p className="text-gray-900 font-semibold text-xs leading-snug">{opt.label}</p>
                    <span className="text-gray-400 text-[10px] leading-tight">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={resetAll} className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition-colors text-sm border border-gray-200">
              다른 날짜로 이동
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
