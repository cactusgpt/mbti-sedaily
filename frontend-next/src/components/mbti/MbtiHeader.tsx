import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

export function MbtiHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 100);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* 데스크톱: 서울경제 스타일 헤더 */}
      <div className="hidden md:block bg-[var(--color-bg)]">
        <div className="max-w-container mx-auto px-gutter pt-3 pb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] text-[var(--color-text-muted)] tracking-wide" style={{ fontFamily: '"Noto Sans", sans-serif' }}>
              서울경제신문 · MBTI 맞춤 경제 뉴스
            </span>
            <a
              href="https://www.sedaily.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              style={{ fontFamily: '"Noto Sans KR", sans-serif' }}
            >
              서울경제 홈 →
            </a>
          </div>
          <Link
           	href="/"
            className="font-serif font-normal tracking-normal text-[var(--color-text)] block text-center no-hover"
            style={{ fontFamily: "Seoul1960, sans-serif", fontSize: "50px" }}
          >
            <span style={{ fontWeight: 900, WebkitTextStroke: "0.3px currentColor", letterSpacing: "-0.02em" }}>
              K-Stock Insight
            </span>
            <div
              className="text-sm"
              style={{
                fontFamily: "Seoul1960, sans-serif",
                fontWeight: 900,
                fontSize: "20px",
                letterSpacing: "0",
                marginTop: "-22px",
                WebkitTextStroke: "0.3px currentColor",
              }}
            >
              Your MBTI, Your News Style
            </div>
          </Link>
        </div>
        <div className="border-b border-black">
          <div className="max-w-container mx-auto px-gutter py-2">
            <div className="flex justify-center gap-3">
              {[
                { label: "NT 전략형", color: "bg-blue-100 text-blue-700" },
                { label: "NF 가치형", color: "bg-violet-100 text-violet-700" },
                { label: "ST 실용형", color: "bg-green-100 text-green-700" },
                { label: "SF 공감형", color: "bg-orange-100 text-orange-700" },
              ].map((g) => (
                <a
                  key={g.label}
                  href="#mbti-select"
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${g.color} hover:opacity-80 transition-opacity`}
                >
                  {g.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 모바일: 컴팩트 헤더 */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-black">
        <div className="max-w-container mx-auto px-gutter py-2">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-[var(--color-text)] no-underline">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <span
                className="font-bold text-lg"
                style={{ fontFamily: "Seoul1960, sans-serif", letterSpacing: "-0.02em" }}
              >
                K-Stock Insight
              </span>
            </Link>
            <span className="text-[10px] text-[var(--color-text-muted)]">서울경제</span>
          </div>
        </div>
      </div>

      {/* 스크롤 시 나타나는 고정 헤더 (데스크톱) */}
      <div
        className={`hidden md:block fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-black transition-all duration-300 ${
          isScrolled ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        <div className="max-w-container mx-auto px-gutter h-14">
          <div className="flex items-center justify-between h-full">
            <Link
             	href="/"
              className="font-serif text-[var(--color-text)] no-hover"
              style={{ fontFamily: "Seoul1960, sans-serif", fontSize: "28px" }}
            >
              <span style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>K-Stock Insight</span>
            </Link>
            <div className="flex gap-2">
              {[
                { label: "NT", color: "bg-blue-500" },
                { label: "NF", color: "bg-violet-500" },
                { label: "ST", color: "bg-green-500" },
                { label: "SF", color: "bg-orange-500" },
              ].map((g) => (
                <a
                  key={g.label}
                  href="#mbti-select"
                  className={`w-6 h-6 rounded-full ${g.color} flex items-center justify-center text-white text-[8px] font-bold hover:scale-110 transition-transform`}
                >
                  {g.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 여백 */}
      <div className="md:hidden h-12"></div>
    </>
  );
}
