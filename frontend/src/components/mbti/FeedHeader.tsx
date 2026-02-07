import { Link } from "react-router-dom";
import type { MbtiGroupId } from "@/data/mbtiGroups";

interface Props {
  selectedGroup: MbtiGroupId;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onChangeGroup: () => void;
}

const categories = ["전체", "경제", "정치", "사회", "세계", "AI/테크", "문화", "스포츠"];

const groupLabels: Record<MbtiGroupId, { label: string; color: string }> = {
  NT: { label: "NT 분석형", color: "bg-blue-500" },
  NF: { label: "NF 가치형", color: "bg-violet-500" },
  ST: { label: "ST 팩트형", color: "bg-green-500" },
  SF: { label: "SF 공감형", color: "bg-orange-500" },
};

export function FeedHeader({ selectedGroup, selectedCategory, onSelectCategory, onChangeGroup }: Props) {
  const group = groupLabels[selectedGroup];

  return (
    <header className="bg-white sticky top-0 z-50 border-b border-gray-200">
      {/* Top bar */}
      <div className="border-b border-gray-100">
        <div className="max-w-[1080px] mx-auto px-5">
          <div className="flex items-center justify-between py-2 text-[11px] text-gray-400">
            <span>서울경제신문 · MBTI 맞춤 뉴스</span>
            <a
              href="https://www.sedaily.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 transition-colors"
            >
              서울경제 홈
            </a>
          </div>
        </div>
      </div>

      {/* Logo + Type selector */}
      <div className="max-w-[1080px] mx-auto px-5">
        <div className="flex items-center justify-between py-4">
          <Link to="/" className="block">
            <span
              className="text-[28px] md:text-[32px] font-black text-gray-900"
              style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
            >
              K-Stock Insight
            </span>
          </Link>

          {/* MBTI Type indicator */}
          <button
            onClick={onChangeGroup}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${group.color} text-white text-[13px] font-medium hover:opacity-90 transition-opacity`}
          >
            <span>{group.label}</span>
            <span className="text-white/70">변경</span>
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="max-w-[1080px] mx-auto px-5">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mb-px">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`px-4 py-3 text-[14px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
