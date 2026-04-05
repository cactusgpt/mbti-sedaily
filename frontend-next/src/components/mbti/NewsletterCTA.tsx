

import { useState } from "react";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { mbtiGroupList, mbtiGroups } from "@/data/mbtiGroups";

interface Props {
  selectedGroup: MbtiGroupId | null;
  onSelectGroup: (group: MbtiGroupId) => void;
}

export function NewsletterCTA({ selectedGroup, onSelectGroup }: Props) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !selectedGroup) return;
    setSubmitted(true);
  };

  return (
    <section className="py-16 md:py-20 bg-[var(--color-bg)]">
      <div className="max-w-xl mx-auto px-gutter">
        <div className="rounded-xl bg-[var(--color-primary)] p-8 md:p-12 text-center">
          {!submitted ? (
            <>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>
                나에게 맞는 경제 뉴스
              </h2>
              <p className="text-gray-400 text-sm mb-8">
                매주 당신의 MBTI 스타일로 큐레이션된 뉴스레터를 받아보세요
              </p>

              {/* 그룹 선택 */}
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {mbtiGroupList.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => onSelectGroup(group.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer border ${
                      selectedGroup === group.id
                        ? `${group.bgClass} text-white border-transparent`
                        : "bg-transparent text-gray-400 border-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {group.icon} {group.label}
                  </button>
                ))}
              </div>

              {/* 이메일 폼 */}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="email"
                  placeholder="이메일을 입력하세요"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-500 border border-white/20 focus:outline-none focus:border-white/40 text-sm"
                />
                <button
                  type="submit"
                  disabled={!email || !selectedGroup}
                  className={`px-6 py-3 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                    email && selectedGroup
                      ? "bg-white text-[var(--color-primary)] hover:bg-gray-100"
                      : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  구독하기
                </button>
              </form>
            </>
          ) : (
            <div className="py-8">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-white mb-2">구독 신청 완료!</h3>
              <p className="text-gray-400 text-sm mb-1">
                <span className="text-white font-medium">{email}</span>으로
              </p>
              <p className="text-gray-400 text-sm">
                {selectedGroup && (
                  <span className="text-white font-medium">
                    {mbtiGroups[selectedGroup].label}
                  </span>
                )}{" "}
                스타일 뉴스레터를 보내드릴게요.
              </p>
              <p className="text-xs text-gray-600 mt-4">
                * 베타 서비스 준비 중입니다. 곧 만나요!
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
