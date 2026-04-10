/**
 * A/B Test API client — minimal frontend integration.
 *
 * Usage in ArticleView:
 *   const { group } = await getABGroup(userId, 'mbti-vs-original-v1');
 *   // group === 'A' → show original, group === 'B' → show MBTI version
 *   // Track events:
 *   trackABEvent(userId, experimentId, 'read', articleId, { read_time_seconds: 45 });
 */

import { API_URL } from '@/shared/config/api';

export interface ABAssignment {
  user_id: string;
  experiment_id: string;
  group: 'A' | 'B';
  group_label: string;
  is_new: boolean;
}

/**
 * Get or create the user's A/B group assignment.
 * Deterministic — same user always gets the same group.
 * Returns null if the experiment doesn't exist or API is unavailable.
 */
export async function getABGroup(
  userId: string,
  experimentId: string,
): Promise<ABAssignment | null> {
  try {
    const res = await fetch(`${API_URL}/api/ab-test/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, experiment_id: experimentId }),
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Track an engagement event for the A/B test.
 *
 * Event types:
 *   'read'    — user opened the article (include read_time_seconds)
 *   'scroll'  — user scrolled (include scroll_depth_percent: 0-100)
 *   'archive' — user archived a sentence
 *   'share'   — user shared the article
 *   'return'  — user returned to read another article
 */
export async function trackABEvent(
  userId: string,
  experimentId: string,
  eventType: string,
  articleId: string,
  metadata?: Record<string, number | string>,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/ab-test/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        experiment_id: experimentId,
        event_type: eventType,
        article_id: articleId,
        metadata: metadata || {},
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}
