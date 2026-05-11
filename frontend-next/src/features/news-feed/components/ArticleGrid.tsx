'use client';

import type { EditorPersona, MbtiGroupId } from '@/shared/data/mbtiGroups';
import type { MbtiArticle } from '@/shared/types/mbti';
import { ArticleCard } from './ArticleCard';
import { EditorialHero, MobileBriefCard } from './EditorialHero';
import { MobileRail } from './MobileRail';

interface Props {
  articles: MbtiArticle[];
  selectedGroup: MbtiGroupId;
  persona: EditorPersona;
  onArticleClick: (article: MbtiArticle) => void;
}

export function ArticleGrid({ articles, selectedGroup, persona, onArticleClick }: Props) {
  if (articles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center">
        <p className="text-[15px] font-medium text-stone-500">아직 큐레이션된 기사가 없어요</p>
        <p className="mt-1 text-[13px] text-stone-400">잠시 후 다시 확인해주세요</p>
      </div>
    );
  }

  const [hero, ...rest] = articles;
  const railItems = rest.slice(0, 6);
  const gridItems = rest.slice(0, 9); // up to 9 cards on desktop grid

  return (
    <div className="flex flex-col gap-8">
      {/* Mobile-only brief card (Demo C) */}
      <MobileBriefCard persona={persona} totalCount={articles.length} />

      {/* Editorial hero — desktop + mobile both use this; the mobile layout
          stacks via grid-cols-1 on small breakpoints. */}
      <EditorialHero
        article={hero}
        selectedGroup={selectedGroup}
        persona={persona}
        totalCount={articles.length}
        onClick={() => onArticleClick(hero)}
      />

      {/* Mobile-only horizontal rail (Demo C) */}
      {railItems.length > 0 && (
        <MobileRail articles={railItems} selectedGroup={selectedGroup} onArticleClick={onArticleClick} />
      )}

      {/* Continue reading section */}
      {gridItems.length > 0 && (
        <section aria-label="계속 읽기 좋은 기사" className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="text-[18px] font-bold text-stone-900 md:text-[20px]">계속 읽기 좋은 기사</h3>
              <p className="mt-1 text-[12px] text-stone-500 md:text-[13px]">
                각 카드마다 “왜 추천됐는지”가 함께 보입니다
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {gridItems.map((article) => (
              <ArticleCard
                key={article.news_id}
                article={article}
                selectedGroup={selectedGroup}
                onClick={() => onArticleClick(article)}
                editorName={persona.name}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
