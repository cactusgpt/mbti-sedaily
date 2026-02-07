

import { useEffect } from "react";
import type { MbtiGroupId } from "@/data/mbtiGroups";

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
  original_link: string;
  versions: Record<string, MbtiVersion>;
}

interface Props {
  article: Article;
  currentGroup: MbtiGroupId;
  onClose: () => void;
}

const groupStyles: Record<MbtiGroupId, { label: string; color: string; bg: string; border: string }> = {
  NT: { label: "NT 분석형", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  NF: { label: "NF 가치형", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  ST: { label: "ST 팩트형", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  SF: { label: "SF 공감형", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
};

export function CompareModal({ article, currentGroup, onClose }: Props) {
  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const groups: MbtiGroupId[] = ["NT", "NF", "ST", "SF"];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-[900px] w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-[18px] font-bold text-gray-900">
            같은 뉴스, 네 가지 시선
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400"
          >
            ✕
          </button>
        </div>

        {/* Original title */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="text-[12px] text-gray-400 mb-1">원본 기사</p>
          <h3 className="text-[15px] font-medium text-gray-700">
            {article.title}
          </h3>
        </div>

        {/* 4 versions grid */}
        <div className="p-4 md:p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => {
              const style = groupStyles[group];
              const version = article.versions[group];
              if (!version) return null;

              const isCurrentGroup = group === currentGroup;

              return (
                <div
                  key={group}
                  className={`p-4 rounded-xl border-2 ${style.border} ${style.bg} ${
                    isCurrentGroup ? "ring-2 ring-offset-2 ring-gray-400" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[13px] font-bold ${style.color}`}>
                      {style.label}
                    </span>
                    {isCurrentGroup && (
                      <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                        현재 선택
                      </span>
                    )}
                  </div>
                  <h4 className="text-[15px] font-bold text-gray-900 leading-snug mb-2">
                    {version.title}
                  </h4>
                  <p className="text-[13px] text-gray-600 leading-relaxed line-clamp-4">
                    {version.body[0]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <a
            href={article.original_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            원문 보기 →
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white text-[13px] font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
