'use client';

import Link from "next/link";
import type { MbtiGroupId } from "@/shared/data/mbtiGroups";
import type { MbtiArticle } from "@/shared/types/mbti";
import { getWeekDays, isSameDay, getMonthDays } from "@/shared/utils/dateUtils";
import { ArticleGrid } from "./ArticleGrid";

interface Props {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  calendarMonth: Date;
  setCalendarMonth: (date: Date) => void;
  showCalendar: boolean;
  setShowCalendar: (show: boolean) => void;
  articles: MbtiArticle[];
  loading: boolean;
  selectedGroup: MbtiGroupId;
  onMbtiChange?: (group: MbtiGroupId) => void;
  showAudioPlayer: boolean;
  startAudioBriefing: () => void;
  onArticleClick: (article: MbtiArticle) => void;
}

// MBTI 유형별 스타일 정보
const typeInfo = {
  NT: {
    name: "민철",
    names: ["민철", "지훈", "서연"],
    nickname: "분석가",
    color: "bg-purple-500",
    textColor: "text-purple-600",
    ringColor: "ring-purple-200",
    shadowColor: "shadow-purple-200/50",
    avatar: "/editors/intj.png",
    tagline: "논리와 전략으로 세상을 읽는 사람",
    pickMessage: "오늘 가장 흥미로운 데이터와 인사이트를 담은 기사를 골랐어요."
  },
  NF: {
    name: "하은",
    names: ["하은", "수빈", "예린"],
    nickname: "이야기꾼",
    color: "bg-rose-500",
    textColor: "text-rose-600",
    ringColor: "ring-rose-200",
    shadowColor: "shadow-rose-200/50",
    avatar: "/editors/infp.png",
    tagline: "의미와 가능성을 발견하는 사람",
    pickMessage: "읽으면서 마음이 움직였던 기사, 당신도 느껴보세요."
  },
  ST: {
    name: "준서",
    names: ["준서", "도윤", "시우"],
    nickname: "실용주의자",
    color: "bg-emerald-500",
    textColor: "text-emerald-700",
    ringColor: "ring-emerald-200",
    shadowColor: "shadow-emerald-200/50",
    avatar: "/editors/istj.png",
    tagline: "사실과 경험을 중시하는 사람",
    pickMessage: "핵심만 딱, 바로 써먹을 수 있는 기사를 챙겨왔어요."
  },
  SF: {
    name: "소율",
    names: ["소율", "유나", "다은"],
    nickname: "공감러",
    color: "bg-amber-500",
    textColor: "text-amber-700",
    ringColor: "ring-amber-200",
    shadowColor: "shadow-amber-200/50",
    avatar: "/editors/esfp.png",
    tagline: "사람과 순간을 소중히 여기는 사람",
    pickMessage: "오늘 하루, 이 기사 하나면 친구랑 대화가 통해요."
  },
};

