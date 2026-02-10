import { useState, useEffect } from "react";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { ArticleReactions } from "./ArticleReactions";
import { ArticlePodcast } from "./ArticlePodcast";
import { useAuth } from "@/contexts/AuthContext";
import { recordArticleRead } from "@/lib/userApi";
import { trackArticleRead } from "@/lib/readingTracker";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_URL } from "@/config/api";

interface MbtiVersion {
  title: string;
  subtitle: string;
  body: string | string[];
  key_points: string[];
  closing_line: string;
  tone: string;
}

// body를 문자열로 변환 (배열인 경우 합침)
function normalizeBody(body: string | string[]): string {
  if (Array.isArray(body)) {
    return body.join("\n\n");
  }
  return body;
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
  article: Article;
  currentGroup: MbtiGroupId;
  onClose: () => void;
  onChangeGroup: (group: MbtiGroupId) => void;
}

// 에디터 정보 (심플하게)
const editors: Record<MbtiGroupId, {
  name: string;
  mbti: string;
}> = {
  NT: { name: "시현", mbti: "NT" },
  NF: { name: "지원", mbti: "NF" },
  ST: { name: "정훈", mbti: "ST" },
  SF: { name: "하은", mbti: "SF" },
};

const groups: MbtiGroupId[] = ["NT", "NF", "ST", "SF"];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// AI 질문 생성
function generateQuestions(article: Article, group: MbtiGroupId): string[] {
  const baseQuestions = [
    `이 뉴스가 나한테 어떤 영향이 있을까?`,
    `앞으로 어떻게 될 것 같아?`,
  ];

  const groupQuestions: Record<MbtiGroupId, string[]> = {
    NT: [
      "이 데이터 신뢰할 수 있어?",
      "장기적으로 시장에 어떤 영향이 있을까?",
    ],
    NF: [
      "이게 사회적으로 어떤 의미가 있어?",
      "사람들 삶에 어떤 변화가 생길까?",
    ],
    ST: [
      "정확한 수치랑 출처 알려줘",
      "실제로 뭘 해야 해?",
    ],
    SF: [
      "좀 더 쉽게 설명해줄 수 있어?",
      "내 일상에는 어떤 영향이 있어?",
    ],
  };

  return [...baseQuestions, ...groupQuestions[group]];
}

