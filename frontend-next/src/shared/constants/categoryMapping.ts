/**
 * Category mapping constants
 * Single source of truth for Korean ↔ English category conversions
 */

export const CATEGORY_MAPPING = {
  // Economic subcategories
  '경제>증권_증시': 'markets',
  '경제>부동산': 'property', 
  '경제>금융_재테크': 'finance',
  '경제>무역': 'finance',
  '경제>외환': 'finance',
  '경제>산업_기업': 'business',
  '경제>반도체': 'business',
  '경제>유통': 'business',
  
  // Main categories
  'IT_과학': 'technology',
  '정치': 'politics',
  '사회': 'society',
  '문화': 'culture',
  '스포츠': 'sports',
  '국제': 'international',
  
  // Fallback for general 경제
  '경제': 'finance',
} as const;

// 새로운 카테고리 매핑 (여러 소분류 → 하나의 영문 카테고리)
export const REVERSE_CATEGORY_MAPPING = {
  'markets': ['경제'],
  'property': ['경제'], 
  'finance': ['경제'],
  'business': ['경제'],
  'technology': ['IT_과학'],
  'politics': ['정치'],
  'society': ['사회'],
  'culture': ['문화'],
  'sports': ['스포츠'],
  'international': ['국제'],
} as const;

/**
 * Convert Korean category to English slug
 * @param category Korean category name (e.g., "경제>증권_증시")
 * @returns English category slug (e.g., "markets")
 */
export function koreanToEnglish(category: string): string {
  return CATEGORY_MAPPING[category as keyof typeof CATEGORY_MAPPING] || 'news';
}

/**
 * Convert English category slug to Korean categories array
 * @param slug English category slug (e.g., "markets")
 * @returns Array of Korean category names (e.g., ["경제>증권_증시"])
 */
export function englishToKorean(slug: string): string[] {
  return [...(REVERSE_CATEGORY_MAPPING[slug as keyof typeof REVERSE_CATEGORY_MAPPING] || [slug])];
}

/**
 * Get category slug from Korean or English input
 * Handles both Korean names and English slugs
 * @param category Category name or slug
 * @returns English category slug
 */
export function getCategorySlug(category: string): string {
  // If already English, return as-is (after validation)
  const englishCategories = Object.keys(REVERSE_CATEGORY_MAPPING);
  if (englishCategories.includes(category)) {
    return category;
  }

  // Convert from Korean
  return koreanToEnglish(category);
}
