'use client';

import { Calendar, Newspaper, Users, Camera, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MbtiGroupId } from "@/shared/data/mbtiGroups";
import type { TabType, DnaSubTab, DnaViewMode, Persona } from "@/shared/types/mbti";

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
  newsDNA: NewsDNA;
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
  newsDNA,
  persona,
  selectedGroup,
  setActiveTab,
}: Props) {
  const router = useRouter();

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <div className="text-center mb-6">
        <h2 className="text-[24px] font-bold text-gray-900 mb-2">나의 뉴스 DNA</h2>
        <p className="text-[15px] text-gray-500">
          당신이 관심 갖는 세상의 모습
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 관심 분야 분석 - 시각화/차트 토글 */}
        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full">
          {/* 헤더 + 토글 */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[15px] font-bold text-gray-900">관심 분야 분석</h3>
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

          {/* 레이더 차트 뷰 */}
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
                        persona.color === 'bg-green-500' ? '#86efac' :
                        persona.color === 'bg-blue-500' ? '#93c5fd' :
                        persona.color === 'bg-violet-500' ? '#c4b5fd' : '#fed7aa'
                      } stopOpacity="0.6" />
                      <stop offset="100%" stopColor={
                        persona.color === 'bg-green-500' ? '#4ade80' :
                        persona.color === 'bg-blue-500' ? '#60a5fa' :
                        persona.color === 'bg-violet-500' ? '#a78bfa' : '#fb923c'
                      } stopOpacity="0.4" />
                    </linearGradient>
                  </defs>

                  {/* 배경 육각형 그리드 */}
                  {[85, 68, 51, 34, 17].map((size, i) => {
                    const points = Array.from({ length: 6 }, (_, j) => {
                      const angle = (j * 60 - 90) * (Math.PI / 180);
                      const x = 100 + size * Math.cos(angle);
                      const y = 100 + size * Math.sin(angle);
                      return `${x},${y}`;
                    }).join(' ');
                    return (
                      <polygon
                        key={i}
                        points={points}
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth={i === 0 ? "0.75" : "0.5"}
                      />
                    );
                  })}

                  {/* 축 라인 */}
                  {Array.from({ length: 6 }, (_, i) => {
                    const angle = (i * 60 - 90) * (Math.PI / 180);
                    const x2 = 100 + 85 * Math.cos(angle);
                    const y2 = 100 + 85 * Math.sin(angle);
                    return (
                      <line
                        key={i}
                        x1="100"
                        y1="100"
                        x2={x2}
                        y2={y2}
                        stroke="#f3f4f6"
                        strokeWidth="0.5"
                      />
                    );
                  })}

                  {/* 데이터 영역 */}
                  {(() => {
                    const values = [
                      newsDNA.economy,
                      newsDNA.tech,
                      newsDNA.politics,
                      newsDNA.society,
                      newsDNA.culture,
                      newsDNA.world,
                    ];
                    const points = values.map((val, i) => {
                      const angle = (i * 60 - 90) * (Math.PI / 180);
                      const r = (val / 100) * 80;
                      const x = 100 + r * Math.cos(angle);
                      const y = 100 + r * Math.sin(angle);
                      return `${x},${y}`;
                    }).join(' ');

                    const strokeColor = persona.color === 'bg-green-500' ? '#16a34a' :
                                        persona.color === 'bg-blue-500' ? '#2563eb' :
                                        persona.color === 'bg-violet-500' ? '#7c3aed' : '#ea580c';

                    return (
                      <>
                        <polygon
                          points={points}
                          fill="url(#areaGradient)"
                          stroke={strokeColor}
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                          className="transition-all duration-500"
                        />
                        {/* 데이터 포인트 */}
                        {values.map((val, i) => {
                          const angle = (i * 60 - 90) * (Math.PI / 180);
                          const r = (val / 100) * 80;
                          const x = 100 + r * Math.cos(angle);
                          const y = 100 + r * Math.sin(angle);
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r="4" fill="white" stroke={strokeColor} strokeWidth="1.5" />
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>

                {/* 라벨들 */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                  <span className="text-[12px] font-semibold text-slate-600">경제</span>
                </div>
                <div className="absolute top-[15%] -right-6">
                  <span className="text-[12px] font-semibold text-slate-600">테크</span>
                </div>
                <div className="absolute bottom-[15%] -right-6">
                  <span className="text-[12px] font-semibold text-slate-600">정치</span>
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                  <span className="text-[12px] font-semibold text-slate-600">사회</span>
                </div>
                <div className="absolute bottom-[15%] -left-6">
                  <span className="text-[12px] font-semibold text-slate-600">문화</span>
                </div>
                <div className="absolute top-[15%] -left-6">
                  <span className="text-[12px] font-semibold text-slate-600">세계</span>
                </div>
              </div>

              {/* 범례 */}
              <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
                <div className={`w-3 h-3 rounded-full ${persona.color}`} />
                <span className="text-[13px] text-gray-700 font-medium">{selectedGroup} 유형 관심사</span>
              </div>
            </div>
          )}

          {/* 바 차트 뷰 */}
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
                        persona.color === 'bg-green-500' ? 'bg-green-400' :
                        persona.color === 'bg-blue-500' ? 'bg-blue-400' :
                        persona.color === 'bg-violet-500' ? 'bg-violet-400' : 'bg-orange-400'
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

        {/* 비슷한 DNA */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] h-fit">
          <h3 className="text-[15px] font-bold text-gray-900 mb-3">비슷한 DNA를 가진 사람들</h3>
          <p className="text-[14px] text-gray-500 mb-5">
            1,234명이 비슷한 관심사를 가지고 있어요
          </p>
          <button
            onClick={() => setActiveTab("community")}
            className="w-full py-3.5 bg-blue-500 rounded-xl text-[14px] font-medium text-white hover:bg-blue-600 transition-colors"
          >
            커뮤니티 둘러보기
          </button>
        </div>
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
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-50 rounded-xl flex items-center justify-center">
                  <Newspaper className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-[12px] text-gray-500">뉴스</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-50 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-[12px] text-gray-500">유명인</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-50 rounded-xl flex items-center justify-center">
                  <Camera className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-[12px] text-gray-500">사진</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-[12px] text-gray-500">투자</p>
              </div>
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

          {/* 타임머신 링크 */}
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
