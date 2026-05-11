export interface MbtiVersion {
  title: string;
  subtitle: string;
  body: string | string[];
  key_points: string[];
  closing_line: string;
  tone: string;
  image_url?: string;
}

export interface MbtiArticle {
  news_id: string;
  title: string;
  sub_title: string;
  published_at: string;
  category: string;
  provider: string;
  byline: string;
  image_url: string | null;
  content: string;
  original_link: string;
  versions?: Record<string, MbtiVersion>;
}

export interface ArchivedSentence {
  id: string;
  text: string;
  articleId: string;
  articleTitle: string;
  articlePublishedAt?: string;
  createdAt: Date;
}

export interface TextSelection {
  text: string;
  articleId: string;
  articleTitle: string;
  articlePublishedAt?: string;
  position: { x: number; y: number };
}

// Persona = the editor persona surfaced to the user (시현/지원/정훈/하은).
// Single source of truth lives in shared/data/mbtiGroups.ts as EditorPersona;
// this re-export keeps existing consumers stable.
export type { EditorPersona as Persona } from "@/shared/data/mbtiGroups";

export type TabType = "question" | "feed" | "community" | "archive" | "dna";
export type DnaSubTab = "analysis" | "birthday";
export type DnaViewMode = "radar" | "chart";
