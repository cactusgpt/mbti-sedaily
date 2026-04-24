'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MbtiGroupId } from "@/shared/data/mbtiGroups";
import { TimelineNewsFeed } from "@/components/timeline/TimelineNewsFeed";
import { MbtiChatBot } from "@/components/mbti/MbtiChatBot";

type AppState = "loading" | "onboarding" | "feed";

export default function TimelinePage() {
  const router = useRouter();
  const [appState, setAppState] = useState<AppState>("loading");
  const [userGroup, setUserGroup] = useState<MbtiGroupId | null>(null);
  const [userTags, setUserTags] = useState<string[]>([]);

  useEffect(() => {
    const savedGroup = localStorage.getItem("mbti-group") as MbtiGroupId | null;
    const savedTags = localStorage.getItem("user-tags");

    if (savedGroup) {
      setUserGroup(savedGroup);
      setUserTags(savedTags ? JSON.parse(savedTags) : []);
    } else {
      setUserGroup("SF");
    }
    setAppState("feed");
  }, []);

  const handleChangeGroup = () => {
    localStorage.removeItem("mbti-group");
    localStorage.removeItem("user-tags");
    localStorage.removeItem("onboarding-completed");
    localStorage.removeItem("onboarding-answers");
    router.replace("/");
  };

  const handleMbtiChange = (group: MbtiGroupId) => {
    localStorage.setItem("mbti-group", group);
    setUserGroup(group);
  };

  if (appState === "loading") {
    return <div className="min-h-screen bg-white" />;
  }

  if (!userGroup) {
    return null;
  }

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
