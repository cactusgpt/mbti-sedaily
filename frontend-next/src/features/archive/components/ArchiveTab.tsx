'use client';

import { useState } from "react";
import type { ArchivedSentence, MbtiArticle, TabType } from "@/shared/types/mbti";
import { getWeekDays, isSameDay, getMonthDays } from "@/shared/utils/dateUtils";

// 하위 호환성을 위한 타입 별칭
type Article = MbtiArticle;

interface Props {
  archiveDate: Date;
  setArchiveDate: (date: Date) => void;
  archivedSentences: ArchivedSentence[];
  setArchivedSentences: React.Dispatch<React.SetStateAction<ArchivedSentence[]>>;
  setActiveTab: (tab: TabType) => void;
  setExpandedArticles: React.Dispatch<React.SetStateAction<Set<string>>>;
  articles: Article[];
  showToast: () => void;
}

export function ArchiveTab({
  archiveDate,
  setArchiveDate,
  archivedSentences,
  setArchivedSentences,
  setActiveTab,
  setExpandedArticles,
  articles,
  showToast,
}: Props) {
  // 내부 상태
  const [showArchiveCalendar, setShowArchiveCalendar] = useState(false);
  const [archiveCalendarMonth, setArchiveCalendarMonth] = useState<Date>(new Date());

  return (
    <div className="min-h-[calc(100vh-120px)]">
      {/* 날짜 네비게이션 - 뉴스피드와 동일한 스타일 */}
      {archivedSentences.length > 0 && (
        <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
          {/* 월/주 네비게이션 */}
          <div className="flex items-center justify-center gap-4 py-3 px-4">
            <button
              onClick={() => {
                const current = archiveDate || new Date();
                const newDate = new Date(current);
                newDate.setDate(newDate.getDate() - 7);
                setArchiveDate(newDate);
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={() => {
                setArchiveCalendarMonth(archiveDate || new Date());
                setShowArchiveCalendar(true);
              }}
              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-[16px] font-semibold text-gray-800">
                {(archiveDate || new Date()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            <button
              onClick={() => {
                const current = archiveDate || new Date();
                const newDate = new Date(current);
                newDate.setDate(newDate.getDate() + 7);
                if (newDate <= new Date()) setArchiveDate(newDate);
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
            {getWeekDays(archiveDate || new Date()).map((day) => {
              const isSelected = archiveDate && isSameDay(day, archiveDate);
              const isToday = isSameDay(day, new Date());
              const isFuture = day > new Date();
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              const hasSentences = archivedSentences.some(s => isSameDay(new Date(s.createdAt), day));

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => !isFuture && setArchiveDate(day)}
                  disabled={isFuture}
                  className={`relative flex flex-col items-center px-3 py-2 rounded-xl transition-all duration-200 min-w-[48px] ${
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
                  {hasSentences && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 bg-amber-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 아카이브 캘린더 팝업 */}
      {showArchiveCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowArchiveCalendar(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[340px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setArchiveCalendarMonth(new Date(archiveCalendarMonth.getFullYear(), archiveCalendarMonth.getMonth() - 1))}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[18px] font-bold">
                {archiveCalendarMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
              </span>
              <button
                onClick={() => setArchiveCalendarMonth(new Date(archiveCalendarMonth.getFullYear(), archiveCalendarMonth.getMonth() + 1))}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
                <div key={d} className="text-center text-[12px] text-gray-400 py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {getMonthDays(archiveCalendarMonth.getFullYear(), archiveCalendarMonth.getMonth()).map((day, idx) => {
                if (!day) return <div key={idx} />;
                const isSelected = archiveDate && isSameDay(day, archiveDate);
                const isToday = isSameDay(day, new Date());
                const isFuture = day > new Date();
                const hasSentences = archivedSentences.some(s => isSameDay(new Date(s.createdAt), day));

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isFuture) {
                        setArchiveDate(day);
                        setShowArchiveCalendar(false);
                      }
                    }}
                    disabled={isFuture}
                    className={`aspect-square flex flex-col items-center justify-center rounded-full text-[14px] transition-all relative ${
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
                    {hasSentences && !isSelected && (
                      <span className="absolute bottom-1 w-1 h-1 bg-amber-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setArchiveDate(new Date());
                setShowArchiveCalendar(false);
              }}
              className="w-full mt-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
            >
              오늘로 이동
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[600px] mx-auto px-6 py-12">

        {archivedSentences.length === 0 ? (
          // 빈 상태 - 감성적인 디자인
          <div className="text-center py-20">
            <div
              className="relative w-24 h-24 mx-auto mb-8"
              style={{ animation: 'float 4s ease-in-out infinite' }}
            >
              <style>{`
                @keyframes float {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-10px); }
                }
              `}</style>
              <div className="absolute inset-0 bg-amber-200/30 rounded-3xl rotate-6" />
              <div className="absolute inset-0 bg-amber-100/50 rounded-3xl -rotate-3" />
              <div className="absolute inset-0 bg-white rounded-3xl shadow-sm flex items-center justify-center">
                <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
            </div>

            <h2 className="text-[24px] font-bold text-gray-900 mb-3">
              아직 비어있는 서랍
            </h2>
            <p className="text-[15px] text-gray-500 leading-relaxed mb-10">
              뉴스를 읽다 마음에 남는 문장이 있다면<br/>
              드래그해서 이곳에 보관해보세요
            </p>

            <button
              onClick={() => setActiveTab("feed")}
              className="group px-8 py-4 bg-blue-500 text-white rounded-2xl text-[15px] font-medium hover:bg-blue-600 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
            >
              <span className="flex items-center gap-2">
                오늘의 뉴스 읽기
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        ) : (
          <>
            {/* 헤더 - 개인화된 메시지 */}
            <div className="text-center mb-12" style={{ animation: 'fadeIn 0.6s ease-out' }}>
              <p className="text-[14px] text-amber-600 font-medium mb-2">
                {archivedSentences.length === 1 ? '첫 번째 문장을 저장했어요' :
                 archivedSentences.length < 5 ? '컬렉션이 시작되었어요' :
                 archivedSentences.length < 10 ? '멋진 컬렉션이 만들어지고 있어요' :
                 '당신만의 인사이트가 쌓이고 있어요'}
              </p>
              <h2 className="text-[28px] font-bold text-gray-900">
                {archivedSentences.length}개의 문장
              </h2>
            </div>

            {/* 오늘의 회상 카드 (2개 이상일 때) */}
            {archivedSentences.length >= 2 && (
              <div
                className="mb-10 p-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border border-amber-100/50"
                style={{ animation: 'fadeIn 0.6s ease-out 0.1s both' }}
              >
                <p className="text-[12px] text-amber-600 font-medium mb-4 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  이 문장, 기억하시나요?
                </p>
                <p className="text-[18px] text-gray-800 leading-[1.8] font-medium editorial-title">
                  &quot;{archivedSentences[Math.floor(Math.random() * archivedSentences.length)]?.text.slice(0, 100)}{archivedSentences[0]?.text.length > 100 ? '...' : ''}&quot;
                </p>
              </div>
            )}

            {/* 날짜별 그룹화된 문장 목록 */}
            {(() => {
              const filteredSentences = archivedSentences.filter(s => isSameDay(new Date(s.createdAt), archiveDate));

              if (filteredSentences.length === 0) {
                return (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-[16px] text-gray-600 mb-2">
                      {archiveDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}에는
                    </p>
                    <p className="text-[14px] text-gray-400">저장한 문장이 없어요</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[13px] font-semibold text-gray-500">
                      {archiveDate?.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                    </span>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[12px] text-gray-400">{filteredSentences.length}개</span>
                  </div>

                  {filteredSentences.map((sentence, idx) => {
                    const savedDate = new Date(sentence.createdAt);
                    const timeStr = savedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={sentence.id}
                        className="group relative"
                        style={{ animation: `fadeIn 0.4s ease-out ${0.1 + idx * 0.03}s both` }}
                      >
                        <div className="bg-white rounded-2xl p-5 border border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-gray-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 flex gap-4">
                          <div className="flex-shrink-0 w-1 bg-gradient-to-b from-amber-400 to-amber-200 rounded-full" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[16px] text-gray-800 leading-[1.9] mb-4">
                              {sentence.text}
                            </p>
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => {
                                  const article = articles.find(a => a.news_id === sentence.articleId);
                                  if (article) {
                                    setActiveTab("feed");
                                    setTimeout(() => {
                                      setExpandedArticles(prev => new Set(prev).add(sentence.articleId));
                                      document.getElementById(`article-${articles.findIndex(a => a.news_id === sentence.articleId)}`)?.scrollIntoView({ behavior: 'smooth' });
                                    }, 100);
                                  }
                                }}
                                className="flex items-center gap-2 text-[13px] text-gray-500 hover:text-gray-900 transition-colors group/link"
                              >
                                <svg className="w-4 h-4 text-gray-400 group-hover/link:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                </svg>
                                <span className="truncate max-w-[200px]">{sentence.articleTitle}</span>
                              </button>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-300">저장 {timeStr}</span>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(`"${sentence.text}"\n- ${sentence.articleTitle}`);
                                      showToast();
                                    }}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setArchivedSentences(prev => prev.filter(s => s.id !== sentence.id))}
                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <svg className="w-4 h-4 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* AI 기반 추천 섹션 */}
            {archivedSentences.length >= 1 && (
              <div className="mt-12 pt-8 border-t border-gray-100" style={{ animation: 'fadeIn 0.6s ease-out 0.3s both' }}>
                {/* AI 추천 헤더 */}
                <div className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-2xl p-5 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-100/60 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[15px] font-bold text-gray-900">AI가 찾은 관련 뉴스</h3>
                        <span className="px-2 py-0.5 bg-violet-100 text-violet-600 text-[10px] font-semibold rounded-full">AI</span>
                      </div>
                      <p className="text-[13px] text-gray-500 leading-relaxed">
                        저장한 {archivedSentences.length}개의 문장을 분석해서<br/>
                        관심사에 맞는 뉴스를 추천해드려요
                      </p>
                    </div>
                  </div>
                </div>

                {/* 추천 기사 목록 */}
                <div className="space-y-3">
                  {articles
                    .filter(article => !archivedSentences.some(s => s.articleId === article.news_id))
                    .slice(0, 3)
                    .map((article, idx) => (
                    <button
                      key={article.news_id}
                      onClick={() => {
                        setActiveTab("feed");
                        setTimeout(() => {
                          setExpandedArticles(prev => new Set(prev).add(article.news_id));
                          document.getElementById(`article-${idx}`)?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="w-full text-left p-4 bg-white border border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-violet-200 hover:bg-violet-50/30 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] rounded-xl transition-all duration-200 group/rec"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-violet-100 to-blue-100 rounded-xl flex flex-col items-center justify-center">
                          <span className="text-[14px] font-bold text-violet-600">{95 - idx * 7}%</span>
                          <span className="text-[9px] text-violet-400">매칭</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-gray-800 line-clamp-2 group-hover/rec:text-violet-900 transition-colors">
                            {article.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-gray-400">{article.category}</span>
                            <span className="w-1 h-1 bg-gray-200 rounded-full" />
                            <span className="text-[11px] text-violet-500">저장한 문장과 유사</span>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 group-hover/rec:text-violet-500 flex-shrink-0 mt-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>

                {/* 더보기 */}
                <button className="w-full mt-4 py-3 text-[13px] text-gray-500 hover:text-violet-600 transition-colors flex items-center justify-center gap-1">
                  더 많은 추천 보기
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}

            {/* 마무리 메시지 */}
            <div
              className="mt-16 text-center"
              style={{ animation: 'fadeIn 0.6s ease-out 0.5s both' }}
            >
              <p className="text-[14px] text-gray-400 mb-6">
                더 많은 문장을 발견해보세요
              </p>
              <button
                onClick={() => setActiveTab("feed")}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl text-[14px] font-medium hover:bg-gray-200 transition-colors"
              >
                뉴스피드로 돌아가기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
