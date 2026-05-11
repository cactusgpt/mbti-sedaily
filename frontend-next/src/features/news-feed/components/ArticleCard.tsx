'use client';

import { useState } from 'react';
import type { MbtiGroupId } from '@/shared/data/mbtiGroups';
import type { MbtiArticle } from '@/shared/types/mbti';
import { cleanMarkdown } from '@/shared/utils/textUtils';
import { CategoryBadge } from './CategoryBadge';
import { ImagePlaceholder } from './ImagePlaceholder';
import { pickReasons } from '../constants/editorialLenses';

interface Props {
  article: MbtiArticle;
  selectedGroup: MbtiGroupId;
  onClick: () => void;
  /** Optional editor name label rendered above title (e.g. 시현이 골랐어요) */
  editorName?: string;
}

export function ArticleCard({ article, selectedGroup, onClick, editorName }: Props) {
  const [imgError, setImgError] = useState(false);

  const v = article.versions?.[selectedGroup];
  const title = v?.title || article.title;
  const bodyText = v?.body
    ? cleanMarkdown(Array.isArray(v.body) ? v.body.join('\n\n') : v.body)
    : cleanMarkdown(article.content || '');
  const summary = bodyText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);

  const imageUrl = v?.image_url || article.image_url;
  const showImage = imageUrl && !imgError;

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
    : '';
  const [, reason1, reason2] = pickReasons(selectedGroup, article.news_id, article.category);

  return (
    <a
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className="group flex flex-col gap-3 cursor-pointer rounded-2xl border border-stone-200/70 bg-white p-3 transition-shadow hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)] md:p-4"
    >
      <div className="flex flex-row items-stretch gap-3 md:gap-4">
        {/* 썸네일 — 모바일 96px, 데스크톱 38% */}
        <div className="relative w-[96px] flex-shrink-0 aspect-[16/9] overflow-hidden rounded-lg md:w-[38%]">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl ?? ''}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <ImagePlaceholder category={article.category} />
          )}
        </div>

        {/* 콘텐츠 */}
        <div className="flex flex-col justify-between flex-1 min-w-0">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <CategoryBadge category={article.category} size="sm" />
              {date && <span className="text-[11px] text-stone-400">{date}</span>}
            </div>
            <h3 className="text-[15px] font-bold text-stone-900 lg:text-[17px] leading-[1.35] line-clamp-2">
              {title}
            </h3>
            <p className="mt-1.5 hidden text-[14px] leading-[1.55] text-stone-600 md:line-clamp-2 lg:block">
              {summary}
            </p>
          </div>
          {editorName && (
            <p className="mt-2 hidden text-[11px] text-stone-500 md:block">
              <span className="font-semibold text-stone-700">{editorName}</span>이 골랐어요
            </p>
          )}
        </div>
      </div>

      {/* Why-recommended meta row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">
          추천 이유
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-stone-500 ring-1 ring-stone-200">
          {reason1}
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-stone-500 ring-1 ring-stone-200">
          {reason2}
        </span>
      </div>
    </a>
  );
}
