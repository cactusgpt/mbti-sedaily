import { API_URL } from "@/config/api";

export interface UserPost {
  news_id: string;
  item_type: string;
  title_ko: string;
  content_ko: string;
  category: string;
  author: string;
  author_name: string;
  author_email: string;
  byline: string;
  images: string[];
  published_at: string;
  created_at: string;
  updated_at: string;
  version_NT?: {
    title: string;
    subtitle: string;
    body: string[];
    key_points: string[];
    closing_line: string;
    tone: string;
  };
  version_NF?: {
    title: string;
    subtitle: string;
    body: string[];
    key_points: string[];
    closing_line: string;
    tone: string;
  };
  version_ST?: {
    title: string;
    subtitle: string;
    body: string[];
    key_points: string[];
    closing_line: string;
    tone: string;
  };
  version_SF?: {
    title: string;
    subtitle: string;
    body: string[];
    key_points: string[];
    closing_line: string;
    tone: string;
  };
}

export interface MbtiVersionInput {
  title: string;
  body: string;
}

export interface CreatePostParams {
  title: string;
  content: string;
  category: string;
  author_id: string;
  author_name: string;
  author_email: string;
  image_url?: string;
  // MBTI-specific versions (optional)
  version_NT?: MbtiVersionInput;
  version_NF?: MbtiVersionInput;
  version_ST?: MbtiVersionInput;
  version_SF?: MbtiVersionInput;
}

class PostService {
  private baseUrl = `${API_URL}/api/posts`;

  async createPost(params: CreatePostParams): Promise<UserPost> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create post");
    }

    return response.json();
  }

  async listPosts(category?: string, limit: number = 50): Promise<UserPost[]> {
    const params = new URLSearchParams();
    if (category && category !== "전체") {
      params.append("category", category);
    }
    params.append("limit", limit.toString());

    const url = `${this.baseUrl}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Failed to fetch posts");
      return [];
    }

    const data = await response.json();
    return data.posts || [];
  }

  async getPost(postId: string): Promise<UserPost | null> {
    const response = await fetch(`${this.baseUrl}/${postId}`);

    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  async deletePost(postId: string, userEmail: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/${postId}?user_email=${encodeURIComponent(userEmail)}`, {
      method: "DELETE",
    });

    return response.ok;
  }
}

export const postService = new PostService();
