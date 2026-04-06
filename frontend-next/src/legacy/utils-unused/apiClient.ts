/**
 * API Client for Seoul Economic Daily
 */

import { CategoryArticle, ArticleDetail } from "@/shared/types/article";
import { englishToKorean } from "@/shared/constants/categoryMapping";
import { API_URL } from "@/shared/config/api";

export { API_URL };
export type { CategoryArticle };

export interface SearchResponse {
  articles: CategoryArticle[];
  total_hits: number;
  total_pages: number;
  page: number;
  page_size: number;
}

export async function fetchLatestArticles(days: number = 7, pageSize: number = 15, page: number = 1): Promise<SearchResponse> {
  const response = await fetch(`${API_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '*',
      filters: {
        published_from: '2020-01-01',
        published_until: '2030-12-31',
        providers: [],
        categories: []
      },
      page: page,
      page_size: pageSize
    }),
  });

  if (!response.ok) throw new Error('Failed to fetch articles');
  return response.json();
}

export async function fetchArticleDetail(articleId: string) {
  try {
    const searchResponse = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: articleId,
        filters: {
          published_from: '2020-01-01',
          published_until: '2030-12-31',
          providers: [],
          categories: []
        },
        page: 1,
        page_size: 1
      }),
    });

    if (!searchResponse.ok) throw new Error('Failed to fetch article');
    const searchData = await searchResponse.json();

    const foundArticle = searchData.articles?.find((a: any) => a.news_id === articleId);
    if (!foundArticle) {
      const response = await fetch(`${API_URL}/api/article/${articleId}`);
      if (!response.ok) throw new Error('Failed to fetch article');
      return response.json();
    }

    return foundArticle;
  } catch (error) {
    const response = await fetch(`${API_URL}/api/article/${articleId}`);
    if (!response.ok) throw new Error('Failed to fetch article');
    return response.json();
  }
}

export async function fetchArticleBySlug(slug: string) {
  const response = await fetch(`${API_URL}/api/article/by-slug/${slug}`);
  if (!response.ok) throw new Error('Failed to fetch article by slug');
  return response.json();
}

export async function fetchCategoryArticles(category: string, page: number = 1, pageSize: number = 20): Promise<SearchResponse> {
  const koreanCategory = englishToKorean(category);

  const response = await fetch(`${API_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '*',
      filters: {
        published_from: '2020-01-01',
        published_until: '2030-12-31',
        providers: ['서울경제'],
        categories: koreanCategory
      },
      page: page,
      page_size: pageSize
    })
  });

  if (!response.ok) throw new Error('Failed to fetch articles');
  return response.json();
}

export async function fetchRelatedArticles(category: string, articleId: string, pageSize: number = 4): Promise<CategoryArticle[]> {
  try {
    const response = await fetch(`${API_URL}/api/related/${articleId}?limit=${pageSize}`);
    if (response.ok) {
      const data = await response.json();
      if (data.related_articles && data.related_articles.length > 0) {
        return data.related_articles;
      }
    }
  } catch (error) {
    console.warn('Hashtag-based recommendations failed, falling back to category-based');
  }

  const REVERSE_CATEGORY_MAP: Record<string, string[]> = {
    'finance': ['경제'],
    'technology': ['IT_과학'],
    'politics': ['정치'],
    'society': ['사회'],
    'culture': ['문화'],
    'sports': ['스포츠'],
    'international': ['국제'],
    'news': []
  };

  const response = await fetch(`${API_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '*',
      filters: {
        published_from: '2020-01-01',
        published_until: '2030-12-31',
        categories: REVERSE_CATEGORY_MAP[category] || []
      },
      page: 1,
      page_size: pageSize
    }),
  });

  if (!response.ok) throw new Error('Failed to fetch related articles');
  const data = await response.json();
  return (data.articles || []).filter((a: CategoryArticle) => a.news_id !== articleId);
}

export async function searchArticles(query: string, page: number = 1, pageSize: number = 20): Promise<SearchResponse> {
  const response = await fetch(`${API_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      filters: {
        published_from: '2020-01-01',
        published_until: '2030-12-31',
        providers: [],
        categories: []
      },
      page: page,
      page_size: pageSize
    }),
  });

  if (!response.ok) throw new Error('Failed to search articles');
  return response.json();
}
