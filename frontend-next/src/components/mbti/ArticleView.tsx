import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MbtiGroupId } from "@/shared/data/mbtiGroups";
import type { MbtiVersion } from "@/shared/types/mbti";
import { useAuth } from "@/features/auth";
import { recordArticleRead, recordArticleReadV2 } from "@/shared/lib/userApi";
import { trackArticleRead } from "@/shared/lib/readingTracker";
import { API_URL } from "@/shared/config/api";

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

// v2 Article API의 version 객체를 shared MbtiVersion shape로 변환.
// v1의 tone 필드가 v2엔 없어서 빈 문자열로 채움. v1 frontend 컴포넌트는 tone을
// 표시 용도로만 쓰며, 빈 문자열이면 단순히 안 보임 (data-driven hide 패턴).
function adaptV2Version(v2Version: Record<string, unknown>): MbtiVersion {
  return {
    title: (v2Version.title as string) || '',
    subtitle: (v2Version.subtitle as string) || '',
    body: (v2Version.body as string) || '',
    key_points: Array.isArray(v2Version.key_points)
      ? (v2Version.key_points as string[])
      : [],
    closing_line: (v2Version.closing_line as string) || '',
    tone: '',
  };
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

  // Original-sentence list shown in the no-version fallback render. Lifted
  // out of the `!version` branch so handleArchive can read from the correct
  // source no matter which branch the user is currently looking at.
  const originalSentences = useMemo(
    () =>
      article.content
        ? article.content
            .split(/(?<=[.?!])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 10)
        : [],
    [article.content]
  );

  // The two render branches click into different arrays via the same index,
  // so swapping between them (e.g. v2 versions arrive after the fallback was
  // shown) would leave indices pointing into the wrong source. Reset.
  useEffect(() => {
    setSelectedSentences(new Set());
  }, [version]);

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

  // 선택된 항목 가져오기 — `selectedSentences` indices map into whichever
  // source is currently rendered. Previously this always read from
  // `archiveItems`, so saves from the fallback branch produced empty text.
  const getSelectedText = () => {
    const source = version ? archiveItems : originalSentences;
    return Array.from(selectedSentences)
      .sort((a, b) => a - b)
      .map(idx => source[idx])
      .filter(Boolean)
      .join(" ");
  };

  // Round 4: 1 fetch with ?include_all_mbti=true.
  // v1은 한 호출에 4 versions를 받았고, TASK-7에서 v2 cutover 시 4-parallel로
  // 갔었음 (Article API가 mbti 단일 variant만 반환했었기 때문). Round 4에서
  // backend에 ?include_all_mbti=true 옵션을 추가해서 1 호출로 복귀.
  // 응답이 all_versions (4 entries)를 포함하면 그것 사용, 부재하거나 <4면
  // 4-parallel fallback (구 backend 호환 + partial transform 케이스).
  // FeedPage prefetchCache가 같은 어댑터 결과를 미리 채워뒀을 수 있지만
  // ArticleView는 prefetchCache를 직접 보지 않음 (FeedPage의 openArticle이
  // 이미 cached article을 setViewArticle해서 versions가 들어온 상태로 props
  // 받음). 즉 prefetch hit 케이스는 line 99 가드로 fetch 자체가 skip됨.
  useEffect(() => {
    if (!version && !isLoadingContent) {
      setIsLoadingContent(true);
      const groups = ['NT', 'NF', 'ST', 'SF'] as const;
      const primaryGroup = currentGroup;

      const fetchAllInOne = fetch(
        `${API_URL}/api/v2/article/${article.news_id}?mbti=${primaryGroup}&include_all_mbti=true`
      ).then((r) => (r.ok ? r.json() : null));

      fetchAllInOne
        .then((data) => {
          // Path A: backend returned all_versions with all 4 MBTI entries.
          if (
            data &&
            data.all_versions &&
            typeof data.all_versions === 'object' &&
            groups.every((g) => data.all_versions[g])
          ) {
            const nextVersions: Record<string, MbtiVersion> = {};
            groups.forEach((g) => {
              nextVersions[g] = adaptV2Version(
                data.all_versions[g] as Record<string, unknown>
              );
            });
            setArticle((prev) => ({ ...prev, versions: nextVersions }));
            return;
          }
          // Path B: fallback to 4-parallel (older backend, partial transform,
          // or include_all_mbti not honored).
          return Promise.all(
            groups.map((g) =>
              fetch(`${API_URL}/api/v2/article/${article.news_id}?mbti=${g}`).then(
                (r) => (r.ok ? r.json() : null)
              )
            )
          ).then((results) => {
            const nextVersions: Record<string, MbtiVersion> = {};
            let allOk = true;
            results.forEach((r, i) => {
              if (r && r.version) {
                nextVersions[groups[i]] = adaptV2Version(
                  r.version as Record<string, unknown>
                );
              } else {
                allOk = false;
              }
            });
            if (allOk) {
              setArticle((prev) => ({ ...prev, versions: nextVersions }));
            }
            // !allOk 케이스: setArticle 안 함 → version 그대로 undefined →
            // fallback render. 어댑터가 content를 body_preview로 이미
            // 채워뒀으니 200자라도 표시됨.
          });
        })
        .catch((err) => console.error('Failed to load v2 versions:', err))
        .finally(() => setIsLoadingContent(false));
    }
  }, [article.news_id, version, currentGroup]);

  // 읽기 기록 — fires once per article open; version hasn't loaded yet
  // at this point, so we always use the original article title
  useEffect(() => {
    trackArticleRead(article.news_id);
    if (isAuthenticated && user) {
      // Dual-write:
      //   - v1 endpoint feeds existing DNA-tab / recommend-API features
      //   - v2 endpoint feeds Phase 3 user_interactions for the
      //     Consolidation Lambda. mbtiForV2 prefers the 4-char form
      //     (Round 5-G — captured at OnboardingPage editor selection)
      //     so the backend can lazy-create the user_profiles row with a
      //     proper CHAR(4) value. Falls back to the 2-char currentGroup
      //     for legacy users until app/page.tsx backfills on next mount.
      const mbtiForV2 = (typeof window !== "undefined"
        ? localStorage.getItem("mbti-type")
        : null) || currentGroup;
      recordArticleRead(user.userId, article.news_id, article.title);
      recordArticleReadV2(user.userId, article.news_id, mbtiForV2);
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

  // 원본 기사 (MBTI 버전 없을 때) — `originalSentences` is computed at
  // component scope (above) so handleArchive can read from it.
  if (!version) {
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
