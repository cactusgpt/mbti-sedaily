'use client';

import { useState } from 'react';
import type { MbtiGroupId } from '@/shared/data/mbtiGroups';
import type { MbtiArticle } from '@/shared/types/mbti';
import { ImagePlaceholder } from './ImagePlaceholder';

interface Props {
  articles: MbtiArticle[];
  selectedGroup: MbtiGroupId;
  onArticleClick: (article: MbtiArticle) => void;
}

/**
 * Horizontal-scroll rail used on mobile, mirroring Demo C's `.rail`.
 * Hidden on `md+` so desktop users see the same articles in the grid below.
 */
export function MobileRail({ articles, selectedGroup, onArticleClick }: Props) {
  if (articles.length === 0) return null;

  return (
    <div className="md:hidden">
      <div className="mb-3 flex items-end justify-between px-1">
        <h3 className="text-[15px] font-bold text-stone-900">바로 이어 읽기</h3>
        <span className="text-[11px] text-stone-400">좌우로 스와이프</span>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide snap-x snap-mandatory">
        {articles.map((article) => (
          <MiniCard
            key={article.news_id}
            article={article}
            selectedGroup={selectedGroup}
            onClick={() => onArticleClick(article)}
          />
        ))}
      </div>
    </div>
  );
}

function MiniCard({
  article,
  selectedGroup,
  onClick,
}: {
  article: MbtiArticle;
  selectedGroup: MbtiGroupId;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const v = article.versions?.[selectedGroup];
  const title = v?.title || article.title;
  const imageUrl = v?.image_url || article.image_url;
  const showImage = imageUrl && !imgError;

  return (
    <button
      type="button"
      onClick={onClick}
      className="snap-start flex w-[240px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white text-left"
    >
      <div className="relative h-[104px] w-full overflow-hidden bg-stone-100">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl ?? ''}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImagePlaceholder category={article.category} />
        )}
      </div>
      <div className="p-3">
        <p className="text-[11px] font-semibold text-stone-500">{article.category || '오늘의 추천'}</p>
        <p className="mt-1 line-clamp-2 text-[14px] font-bold leading-[1.35] text-stone-900">
          {title}
        </p>
      </div>
    </button>
  );
}
