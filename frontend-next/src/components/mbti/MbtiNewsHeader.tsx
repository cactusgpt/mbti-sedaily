import { useState, useEffect } from "react";
import Link from "next/link";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { mbtiGroups } from "@/data/mbtiGroups";

interface Props {
  selectedGroup: MbtiGroupId;
  onSelectGroup: (group: MbtiGroupId) => void;
}

const groupTabs: { id: MbtiGroupId; label: string; activeColor: string }[] = [
  { id: "NT", label: "NT 전략형", activeColor: "border-blue-500 text-blue-600" },
  { id: "NF", label: "NF 가치형", activeColor: "border-violet-500 text-violet-600" },
  { id: "ST", label: "ST 실용형", activeColor: "border-green-500 text-green-600" },
  { id: "SF", label: "SF 공감형", activeColor: "border-orange-500 text-orange-600" },
];

const categories = ["경제", "정치", "사회", "세계", "AI/테크", "문화", "스포츠"];

export function MbtiNewsHeader({ selectedGroup, onSelectGroup }: Props) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* 메인 헤더 */}
      <header className="bg-white border-b border-gray-200">
        {/* 상단 바 */}
        <div className="max-w-[1080px] mx-auto px-5">
          <div className="flex items-center justify-between py-2 text-[11px] text-gray-400">
            <span>서울경제신문 · MBTI 맞춤 뉴스</span>
            <a
              href="https://www.sedaily.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 transition-colors"
            >
              서울경제 홈 →
            </a>
          </div>
        </div>

        {/* 로고 */}
        <div className="max-w-[1080px] mx-auto px-5 py-4 md:py-5">
          <Link href="/" className="block text-center">
            <span
              className="text-[36px] md:text-[44px] font-black text-gray-900 tracking-tight"
              style={{ fontFamily: "Seoul1960, 'Noto Sans KR', sans-serif" }}
            >
              K-Stock Insight
            </span>
          </Link>
        </div>

        {/* 카테고리 탭 (뉴닉 스타일) */}
        <div className="border-t border-gray-100">
          <nav className="max-w-[1080px] mx-auto px-5">
            <div className="flex items-center justify-center gap-0 overflow-x-auto scrollbar-hide">
              {groupTabs.map((tab) => {
                const isActive = selectedGroup === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelectGroup(tab.id)}
                    className={`px-5 py-3 text-[14px] font-semibold whitespace-nowrap border-b-[3px] transition-all ${
                      isActive
                        ? tab.activeColor
                        : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
              <div className="w-px h-5 bg-gray-200 mx-2" />
              {categories.map((cat) => (
                <button
                  key={cat}
                  className="px-3 py-3 text-[13px] text-gray-400 whitespace-nowrap hover:text-gray-600 transition-colors border-b-[3px] border-transparent"
                >
                  {cat}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* 스크롤 시 고정 헤더 */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 transition-all duration-200 ${
          isScrolled ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-[1080px] mx-auto px-5">
          <div className="flex items-center h-12 gap-4">
            <Link
             	href="/"
              className="font-black text-[20px] text-gray-900 shrink-0"
              style={{ fontFamily: "Seoul1960, sans-serif" }}
            >
              K-Stock Insight
            </Link>
            <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide ml-auto">
              {groupTabs.map((tab) => {
                const isActive = selectedGroup === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelectGroup(tab.id)}
                    className={`px-3 py-1.5 text-[12px] font-semibold rounded-full transition-all ${
                      isActive
                        ? `${mbtiGroups[tab.id].bgClass} text-white`
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
