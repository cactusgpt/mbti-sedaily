/**
 * Normalize image URL
 * - New articles (1/24+): wimg.sedaily.com/news/cms/ - use as-is
 * - Old articles: newsimg.sedaily.com - use as-is (works via redirect)
 */
export function normalizeImageUrl(url: string): string {
  if (!url) return '';

  // Return URL as-is - both old and new formats work
  // Old: newsimg.sedaily.com -> redirects to wimg.sedaily.com/news/legacy/
  // New: wimg.sedaily.com/news/cms/ -> direct access
  return url;
}

/**
 * Get image URL from article data
 * Constructs URL from publishedAt and originalLink, then normalizes it
 *
 * Note: This is a fallback for old articles. New articles should use
 * getArticleImageUrl() which prioritizes the direct image_url from database.
 */
export function getImageUrl(publishedAt: string, originalLink: string): string {
  if (!publishedAt || !originalLink) return '';

  const date = publishedAt.substring(0, 10).split('-');
  const [year, month, day] = date;
  const code = originalLink.split('/').pop(); // Extract code from URL

  // Construct URL using new domain directly
  return `https://wimg.sedaily.com/news/cms/${year}/${month}/${day}/${code}_1.jpg`;
}

/**
 * Get the best available image URL for an article
 * Priority:
 * 1. Direct image_url from database (new format, correct for all articles)
 * 2. Fallback to constructed URL (legacy support)
 *
 * @param imageUrl - Direct image URL from API (preferred)
 * @param publishedAt - Article publish date (fallback)
 * @param originalLink - Original article link (fallback)
 */
export function getArticleImageUrl(
  imageUrl?: string | null,
  publishedAt?: string,
  originalLink?: string
): string {
  // Priority 1: Use direct image URL if available
  if (imageUrl) {
    return normalizeImageUrl(imageUrl);
  }

  // Priority 2: Fallback to constructed URL for legacy articles
  if (publishedAt && originalLink) {
    return getImageUrl(publishedAt, originalLink);
  }

  return '';
}
