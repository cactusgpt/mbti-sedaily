'use client';

import { useState } from 'react';
import { Bot, Clock, Sparkles } from 'lucide-react';
import type { EditorPersona, MbtiGroupId } from '@/shared/data/mbtiGroups';
import type { MbtiArticle } from '@/shared/types/mbti';
import { cleanMarkdown } from '@/shared/utils/textUtils';
import { CategoryBadge } from './CategoryBadge';
import { ImagePlaceholder } from './ImagePlaceholder';
import {
  estimateReadMinutes,
  formatKstUpdated,
  lensDescriptions,
  pickBlurb,
  pickReasons,
} from '../constants/editorialLenses';

interface Props {
  article: MbtiArticle;
  selectedGroup: MbtiGroupId;
  persona: EditorPersona;
  totalCount: number;
  onClick: () => void;
}

const groupOrder: MbtiGroupId[] = ['NT', 'NF', 'ST', 'SF'];

const chipClasses: Record<MbtiGroupId, string> = {
  NT: 'bg-blue-500',
  NF: 'bg-violet-500',
  ST: 'bg-emerald-500',
  SF: 'bg-orange-500',
};

const groupNames: Record<MbtiGroupId, string> = {
  NT: '시현',
  NF: '지원',
  ST: '정훈',
  SF: '하은',
};

export function EditorialHero({ article, selectedGroup, persona, totalCount, onClick }: Props) {
  const [imgError, setImgError] = useState(false);

  const v = article.versions?.[selectedGroup];
  const title = v?.title || article.title;
  const bodyText = v?.body
    ? cleanMarkdown(Array.isArray(v.body) ? v.body.join('\n\n') : v.body)
    : cleanMarkdown(article.content || '');
  const summary =
    (article.sub_title || bodyText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
      .slice(0, 220);

  const imageUrl = v?.image_url || article.image_url;
  const showImage = imageUrl && !imgError;
  const readMinutes = estimateReadMinutes(bodyText);
  const reasons = pickReasons(selectedGroup, article.news_id, article.category);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick();
  };

  return (
    <section aria-label="오늘의 대표 기사" className="grid gap-4 md:grid-cols-[1.35fr_0.65fr] md:gap-5">
      {/* Lead article ─────────────────────────────────────────── */}
      <article
        onClick={handleClick}
        className="group relative grid cursor-pointer overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] md:grid-cols-[1fr_0.88fr]"
      >
        {/* Copy */}
        <div className="flex flex-col justify-between gap-5 p-6 md:p-8">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-bold tracking-wide">
              <span className={`inline-flex h-[26px] min-w-[40px] items-center justify-center rounded-full px-2.5 text-[11px] font-extrabold text-white ${persona.colorClass}`}>
                {selectedGroup}
              </span>
              <span className={`uppercase ${persona.textClass}`}>{persona.name}이 고른 오늘의 한 편</span>
            </div>
            <h2 className="mt-3 text-[26px] font-bold leading-[1.2] tracking-tight text-stone-900 md:text-[34px]">
              {title}
            </h2>
            <p className="mt-3 line-clamp-3 text-[15px] leading-[1.7] text-stone-600 md:text-[16px]">
              {summary}
            </p>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-lg border border-stone-200/80 bg-stone-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[18px] font-bold text-stone-900">
                <Clock className="h-3.5 w-3.5 text-stone-500" aria-hidden="true" />
                {readMinutes}분
              </div>
              <div className="text-[11px] text-stone-500">읽는 시간</div>
            </div>
            <div className="rounded-lg border border-stone-200/80 bg-stone-50 px-3 py-2.5">
              <div className="text-[18px] font-bold text-stone-900">{Math.max(totalCount, 1)}건</div>
              <div className="text-[11px] text-stone-500">오늘의 큐레이션</div>
            </div>
            <div className="rounded-lg border border-stone-200/80 bg-stone-50 px-3 py-2.5">
              <div className="text-[14px] font-semibold text-stone-900">
                {article.category || '오늘의 추천'}
              </div>
              <div className="text-[11px] text-stone-500">관심 토픽</div>
            </div>
          </div>
        </div>

        {/* Image */}
        <div className="relative min-h-[200px] overflow-hidden bg-stone-100 md:min-h-full">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl ?? ''}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              loading="eager"
              onError={() => setImgError(true)}
            />
          ) : (
            <ImagePlaceholder category={article.category} />
          )}
          {/* mobile-only category badge overlay */}
          <div className="absolute left-3 top-3 md:hidden">
            <CategoryBadge category={article.category} variant="overlay" />
          </div>
        </div>
      </article>

      {/* Side panel: 4 lenses + flow ───────────────────────────── */}
      <aside className="flex flex-col gap-4">
        {/* 4 lenses card */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-stone-900">같은 기사, 네 가지 렌즈</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-50 px-2 py-0.5 text-[11px] text-stone-500">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {formatKstUpdated()}
            </span>
          </div>
          <ul className="mt-3 space-y-3">
            {groupOrder.map((g) => {
              const isActive = g === selectedGroup;
              return (
                <li
                  key={g}
                  className={`grid grid-cols-[44px_1fr] items-start gap-2.5 rounded-lg px-2 py-2 transition-colors ${
                    isActive ? 'bg-stone-50 ring-1 ring-stone-200' : ''
                  }`}
                >
                  <span
                    className={`inline-flex h-[26px] w-[42px] items-center justify-center rounded-full px-2 text-[11px] font-extrabold text-white ${chipClasses[g]}`}
                  >
                    {g}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-[12px] font-semibold ${isActive ? 'text-stone-900' : 'text-stone-500'}`}>
                      {groupNames[g]} · {g === 'NT' ? '전략 분석가' : g === 'NF' ? '가치 해석자' : g === 'ST' ? '실용 실무자' : '공감 소통가'}
                    </div>
                    <p className="mt-0.5 text-[13px] leading-[1.45] text-stone-600">{lensDescriptions[g]}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Persona blurb / why */}
        <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-5">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-stone-500">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            오늘의 흐름
          </div>
          <p className="text-[14px] leading-[1.6] text-stone-700">{pickBlurb[selectedGroup]}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {reasons.map((r) => (
              <span
                key={r}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-600 ring-1 ring-stone-200"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}

/**
 * Mobile "brief" card shown above the hero on small screens.
 * Mirrors Demo C's `.brief` block.
 */
export function MobileBriefCard({
  persona,
  totalCount,
}: {
  persona: EditorPersona;
  totalCount: number;
}) {
  const groupId = persona.id;
  return (
    <div className="md:hidden">
      <div className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-4">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${persona.lightClass} ${persona.textClass} font-extrabold`}>
          AI
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold leading-[1.35] text-stone-900">
            오늘은 {Math.max(totalCount, 1)}건 중 3개만 먼저 읽어도 좋아요
          </p>
          <p className="mt-0.5 text-[12px] leading-[1.45] text-stone-500">
            {pickBlurb[groupId]}
          </p>
        </div>
      </div>
    </div>
  );
}
