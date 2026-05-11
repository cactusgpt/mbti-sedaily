'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MbtiGroupId } from "@/shared/data/mbtiGroups";
import { TimelineNewsFeed } from "@/components/timeline/TimelineNewsFeed";
import { MbtiChatBot } from "@/components/mbti/MbtiChatBot";

const mbtiGroupIds: MbtiGroupId[] = ["NT", "NF", "ST", "SF"];

function readStoredGroup(): MbtiGroupId {
  if (typeof window === "undefined") return "SF";
  const savedGroup = localStorage.getItem("mbti-group") as MbtiGroupId | null;
  return savedGroup && mbtiGroupIds.includes(savedGroup) ? savedGroup : "SF";
}

function readStoredTags(): string[] {
  if (typeof window === "undefined") return [];
  const savedTags = localStorage.getItem("user-tags");
  if (!savedTags) return [];
  try {
    const parsed = JSON.parse(savedTags);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

export default function TimelinePage() {
  const router = useRouter();
  const [userGroup, setUserGroup] = useState<MbtiGroupId>(readStoredGroup);
  const [userTags] = useState<string[]>(readStoredTags);

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
