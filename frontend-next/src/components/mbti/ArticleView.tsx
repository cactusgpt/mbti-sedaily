import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MbtiGroupId } from "@/shared/data/mbtiGroups";
import { useAuth } from "@/features/auth";
import { recordArticleRead } from "@/shared/lib/userApi";
import { trackArticleRead } from "@/shared/lib/readingTracker";
import { API_URL } from "@/shared/config/api";

interface MbtiVersion {
  title: string;
  subtitle: string;
  body: string | string[];
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
  versions?: Record<string, MbtiVersion>;
}

interface Props {
  article: Article;
  currentGroup: MbtiGroupId;
  onClose: () => void;
  onChangeGroup: (group: MbtiGroupId) => void;
  onArchiveSentence?: (text: string, articleId: string, articleTitle: string) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
}

// 본문 텍스트 결합
function getBodyText(body: string | string[]): string {
  return Array.isArray(body) ? body.join("\n\n") : body;
}

export function ArticleView({ article: initialArticle, currentGroup, onClose, onArchiveSentence }: Props) {
  const { user, isAuthenticated } = useAuth();
  const [article, setArticle] = useState<Article>(initialArticle);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // 아카이빙 관련
  const [selectedSentences, setSelectedSentences] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const version = article.versions?.[currentGroup];
  const bodyText = useMemo(
    () => (version ? getBodyText(version.body) : ""),
    [version]
  );
  const archiveItems = useMemo(
    () => version?.key_points ?? [],
    [version]
  );

  // 핵심 정리 선택 토글
  const toggleSentence = (index: number) => {
    setSelectedSentences(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // 선택된 항목 가져오기
  const getSelectedText = () => {
    return Array.from(selectedSentences)
      .sort((a, b) => a - b)
      .map(idx => archiveItems[idx])
      .filter(Boolean)
      .join(" ");
  };

  // API에서 MBTI 버전 가져오기
  useEffect(() => {
    if (!version && !isLoadingContent) {
      setIsLoadingContent(true);
      fetch(`${API_URL}/api/article/${article.news_id}`)
        .then((res) => {
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          setArticle((prev) => ({
            ...prev,
            content: data.content_ko || prev.content,
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
          }));
        })
        .catch((err) => console.error("Failed to load content:", err))
        .finally(() => setIsLoadingContent(false));
    }
  }, [article.news_id, version]);

  // 읽기 기록 — fires once per article open; version hasn't loaded yet
  // at this point, so we always use the original article title
  useEffect(() => {
    trackArticleRead(article.news_id);
    if (isAuthenticated && user) {
      recordArticleRead(user.userId, article.news_id, article.title);
    }
  }, [article.news_id, isAuthenticated, user]);

  // 문장 아카이빙
  const handleArchive = () => {
    const text = getSelectedText();
    if (text && onArchiveSentence) {
      const title = version?.title || article.title;
      onArchiveSentence(text, article.news_id, title);
      setSavedCount(prev => prev + selectedSentences.size);
      setSelectedSentences(new Set());

      setToastMessage(`${selectedSentences.size}개 문장 저장됨`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 1500);
    }
  };

  // 원본 기사 (MBTI 버전 없을 때)
  if (!version) {
    const originalSentences = article.content
      ? article.content
          .split(/(?<=[.?!])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 10)
      : [];

    return (
      <div className="fixed inset-0 z-[100] bg-[#FAFAFA]">
        {/* 헤더 */}
        <header className="sticky top-0 bg-[#FAFAFA] z-10">
          <div className="max-w-[520px] mx-auto px-5">
            <div className="flex items-center justify-between h-12">
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center -ml-2"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {savedCount > 0 && (
                <span className="text-[13px] text-gray-500">
                  {savedCount}개 저장됨
                </span>
              )}
            </div>
          </div>
        </header>

        {/* 본문 */}
        <main className="h-[calc(100vh-48px)] overflow-y-auto">
          <article className="max-w-[520px] mx-auto px-5 pb-32">
            {/* 메타 */}
            <div className="pt-4 pb-6">
              <p className="text-[13px] text-gray-400 mb-3">
                {article.category} · {formatDate(article.published_at)}
              </p>
              <h1 className="text-[22px] font-bold text-gray-900 leading-tight">
                {article.title}
              </h1>
            </div>

            {/* 안내 */}
            <div className="mb-6 py-3 px-4 bg-gray-100 rounded-xl">
              <p className="text-[13px] text-gray-500 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                문장을 탭하면 선택돼요
              </p>
            </div>

            {/* 이미지 */}
            {article.image_url && (
              <div className="mb-8 -mx-5">
                <img src={article.image_url} alt="" className="w-full" />
              </div>
            )}

            {/* 본문 - 문장별 */}
            <div className="leading-[1.9]">
              {originalSentences.map((sentence, idx) => {
                const isSelected = selectedSentences.has(idx);
                return (
                  <span
                    key={idx}
                    onClick={() => toggleSentence(idx)}
                    className={`
                      cursor-pointer transition-all duration-150
                      ${isSelected
                        ? "bg-yellow-200 text-gray-900"
                        : "hover:bg-yellow-50"
                      }
                    `}
                  >
                    {sentence}{" "}
                  </span>
                );
              })}
            </div>

            {/* 출처 */}
            <div className="mt-12 pt-6 border-t border-gray-200">
              <a
                href={article.original_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-gray-400 hover:text-gray-600"
              >
                원문 보기 →
              </a>
            </div>
          </article>
        </main>

        {/* 저장 버튼 */}
        {selectedSentences.size > 0 && (
          <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50 px-5">
            <button
              onClick={handleArchive}
              className="flex items-center gap-2.5 px-5 py-3.5 bg-blue-500 text-white rounded-2xl shadow-xl active:scale-95 transition-transform"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[15px] font-medium">
                {selectedSentences.size}개 문장 저장
              </span>
            </button>
          </div>
        )}

        {/* 토스트 */}
        {showToast && (
          <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50">
            <div className="px-5 py-3 bg-blue-500 text-white rounded-full shadow-xl">
              <span className="text-[14px]">{toastMessage}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#FAFAFA]">
      {/* 헤더 - 미니멀 */}
      <header className="sticky top-0 bg-[#FAFAFA] z-10 border-b border-gray-100">
        <div className="max-w-[720px] mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[14px]">목록</span>
            </button>
            {savedCount > 0 && (
              <span className="text-[13px] text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {savedCount}개 저장됨
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 본문 영역 */}
      <main className="h-[calc(100vh-56px)] overflow-y-auto">
        <article className="max-w-[720px] mx-auto px-6 py-8 pb-32">
          {/* 제목 영역 */}
          <div className="pb-8">
            <p className="text-[14px] text-gray-400 mb-4">
              {article.category} · {formatDate(article.published_at)}
            </p>
            <h1 className="text-[28px] md:text-[32px] font-bold text-gray-900 leading-tight mb-4">
              {version.title}
            </h1>
            {version.subtitle && (
              <p className="text-[16px] text-gray-500 leading-relaxed">
                {version.subtitle}
              </p>
            )}
          </div>

          {/* 이미지 */}
          {article.image_url && (
            <div className="mb-8 -mx-6 md:mx-0 md:rounded-2xl overflow-hidden">
              <img src={article.image_url} alt="" className="w-full" />
            </div>
          )}

          {/* 본문 - Markdown 렌더링 */}
          <div className="prose prose-gray max-w-none text-[17px] leading-[1.95] text-gray-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {bodyText}
            </ReactMarkdown>
          </div>

          {/* 핵심 포인트 — 클릭하여 저장 */}
          {version.key_points && version.key_points.length > 0 && (
            <div className="mt-12 p-6 bg-white rounded-2xl border border-gray-100">
              <p className="text-[14px] font-semibold text-gray-900 mb-1">핵심 정리</p>
              <p className="text-[12px] text-gray-400 mb-5">항목을 클릭하면 선택됩니다</p>
              <ul className="space-y-4">
                {version.key_points.map((point, idx) => {
                  const isSelected = selectedSentences.has(idx);
                  return (
                    <li
                      key={idx}
                      onClick={() => toggleSentence(idx)}
                      className={`text-[15px] text-gray-700 leading-relaxed pl-5 border-l-2 cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? "border-yellow-400 bg-yellow-100"
                          : "border-gray-300 hover:bg-yellow-50"
                      }`}
                    >
                      {point}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 마무리 */}
          {version.closing_line && (
            <p className="mt-10 text-[16px] text-gray-500 italic leading-relaxed">
              {version.closing_line}
            </p>
          )}

          {/* 출처 */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <a
              href={article.original_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              원문 기사 보기 →
            </a>
          </div>
        </article>
      </main>

      {/* 선택된 문장 있을 때 저장 버튼 */}
      {selectedSentences.size > 0 && (
        <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50 px-5">
          <button
            onClick={handleArchive}
            className="flex items-center gap-2.5 px-5 py-3.5 bg-blue-500 text-white rounded-2xl shadow-xl active:scale-95 transition-transform"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[15px] font-medium">
              {selectedSentences.size}개 문장 저장
            </span>
          </button>
        </div>
      )}

      {/* 토스트 */}
      {showToast && (
        <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50">
          <div className="px-5 py-3 bg-blue-500 text-white rounded-full shadow-xl">
            <span className="text-[14px]">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
