

import { useState, useEffect } from "react";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { mbtiGroups } from "@/data/mbtiGroups";
import { API_URL } from "@/config/api";
import { ArticleReactions } from "./ArticleReactions";

interface MbtiVersion {
  title: string;
  subtitle: string;
  body: string[];
  key_points: string[];
  closing_line: string;
  tone: string;
}

interface Article {
  news_id: string;
  title: string;
  sub_title: string;
  published_at: string;
  category: string;
  provider: string;
  byline: string;
  image_url: string | null;
  content: string;
  original_link: string;
  versions: Record<string, MbtiVersion>;
}

interface Props {
  selectedGroup: MbtiGroupId;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    '경제': '경제', 'IT_과학': 'AI/테크', '정치': '정치', '사회': '사회',
    '문화': '문화', '스포츠': '스포츠', '국제': '세계', '금융': '경제',
    '증권': '경제', '부동산': '경제', '산업': 'AI/테크',
  };
  return map[cat] || cat;
}

export function NewsFeed({ selectedGroup }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticles() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "*",
            filters: {
              published_from: new Date().toISOString().slice(0, 10),
              published_until: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
              providers: [],
              categories: [],
            },
            page: 1,
            page_size: 20,
          }),
        });
        const data = await res.json();
        const withVersions = (data.articles || []).filter(
          (a: Article) => a.versions && Object.keys(a.versions).length === 4
        );
        setArticles(withVersions);
      } catch (e) {
        console.error("Failed to fetch articles:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, []);

  const group = mbtiGroups[selectedGroup];
  const groupKey = selectedGroup;

  if (loading) {
    return (
      <div className="max-w-[1080px] mx-auto px-5 py-10">
        {/* Hero skeleton */}
        <div className="flex gap-6 mb-10">
          <div className="flex-1 h-[300px] bg-gray-100 rounded-lg animate-pulse" />
          <div className="flex-1 space-y-4 py-8">
            <div className="h-7 bg-gray-200 rounded w-4/5 animate-pulse" />
            <div className="h-5 bg-gray-100 rounded w-full animate-pulse" />
            <div className="h-5 bg-gray-100 rounded w-3/4 animate-pulse" />
          </div>
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-[140px] bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) return null;

  const heroArticle = articles[0];
  const heroV = heroArticle.versions[groupKey];
  const gridArticles = articles.slice(1, 5);
  const listArticles = articles.slice(5);

  return (
    <div className="max-w-[1080px] mx-auto px-5 py-8">
      {/* Hero Article - 뉴닉 스타일 (이미지 좌 + 텍스트 우) */}
      {heroV && (
        <article
          className="flex flex-col md:flex-row gap-6 mb-10 cursor-pointer group"
          onClick={() => setExpandedId(expandedId === heroArticle.news_id ? null : heroArticle.news_id)}
        >
          {heroArticle.image_url && (
            <div className="md:w-[55%] rounded-lg overflow-hidden">
              <img
                src={heroArticle.image_url}
                alt={heroV.title}
                className="w-full h-[200px] md:h-[320px] object-cover group-hover:scale-[1.02] transition-transform duration-300"
              />
            </div>
          )}
          <div className={`${heroArticle.image_url ? 'md:w-[45%]' : 'w-full'} flex flex-col justify-center`}>
            <h2
              className="text-[22px] md:text-[26px] font-bold leading-tight text-gray-900 mb-3 group-hover:text-gray-700 transition-colors"
              style={{ fontFamily: "'Noto Sans KR', Pretendard, sans-serif" }}
            >
              {heroV.title}
            </h2>
            <p className="text-[15px] text-gray-500 leading-relaxed mb-4 line-clamp-3">
              {heroV.body[0]?.slice(0, 200)}...
            </p>
            <div className="flex items-center gap-2 text-[13px] text-gray-400">
              <span className="font-medium text-gray-500">{categoryLabel(heroArticle.category)}</span>
              <span>·</span>
              <span>{formatTimeAgo(heroArticle.published_at)}</span>
            </div>
          </div>
        </article>
      )}

      {/* Hero 펼침 */}
      {expandedId === heroArticle.news_id && heroV && (
        <ExpandedArticle version={heroV} groupKey={groupKey} group={group} link={heroArticle.original_link} articleId={heroArticle.news_id} />
      )}

      {/* 4-Column Grid (뉴닉 하단 그리드) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-7 mb-10">
        {gridArticles.map((article) => {
          const v = article.versions[groupKey];
          if (!v) return null;
          const isExpanded = expandedId === article.news_id;

          return (
            <div key={article.news_id}>
              <article
                className="cursor-pointer group"
                onClick={() => setExpandedId(isExpanded ? null : article.news_id)}
              >
                {article.image_url && (
                  <div className="rounded-lg overflow-hidden mb-3">
                    <img
                      src={article.image_url}
                      alt={v.title}
                      className="w-full h-[120px] md:h-[150px] object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  </div>
                )}
                <h3
                  className="text-[15px] font-bold leading-snug text-gray-900 mb-1.5 line-clamp-2 group-hover:text-gray-600 transition-colors"
                  style={{ fontFamily: "'Noto Sans KR', Pretendard, sans-serif" }}
                >
                  {v.title}
                </h3>
                <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
                  <span className="font-medium text-gray-500">{categoryLabel(article.category)}</span>
                  <span>·</span>
                  <span>{formatTimeAgo(article.published_at)}</span>
                </div>
              </article>
              {isExpanded && (
                <ExpandedArticle version={v} groupKey={groupKey} group={group} link={article.original_link} articleId={article.news_id} />
              )}
            </div>
          );
        })}
      </div>

      {/* 나머지 기사 리스트 */}
      {listArticles.length > 0 && (
        <>
          <hr className="border-gray-100 mb-8" />
          <div className="max-w-[680px] mx-auto space-y-7">
            {listArticles.map((article) => {
              const v = article.versions[groupKey];
              if (!v) return null;
              const isExpanded = expandedId === article.news_id;

              return (
                <div key={article.news_id}>
                  <article
                    className="flex gap-4 cursor-pointer group"
                    onClick={() => setExpandedId(isExpanded ? null : article.news_id)}
                  >
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-[16px] font-bold leading-snug text-gray-900 mb-1.5 line-clamp-2 group-hover:text-gray-600 transition-colors"
                        style={{ fontFamily: "'Noto Sans KR', Pretendard, sans-serif" }}
                      >
                        {v.title}
                      </h3>
                      <p className="text-[13px] text-gray-400 leading-relaxed line-clamp-2 mb-1.5">
                        {v.subtitle || v.body[0]?.slice(0, 80) + "..."}
                      </p>
                      <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
                        <span className="font-medium text-gray-500">{categoryLabel(article.category)}</span>
                        <span>·</span>
                        <span>{formatTimeAgo(article.published_at)}</span>
                      </div>
                    </div>
                    {article.image_url && (
                      <div className="shrink-0 w-[100px] h-[70px] md:w-[130px] md:h-[85px] rounded-lg overflow-hidden">
                        <img src={article.image_url} alt={v.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </article>
                  {isExpanded && (
                    <ExpandedArticle version={v} groupKey={groupKey} group={group} link={article.original_link} articleId={article.news_id} />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ExpandedArticle({
  version: v,
  groupKey,
  group,
  link,
  articleId,
}: {
  version: MbtiVersion;
  groupKey: string;
  group: { bgLightClass: string; borderClass: string; textClass: string };
  link: string;
  articleId: string;
}) {
  return (
    <div className="mt-4 mb-6 p-5 md:p-6 bg-gray-50 rounded-xl border border-gray-100">
      <div className="space-y-4 max-w-[680px]">
        {v.body.map((p, i) => (
          <p key={i} className="text-[15px] leading-[1.85] text-gray-700">
            {p}
          </p>
        ))}
      </div>
      {v.key_points.length > 0 && (
        <div className={`mt-5 p-4 rounded-xl ${group.bgLightClass} border ${group.borderClass} max-w-[680px]`}>
          <p className={`text-xs font-bold mb-2 ${group.textClass}`}>
            {groupKey === "NT" ? "📌 핵심 지표" : groupKey === "NF" ? "💭 핵심 메시지" : groupKey === "ST" ? "📋 팩트 정리" : "💬 한줄 정리"}
          </p>
          <ul className="space-y-1.5">
            {v.key_points.map((pt, i) => (
              <li key={i} className="text-[13px] text-gray-700">{pt}</li>
            ))}
          </ul>
        </div>
      )}
      <p className={`mt-3 text-[13px] font-medium ${group.textClass} max-w-[680px]`}>
        {v.closing_line}
      </p>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-3 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        원문 보기 →
      </a>

      {/* Interactive Reactions */}
      <div onClick={(e) => e.stopPropagation()}>
        <ArticleReactions articleId={articleId} mbtiGroup={groupKey} />
      </div>
    </div>
  );
}
