import { CATEGORY_MAP } from '@/constants/categories';

// 카테고리 표시 이름 매핑
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  finance: "Finance",
  technology: "Technology",
  politics: "Politics",
  society: "Society",
  culture: "Culture",
  sports: "Sports",
  international: "International",
  regional: "Regional",
  industry: "Industry",
  realestate: "Real Estate",
  news: "News",
  business: "Business",
};

/**
 * 한글 카테고리를 영어로 변환
 * @param category - 한글 또는 영어 카테고리
 * @returns 영어 카테고리 표시 이름
 */
export function getCategoryInEnglish(category: string): string {
  if (!category) return "News";

  // 한글 카테고리인 경우 영어로 변환
  const englishCategory = CATEGORY_MAP[category];
  if (englishCategory && CATEGORY_DISPLAY_NAMES[englishCategory]) {
    return CATEGORY_DISPLAY_NAMES[englishCategory];
  }

  // 이미 영어인 경우
  if (CATEGORY_DISPLAY_NAMES[category]) {
    return CATEGORY_DISPLAY_NAMES[category];
  }

  // 소문자로 변환 후 확인
  const lowerCategory = category.toLowerCase();
  if (CATEGORY_DISPLAY_NAMES[lowerCategory]) {
    return CATEGORY_DISPLAY_NAMES[lowerCategory];
  }

  // 매핑에 없으면 첫 글자 대문자로
  return category.charAt(0).toUpperCase() + category.slice(1);
}
