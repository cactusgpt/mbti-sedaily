

import { useState, useEffect } from "react";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { API_URL } from "@/config/api";

interface MbtiVersion {
  title: string;
  subtitle: string;
  body: string | string[];
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
    // 건너뛸 패턴들
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
  published_at: string;
  category: string;
  image_url: string | null;
  versions: Record<string, MbtiVersion>;
}

// 에디터 정보
const editors = [
  {
    id: "NT" as MbtiGroupId,
    name: "시현",
    mbti: "INTJ",
    role: "분석 에디터",
    desc: "데이터 중심으로 핵심만 짚어드립니다",
    traits: ["전략적 사고", "효율 중시", "본질 파악"],
  },
  {
    id: "NF" as MbtiGroupId,
    name: "지원",
    mbti: "INFP",
    role: "인사이트 에디터",
    desc: "맥락과 의미를 깊이 있게 전합니다",
    traits: ["깊은 통찰", "가치 중심", "큰 그림"],
  },
  {
    id: "ST" as MbtiGroupId,
    name: "정훈",
    mbti: "ISTJ",
    role: "팩트 에디터",
    desc: "사실 위주로 군더더기 없이 정리합니다",
    traits: ["정확한 팩트", "실용적", "신뢰 우선"],
  },
  {
    id: "SF" as MbtiGroupId,
    name: "하은",
    mbti: "ESFP",
    role: "스토리 에디터",
    desc: "쉽고 친근하게 풀어서 전합니다",
    traits: ["쉬운 설명", "공감 중심", "재미있게"],
  },
];

interface Props {
  onSelectGroup: (group: MbtiGroupId) => void;
  onBack?: () => void;
}

export function OnboardingPage({ onSelectGroup, onBack }: Props) {
  const [featuredArticle, setFeaturedArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEditor, setSelectedEditor] = useState<MbtiGroupId | null>(null);
  const [hoveredEditor, setHoveredEditor] = useState<MbtiGroupId | null>(null);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await fetch(`${API_URL}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "*",
            filters: {
              published_from: new Date().toISOString().slice(0, 10),
              published_until: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
              categories: ["경제"],
            },
            page: 1,
            page_size: 10,
          }),
        });
        const data = await res.json();
        const withVersions = (data.articles || []).filter(
          (a: Article) => a.versions && Object.keys(a.versions).length === 4
        );
        if (withVersions.length > 0) {
          setFeaturedArticle(withVersions[0]);
        }
      } catch (e) {
        console.error("Failed to fetch:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchFeatured();
  }, []);

  const handleSelect = (group: MbtiGroupId) => {
    setSelectedEditor(group);
  };

  const handleStart = () => {
    if (selectedEditor) {
      localStorage.setItem("mbti-group", selectedEditor);
      onSelectGroup(selectedEditor);
    }
  };

  const activeEditor = hoveredEditor || selectedEditor || "SF";
  const currentEditor = editors.find(e => e.id === activeEditor)!;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-[900px] mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-[18px] font-bold text-gray-900">K-Stock Insight</h1>
            <span className="text-[12px] text-gray-400">서울경제</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[900px] mx-auto px-6 py-12 md:py-20">
        {/* Hero Text */}
        <div className="text-center mb-12">
          <h2 className="text-[26px] md:text-[32px] font-bold text-gray-900 mb-3">
            나에게 맞는 에디터 선택하기
          </h2>
          <p className="text-[15px] text-gray-500">
            같은 뉴스도 시선에 따라 다르게 읽힙니다
          </p>
        </div>

        {/* Editor Selection - 심플한 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {editors.map((editor) => {
            const isActive = activeEditor === editor.id;
            const isSelected = selectedEditor === editor.id;
            return (
              <button
                key={editor.id}
                onClick={() => handleSelect(editor.id)}
                onMouseEnter={() => setHoveredEditor(editor.id)}
                onMouseLeave={() => setHoveredEditor(null)}
                className={`relative p-5 text-left border rounded-lg transition-all ${
                  isActive
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-200 hover:border-gray-400"
                } ${isSelected ? "ring-2 ring-gray-900" : ""}`}
              >
                {/* 이름 + MBTI */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[17px] font-semibold ${isActive ? "text-gray-900" : "text-gray-700"}`}>
                    {editor.name}
                  </span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${isActive ? "bg-gray-200 text-gray-600" : "bg-gray-100 text-gray-400"}`}>
                    {editor.mbti}
                  </span>
                </div>

                {/* 역할 */}
                <div className="text-[12px] text-gray-400 mb-2">
                  {editor.role}
                </div>

                {/* 설명 */}
                <div className={`text-[13px] leading-relaxed mb-3 ${isActive ? "text-gray-600" : "text-gray-400"}`}>
                  {editor.desc}
                </div>

                {/* 특징 태그 */}
                <div className="flex flex-wrap gap-1">
                  {editor.traits.map((trait, idx) => (
                    <span
                      key={idx}
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        isActive ? "bg-gray-200 text-gray-600" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {trait}
                    </span>
                  ))}
                </div>

                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px]">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Preview Section - 심플하게 */}
        {loading ? (
          <div className="border border-gray-200 rounded-lg p-8 animate-pulse">
            <div className="h-5 bg-gray-100 rounded w-1/4 mb-6" />
            <div className="grid md:grid-cols-2 gap-8">
              <div className="h-[200px] bg-gray-100 rounded-lg" />
              <div className="space-y-4">
                <div className="h-6 bg-gray-100 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-full" />
              </div>
            </div>
          </div>
        ) : featuredArticle ? (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Preview Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-[14px] font-semibold text-gray-900">
                  {currentEditor.name}
                </span>
                <span className="text-[13px] text-gray-400 ml-2">
                  {currentEditor.role}
                </span>
              </div>
              <span className="text-[12px] text-gray-400">미리보기</span>
            </div>

            {/* Preview Content */}
            <div className="p-6 md:p-8">
              <div className="grid md:grid-cols-2 gap-6 items-start">
                {featuredArticle.image_url && (
                  <div className="rounded-lg overflow-hidden">
                    <img
                      src={featuredArticle.image_url}
                      alt=""
                      className="w-full h-[180px] md:h-[220px] object-cover"
                    />
                  </div>
                )}

                <div>
                  <p className="text-[12px] text-gray-400 mb-2">
                    오늘 · {featuredArticle.category}
                  </p>
                  <h3 className="text-[18px] md:text-[20px] font-bold text-gray-900 leading-snug mb-3">
                    {featuredArticle.versions[activeEditor]?.title}
                  </h3>
                  <p className="text-[14px] text-gray-600 leading-relaxed line-clamp-4">
                    {featuredArticle.versions[activeEditor]?.body ? getBodyText(featuredArticle.versions[activeEditor].body) : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <p className="text-[13px] text-gray-500">
                {selectedEditor ? `${currentEditor.name}의 뉴스가 궁금하다면?` : "에디터를 선택해주세요"}
              </p>
              <button
                onClick={handleStart}
                disabled={!selectedEditor}
                className="px-5 py-2 bg-gray-900 text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                시작하기
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            뉴스를 준비 중입니다
          </div>
        )}

        {/* Bottom hint */}
        <p className="text-center text-[12px] text-gray-400 mt-8">
          언제든 에디터를 변경할 수 있습니다
        </p>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[11px] text-gray-400 border-t border-gray-200">
        © 서울경제신문
      </footer>
    </div>
  );
}
