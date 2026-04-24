'use client';

import { useState, useEffect, Suspense } from "react";
import { StoryNewsFeed } from "@/components/story/StoryNewsFeed";
import { FeedPage } from "@/components/mbti/FeedPage";
import { MbtiChatBot } from "@/components/mbti/MbtiChatBot";
import { OnboardingPage } from "@/components/mbti/OnboardingPage";
import { BriefingPage } from "@/components/mbti/BriefingPage";
import type { MbtiGroupId } from "@/shared/data/mbtiGroups";

type ViewMode = "story" | "feed" | "editor-select" | "briefing";

function HomeContent() {
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [userGroup, setUserGroup] = useState<MbtiGroupId>("SF");

  useEffect(() => {
    const savedGroup = localStorage.getItem("mbti-group") as MbtiGroupId | null;
    if (savedGroup) {
      setUserGroup(savedGroup);
    }
  }, []);

  const handleSwitchToFeed = () => {
    setViewMode("feed");
  };

  const handleSwitchToStory = () => {
    setViewMode("story");
  };

  const handleChangeGroup = () => {
    setViewMode("editor-select");
  };

  const handleSelectGroup = (group: MbtiGroupId) => {
    setUserGroup(group);
    localStorage.setItem("mbti-group", group);
    setViewMode("feed");
  };

  const handleStartBriefing = (group: MbtiGroupId) => {
    setUserGroup(group);
    localStorage.setItem("mbti-group", group);
    setViewMode("briefing");
  };

  const handleFinishBriefing = () => {
    setViewMode("feed");
  };

  const handleMbtiChange = (group: MbtiGroupId) => {
    localStorage.setItem("mbti-group", group);
    setUserGroup(group);
  };

  if (viewMode === "briefing") {
    return (
      <BriefingPage
        groupId={userGroup}
        onFinish={handleFinishBriefing}
        onBack={handleChangeGroup}
      />
    );
  }

  if (viewMode === "editor-select") {
    return (
      <OnboardingPage
        onSelectGroup={handleSelectGroup}
        onStartBriefing={handleStartBriefing}
        onBack={handleSwitchToFeed}
      />
    );
  }

  if (viewMode === "story") {
    return (
      <StoryNewsFeed
        onComplete={(preferences) => {
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

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50"></div></div>}>
      <HomeContent />
    </Suspense>
  );
}
