import { Category } from "@/types/article";

export const CATEGORY_MAP: Record<string, Category> = {
  // 기본 카테고리
  정치: "politics",
  경제: "finance",
  국제: "international",
  문화: "culture",
  IT_과학: "technology",
  스포츠: "sports",
  사회: "society",

  // 추가 카테고리
  지역: "regional",
  산업: "industry",
  부동산: "realestate",
  증권: "finance",
  금융: "finance",
  기업: "industry",
  생활: "society",
  연예: "culture",
  오피니언: "society",
  사설: "society",
  칼럼: "society",

  // IT/과학 변형
  "IT": "technology",
  "과학": "technology",
  "테크": "technology",
};

export const REVERSE_CATEGORY_MAP: Record<Category, string[]> = {
  finance: ["경제", "증권", "금융"],
  technology: ["IT_과학", "IT", "과학", "테크"],
  politics: ["정치"],
  society: ["사회", "생활", "오피니언", "사설", "칼럼"],
  culture: ["문화", "연예"],
  sports: ["스포츠"],
  international: ["국제"],
  regional: ["지역"],
  industry: ["산업", "기업"],
  realestate: ["부동산"],
  news: [],
};
