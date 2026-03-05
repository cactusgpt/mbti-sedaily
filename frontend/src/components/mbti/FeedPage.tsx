import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { API_URL } from "@/config/api";
import { ArticleView } from "./ArticleView";
import { UserMenu } from "@/components/auth/UserMenu";

// 프리페칭 캐시 (전역)
const prefetchCache = new Map<string, Article>();

interface MbtiVersion {
  title: string;
  subtitle: string;
  body: string | string[];
  key_points: string[];
  closing_line: string;
  tone: string;
}

// ** 볼드 마크다운 제거
function cleanMarkdown(text: string): string {
  return text.replace(/\*\*/g, '');
}

// body 텍스트 추출 (헤더/테이블 건너뛰기)
function getBodyText(body: string | string[]): string {
  const text = cleanMarkdown(Array.isArray(body) ? body.join('\n\n') : body);
  const paragraphs = text.split("\n\n").filter(p => p.trim());

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) continue;
    if (trimmed.startsWith('■')) continue;
    if (trimmed.includes('|')) continue; // 테이블
    if (trimmed.startsWith('---')) continue;
    if (trimmed.length < 20) continue;
    return trimmed.slice(0, 200);
  }
  return "";
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
  onChangeGroup: () => void;
  onSwitchToStory?: () => void;
}

// 에디터 정보 (심플하게)
const editors: Record<MbtiGroupId, {
  name: string;
  mbti: string;
  emptyMessage: string;
}> = {
  NT: {
    name: "시현",
    mbti: "NT",
    emptyMessage: "아직 뉴스가 없습니다.",
  },
  NF: {
    name: "지원",
    mbti: "NF",
    emptyMessage: "아직 뉴스가 없습니다.",
  },
  ST: {
    name: "정훈",
    mbti: "ST",
    emptyMessage: "아직 뉴스가 없습니다.",
  },
  SF: {
    name: "하은",
    mbti: "SF",
    emptyMessage: "아직 뉴스가 없습니다.",
  },
};

const categories = ["전체", "경제", "정치", "사회", "세계", "테크", "문화"];

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

function categoryToApi(cat: string): string[] {
  if (cat === "전체") return [];
  if (cat === "테크") return ["IT_과학", "산업"];
  if (cat === "세계") return ["국제"];
  return [cat];
}

