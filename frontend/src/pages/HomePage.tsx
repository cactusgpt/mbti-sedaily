import { useState, useEffect } from "react";
import { StoryNewsFeed } from "@/components/story/StoryNewsFeed";
import { FeedPage } from "@/components/mbti/FeedPage";
import { MbtiChatBot } from "@/components/mbti/MbtiChatBot";
import { OnboardingPage } from "@/components/mbti/OnboardingPage";
import { BriefingPage } from "@/components/mbti/BriefingPage";
import type { MbtiGroupId } from "@/data/mbtiGroups";

type ViewMode = "story" | "feed" | "editor-select" | "briefing";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("feed"); // 기본값: 피드 모드 (메인)
  const [userGroup, setUserGroup] = useState<MbtiGroupId>("SF");

  // 저장된 설정 확인
  useEffect(() => {
    const savedGroup = localStorage.getItem("mbti-group") as MbtiGroupId | null;
    if (savedGroup) {
      setUserGroup(savedGroup);
    }
  }, []);

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

  // 브리핑 시작 (에디터와 대화하기)
  const handleStartBriefing = (group: MbtiGroupId) => {
    setUserGroup(group);
    localStorage.setItem("mbti-group", group);
    setViewMode("briefing");
  };

  // 브리핑 완료
  const handleFinishBriefing = () => {
    setViewMode("feed");
  };

  const handleMbtiChange = (group: MbtiGroupId) => {
    localStorage.setItem("mbti-group", group);
    setUserGroup(group);
  };

  // 브리핑 모드 (에디터와 대화하기)
  if (viewMode === "briefing") {
    return (
      <BriefingPage
        groupId={userGroup}
        onFinish={handleFinishBriefing}
        onBack={handleChangeGroup}
      />
    );
  }

  // 에디터 선택 모드
  if (viewMode === "editor-select") {
    return (
      <OnboardingPage
        onSelectGroup={handleSelectGroup}
        onStartBriefing={handleStartBriefing}
        onBack={handleSwitchToFeed}
      />
    );
  }

  // 스토리 모드 (뉴스 여정 - 고양이 캐릭터와 함께)
  if (viewMode === "story") {
    return (
      <StoryNewsFeed
        onComplete={(preferences) => {
          // 좋아요한 카테고리 기반으로 MBTI 그룹 추천
          if (preferences.categories.includes("경제") || preferences.categories.includes("IT_과학")) {
            setUserGroup("NT");
            localStorage.setItem("mbti-group", "NT");
          } else if (preferences.categories.includes("국제") || preferences.categories.includes("정치")) {
            setUserGroup("NF");
            localStorage.setItem("mbti-group", "NF");
          } else if (preferences.categories.includes("산업")) {
            setUserGroup("ST");
            localStorage.setItem("mbti-group", "ST");
          }
          setViewMode("feed");
        }}
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
        onSwitchToStory={handleSwitchToStory}
        onMbtiChange={handleMbtiChange}
      />
      <MbtiChatBot
        mbtiGroup={userGroup}
        onMbtiChange={handleMbtiChange}
      />
    </>
  );
}
