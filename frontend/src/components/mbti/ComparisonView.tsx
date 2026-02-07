

import { useState } from "react";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { mbtiGroupList, mbtiGroups } from "@/data/mbtiGroups";
import { sampleArticle } from "@/data/sampleArticles";

interface Props {
  selectedGroup: MbtiGroupId | null;
}

export function ComparisonView({ selectedGroup }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!selectedGroup) return null;

  return (
    <section className="py-12 md:py-16 bg-[var(--color-bg-subtle)]">
      <div className="max-w-6xl mx-auto px-gutter">
        <div className="text-center mb-8">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity cursor-pointer"
          >
            {isOpen ? "비교 접기 ▲" : "4가지 스타일 비교하기 ▼"}
          </button>
        </div>

        {isOpen && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {mbtiGroupList.map((group) => {
                const version = sampleArticle.versions[group.id];
                const isHighlighted = selectedGroup === group.id;
                return (
                  <div
                    key={group.id}
                    className={`rounded-xl border-2 overflow-hidden bg-white transition-all ${
                      isHighlighted
                        ? `${group.borderClass} shadow-lg ring-2 ring-offset-2 ${group.textClass.replace("text-", "ring-")}`
                        : "border-[var(--color-border)]"
                    }`}
                  >
                    {/* 그룹 헤더 */}
                    <div className={`${group.bgClass} px-4 py-2 flex items-center gap-2`}>
                      <span className="text-white">{group.icon}</span>
                      <span className="text-white font-bold text-xs">{group.label}</span>
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-sm mb-2 text-[var(--color-text)] line-clamp-2">
                        {version.title}
                      </h4>
                      <p className="text-xs text-[var(--color-text-light)] mb-3 line-clamp-3">
                        {version.body[0]}
                      </p>
                      <div className={`rounded-lg p-3 ${group.bgLightClass}`}>
                        <ul className="space-y-1">
                          {version.keyPoints.slice(0, 2).map((point, i) => (
                            <li key={i} className="text-xs text-[var(--color-text)]">
                              • {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-2">{version.tone}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
              ✓ 팩트 100% 동일 | 제목·어조·구조·표현만 다름
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
