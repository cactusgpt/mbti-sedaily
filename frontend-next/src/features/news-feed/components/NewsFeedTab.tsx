'use client';

import Link from 'next/link';
import { Play, Square } from 'lucide-react';
import {
  editorPersonas,
  type EditorPersona,
  type MbtiGroupId,
} from '@/shared/data/mbtiGroups';
import type { MbtiArticle } from '@/shared/types/mbti';
import { ArticleGrid } from './ArticleGrid';
import { formatKstUpdated } from '../constants/editorialLenses';

interface Props {
  // selectedDate state is kept so a future date-picker revival can re-bind
  // it without changing this contract. The picker UI was removed because the
  // v2 feed API does not accept a `since` parameter today.
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
  persona: EditorPersona;
}

const groupOrder: MbtiGroupId[] = ['NT', 'NF', 'ST', 'SF'];

export function NewsFeedTab({
  articles,
  loading,
  selectedGroup,
  onMbtiChange,
  showAudioPlayer,
  startAudioBriefing,
  onArticleClick,
  persona,
}: Props) {
  return (
    <div className="min-h-screen bg-[#FBFAF7]">
      {/* Inline editorial styles + Pretendard / Noto Serif KR */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700;900&display=swap');
      `}</style>

      <div className="mx-auto max-w-[1180px] px-4 pb-16 pt-5 md:px-7 md:pt-7">
        {/* Top meta row — KST update + editor switcher */}
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-orange-400" aria-hidden="true" />
            <span className="text-[12px] font-medium text-stone-500 md:text-[13px]">
              {formatKstUpdated()}
            </span>
            <Link
              href="/editors"
              className="ml-3 hidden text-[12px] text-stone-400 underline-offset-2 hover:text-stone-700 hover:underline md:inline"
            >
              에디터 소개 보기
            </Link>
          </div>

          {/* 4-editor switcher (replaces sticky weekly date nav) */}
          <div className="flex items-center gap-1.5 self-start rounded-full border border-stone-200 bg-white p-1 shadow-[0_2px_8px_rgba(15,23,42,0.04)] md:self-auto">
            {groupOrder.map((g) => {
              const p = editorPersonas[g];
              const isActive = selectedGroup === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => onMbtiChange?.(g)}
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-semibold transition-colors md:px-3 md:py-1.5 ${
                    isActive
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                  aria-pressed={isActive}
                  title={`${p.name} · ${p.label}`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold text-white ${p.colorClass}`}
                  >
                    {g}
                  </span>
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Audio briefing CTA — kept small, optional */}
        {articles.length > 0 && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-stone-200/70 bg-white p-3 md:p-4">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-stone-900 md:text-[14px]">
                {persona.name}의 오디오 브리핑
              </p>
              <p className="mt-0.5 line-clamp-1 text-[12px] text-stone-500 md:text-[13px]">
                오늘 {articles.length}건 중 핵심만 골라 {persona.role} 톤으로 들려드려요.
              </p>
            </div>
            <button
              type="button"
              onClick={startAudioBriefing}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors md:px-4 ${
                showAudioPlayer
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {showAudioPlayer ? (
                <>
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  재생 중
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  브리핑 듣기
                </>
              )}
            </button>
          </div>
        )}

        {/* Editorial feed */}
        {loading ? (
          <FeedSkeleton />
        ) : (
          <ArticleGrid
            articles={articles}
            selectedGroup={selectedGroup}
            persona={persona}
            onArticleClick={onArticleClick}
          />
        )}
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="기사를 불러오는 중">
      <div className="grid gap-4 md:grid-cols-[1.35fr_0.65fr]">
        <div className="grid overflow-hidden rounded-2xl border border-stone-200/80 bg-white md:grid-cols-[1fr_0.88fr]">
          <div className="space-y-3 p-6 md:p-8">
            <div className="h-4 w-32 animate-pulse rounded bg-stone-100" />
            <div className="h-8 w-3/4 animate-pulse rounded bg-stone-100" />
            <div className="h-4 w-full animate-pulse rounded bg-stone-100" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-stone-100" />
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <div className="h-16 animate-pulse rounded-lg bg-stone-100" />
              <div className="h-16 animate-pulse rounded-lg bg-stone-100" />
              <div className="h-16 animate-pulse rounded-lg bg-stone-100" />
            </div>
          </div>
          <div className="aspect-[4/3] animate-pulse bg-stone-100 md:aspect-auto" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-stone-100" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-[44px_1fr] gap-2.5">
                <div className="h-7 w-10 animate-pulse rounded-full bg-stone-100" />
                <div className="h-7 animate-pulse rounded bg-stone-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex h-[148px] animate-pulse flex-row items-stretch gap-3 rounded-2xl border border-stone-200/70 bg-white p-3"
          >
            <div className="aspect-[16/9] w-[96px] flex-shrink-0 rounded-lg bg-stone-100 md:w-[38%]" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3 w-20 rounded bg-stone-100" />
              <div className="h-4 w-full rounded bg-stone-100" />
              <div className="h-4 w-4/5 rounded bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
