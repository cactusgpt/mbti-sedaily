/**
 * Recommendation API client — personalized recommendations + DNA analysis.
 */

import { API_URL } from '@/shared/config/api';

export interface InterestScores {
  economy: number;
  tech: number;
  world: number;
  society: number;
  culture: number;
  politics: number;
  sports: number;
}

export interface AnalysisResponse {
  interest_scores: InterestScores;
  total_articles_read: number;
  unique_articles: number;
  category_breakdown: Record<string, number>;
  top_categories: string[];
  reading_streak: number;
  mbti_group: string;
  user_id: string;
}

export interface RecommendedArticle {
  news_id: string;
  title: string;
  category: string;
  published_at: string;
  image_url?: string;
  byline?: string;
  _score?: number;
  _source?: string;
}

export interface RecommendResponse {
  recommendations: RecommendedArticle[];
  count: number;
  strategy: string;
  interest_categories?: string[];
  user_id: string;
}

/**
 * Get reading pattern analysis (뉴스 DNA radar chart data).
 * Returns null if user has no reading history.
 */
export async function getAnalysis(userId: string): Promise<AnalysisResponse | null> {
  const res = await fetch(
    `${API_URL}/api/recommend/analysis?user_id=${encodeURIComponent(userId)}`,
  );

  if (!res.ok) return null;

  const data: AnalysisResponse = await res.json();

  // If no reading history, return null so caller can use fallback
  if (data.total_articles_read === 0) return null;

  return data;
}

/**
 * Get personalized article recommendations.
 */
export async function getRecommendations(
  userId: string,
  limit: number = 5,
): Promise<RecommendResponse | null> {
  const res = await fetch(
    `${API_URL}/api/recommend?user_id=${encodeURIComponent(userId)}&limit=${limit}`,
  );

  if (!res.ok) return null;
  return res.json();
}
