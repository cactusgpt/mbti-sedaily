'use client';

import { useState, useEffect, Suspense } from "react";
import { StoryNewsFeed } from "@/components/story/StoryNewsFeed";
import { FeedPage } from "@/components/mbti/FeedPage";
import { MbtiChatBot } from "@/components/mbti/MbtiChatBot";
import { OnboardingPage } from "@/components/mbti/OnboardingPage";
import { BriefingPage } from "@/components/mbti/BriefingPage";
import { groupToDefaultMbti, type MbtiGroupId } from "@/shared/data/mbtiGroups";

type ViewMode = "story" | "feed" | "editor-select" | "briefing";

const mbtiGroupIds: MbtiGroupId[] = ["NT", "NF", "ST", "SF"];

function readStoredGroup(): MbtiGroupId {
  if (typeof window === "undefined") return "SF";
  const savedGroup = localStorage.getItem("mbti-group") as MbtiGroupId | null;
  return savedGroup && mbtiGroupIds.includes(savedGroup) ? savedGroup : "SF";
}

function HomeContent() {
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [userGroup, setUserGroup] = useState<MbtiGroupId>(readStoredGroup);

  useEffect(() => {
    const savedGroup = localStorage.getItem("mbti-group") as MbtiGroupId | null;
    // Round 5-G: backfill 4-char MBTI for legacy users who only have group.
    // Picks the group's default editor MBTI (NT→INTJ, NF→INFP, ST→ISTJ,
    // SF→ESFP). Idempotent on absence — only writes when mbti-type is missing.
    // In-session group changes via handleMbtiChange / StoryNewsFeed leave
    // the existing mbti-type until the next mount; precise mid-session MBTI
    // edits will be a future settings-page concern.
    if (savedGroup && mbtiGroupIds.includes(savedGroup) && !localStorage.getItem("mbti-type")) {
      localStorage.setItem("mbti-type", groupToDefaultMbti[savedGroup]);
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
