import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { API_URL } from "@/config/api";
import { ArticleView } from "./ArticleView";
import { UserMenu } from "@/components/auth/UserMenu";
import { mockArticles } from "@/data/mockArticles";

// 프리페칭 캐시 (전역)
const prefetchCache = new Map<string, Article>();

// 스크롤 진입 애니메이션 훅
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

// 스크롤 애니메이션 래퍼 컴포넌트
function RevealItem({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateY(28px)",
        transition: `opacity 0.55s cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 0.55s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

interface MbtiVersion {
  title: string;
  subtitle: string;
  body: string | string[];
  key_points: string[];
  closing_line: string;
  tone: string;
  image_url?: string;
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
  versions?: Record<string, MbtiVersion>;
}

interface Props {
  selectedGroup: MbtiGroupId;
  onChangeGroup: () => void;
  onSwitchToStory?: () => void;
  onMbtiChange?: (group: MbtiGroupId) => void;
}

// 에디터 정보 (심플하게)
const editors: Record<MbtiGroupId, {
  name: string;
  mbti: string;
  emptyMessage: string;
}> = {
  NT: {
    name: "구조분석",
    mbti: "NT",
    emptyMessage: "아직 뉴스가 없습니다.",
  },
  NF: {
    name: "가치탐색",
    mbti: "NF",
    emptyMessage: "아직 뉴스가 없습니다.",
  },
  ST: {
    name: "실용체크",
    mbti: "ST",
    emptyMessage: "아직 뉴스가 없습니다.",
  },
  SF: {
    name: "사람이야기",
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

function matchCategory(articleCategory: string, selectedCategory: string): boolean {
  if (selectedCategory === "전체") return true;
  if (selectedCategory === "경제" && articleCategory === "경제") return true;
  if (selectedCategory === "정치" && articleCategory === "정치") return true;
  if (selectedCategory === "사회" && articleCategory === "사회") return true;
  if (selectedCategory === "세계" && articleCategory === "국제") return true;
  if (selectedCategory === "테크" && (articleCategory === "테크" || articleCategory === "IT_과학" || articleCategory === "산업")) return true;
  if (selectedCategory === "문화" && articleCategory === "문화") return true;
  return false;
}

export function FeedPage({ selectedGroup, onChangeGroup, onSwitchToStory, onMbtiChange }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [viewArticle, setViewArticle] = useState<Article | null>(null);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [adTransition, setAdTransition] = useState(true);
  const [currentMbtiIndex, setCurrentMbtiIndex] = useState(0);
  const [mbtiTransition, setMbtiTransition] = useState(true);
  const [showAllArticles, setShowAllArticles] = useState(false);

  const editor = editors[selectedGroup];
  const prefetchingRef = useRef<Set<string>>(new Set());

  // 광고 메시지 목록 (각각 다른 디자인)
  const adMessages = [
    {
      title: "하나의 기사, 네 가지 스타일로 읽어보세요 🎭",
      subtitle: "분석형 · 공감형 · 실용형 · 속보형 | 당신의 성향에 맞는 뉴스를 찾아보세요",
      bgGradient: "from-orange-50 to-yellow-50",
      borderColor: "border-orange-200",
      circleColor1: "bg-orange-200",
      circleColor2: "bg-yellow-200"
    },
    {
      title: "뉴스의 팩트는 바꾸지 않습니다 📊",
      subtitle: "독자에게 닿는 방식을 바꿉니다 | 당신에게 맞는 전달 방식을 선택하세요",
      bgGradient: "from-blue-50 to-cyan-50",
      borderColor: "border-blue-200",
      circleColor1: "bg-blue-200",
      circleColor2: "bg-cyan-200"
    },
    {
      title: "같은 팩트, 네 가지 전달 방식 🎓",
      subtitle: "독자가 선택합니다 | 분석형부터 속보형까지, 당신의 스타일로",
      bgGradient: "from-violet-50 to-purple-50",
      borderColor: "border-violet-200",
      circleColor1: "bg-violet-200",
      circleColor2: "bg-purple-200"
    }
  ];

  // MBTI 타입 소개 메시지
  const mbtiMessages = [
    {
      title: "NT: 구조분석",
      subtitle: "논리적 구조와 인과관계를 분석합니다",
      bgGradient: "from-indigo-50 to-blue-50",
      borderColor: "border-indigo-200",
      circleColor1: "bg-indigo-200",
      circleColor2: "bg-blue-200"
    },
    {
      title: "NF: 가치탐색",
      subtitle: "사회적 의미와 가치를 탐구합니다",
      bgGradient: "from-green-50 to-emerald-50",
      borderColor: "border-green-200",
      circleColor1: "bg-green-200",
      circleColor2: "bg-emerald-200"
    },
    {
      title: "ST: 실용체크",
      subtitle: "현실적 정보와 실행 방안을 제시합니다",
      bgGradient: "from-amber-50 to-orange-50",
      borderColor: "border-amber-200",
      circleColor1: "bg-amber-200",
      circleColor2: "bg-orange-200"
    },
    {
      title: "SF: 사람이야기",
      subtitle: "사람의 이야기와 감정을 전달합니다",
      bgGradient: "from-pink-50 to-rose-50",
      borderColor: "border-pink-200",
      circleColor1: "bg-pink-200",
      circleColor2: "bg-rose-200"
    }
  ];

  // 광고 자동 스크롤 (원형 - 무한 루프)
  useEffect(() => {
    const timer = setInterval(() => {
      setAdTransition(true);
      setCurrentAdIndex((prev) => prev + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // adIndex가 복제 슬라이드(마지막+1)에 도달하면 transition 없이 처음으로 리셋
  useEffect(() => {
    if (currentAdIndex === adMessages.length) {
      const timeout = setTimeout(() => {
        setAdTransition(false);
        setCurrentAdIndex(0);
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [currentAdIndex, adMessages.length]);

  // MBTI 캐러셀 자동 스크롤 (원형 - 무한 루프)
  useEffect(() => {
    const timer = setInterval(() => {
      setMbtiTransition(true);
      setCurrentMbtiIndex((prev) => prev + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // mbtiIndex가 복제 슬라이드(마지막+1)에 도달하면 transition 없이 처음으로 리셋
  useEffect(() => {
    if (currentMbtiIndex === mbtiMessages.length) {
      const timeout = setTimeout(() => {
        setMbtiTransition(false);
        setCurrentMbtiIndex(0);
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [currentMbtiIndex, mbtiMessages.length]);

  // 프리페칭 함수 - hover 시 호출
  const prefetchArticle = useCallback((article: Article) => {
    const id = article.news_id;
    // mock 데이터는 프리페칭 스킵
    if (id.startsWith('mock-')) return;
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
      // 캐시 무효화 (개발용)
      categoryCache.current = {};
      
      try {
        setLoading(true);
        const articles = await fetchCategoryArticles(selectedCategory);
        
        // API에서 데이터가 없으면 mock 데이터 사용 (개발용)
        if (articles.length === 0) {
          console.log("Using mock data for development");
          console.log("Selected category:", selectedCategory);
          const filteredMock = mockArticles.filter(a => matchCategory(a.category, selectedCategory));
          console.log("Filtered count:", filteredMock.length);
          console.log("Sample categories:", filteredMock.slice(0, 3).map(a => a.category));
          setArticles(filteredMock);
        } else {
          setArticles(articles);
        }
      } catch (e) {
        console.error("Failed to fetch articles:", e);
        console.log("API failed, using mock data");
        const filteredMock = mockArticles.filter(a => matchCategory(a.category, selectedCategory));
        console.log("Filtered count:", filteredMock.length);
        setArticles(filteredMock);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [selectedCategory, fetchCategoryArticles]);

  const featuredArticles = articles.slice(0, 4);
  const featuredSource = articles[0] ?? null; // 2x2 그리드용 원문 기사
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
            {/* Ad Banner - Auto Carousel with Slide Animation (원형) */}
            <div className="mb-8 relative overflow-hidden">
              <div
                className={`flex ${adTransition ? "transition-transform duration-700 ease-in-out" : ""}`}
                style={{ transform: `translateX(-${currentAdIndex * 100}%)` }}
              >
                {adMessages.map((ad, index) => (
                  <div
                    key={index}
                    className="w-full flex-shrink-0"
                  >
                    <div className={`bg-gradient-to-r ${ad.bgGradient} rounded-lg p-8 border-2 ${ad.borderColor} relative overflow-hidden`}>
                      <div className={`absolute top-0 right-0 w-32 h-32 ${ad.circleColor1} rounded-full -mr-16 -mt-16 opacity-50`} />
                      <div className={`absolute bottom-0 left-0 w-24 h-24 ${ad.circleColor2} rounded-full -ml-12 -mb-12 opacity-50`} />
                      <div className="relative z-10">
                        <p className="text-[24px] md:text-[28px] font-black text-gray-900 mb-2 text-center">
                          {ad.title}
                        </p>
                        <p className="text-[14px] text-gray-600 text-center">
                          {ad.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {/* 첫 번째 슬라이드 복제 - 무한 루프용 */}
                <div className="w-full flex-shrink-0">
                  <div className={`bg-gradient-to-r ${adMessages[0].bgGradient} rounded-lg p-8 border-2 ${adMessages[0].borderColor} relative overflow-hidden`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 ${adMessages[0].circleColor1} rounded-full -mr-16 -mt-16 opacity-50`} />
                    <div className={`absolute bottom-0 left-0 w-24 h-24 ${adMessages[0].circleColor2} rounded-full -ml-12 -mb-12 opacity-50`} />
                    <div className="relative z-10">
                      <p className="text-[24px] md:text-[28px] font-black text-gray-900 mb-2 text-center">
                        {adMessages[0].title}
                      </p>
                      <p className="text-[14px] text-gray-600 text-center">
                        {adMessages[0].subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Indicator dots - 우측 하단 */}
              <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                {adMessages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => { setAdTransition(true); setCurrentAdIndex(index); }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === (currentAdIndex % adMessages.length) ? "bg-gray-900 w-6" : "bg-gray-400"
                    }`}
                    aria-label={`광고 ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* MBTI Type Carousel */}
            <div className="mb-8 relative overflow-hidden hidden">
              <div
                className={`flex ${mbtiTransition ? "transition-transform duration-700 ease-in-out" : ""}`}
                style={{ transform: `translateX(-${currentMbtiIndex * 100}%)` }}
              >
                {mbtiMessages.map((mbti, index) => (
                  <div
                    key={index}
                    className="w-full flex-shrink-0"
                  >
                    <div className={`bg-gradient-to-r ${mbti.bgGradient} rounded-lg p-8 border-2 ${mbti.borderColor} relative overflow-hidden`}>
                      <div className={`absolute top-0 right-0 w-32 h-32 ${mbti.circleColor1} rounded-full -mr-16 -mt-16 opacity-50`} />
                      <div className={`absolute bottom-0 left-0 w-24 h-24 ${mbti.circleColor2} rounded-full -ml-12 -mb-12 opacity-50`} />
                      <div className="relative z-10">
                        <p className="text-[24px] md:text-[28px] font-black text-gray-900 mb-2 text-center">
                          {mbti.title}
                        </p>
                        <p className="text-[14px] text-gray-600 text-center">
                          {mbti.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {/* 첫 번째 슬라이드 복제 - 무한 루프용 */}
                <div className="w-full flex-shrink-0">
                  <div className={`bg-gradient-to-r ${mbtiMessages[0].bgGradient} rounded-lg p-8 border-2 ${mbtiMessages[0].borderColor} relative overflow-hidden`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 ${mbtiMessages[0].circleColor1} rounded-full -mr-16 -mt-16 opacity-50`} />
                    <div className={`absolute bottom-0 left-0 w-24 h-24 ${mbtiMessages[0].circleColor2} rounded-full -ml-12 -mb-12 opacity-50`} />
                    <div className="relative z-10">
                      <p className="text-[24px] md:text-[28px] font-black text-gray-900 mb-2 text-center">
                        {mbtiMessages[0].title}
                      </p>
                      <p className="text-[14px] text-gray-600 text-center">
                        {mbtiMessages[0].subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                {mbtiMessages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => { setMbtiTransition(true); setCurrentMbtiIndex(index); }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === (currentMbtiIndex % mbtiMessages.length) ? "bg-gray-900 w-6" : "bg-gray-400"
                    }`}
                    aria-label={`MBTI 타입 ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Featured Articles - 전체일 때 2x2 그리드, 카테고리일 때 히어로 카드 */}
            {featuredSource && (
              <RevealItem>
              <div className="mb-6">
                {/* 섹션 타이틀 */}
                <p className="text-[24px] font-bold text-gray-900 mb-4">같은 팩트, 네 가지 전달 방식</p>

                {/* 유형 선택 버튼 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {(['SF', 'NF', 'NT', 'ST'] as MbtiGroupId[]).map((groupId) => {
                    const groupEditor = editors[groupId];
                    const isSelected = selectedGroup === groupId;
                    return (
                      <button
                        key={groupId}
                        onClick={() => onMbtiChange?.(groupId)}
                        className={`px-3 py-2 rounded-lg border-2 transition-all text-center flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm"
                        }`}
                      >
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"
                        }`}>
                          {groupId}
                        </span>
                        <span className={`text-[13px] font-bold ${isSelected ? "text-orange-600" : "text-gray-800"}`}>
                          {groupEditor.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 유형 슬라이더 */}
                {(() => {
                  const sliderOrder: MbtiGroupId[] = ['SF', 'NF', 'NT', 'ST'];
                  const sliderLabels: Record<MbtiGroupId, string> = { SF: '속보형', NF: '공감형', NT: '분석형', ST: '실용형' };
                  const currentIdx = sliderOrder.indexOf(selectedGroup);
                  const pct = (currentIdx / (sliderOrder.length - 1)) * 100;

                  const handleDrag = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
                    const track = e.currentTarget;
                    const rect = track.getBoundingClientRect();
                    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
                    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                    const idx = Math.round(ratio * (sliderOrder.length - 1));
                    const newGroup = sliderOrder[idx];
                    if (newGroup !== selectedGroup) onMbtiChange?.(newGroup);
                  };

                  return (
                    <div className="mb-5 flex justify-center">
                      <div className="w-[80%]">
                        <div
                          className="relative cursor-pointer select-none"
                          onClick={handleDrag}
                          onMouseMove={(e) => e.buttons === 1 && handleDrag(e)}
                          onTouchMove={handleDrag}
                        >
                          <div className="absolute top-[5px] left-0 right-0 h-[2px] bg-gray-200 rounded-full" />
                          <div className="absolute top-[1px] left-0 right-0 flex justify-between pointer-events-none">
                            {sliderOrder.map((groupId) => (
                              <div key={groupId} className="w-3 h-3 rounded-full bg-gray-200 border-2 border-white shadow-sm" />
                            ))}
                          </div>
                          <div
                            className="absolute top-[1px] w-3 h-3 bg-orange-500 rounded-full -translate-x-1/2 transition-all duration-200 shadow-md z-10"
                            style={{ left: `${pct}%` }}
                          />
                          <div className="relative flex justify-between pt-6">
                            {sliderOrder.map((groupId) => {
                              const isActive = groupId === selectedGroup;
                              return (
                                <span key={groupId} className={`text-[10px] font-bold transition-colors duration-200 ${
                                  isActive ? "text-orange-500" : "text-gray-400"
                                }`}>
                                  {sliderLabels[groupId]}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 전체: 2x2 그리드 / 카테고리: 히어로 카드 */}
                {selectedCategory === "전체" ? (
                  <>
                {/* 2x2 그리드 + 가운데 원문 카드 */}
                <div className="relative max-w-[520px] mx-auto">
                  {/* SVG 대각선 연결선 - 그리드 위에 오버레이 */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    preserveAspectRatio="none"
                  >
                    {/* 좌상 → 중앙 */}
                    <line x1="25%" y1="40%" x2="50%" y2="50%" stroke="#fdba74" strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* 우상 → 중앙 */}
                    <line x1="75%" y1="40%" x2="50%" y2="50%" stroke="#fdba74" strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* 좌하 → 중앙 */}
                    <line x1="25%" y1="60%" x2="50%" y2="50%" stroke="#fdba74" strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* 우하 → 중앙 */}
                    <line x1="75%" y1="60%" x2="50%" y2="50%" stroke="#fdba74" strokeWidth="1.5" strokeDasharray="4 3" />
                  </svg>

                  <div className="grid grid-cols-2 gap-6 max-w-[520px] mx-auto">
                    {(['NT', 'NF', 'ST', 'SF'] as MbtiGroupId[]).map((groupId) => {
                      const v = featuredSource.versions?.[groupId];
                      const title = v?.title || featuredSource.title;
                      const imageUrl = v?.image_url || featuredSource.image_url;
                      const groupName = editors[groupId].name;
                      const isSelected = groupId === selectedGroup;
                      return (
                        <article
                          key={groupId}
                          className={`cursor-pointer group rounded-lg transition-all duration-300 ${
                            isSelected ? "ring-2 ring-orange-500 shadow-[0_0_12px_3px_rgba(249,115,22,0.25)]" : ""
                          }`}
                          onClick={() => openArticle(featuredSource)}
                          onMouseEnter={() => prefetchArticle(featuredSource)}
                        >
                          <div className="w-full h-[130px] md:h-[150px] bg-gray-100 overflow-hidden rounded-lg">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200" />
                            )}
                          </div>
                          <div className="pt-2 pb-1 px-0.5 flex items-center gap-1.5">
                            <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              isSelected ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"
                            }`}>
                              {groupId} {groupName}
                            </span>
                            <h3 className="text-[11px] md:text-[12px] font-bold text-gray-900 leading-tight line-clamp-1">
                              {title}
                            </h3>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* 가운데 원문 카드 - absolute 오버레이 */}
                  {featuredSource.original_link && (
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[38%] max-w-[170px]">
                      <a
                        href={featuredSource.original_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg hover:shadow-xl hover:border-orange-300 transition-all group text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="block text-[10px] text-gray-400 mb-1 font-medium tracking-wide uppercase">원문</span>
                        <span className="block text-[13px] font-bold text-gray-900 group-hover:text-orange-500 transition-colors leading-snug line-clamp-3">
                          {featuredSource.title}
                        </span>
                        <span className="block mt-2 text-[11px] text-orange-400 group-hover:text-orange-500">↗ 원문 보기</span>
                      </a>
                    </div>
                  )}
                </div>
                  </>
                ) : (
                  /* 카테고리 진입 시 가로형 카드 */
                  <article
                    className="cursor-pointer group flex gap-4 items-center rounded-xl p-3 border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all duration-300"
                    onClick={() => openArticle(featuredSource)}
                    onMouseEnter={() => prefetchArticle(featuredSource)}
                  >
                    {(() => {
                      const v = featuredSource.versions?.[selectedGroup];
                      const title = v?.title || featuredSource.title;
                      const imageUrl = v?.image_url || featuredSource.image_url;
                      const groupName = editors[selectedGroup].name;
                      return (
                        <>
                          <div className="shrink-0 w-[110px] h-[80px] md:w-[140px] md:h-[96px] bg-gray-100 overflow-hidden rounded-lg">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white mb-1.5">
                              {selectedGroup} {groupName}
                            </span>
                            <h3 className="text-[14px] md:text-[16px] font-bold text-gray-900 leading-snug line-clamp-3">
                              {title}
                            </h3>
                          </div>
                        </>
                      );
                    })()}
                  </article>
                )}

              </div>
              </RevealItem>
            )}

            {/* Divider */}
            <div className="border-t border-gray-200 mb-10" />

            {/* Grid */}
            {(() => {
              const visibleArticles = showAllArticles ? gridArticles : gridArticles.slice(0, 8);
              return (
                <>
                  <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
                    {visibleArticles.map((article, idx) => {
                      const v = article.versions?.[selectedGroup];
                      const title = v?.title || article.title;
                      const content = v?.body
                        ? getBodyText(v.body).slice(0, 100)
                        : (article.content?.slice(0, 100) || article.sub_title || "");

                      return (
                        <RevealItem key={article.news_id} delay={(idx % 4) * 60}>
                        <article
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
                        </RevealItem>
                      );
                    })}
                  </div>
                  {gridArticles.length > 8 && (
                    <div className="mt-10 text-center">
                      <button
                        onClick={() => setShowAllArticles(!showAllArticles)}
                        className="px-6 py-2.5 text-[14px] font-medium text-gray-600 border border-gray-300 rounded-full hover:border-gray-400 hover:text-gray-900 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          {showAllArticles ? "접기" : "전체보기"}
                          <svg className={`w-4 h-4 transition-transform duration-200 ${showAllArticles ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
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
