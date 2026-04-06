import { API_URL } from "@/shared/config/api";

/**
 * Record that a user read an article
 */
export async function recordArticleRead(
  userId: string,
  articleId: string,
  articleTitle?: string
): Promise<void> {
  try {
    await fetch(`${API_URL}/api/user/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        article_id: articleId,
        article_title: articleTitle,
      }),
    });
  } catch (error) {
    console.error("Failed to record article read:", error);
  }
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string) {
  try {
    const res = await fetch(`${API_URL}/api/user/stats?user_id=${userId}`);
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (error) {
    console.error("Failed to get user stats:", error);
    return null;
  }
}

/**
 * Get reading history
 */
export async function getReadingHistory(userId: string) {
  try {
    const res = await fetch(`${API_URL}/api/user/history?user_id=${userId}`);
    if (res.ok) {
      const data = await res.json();
      return data.history || [];
    }
    return [];
  } catch (error) {
    console.error("Failed to get reading history:", error);
    return [];
  }
}
