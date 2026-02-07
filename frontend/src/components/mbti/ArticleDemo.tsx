

import type { MbtiGroupId } from "@/data/mbtiGroups";
import { mbtiGroups } from "@/data/mbtiGroups";
import { sampleArticle } from "@/data/sampleArticles";

interface Props {
  selectedGroup: MbtiGroupId | null;
}

export function ArticleDemo({ selectedGroup }: Props) {
  if (!selectedGroup) return null;

  const version = sampleArticle.versions[selectedGroup];
  const group = mbtiGroups[selectedGroup];

  return (
    <section id="article-demo" className="py-16 md:py-20 bg-[var(--color-bg)]">
      <div className="max-w-3xl mx-auto px-gutter">
        {/* 원본 기사 정보 */}
        <div className="text-center mb-10">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">원본 기사</p>
          <h2 className="text-lg md:text-xl font-bold text-[var(--color-text)] mb-1">
            {sampleArticle.originalTitle}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {sampleArticle.source} · {sampleArticle.date} · {sampleArticle.category}
          </p>
          <div className="mt-4 inline-block px-4 py-1.5 rounded-full bg-[var(--color-bg-subtle)] text-sm text-[var(--color-text-light)] border border-[var(--color-border)]">
            ↓ 아래는 같은 기사를 <strong>당신의 스타일</strong>로 바꾼 버전입니다
          </div>
        </div>

        {/* 변환된 기사 */}
        <article className={`rounded-xl border-2 ${group.borderClass} overflow-hidden`}>
          {/* 그룹 헤더 */}
          <div className={`${group.bgClass} px-6 py-3 flex items-center gap-2`}>
            <span className="text-white text-lg">{group.icon}</span>
            <span className="text-white font-bold text-sm">{group.label}</span>
            <span className="text-white/70 text-xs ml-auto">{group.style}</span>
          </div>

          <div className="p-6 md:p-8 bg-white">
            {/* 제목 */}
            <h3
              className={`text-xl md:text-2xl font-bold leading-tight mb-2 ${
                version.groupId === "NF" ? "italic" : ""
              }`}
              style={{ fontFamily: '"Noto Sans KR", sans-serif' }}
            >
              {version.title}
            </h3>
            <p className="text-sm text-[var(--color-text-light)] mb-6 border-b border-[var(--color-border-light)] pb-4">
              {version.subtitle}
            </p>

            {/* 본문 */}
            <div className="space-y-4 mb-6">
              {version.body.map((paragraph, i) => (
                <p
                  key={i}
                  className={`text-base leading-relaxed text-[var(--color-text)] ${
                    version.groupId === "SF" ? "leading-loose" : ""
                  }`}
                  style={{ fontFamily: '"Noto Sans KR", sans-serif' }}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {/* 핵심 포인트 */}
            <div className={`rounded-lg p-5 ${group.bgLightClass} border ${group.borderClass}`}>
              <p className={`text-xs font-bold mb-3 ${group.textClass}`}>
                {version.groupId === "NT" && "📌 Key Metrics"}
                {version.groupId === "NF" && "💭 핵심 메시지"}
                {version.groupId === "ST" && "📋 팩트 요약"}
                {version.groupId === "SF" && "💬 한줄 요약"}
              </p>
              <ul className="space-y-2">
                {version.keyPoints.map((point, i) => (
                  <li key={i} className="text-sm text-[var(--color-text)]">
                    <span className={`font-medium ${group.textClass}`}>
                      {version.groupId === "ST" ? `${i + 1}. ` : "• "}
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* 마무리 */}
            <p
              className={`mt-5 text-sm font-medium ${group.textClass} ${
                version.groupId === "NF" ? "italic" : ""
              }`}
            >
              {version.closingLine}
            </p>
          </div>
        </article>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          ✓ 팩트 100% 동일 · 어조와 구조만 다릅니다 ·{" "}
          <span className={`font-medium ${group.textClass}`}>{version.tone}</span>
        </p>
      </div>
    </section>
  );
}
