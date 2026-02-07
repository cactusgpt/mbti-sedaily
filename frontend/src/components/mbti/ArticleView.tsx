

import { useState, useEffect } from "react";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { ArticleReactions } from "./ArticleReactions";
import { ArticlePodcast } from "./ArticlePodcast";
import { useAuth } from "@/contexts/AuthContext";
import { recordArticleRead } from "@/lib/userApi";

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

// body를 문단 배열로 변환
function parseBody(body: string | string[]): string[] {
  if (Array.isArray(body)) {
    return body.map(p => cleanMarkdown(p));
  }
  // 문자열인 경우 줄바꿈으로 문단 분리 후 마크다운 제거
  return body.split("\n\n").filter(p => p.trim()).map(p => cleanMarkdown(p));
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

export function ArticleView({ article, currentGroup, onClose, onChangeGroup }: Props) {
  const { user, isAuthenticated } = useAuth();
  const [selectedVersion, setSelectedVersion] = useState<MbtiGroupId>(currentGroup);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [aiAnswers, setAiAnswers] = useState<Record<number, string>>({});
  const [loadingAnswer, setLoadingAnswer] = useState<number | null>(null);

  const version = article.versions[selectedVersion];
  const editor = editors[selectedVersion];
  const questions = generateQuestions(article, selectedVersion);

  // Record article read when component mounts
  useEffect(() => {
    if (isAuthenticated && user) {
      recordArticleRead(user.userId, article.news_id, version?.title || article.title);
    }
  }, [article.news_id, isAuthenticated, user]);

  if (!version) return null;

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

        {/* Body */}
        <div className="space-y-5 mb-10">
          {parseBody(version.body).map((paragraph, idx) => (
            <p key={idx} className="text-[16px] text-gray-800 leading-[1.9]">
              {paragraph}
            </p>
          ))}
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
