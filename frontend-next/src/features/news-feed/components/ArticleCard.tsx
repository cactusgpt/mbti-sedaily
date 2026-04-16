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
  personaNames: string[];
}

export function ArticleCard({ article, selectedGroup, onClick, personaNames }: Props) {
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
    ? new Date(article.published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '';

  return (
    <a
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className="flex flex-row items-center gap-4 cursor-pointer"
    >
      {/* 썸네일 — 모바일 103px 고정, 데스크톱 40% */}
      <div className="relative w-[103px] md:w-[40%] flex-shrink-0 aspect-[16/9] overflow-hidden rounded-lg border border-gray-100">
        {showImage ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImagePlaceholder category={article.category} />
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <h2 className="text-base font-bold text-gray-900 lg:text-lg leading-snug line-clamp-2">
          {title}
        </h2>
        <div className="mt-1 hidden text-base text-gray-700 lg:block">
          <div className="line-clamp-2">{summary}</div>
        </div>
        <div className="mt-2 flex flex-row gap-2 text-xs">
          <div className="line-clamp-1 text-xs font-bold text-gray-700">{personaNames[article.news_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % personaNames.length]}</div>
          {date && (
            <div className="text-xs text-gray-500">{date}</div>
          )}
        </div>
      </div>
    </a>
  );
}