export function ArticleView({ article: initialArticle, currentGroup, onClose, onChangeGroup }: Props) {
  const { user, isAuthenticated } = useAuth();
  const [article, setArticle] = useState<Article>(initialArticle);
  const [selectedVersion, setSelectedVersion] = useState<MbtiGroupId>(currentGroup);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [aiAnswers, setAiAnswers] = useState<Record<number, string>>({});
  const [loadingAnswer, setLoadingAnswer] = useState<number | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const version = article.versions?.[selectedVersion];
  const editor = editors[selectedVersion];
  const questions = generateQuestions(article, selectedVersion);

  // 선택된 MBTI 버전이 없으면 detail API 호출해서 전체 content 및 MBTI 버전 가져오기
  useEffect(() => {
    const currentVersion = article.versions?.[selectedVersion];
    console.log('[ArticleView] Check:', { news_id: article.news_id, currentVersion: !!currentVersion, isLoadingContent });

    // 선택된 버전이 없으면 API 호출
    if (!currentVersion && !isLoadingContent) {
      setIsLoadingContent(true);
      console.log('[ArticleView] Fetching article:', article.news_id);
      fetch(`${API_URL}/api/article/${article.news_id}`)
        .then((res) => res.json())
        .then((data) => {
          console.log('[ArticleView] API Response:', { content_ko_length: data.content_ko?.length, has_versions: !!data.version_NT?.body });
          setArticle((prev) => ({
            ...prev,
            // 전체 content 업데이트
            content: data.content_ko || prev.content,
            // MBTI 버전이 있으면 추가 (body가 있는 경우만)
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
        .catch((err) => console.error("[ArticleView] Failed to load full content:", err))
        .finally(() => setIsLoadingContent(false));
    }
  }, [article.news_id, selectedVersion]);

  // Record article read when component mounts
  useEffect(() => {
    // 로컬 트래킹 (로그인 없이도 동작)
    trackArticleRead(article.news_id);

    // 서버 트래킹 (로그인한 경우)
    if (isAuthenticated && user) {
      recordArticleRead(user.userId, article.news_id, version?.title || article.title);
    }
  }, [article.news_id, isAuthenticated, user]);

  // MBTI 버전이 없으면 원본 표시
  if (!version) {
    return (
      <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
        <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="max-w-[720px] mx-auto px-5">
            <div className="flex items-center justify-between h-14">
              <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-[14px]">
                ← 목록
              </button>
              <span className="text-[13px] text-gray-400">원본 기사</span>
              <a href={article.original_link} target="_blank" className="text-[13px] text-gray-400 hover:text-gray-600">
                원문
              </a>
            </div>
          </div>
        </header>
        <article className="max-w-[720px] mx-auto px-5 py-8">
          <p className="text-[12px] text-gray-400 mb-3">{article.category} · {formatDate(article.published_at)}</p>
          <h1 className="text-[24px] font-bold text-gray-900 mb-4">{article.title}</h1>
          {article.sub_title && <p className="text-[16px] text-gray-500 mb-6">{article.sub_title}</p>}

          {/* Meta */}
          <div className="flex items-center gap-3 text-[12px] text-gray-400 mb-8 pb-6 border-b border-gray-200">
            <span>{article.byline || '서울경제'}</span>
          </div>

          {/* Podcast Player - 원본 기사용 */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-medium text-gray-700">음성으로 듣기</span>
              <span className="text-[11px] text-gray-400">TTS</span>
            </div>
            <ArticlePodcast
              articleTitle={article.title}
              articleBody={article.content || ''}
              mbtiGroup={selectedVersion}
            />
          </div>

          {article.image_url && <img src={article.image_url} alt="" className="w-full rounded-lg mb-6" />}
          <p className="text-[16px] text-gray-800 leading-[1.9] whitespace-pre-line mb-10">{article.content}</p>

          {/* AI 질문 섹션 - 원본 기사용 */}
          <div className="mb-10 pb-8 border-b border-gray-200">
            <h3 className="text-[15px] font-semibold text-gray-900 mb-4">
              더 알아보기
            </h3>

            <div className="space-y-2">
              {questions.map((question, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => handleQuestionClick(idx)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-[14px] text-gray-700">{question}</span>
                    <span className="text-gray-400 text-[12px]">
                      {expandedQuestion === idx ? "−" : "+"}
                    </span>
                  </button>

                  {expandedQuestion === idx && (
                    <div className="px-4 py-4 bg-gray-50 border-t border-gray-100">
                      {loadingAnswer === idx ? (
                        <div className="text-[13px] text-gray-500">
                          답변 생성 중...
                        </div>
                      ) : (
                        <div className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {aiAnswers[idx]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] text-gray-400">
              AI가 생성한 답변입니다
            </p>
          </div>

          {/* 반응 섹션 - 원본 기사용 */}
          <ArticleReactions articleId={article.news_id} mbtiGroup={selectedVersion} />

          {/* Original Article Info */}
          <div className="pt-8 mt-8 border-t border-gray-200">
            <a
              href={article.original_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
            >
              원문 보기 →
            </a>
          </div>
        </article>

        {/* Bottom Navigation */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200">
          <div className="max-w-[720px] mx-auto px-5 py-3">
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="text-gray-500 text-[14px] hover:text-gray-900 transition-colors"
              >
                ← 목록
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle AI question click
  const handleQuestionClick = async (index: number) => {
    if (expandedQuestion === index) {
      setExpandedQuestion(null);
      return;
    }

    setExpandedQuestion(index);

    if (aiAnswers[index]) return;

    setLoadingAnswer(index);

    try {
      const response = await fetch("https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `다음 기사에 대한 질문입니다: "${article.title}"\n\n질문: ${questions[index]}`,
          mbti_group: selectedVersion,
          conversation_history: [],
        }),
      });

      const data = await response.json();
      setAiAnswers((prev) => ({ ...prev, [index]: data.response }));
    } catch (error) {
      setAiAnswers((prev) => ({
        ...prev,
        [index]: "오류가 발생했습니다. 다시 시도해주세요.",
      }));
    } finally {
      setLoadingAnswer(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-[720px] mx-auto px-5">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-900 transition-colors text-[14px]"
            >
              ← 목록
            </button>
            <span className="text-[13px] text-gray-500 flex items-center gap-1.5">
              {editor.name}
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">{editor.mbti}</span>
              의 시선
            </span>
            <a
              href={article.original_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              원문
            </a>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <article className="max-w-[720px] mx-auto px-5 py-8">
        {/* Category & Date */}
        <p className="text-[12px] text-gray-400 mb-3">
          {article.category} · {formatDate(article.published_at)}
        </p>

        {/* Title */}
        <h1 className="text-[24px] md:text-[28px] font-bold text-gray-900 leading-tight mb-4">
          {version.title}
        </h1>

        {/* Subtitle */}
        {version.subtitle && (
          <p className="text-[16px] text-gray-500 leading-relaxed mb-6">
            {version.subtitle}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-[12px] text-gray-400 mb-8 pb-6 border-b border-gray-200">
          <span>{article.byline || editor.name}</span>
        </div>

        {/* Version Selector - 심플하게 텍스트로 */}
        <div className="flex items-center gap-4 mb-8 text-[13px]">
          <span className="text-gray-400">다른 시선</span>
          <div className="flex gap-4">
            {groups.map((group) => {
              const ed = editors[group];
              const isSelected = selectedVersion === group;
              return (
                <button
                  key={group}
                  onClick={() => setSelectedVersion(group)}
                  className={`flex items-center gap-1 transition-colors ${
                    isSelected
                      ? "text-gray-900 font-semibold"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <span className={isSelected ? "underline underline-offset-4" : ""}>{ed.name}</span>
                  <span className={`text-[9px] px-1 py-0.5 rounded ${
                    isSelected ? "bg-gray-200 text-gray-600" : "bg-gray-100 text-gray-400"
                  }`}>{ed.mbti}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Podcast Player - 심플하게 */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-medium text-gray-700">음성으로 듣기</span>
            <span className="text-[11px] text-gray-400">TTS</span>
          </div>
          <ArticlePodcast
            articleTitle={version.title}
            articleBody={version.body}
            mbtiGroup={selectedVersion}
          />
        </div>

        {/* Image */}
        {article.image_url && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img src={article.image_url} alt="" className="w-full h-auto" />
          </div>
        )}

        {/* Body - Markdown 렌더링 */}
        <div className="prose prose-gray max-w-none mb-10
          prose-p:text-[16px] prose-p:text-gray-800 prose-p:leading-[1.9] prose-p:mb-5
          prose-strong:font-bold prose-strong:text-gray-900
          prose-h2:text-[18px] prose-h2:font-semibold prose-h2:text-gray-900 prose-h2:mt-8 prose-h2:mb-4
          prose-h3:text-[16px] prose-h3:font-semibold prose-h3:text-gray-800 prose-h3:mt-6 prose-h3:mb-3
          prose-ul:my-4 prose-ul:pl-5 prose-li:text-[15px] prose-li:text-gray-700 prose-li:mb-2
          prose-table:w-full prose-table:my-6 prose-table:border-collapse
          prose-th:bg-gray-100 prose-th:text-[14px] prose-th:font-semibold prose-th:text-gray-700 prose-th:p-3 prose-th:border prose-th:border-gray-200 prose-th:text-left
          prose-td:text-[14px] prose-td:text-gray-700 prose-td:p-3 prose-td:border prose-td:border-gray-200
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {normalizeBody(version.body)}
          </ReactMarkdown>
        </div>

        {/* Key Points - 심플한 박스 */}
        {version.key_points && version.key_points.length > 0 && (
          <div className="p-5 border border-gray-200 rounded-lg mb-10">
            <h3 className="text-[14px] font-semibold text-gray-900 mb-3">
              핵심 정리
            </h3>
            <ul className="space-y-2">
              {version.key_points.map((point, idx) => (
                <li key={idx} className="text-[14px] text-gray-700 leading-relaxed flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Closing Line */}
        {version.closing_line && (
          <p className="text-[15px] text-gray-600 italic mb-10 pb-8 border-b border-gray-200">
            {version.closing_line}
          </p>
        )}

        {/* ===== AI 질문 섹션 - 심플하게 ===== */}
        <div className="mb-10 pb-8 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold text-gray-900 mb-4">
            더 알아보기
          </h3>

          <div className="space-y-2">
            {questions.map((question, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => handleQuestionClick(idx)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-[14px] text-gray-700">{question}</span>
                  <span className="text-gray-400 text-[12px]">
                    {expandedQuestion === idx ? "−" : "+"}
                  </span>
                </button>

                {expandedQuestion === idx && (
                  <div className="px-4 py-4 bg-gray-50 border-t border-gray-100">
                    {loadingAnswer === idx ? (
                      <div className="text-[13px] text-gray-500">
                        답변 생성 중...
                      </div>
                    ) : (
                      <div className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {aiAnswers[idx]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-gray-400">
            AI가 생성한 답변입니다
          </p>
        </div>

        {/* ===== 반응 섹션 ===== */}
        <ArticleReactions articleId={article.news_id} mbtiGroup={selectedVersion} />

        {/* Original Article Info */}
        <div className="pt-8 mt-8 border-t border-gray-200">
          <p className="text-[12px] text-gray-400 mb-2">원문</p>
          <p className="text-[14px] text-gray-600 mb-4 line-clamp-2">{article.title}</p>
          <a
            href={article.original_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            원문 보기 →
          </a>
        </div>
      </article>

      {/* Bottom Navigation - 심플하게 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200">
        <div className="max-w-[720px] mx-auto px-5 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-gray-500 text-[14px] hover:text-gray-900 transition-colors"
            >
              ← 목록
            </button>
            <div className="flex items-center gap-4 text-[13px]">
              {groups.filter(g => g !== selectedVersion).map((group) => (
                <button
                  key={group}
                  onClick={() => setSelectedVersion(group)}
                  className="flex items-center gap-1 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {editors[group].name}
                  <span className="text-[9px] px-1 py-0.5 bg-gray-100 rounded">{editors[group].mbti}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
