import { useState } from "react";

type Step = "input" | "loading" | "result";

interface HistoricalEvent {
  year: number;
  title: string;
  description: string;
  category: string;
  image: string;
}

interface DayNews {
  title: string;
  summary: string;
  category: string;
}

const HISTORICAL_EVENTS: Record<string, HistoricalEvent[]> = {
  "01-01": [
    { year: 1990, title: "독일 통일 협상 본격화", description: "동서독 통일을 위한 본격적인 협상이 시작됐다.", category: "국제", image: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=400&q=80" },
    { year: 1995, title: "WTO 공식 출범", description: "세계무역기구(WTO)가 GATT를 대체하며 공식 출범했다.", category: "경제", image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=80" },
    { year: 2000, title: "Y2K 버그 무사 통과", description: "전 세계가 우려했던 밀레니엄 버그가 별다른 피해 없이 지나갔다.", category: "IT", image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=80" },
    { year: 2010, title: "아이티 대지진 발생 전날", description: "카리브해 섬나라 아이티에 규모 7.0 강진이 발생하기 하루 전이었다.", category: "국제", image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80" },
  ],
  "03-01": [
    { year: 1919, title: "3·1 독립운동", description: "전국 각지에서 독립만세운동이 일어났다. 민족 대표 33인이 독립선언서를 낭독했다.", category: "역사", image: "https://images.unsplash.com/photo-1569163139599-0f4517e36f51?w=400&q=80" },
    { year: 1995, title: "삼풍백화점 붕괴 3개월 전", description: "서울 서초구 삼풍백화점이 붕괴되기 3개월 전, 건물 균열 징후가 보고됐다.", category: "사회", image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=80" },
    { year: 2001, title: "구제역 파동", description: "국내 구제역 확산으로 축산업계 비상이 걸렸다.", category: "사회", image: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=400&q=80" },
    { year: 2010, title: "천안함 침몰 한 달 전", description: "서해 백령도 인근에서 해군 초계함 천안함이 침몰하기 한 달 전이었다.", category: "사회", image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80" },
  ],
  "06-25": [
    { year: 1950, title: "6·25 전쟁 발발", description: "북한군이 38선을 넘어 기습 남침하며 한국전쟁이 시작됐다.", category: "역사", image: "https://images.unsplash.com/photo-1569163139599-0f4517e36f51?w=400&q=80" },
    { year: 1993, title: "삼풍백화점 붕괴 2년 전", description: "서울 서초구 삼풍백화점이 붕괴되기 2년 전, 건물 균열 징후가 있었다.", category: "사회", image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=80" },
    { year: 2000, title: "남북 정상회담", description: "김대중 대통령과 김정일 국방위원장이 평양에서 역사적인 남북 정상회담을 가졌다.", category: "역사", image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&q=80" },
    { year: 2009, title: "마이클 잭슨 사망", description: "팝의 황제 마이클 잭슨이 심정지로 사망했다.", category: "문화", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80" },
  ],
  "08-15": [
    { year: 1945, title: "광복절", description: "일제강점기 35년 만에 대한민국이 광복을 맞이했다.", category: "역사", image: "https://images.unsplash.com/photo-1569163139599-0f4517e36f51?w=400&q=80" },
    { year: 1948, title: "대한민국 정부 수립", description: "이승만 초대 대통령이 취임하며 대한민국 정부가 공식 수립됐다.", category: "역사", image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&q=80" },
    { year: 1995, title: "윈도우 95 출시", description: "마이크로소프트가 윈도우 95를 출시하며 PC 시대의 새 장을 열었다.", category: "IT", image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=80" },
    { year: 2003, title: "미국 동부 대정전", description: "미국·캐나다 동부 지역에서 대규모 정전 사태가 발생했다.", category: "국제", image: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&q=80" },
  ],
  "11-29": [
    { year: 1993, title: "우루과이 라운드 타결", description: "7년간의 협상 끝에 우루과이 라운드가 타결되며 세계 무역 질서가 재편됐다.", category: "경제", image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=80" },
    { year: 1999, title: "IMF 졸업 선언", description: "한국이 IMF 구제금융을 조기 상환하며 경제 위기 극복을 선언했다.", category: "경제", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80" },
    { year: 2002, title: "한일 월드컵 열기 여운", description: "한국 축구 4강 신화의 여운이 가시지 않은 가운데 국내 스포츠 열기가 이어졌다.", category: "스포츠", image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&q=80" },
    { year: 2010, title: "연평도 포격 9일 후", description: "북한의 연평도 포격 도발 이후 한반도 긴장이 고조됐다.", category: "사회", image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80" },
  ],
};

const DUMMY_NEWS: DayNews[] = [
  { title: "코스피, 외국인 매수세에 2,650선 회복", summary: "외국인 투자자들의 순매수가 이어지며 코스피가 2,650선을 회복했다. 반도체·2차전지 업종이 강세를 보였다.", category: "경제" },
  { title: "정부, 부동산 규제 완화 추가 방안 발표", summary: "국토교통부가 수도권 일부 지역의 분양가 상한제 적용 제외 등 추가 규제 완화 방안을 발표했다.", category: "경제" },
  { title: "AI 반도체 수출 규제 강화 논의", summary: "미국이 첨단 AI 반도체의 대중국 수출 규제를 추가 강화하는 방안을 검토 중인 것으로 알려졌다.", category: "IT" },
  { title: "국내 소비자물가 전월 대비 0.2% 상승", summary: "통계청이 발표한 소비자물가지수가 전월 대비 0.2% 상승했다. 식료품과 에너지 가격 상승이 주요 원인이다.", category: "경제" },
  { title: "서울시, 한강변 개발 계획 공개", summary: "서울시가 한강변 주요 지점에 복합문화공간을 조성하는 마스터플랜을 공개했다.", category: "사회" },
];

function getHistoricalEvents(dateStr: string): HistoricalEvent[] {
  const d = new Date(dateStr);
  const key = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (HISTORICAL_EVENTS[key]) return HISTORICAL_EVENTS[key];
  return [
    { year: d.getFullYear() - 30, title: "경제 성장률 발표", description: `${d.getFullYear() - 30}년 같은 날, 정부가 연간 경제성장률 전망치를 발표했다.`, category: "경제", image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=80" },
    { year: d.getFullYear() - 20, title: "주요 기업 실적 발표", description: `${d.getFullYear() - 20}년 같은 날, 국내 주요 대기업들이 분기 실적을 발표했다.`, category: "경제", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80" },
    { year: d.getFullYear() - 15, title: "IT 신기술 발표", description: `${d.getFullYear() - 15}년 같은 날, 국내외 IT 기업들이 신기술 로드맵을 공개했다.`, category: "IT", image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=80" },
    { year: d.getFullYear() - 5, title: "사회 이슈 부각", description: `${d.getFullYear() - 5}년 같은 날, 주요 사회 이슈가 여론의 주목을 받았다.`, category: "사회", image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80" },
  ];
}

const CATEGORY_COLOR: Record<string, string> = {
  경제: "bg-blue-100 text-blue-600",
  IT: "bg-violet-100 text-violet-600",
  사회: "bg-orange-100 text-orange-600",
  역사: "bg-amber-100 text-amber-700",
  국제: "bg-emerald-100 text-emerald-600",
  문화: "bg-pink-100 text-pink-600",
  스포츠: "bg-red-100 text-red-600",
};

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
            style={{
              top: `${50 + 46 * Math.sin((i * Math.PI * 2) / 6)}%`,
              left: `${50 + 46 * Math.cos((i * Math.PI * 2) / 6)}%`,
              animationDelay: `${i * 0.18}s`,
              animationDuration: "1.4s",
            }}
          />
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
  const [events, setEvents] = useState<HistoricalEvent[]>([]);

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDate) { setError("날짜를 선택해주세요."); return; }
    if (targetDate >= today) { setError("오늘 이전 날짜를 선택해주세요."); return; }
    setError("");
    setStep("loading");
    setTimeout(() => {
      setEvents(getHistoricalEvents(targetDate));
      setStep("result");
    }, 2800);
  };

  const d = targetDate ? new Date(targetDate) : null;
  const formatted = d
    ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
    : "";

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl">

        {/* 헤더 */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🛸</div>
          <h1 className="text-2xl font-bold text-gray-900">타임머신</h1>
          <p className="text-gray-400 text-sm mt-1">원하는 날짜로 돌아가 그날의 뉴스를 확인하세요</p>
        </div>

        {/* 입력 */}
        {step === "input" && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">여행할 날짜</label>
              <input
                type="date"
                value={targetDate}
                min="1990-01-01"
                max={today}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              className="w-full bg-gray-900 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              <span>🛸</span> 시간 여행 시작
            </button>
          </form>
        )}

        {/* 로딩 */}
        {step === "loading" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <TimeMachineAnimation targetDate={targetDate} />
          </div>
        )}

        {/* 결과 */}
        {step === "result" && (
          <div className="space-y-5">

            {/* 날짜 헤더 */}
            <div className="text-center py-2">
              <p className="text-gray-400 text-xs uppercase tracking-widest">도착했습니다</p>
              <h2 className="text-gray-900 text-2xl font-bold mt-1">{formatted}</h2>
            </div>

            {/* 그날의 주요 뉴스 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-gray-800 font-bold text-sm mb-4 flex items-center gap-2">
                <span>📰</span> 그날의 주요 뉴스
              </h3>
              <div className="divide-y divide-gray-50">
                {DUMMY_NEWS.map((news, i) => (
                  <div key={i} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${CATEGORY_COLOR[news.category] ?? "bg-gray-100 text-gray-600"}`}>
                        {news.category}
                      </span>
                      <div>
                        <p className="text-gray-800 text-sm font-medium leading-snug">{news.title}</p>
                        <p className="text-gray-400 text-xs mt-1 leading-relaxed">{news.summary}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 역사 속 이슈 타임라인 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-gray-800 font-bold text-sm mb-6 flex items-center gap-2">
                <span>🕰️</span> 같은 날, 역사 속 이슈
              </h3>

              {/* 가로 타임라인 (md 이상) */}
              <div className="hidden md:block overflow-x-auto">
                <div className="flex items-start min-w-max pb-2">
                  {events.map((ev, i) => (
                    <div key={i} className="flex flex-col items-center" style={{ width: 176 }}>
                      {/* 점 + 선 */}
                      <div className="flex items-center w-full h-4 mb-2">
                        {i > 0 ? <div className="flex-1 h-px bg-gray-300" /> : <div className="flex-1" />}
                        <div className="w-3 h-3 rounded-full bg-gray-800 border-2 border-white ring-1 ring-gray-300 shrink-0" />
                        {i < events.length - 1 ? <div className="flex-1 h-px bg-gray-300" /> : <div className="flex-1" />}
                      </div>

                      {/* 연도 */}
                      <p className="text-gray-500 text-xs font-semibold mb-2">{ev.year}</p>

                      {/* 카드 */}
                      <div className="w-40 rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-all cursor-pointer">
                        <img
                          src={ev.image}
                          alt={ev.title}
                          className="w-full h-24 object-cover bg-gray-100"
                          onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80"; }}
                        />
                        <div className="p-2.5">
                          <p className="text-gray-800 text-xs font-semibold leading-snug line-clamp-2">{ev.title}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium mt-1.5 inline-block ${CATEGORY_COLOR[ev.category] ?? "bg-gray-100 text-gray-600"}`}>
                            {ev.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 세로 타임라인 (모바일) */}
              <div className="md:hidden space-y-0">
                {events.map((ev, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-800 border-2 border-white ring-1 ring-gray-300 shrink-0" />
                      {i < events.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                    </div>
                    <div className="flex gap-3 pb-4 flex-1">
                      <img
                        src={ev.image}
                        alt={ev.title}
                        className="w-20 h-16 object-cover rounded-lg shrink-0 bg-gray-100"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80"; }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-400 text-xs font-semibold">{ev.year}</p>
                        <p className="text-gray-800 text-sm font-semibold leading-snug mt-0.5">{ev.title}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${CATEGORY_COLOR[ev.category] ?? "bg-gray-100 text-gray-600"}`}>
                          {ev.category}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 다시 하기 */}
            <button
              onClick={() => { setStep("input"); setTargetDate(""); setEvents([]); }}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition-colors text-sm border border-gray-200"
            >
              다른 날짜로 이동
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