export function NewsFeedTab({
  selectedDate,
  setSelectedDate,
  calendarMonth,
  setCalendarMonth,
  showCalendar,
  setShowCalendar,
  articles,
  loading,
  selectedGroup,
  onMbtiChange,
  showAudioPlayer,
  startAudioBriefing,
  onArticleClick,
}: Props) {
  return (
    <div className="min-h-screen bg-white">
      {/* 스타일 정의 */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700;900&display=swap');

        .editorial-title {
          font-family: 'Noto Serif KR', serif;
        }
      `}</style>

      {/* 상단 고정 주간 네비게이션 */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        {/* 월/주 네비게이션 */}
        <div className="flex items-center justify-center gap-4 py-3 px-4">
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 7);
              setSelectedDate(newDate);
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => {
              setCalendarMonth(new Date(selectedDate));
              setShowCalendar(true);
            }}
            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="text-[16px] font-semibold text-gray-800">
              {selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
            </span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 7);
              if (newDate <= new Date()) setSelectedDate(newDate);
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 주간 날짜 탭 */}
        <div className="flex justify-center gap-1 px-4 pb-3">
          {getWeekDays(selectedDate).map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const isFuture = day > new Date();
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

            return (
              <button
                key={day.toISOString()}
                onClick={() => !isFuture && setSelectedDate(day)}
                disabled={isFuture}
                className={`flex flex-col items-center px-3 py-2 rounded-xl transition-all duration-200 min-w-[48px] ${
                  isSelected
                    ? "bg-blue-500 text-white"
                    : isToday
                      ? "bg-gray-100 text-gray-900 font-semibold"
                      : isFuture
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="text-[11px] mb-1">{dayNames[day.getDay()]}</span>
                <span className="text-[16px] font-medium">{day.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 캘린더 팝업 */}
      {showCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCalendar(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[340px]" onClick={(e) => e.stopPropagation()}>
            {/* 캘린더 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[18px] font-bold">
                {calendarMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
              </span>
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
                <div key={d} className="text-center text-[12px] text-gray-400 py-2">{d}</div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-1">
              {getMonthDays(calendarMonth.getFullYear(), calendarMonth.getMonth()).map((day, idx) => {
                if (!day) return <div key={idx} />;
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const isFuture = day > new Date();

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isFuture) {
                        setSelectedDate(day);
                        setShowCalendar(false);
                      }
                    }}
                    disabled={isFuture}
                    className={`aspect-square flex items-center justify-center rounded-full text-[14px] transition-all ${
                      isSelected
                        ? "bg-blue-500 text-white font-bold"
                        : isToday
                          ? "bg-gray-200 text-gray-900 font-semibold"
                          : isFuture
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            {/* 오늘로 이동 버튼 */}
            <button
              onClick={() => {
                setSelectedDate(new Date());
                setShowCalendar(false);
              }}
              className="w-full mt-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
            >
              오늘로 이동
            </button>
          </div>
        </div>
      )}

      {/* MBTI 스위처 + 기사 개수 */}
      <div className="pt-4 pb-3 px-6">
        <div className="max-w-[1100px] mx-auto">
          {/* MBTI 유형 스위처 */}
          <div className="flex items-center justify-center gap-8 mb-3">
            {(["NT", "NF", "ST", "SF"] as const).map((type) => {
              const isSelected = selectedGroup === type;
              return (
                <button
                  key={type}
                  onClick={() => onMbtiChange?.(type)}
                  className="flex flex-col items-center gap-3 group transition-transform duration-300 hover:-translate-y-0.5"
                >
                  {/* 캐릭터 아바타 with 글로우 효과 */}
                  <div className="relative">
                    {/* 선택 시 배경 글로우 - 은은하게 */}
                    {isSelected && (
                      <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${typeInfo[type].color}`} />
                    )}
                    <div className={`relative w-[56px] h-[56px] rounded-full overflow-hidden transition-all duration-500 ease-out bg-white ${
                      isSelected
                        ? `ring-[2.5px] ${typeInfo[type].ringColor} shadow-lg`
                        : "ring-1 ring-gray-100 opacity-35 grayscale group-hover:grayscale-0 group-hover:opacity-100 group-hover:ring-gray-200 group-hover:shadow-md"
                    }`}>
                      <img
                        src={typeInfo[type].avatar}
                        alt={typeInfo[type].name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  {/* 타입 라벨 */}
                  <span className={`px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all duration-300 ${
                    isSelected
                      ? `${typeInfo[type].color} text-white`
                      : "bg-transparent text-gray-300 group-hover:text-gray-500"
                  }`}>
                    {type}
                  </span>
                </button>
              );
            })}
          </div>
          {/* 선택된 유형 한줄 소개 */}
          <div className="text-center mb-2">
            <p className="text-[13px] text-gray-500 transition-all duration-300">
              <span className={`font-semibold ${typeInfo[selectedGroup].textColor}`}>{typeInfo[selectedGroup].name}</span>
              <span className="text-gray-400 ml-1">({typeInfo[selectedGroup].nickname})</span>
              <span className="mx-2 text-gray-200">|</span>
              <span className="font-light">{typeInfo[selectedGroup].tagline}</span>
            </p>
            <Link
              href="/editors"
              className="inline-flex items-center gap-1 mt-2 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span>에디터 소개 보기</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* 기사 개수 배지 + 오디오 브리핑 버튼 */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="inline-flex items-center justify-center px-4 py-2 bg-gray-50 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100/50">
          <span className="text-[13px] text-gray-500 font-medium">
            {articles.length > 0 ? (
              <>
                <span className="text-gray-900 font-bold">{articles.length}</span>
                <span className="ml-1">개의 기사</span>
              </>
            ) : "기사가 없습니다"}
          </span>
        </div>

        {/* 오디오 브리핑 버튼 */}
        {articles.length > 0 && (
          <button
            onClick={startAudioBriefing}
            className={`group inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
              showAudioPlayer
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg'
                : 'bg-white text-gray-600 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-100/80 hover:border-amber-200 hover:shadow-[0_4px_12px_rgba(251,191,36,0.15)]'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              showAudioPlayer
                ? 'bg-white/20'
                : 'bg-gradient-to-r from-amber-400 to-orange-500 group-hover:scale-110'
            }`}>
              <svg className={`w-3 h-3 ${showAudioPlayer ? 'text-white' : 'text-white'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-[13px] font-medium">
              {showAudioPlayer ? '브리핑 중' : '오디오 브리핑'}
            </span>
          </button>
        )}
      </div>

      {/* 기사 목록 */}
      <div className="max-w-[1100px] mx-auto px-5 md:px-8">
        {loading ? (
          <div className="flex flex-col">
            {/* Pick 스켈레톤 */}
            <div className="pb-3 pt-5 flex items-center gap-2 md:pt-0 md:pb-6">
              <div className="w-7 h-7 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-6 w-36 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-8 animate-pulse">
              <div className="aspect-[16/9] w-full rounded-lg bg-gray-200" />
              <div className="flex flex-col justify-center mt-3 md:mt-0">
                <div className="h-6 bg-gray-200 rounded w-full mb-3" />
                <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-4" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
            </div>
            {/* 리스트 스켈레톤 */}
            <div className="mt-5 border-t border-gray-200 pt-5 md:mt-8 md:pt-8">
              <div className="h-6 w-28 bg-gray-200 rounded animate-pulse mb-6" />
              <div className="grid grid-cols-1 md:grid-cols-2 md:gap-8 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="grid grid-cols-[103px_auto] md:grid-cols-[4fr_6fr] items-center gap-4 animate-pulse">
                    <div className="aspect-[16/9] w-full rounded-lg bg-gray-200" />
                    <div className="flex flex-col">
                      <div className="h-5 bg-gray-200 rounded w-full mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ArticleGrid
            articles={articles}
            selectedGroup={selectedGroup}
            onArticleClick={onArticleClick}
            personaName={typeInfo[selectedGroup].name}
            personaNames={typeInfo[selectedGroup].names}
            personaAvatar={typeInfo[selectedGroup].avatar}
          />
        )}
      </div>

      {/* 하단 여백 */}
      <div className="h-32" />
    </div>
  );
}
