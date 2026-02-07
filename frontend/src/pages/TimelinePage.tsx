import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { ConversationalOnboarding, UserPreferences } from "@/components/onboarding/ConversationalOnboarding";
import { TimelineNewsFeed } from "@/components/timeline/TimelineNewsFeed";
import { MbtiChatBot } from "@/components/mbti/MbtiChatBot";
import { useAuth } from "@/contexts/AuthContext";

type AppState = "loading" | "onboarding" | "feed";

export default function TimelinePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [appState, setAppState] = useState<AppState>("loading");
  const [userGroup, setUserGroup] = useState<MbtiGroupId | null>(null);
  const [userTags, setUserTags] = useState<string[]>([]);

  // Check saved preferences on mount
  useEffect(() => {
    if (authLoading) return;

    const savedGroup = localStorage.getItem("mbti-group") as MbtiGroupId | null;
    const savedTags = localStorage.getItem("user-tags");
    const hasCompletedOnboarding = localStorage.getItem("onboarding-completed");

    if (isAuthenticated && savedGroup && hasCompletedOnboarding) {
      setUserGroup(savedGroup);
      setUserTags(savedTags ? JSON.parse(savedTags) : []);
      setAppState("feed");
    } else {
      // Redirect to home for onboarding
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

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

  // Loading state
  if (appState === "loading" || authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full mx-auto mb-4" />
          <p className="text-gray-400">...</p>
        </div>
      </div>
    );
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
