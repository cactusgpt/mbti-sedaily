'use client';

import { useState } from 'react';
import type { MbtiGroupId } from '@/shared/data/mbtiGroups';
import type { MbtiArticle } from '@/shared/types/mbti';
import { cleanMarkdown } from '@/shared/utils/textUtils';
import { ImagePlaceholder } from './ImagePlaceholder';

interface Props {
  article: MbtiArticle;
  selectedGroup: MbtiGroupId;
  onClick: () => void;
  personaName: string;
}

export function HeroCard({ article, selectedGroup, onClick, personaName }: Props) {
  const [imgError, setImgError] = useState(false);

  const v = article.versions?.[selectedGroup];
  const title = v?.title || article.title;
  const bodyText = v?.body
    ? cleanMarkdown(Array.isArray(v.body) ? v.body.join('\n\n') : v.body)
    : cleanMarkdown(article.content || '');
  const summary = article.sub_title || bodyText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250);

  const imageUrl = v?.image_url || article.image_url;
  const showImage = imageUrl && !imgError;

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '';

  return (
    <a
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className="grid grid-cols-1 items-center gap-3 md:grid-cols-2 md:gap-8 cursor-pointer"
    >
      {/* 이미지 */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-gray-100">
        {showImage ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
            loading="eager"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImagePlaceholder category={article.category} />
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="flex flex-1 flex-col">
        <h2 className="mt-2 text-lg font-bold text-gray-900 md:mt-4 lg:text-2xl leading-snug">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-[1.45] text-gray-700 md:mt-3 md:text-base">
          <div className="line-clamp-3">{summary}</div>
        </div>
        <div className="mt-2 flex flex-row gap-2 md:mt-4">
          <div className="text-xs font-bold text-gray-700 md:text-sm">{personaName}</div>
          {date && (
            <div className="text-xs text-gray-500 md:text-sm">{date}</div>
          )}
        </div>
      </div>
    </a>
  );
}
