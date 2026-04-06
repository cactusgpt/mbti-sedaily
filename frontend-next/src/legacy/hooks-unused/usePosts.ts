import { useState, useEffect, useCallback } from "react";
import { postService, type UserPost, type CreatePostParams } from "@/shared/services/postService";

export function usePosts() {
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch posts on mount
  const fetchPosts = useCallback(async (category?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedPosts = await postService.listPosts(category);
      setPosts(fetchedPosts);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
      setError("게시글을 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Create a new post
  const createPost = useCallback(
    async (params: CreatePostParams) => {
      setIsLoading(true);
      setError(null);
      try {
        const newPost = await postService.createPost(params);
        setPosts((prevPosts) => [newPost, ...prevPosts]);
        return newPost;
      } catch (err: any) {
        const errorMessage = err.message || "게시글 작성에 실패했습니다.";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Delete a post
  const deletePost = useCallback(async (postId: string, userEmail: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const success = await postService.deletePost(postId, userEmail);
      if (success) {
        setPosts((prevPosts) => prevPosts.filter((post) => post.news_id !== postId));
      }
      return success;
    } catch (err) {
      console.error("Failed to delete post:", err);
      setError("게시글 삭제에 실패했습니다.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get posts by category
  const getPostsByCategory = useCallback(
    (category: string) => {
      if (category === "전체" || category === "운세") {
        return posts;
      }
      return posts.filter((post) => post.category === category);
    },
    [posts]
  );

  // Refresh posts
  const refreshPosts = useCallback((category?: string) => {
    return fetchPosts(category);
  }, [fetchPosts]);

  return {
    posts,
    isLoading,
    error,
    createPost,
    deletePost,
    getPostsByCategory,
    refreshPosts,
  };
}

export type { UserPost, CreatePostParams };
