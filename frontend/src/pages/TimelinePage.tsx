import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { TimelineNewsFeed } from "@/components/timeline/TimelineNewsFeed";
import { MbtiChatBot } from "@/components/mbti/MbtiChatBot";

// useNavigate는 handleChangeGroup에서 사용

type AppState = "loading" | "onboarding" | "feed";

export default function TimelinePage() {
  const navigate = useNavigate();
  const [appState, setAppState] = useState<AppState>("loading");
  const [userGroup, setUserGroup] = useState<MbtiGroupId | null>(null);
  const [userTags, setUserTags] = useState<string[]>([]);

  // Check saved preferences on mount
  useEffect(() => {
    const savedGroup = localStorage.getItem("mbti-group") as MbtiGroupId | null;
    const savedTags = localStorage.getItem("user-tags");

    // 타임라인은 로그인 없이도 접근 가능, MBTI 그룹만 있으면 됨
    if (savedGroup) {
      setUserGroup(savedGroup);
      setUserTags(savedTags ? JSON.parse(savedTags) : []);
    } else {
      // MBTI 그룹이 없으면 기본값 SF로 설정
      setUserGroup("SF");
    }
    setAppState("feed");
  }, []);

  const handleChangeGroup = () => {
    // Reset and go back to home for onboarding
    localStorage.removeItem("mbti-group");
    localStorage.removeItem("user-tags");
    localStorage.removeItem("onboarding-completed");
    localStorage.removeItem("onboarding-answers");
    navigate("/");
  };

  const handleMbtiChange = (group: MbtiGroupId) => {
    localStorage.setItem("mbti-group", group);
    setUserGroup(group);
  };

  // Loading state - 빈 화면으로 빠르게 전환
  if (appState === "loading") {
    return <div className="min-h-screen bg-white" />;
  }

  // Should not reach here if not authenticated
  if (!userGroup) {
    return null;
  }

  // Timeline Feed
  return (
    <>
      <TimelineNewsFeed
        userGroup={userGroup}
        userTags={userTags}
        onChangeGroup={handleChangeGroup}
      />
      <MbtiChatBot
        mbtiGroup={userGroup}
        onMbtiChange={handleMbtiChange}
      />
    </>
  );
}