export function FeedPage({ selectedGroup, onChangeGroup, onSwitchToStory }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [viewArticle, setViewArticle] = useState<Article | null>(null);

  const editor = editors[selectedGroup];
  const prefetchingRef = useRef<Set<string>>(new Set());

  // 프리페칭 함수 - hover 시 호출
  const prefetchArticle = useCallback((article: Article) => {
    const id = article.news_id;
    // 이미 캐시에 있거나 로딩 중이면 스킵
    if (prefetchCache.has(id) || prefetchingRef.current.has(id)) return;
    // MBTI 버전이 이미 있으면 스킵
    if (article.versions && Object.keys(article.versions).length === 4) return;

    prefetchingRef.current.add(id);
    fetch(`${API_URL}/api/article/${id}`)
      .then(res => res.json())
      .then(data => {
        const enrichedArticle: Article = {
          ...article,
          content: data.content_ko || article.content,
          ...(data.version_NT?.body && data.version_NF?.body && data.version_ST?.body && data.version_SF?.body
            ? {
                versions: {
                  NT: data.version_NT,
                  NF: data.version_NF,
                  ST: data.version_ST,
                  SF: data.version_SF,
                },
              }
            : {}),
        };
        prefetchCache.set(id, enrichedArticle);
      })
      .catch(() => {})
      .finally(() => {
        prefetchingRef.current.delete(id);
      });
  }, []);

  const openArticle = useCallback((article: Article) => {
    // 캐시된 데이터가 있으면 사용
    const cachedArticle = prefetchCache.get(article.news_id);
    setViewArticle(cachedArticle || article);
    window.history.pushState({ articleId: article.news_id }, "", `#article-${article.news_id}`);
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (viewArticle && !event.state?.articleId) {
        setViewArticle(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [viewArticle]);

  const handleCloseArticle = useCallback(() => {
    if (viewArticle) {
      window.history.back();
    }
  }, [viewArticle]);

  // 카테고리별 캐시
  const categoryCache = useRef<Record<string, Article[]>>({});

  const fetchCategoryArticles = useCallback(async (category: string) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const res = await fetch(`${API_URL}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "*",
        filters: {
          published_from: sevenDaysAgo,
          published_until: tomorrow,
          categories: categoryToApi(category),
        },
        page: 1,
        page_size: 30,
      }),
    });
    const data = await res.json();
    return data.articles || [];
  }, []);

  // 카테고리 hover 시 프리페칭
  const prefetchCategory = useCallback((category: string) => {
    if (categoryCache.current[category]) return;
    fetchCategoryArticles(category).then(articles => {
      categoryCache.current[category] = articles;
    }).catch(() => {});
  }, [fetchCategoryArticles]);

  useEffect(() => {
    async function fetchArticles() {
      // 캐시에 있으면 즉시 사용
      if (categoryCache.current[selectedCategory]) {
        setArticles(categoryCache.current[selectedCategory]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const articles = await fetchCategoryArticles(selectedCategory);
        categoryCache.current[selectedCategory] = articles;
        setArticles(articles);
      } catch (e) {
        console.error("Failed to fetch articles:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [selectedCategory, fetchCategoryArticles]);

  const heroArticle = articles[0];
  const gridArticles = articles.slice(1);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-40">
        {/* Top bar */}
        <div className="max-w-[1000px] mx-auto px-5 py-2.5 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-[18px] font-bold text-gray-900 tracking-tight">
              AI LENS
            </h1>
            <span className="text-[13px] text-gray-500 flex items-center gap-1.5">
              by <span className="font-medium text-gray-700">{editor.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{editor.mbti}</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://sedaily.com"
              target="_blank"
              className="text-[12px] text-gray-400 hover:text-gray-600"
            >
              서울경제
            </a>
            <button
              onClick={onChangeGroup}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              에디터 변경
            </button>
            <UserMenu />
          </div>
        </div>

        {/* Category tabs + 우측 메뉴 탭 */}
        <div className="max-w-[1000px] mx-auto px-5">
          <nav className="flex items-center justify-between">
            {/* 좌측: 카테고리 탭 */}
            <div className="flex gap-6 overflow-x-auto scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  onMouseEnter={() => prefetchCategory(cat)}
                  className={`py-3 text-[14px] whitespace-nowrap border-b-2 transition-colors ${
                    selectedCategory === cat
                      ? "border-gray-900 text-gray-900 font-semibold"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 우측: 뉴스 여정 + 타임라인 탭 */}
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {onSwitchToStory && (
                <button
                  onClick={onSwitchToStory}
                  className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <span>🐱</span>
                  <span>뉴스 여정</span>
                </button>
              )}
              <Link
                to="/timeline"
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>타임라인</span>
              </Link>
              {/* 사주/운세 버튼 숨김 */}
              <Link
                to="/timemachine"
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span>🛸</span>
                <span>타임머신</span>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className={`max-w-[1000px] mx-auto px-5 py-8 flex-1 transition-opacity duration-150 ${loading ? "opacity-60" : "opacity-100"}`}>
        {articles.length === 0 && !loading ? (
          <div className="text-center py-20">
            <p className="text-gray-500">{editor.emptyMessage}</p>
          </div>
        ) : (
          <>
            {/* Hero Article */}
            {heroArticle && (
              <article
                className="flex flex-col md:flex-row gap-6 mb-12 cursor-pointer group"
                onClick={() => openArticle(heroArticle)}
                onMouseEnter={() => prefetchArticle(heroArticle)}
              >
                {heroArticle.image_url && (
                  <div className="md:w-1/2 rounded-lg overflow-hidden">
                    <img
                      src={heroArticle.image_url}
                      alt=""
                      className="w-full h-[200px] md:h-[280px] object-cover group-hover:scale-[1.01] transition-transform duration-300"
                    />
                  </div>
                )}
                <div className={`${heroArticle.image_url ? "md:w-1/2" : "w-full"} flex flex-col justify-center`}>
                  <p className="text-[12px] text-gray-400 mb-2">
                    {heroArticle.category} · {formatTimeAgo(heroArticle.published_at)}
                  </p>
                  <h3 className="text-[22px] md:text-[26px] font-bold text-gray-900 leading-tight mb-3 group-hover:text-gray-600 transition-colors">
                    {heroArticle.versions?.[selectedGroup]?.title || heroArticle.title}
                  </h3>
                  <p className="text-[15px] text-gray-600 leading-relaxed line-clamp-3">
                    {heroArticle.versions?.[selectedGroup]?.body
                      ? getBodyText(heroArticle.versions[selectedGroup].body)
                      : heroArticle.content?.slice(0, 200) || heroArticle.sub_title || ""}
                  </p>
                </div>
              </article>
            )}

            {/* Divider */}
            <div className="border-t border-gray-200 mb-10" />

            {/* Grid */}
            <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
              {gridArticles.map((article) => {
                const v = article.versions?.[selectedGroup];
                // MBTI 버전 없는 기사도 원본 제목으로 표시 (클릭 시 On-Demand 변환)
                const title = v?.title || article.title;
                const content = v?.body
                  ? getBodyText(v.body).slice(0, 100)
                  : (article.content?.slice(0, 100) || article.sub_title || "");

                return (
                  <article
                    key={article.news_id}
                    className="flex gap-5 cursor-pointer group"
                    onClick={() => openArticle(article)}
                    onMouseEnter={() => prefetchArticle(article)}
                  >
                    {article.image_url && (
                      <div className="shrink-0 w-[140px] h-[100px] rounded-lg overflow-hidden">
                        <img
                          src={article.image_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-400 mb-1.5">
                        {article.category}
                      </p>
                      <h4 className="text-[15px] font-semibold text-gray-900 leading-snug mb-2 line-clamp-2 group-hover:text-gray-600 transition-colors">
                        {title}
                      </h4>
                      <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2">
                        {content}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Footer - fixed to bottom */}
      <footer className="border-t border-gray-200 mt-auto">
        <div className="max-w-[1000px] mx-auto px-5 py-6 text-center text-[12px] text-gray-400">
          © 서울경제신문
        </div>
      </footer>

      {/* Article View */}
      {viewArticle && (
        <ArticleView
          article={viewArticle}
          currentGroup={selectedGroup}
          onClose={handleCloseArticle}
          onChangeGroup={() => {}}
        />
      )}
    </div>
  );
}
