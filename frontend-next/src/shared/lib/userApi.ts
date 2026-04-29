import { API_URL } from "@/shared/config/api";
import { authFetch } from "@/shared/lib/authFetch";

// All endpoints below now require a Cognito ID token. The backend derives
// the canonical user_id from the verified JWT `sub` claim and ignores any
// `user_id` field on the body / query string (it stays in the URL only for
// human-readable logs and to keep API Gateway access-log lines unchanged).

/**
 * Record that a user read an article. Fire-and-forget; failures are logged
 * but never thrown to the caller — the read view should not be blocked by
 * tracker hiccups.
 */
export async function recordArticleRead(
  userId: string,
  articleId: string,
  articleTitle?: string
): Promise<void> {
  try {
    const res = await authFetch(`${API_URL}/api/user/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        article_id: articleId,
        article_title: articleTitle,
      }),
    });
    if (!res.ok) {
      console.warn(`recordArticleRead returned ${res.status}`);
    }
  } catch (error) {
    console.error("Failed to record article read:", error);
  }
}

