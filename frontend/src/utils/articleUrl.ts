/**
 * Article URL utilities for SEO-friendly URLs
 * Supports both new slug-based URLs and legacy query parameter URLs
 */

import { BaseArticle } from "@/types/article";
import { getCategorySlug as getCategorySlugFromMapping } from "@/constants/categoryMapping";

/**
 * Build SEO-friendly article URL from article data
 *
 * Format: /{category}/{year}/{month}/{day}/{slug}
 * Fallback: /article?id={news_id} (for articles without slugs)
 *
 * @param article Article with slug, published_at, and category
 * @returns SEO-friendly URL path
 */
export function buildArticleUrl(article: BaseArticle | { news_id: string; slug?: string; published_at: string; category?: string | string[] }): string {
  // Fallback to legacy URL if no slug
  if (!article.slug) {
    return `/article?id=${article.news_id}`;
  }

  try {
    // Parse date from published_at (extract YYYY-MM-DD to avoid timezone issues)
    const dateStr = article.published_at.substring(0, 10); // "2025-12-23"
    const [year, month, day] = dateStr.split('-');

    // Get category (handle both string and array)
    let category = 'news'; // default
    if (article.category) {
      if (Array.isArray(article.category)) {
        category = article.category[0] || 'news';
      } else {
        category = article.category;
      }
    }

    // Normalize category to English
    const categorySlug = getCategorySlugFromMapping(category);

    // Build URL: /{category}/{year}/{month}/{day}/{slug}
    return `/${categorySlug}/${year}/${month}/${day}/${article.slug}`;
  } catch (error) {
    console.error('Failed to build article URL, falling back to legacy:', error);
    return `/article?id=${article.news_id}`;
  }
}

/**
 * Extract news_id from legacy URL
 *
 * @param url Legacy URL like /article?id=02100311.20251222092834001
 * @returns news_id or null
 */
export function extractNewsIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url, 'https://example.com');
    return urlObj.searchParams.get('id');
  } catch {
    return null;
  }
}

/**
 * Check if URL is a legacy article URL
 */
export function isLegacyArticleUrl(pathname: string): boolean {
  return pathname === '/article';
}

/**
 * Parse slug-based article URL to extract category, date, and slug
 *
 * @param pathname URL pathname like /finance/2025/12/22/samsung-earnings
 * @returns Parsed URL parts or null if not a valid article URL
 */
export function parseArticleUrl(pathname: string): {
  category: string;
  year: string;
  month: string;
  day: string;
  slug: string;
} | null {
  // Match pattern: /{category}/{year}/{month}/{day}/{slug}
  const match = pathname.match(/^\/([^/]+)\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)$/);

  if (!match) return null;

  const [, category, year, month, day, slug] = match;

  // Validate category
  const validCategories = ['finance', 'technology', 'politics', 'society', 'culture', 'sports', 'international', 'news'];
  if (!validCategories.includes(category)) return null;

  return { category, year, month, day, slug };
}
