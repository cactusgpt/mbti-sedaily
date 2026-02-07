import { useState, useEffect } from "react";
import { StoryNewsFeed } from "@/components/story/StoryNewsFeed";
import { FeedPage } from "@/components/mbti/FeedPage";
import { MbtiChatBot } from "@/components/mbti/MbtiChatBot";
import { OnboardingPage } from "@/components/mbti/OnboardingPage";
import type { MbtiGroupId } from "@/data/mbtiGroups";

type ViewMode = "story" | "feed" | "editor-select";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("feed"); // 기본값: 피드 모드 (메인)
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [userGroup, setUserGroup] = useState<MbtiGroupId>("SF");

  // 저장된 설정 확인
  useEffect(() => {
    const savedInterests = localStorage.getItem("user-interests");
    const savedGroup = localStorage.getItem("mbti-group") as MbtiGroupId | null;

    if (savedInterests) {
      setUserInterests(JSON.parse(savedInterests));
    }

    if (savedGroup) {
      setUserGroup(savedGroup);
    }
  }, []);

  // 관심사 선택 핸들러
  const handleInterestSelect = (interests: string[]) => {
    setUserInterests(interests);
    localStorage.setItem("user-interests", JSON.stringify(interests));

    // 관심사 기반으로 MBTI 그룹 추천 (간단한 로직)
    // 경제/금융 → NT (분석적), 생활/건강 → SF (따뜻한), 세상 이야기 → NF (인사이트), 문화 → SF
    if (interests.includes("economy")) {
      setUserGroup("NT");
      localStorage.setItem("mbti-group", "NT");
    } else if (interests.includes("world")) {
      setUserGroup("NF");
      localStorage.setItem("mbti-group", "NF");
    }
  };

  // 오디오 경험 핸들러
  const handleAudioTry = () => {
    // TODO: TTS 재생 기능 구현
    console.log("Audio experience triggered");
  };

  // 공유 핸들러
  const handleShare = () => {
    console.log("Share to parents triggered");
  };

  // 스토리 모드에서 피드 모드로 전환 (목록으로)
  const handleSwitchToFeed = () => {
    setViewMode("feed");
  };

  // 스토리 모드로 전환 (뉴스 여정)
  const handleSwitchToStory = () => {
    setViewMode("story");
  };

  // MBTI 그룹 변경 - 에디터 선택 페이지로 이동
  const handleChangeGroup = () => {
    setViewMode("editor-select");
  };

  // 에디터 그룹 선택 완료
  const handleSelectGroup = (group: MbtiGroupId) => {
    setUserGroup(group);
    localStorage.setItem("mbti-group", group);
    setViewMode("feed"); // 선택 후 피드로 돌아가기
  };

  const handleMbtiChange = (group: MbtiGroupId) => {
    localStorage.setItem("mbti-group", group);
    setUserGroup(group);
  };

  // 에디터 선택 모드
  if (viewMode === "editor-select") {
    return (
      <OnboardingPage
        onSelectGroup={handleSelectGroup}
        onBack={handleSwitchToFeed}
      />
    );
  }

  // 스토리 모드 (뉴스 여정 - 고양이 캐릭터와 함께)
  if (viewMode === "story") {
    return (
      <StoryNewsFeed
        onInterestSelect={handleInterestSelect}
        onAudioTry={handleAudioTry}
        onShare={handleShare}
        onSwitchToFeed={handleSwitchToFeed}
      />
    );
  }

  // 피드 모드 (기존 카테고리 피드) - 기본 화면
  return (
    <>
      <FeedPage
        selectedGroup={userGroup}
        onChangeGroup={handleChangeGroup}
      />
      <MbtiChatBot
        mbtiGroup={userGroup}
        onMbtiChange={handleMbtiChange}
      />

      {/* 뉴스 여정 탐색하기 버튼 */}
      <button
        onClick={handleSwitchToStory}
        className="fixed bottom-24 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-400 to-amber-500 text-white rounded-full shadow-lg font-medium hover:opacity-90 transition-all animate-pulse hover:animate-none"
      >
        <span className="text-lg">🐱</span>
        <span>뉴스 여정</span>
      </button>
    </>
  );
}
