

import { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/shared/config/api";

interface Props {
  articleId: string;
  mbtiGroup: string;
}

interface ReactionCounts {
  like: number;
  fire: number;
  thinking: number;
  mustRead: number;
}

interface Comment {
  id: string;
  text: string;
  mbti_group: string;
  created_at: string;
  likes: number;
}

interface RatingStats {
  average: number;
  count: number;
}

// MBTI 그룹별 색상
const groupColors: Record<string, { bg: string; text: string; border: string; light: string }> = {
  NT: { bg: "bg-blue-500", text: "text-blue-600", border: "border-blue-200", light: "bg-blue-50" },
  NF: { bg: "bg-violet-500", text: "text-violet-600", border: "border-violet-200", light: "bg-violet-50" },
  ST: { bg: "bg-green-500", text: "text-green-600", border: "border-green-200", light: "bg-green-50" },
  SF: { bg: "bg-orange-500", text: "text-orange-600", border: "border-orange-200", light: "bg-orange-50" },
};

// 로컬 스토리지 키 (유저 상태 저장용)
const getUserStateKey = (articleId: string, type: string) => `mbti-user-${articleId}-${type}`;

export function ArticleReactions({ articleId, mbtiGroup }: Props) {
  // Reaction states
  const [reactions, setReactions] = useState<ReactionCounts>({ like: 0, fire: 0, thinking: 0, mustRead: 0 });
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set());
  const [loadingReaction, setLoadingReaction] = useState<string | null>(null);

  // Rating states
  const [rating, setRating] = useState<number>(0);
  const [ratingStats, setRatingStats] = useState<RatingStats>({ average: 0, count: 0 });
  const [hasRated, setHasRated] = useState(false);
  const [loadingRating, setLoadingRating] = useState(false);

  // Comment states
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [loadingComment, setLoadingComment] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  const colors = groupColors[mbtiGroup] || groupColors.SF;

  // Fetch engagement data from API
  const fetchEngagementData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/engagement/${articleId}`);
      if (!response.ok) throw new Error('Failed to fetch engagement data');

      const data = await response.json();

      // Update reactions
      if (data.reactions) {
        setReactions(data.reactions);
      }

      // Update rating stats
      if (data.rating) {
        setRatingStats(data.rating);
      }

      // Update comments
      if (data.comments) {
        setComments(data.comments);
      }

      // Load user states from localStorage
      const storedUserReactions = localStorage.getItem(getUserStateKey(articleId, "userReactions"));
      if (storedUserReactions) {
        setUserReactions(new Set(JSON.parse(storedUserReactions)));
      }

      const storedUserRating = localStorage.getItem(getUserStateKey(articleId, "userRating"));
      if (storedUserRating) {
        setHasRated(true);
        setRating(parseInt(storedUserRating));
      }

      const storedLikedComments = localStorage.getItem(getUserStateKey(articleId, "likedComments"));
      if (storedLikedComments) {
        setLikedComments(new Set(JSON.parse(storedLikedComments)));
      }

    } catch (error) {
      console.error("Failed to fetch engagement data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [articleId]);

  // Load data on mount
  useEffect(() => {
    fetchEngagementData();
  }, [fetchEngagementData]);

  // Handle reaction click
  const handleReaction = async (type: keyof ReactionCounts) => {
    if (loadingReaction) return;

    try {
      setLoadingReaction(type);

      const response = await fetch(`${API_URL}/api/engagement/${articleId}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction_type: type }),
      });

      if (!response.ok) throw new Error('Failed to toggle reaction');

      const data = await response.json();

      // Update reactions from server response
      if (data.reactions) {
        setReactions(data.reactions);
      }

      // Update local user state
      const newUserReactions = new Set(userReactions);
      if (data.action === 'added') {
        newUserReactions.add(type);
      } else {
        newUserReactions.delete(type);
      }
      setUserReactions(newUserReactions);
      localStorage.setItem(getUserStateKey(articleId, "userReactions"), JSON.stringify([...newUserReactions]));

    } catch (error) {
      console.error("Failed to toggle reaction:", error);
    } finally {
      setLoadingReaction(null);
    }
  };

  // Handle rating
  const handleRating = async (star: number) => {
    if (hasRated || loadingRating) return;

    try {
      setLoadingRating(true);

      const response = await fetch(`${API_URL}/api/engagement/${articleId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: star }),
      });

      if (!response.ok) throw new Error('Failed to submit rating');

      const data = await response.json();

      if (data.success) {
        setRating(star);
        setHasRated(true);
        if (data.stats) {
          setRatingStats(data.stats);
        }
        localStorage.setItem(getUserStateKey(articleId, "userRating"), star.toString());
      } else if (data.message) {
        // Already rated
        setHasRated(true);
        if (data.stats) {
          setRatingStats(data.stats);
        }
      }

    } catch (error) {
      console.error("Failed to submit rating:", error);
    } finally {
      setLoadingRating(false);
    }
  };

  // Handle comment submit
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || loadingComment) return;

    try {
      setLoadingComment(true);

      const response = await fetch(`${API_URL}/api/engagement/${articleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newComment.trim(),
          mbti_group: mbtiGroup,
        }),
      });

      if (!response.ok) throw new Error('Failed to add comment');

      const data = await response.json();

      if (data.success && data.comment) {
        setComments([data.comment, ...comments]);
        setNewComment("");
      }

    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setLoadingComment(false);
    }
  };

  // Handle comment like
  const handleCommentLike = async (commentId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/engagement/${articleId}/comments/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId }),
      });

      if (!response.ok) throw new Error('Failed to like comment');

      const data = await response.json();

      // Update comment likes count
      setComments(comments.map(c =>
        c.id === commentId ? { ...c, likes: data.likes } : c
      ));

      // Update local liked state
      const newLikedComments = new Set(likedComments);
      if (data.action === 'liked') {
        newLikedComments.add(commentId);
      } else {
        newLikedComments.delete(commentId);
      }
      setLikedComments(newLikedComments);
      localStorage.setItem(getUserStateKey(articleId, "likedComments"), JSON.stringify([...newLikedComments]));

    } catch (error) {
      console.error("Failed to like comment:", error);
    }
  };

  const reactionButtons = [
    { type: "like" as const, emoji: "👍", label: "좋아요" },
    { type: "fire" as const, emoji: "🔥", label: "흥미진진" },
    { type: "thinking" as const, emoji: "🤔", label: "생각해볼만한" },
    { type: "mustRead" as const, emoji: "⭐", label: "후속강추" },
  ];

  if (isLoading) {
    return (
      <div className="mt-5 pt-5 border-t border-gray-200">
        <div className="animate-pulse">
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 w-24 bg-gray-200 rounded-full" />
            ))}
          </div>
          <div className="h-12 bg-gray-100 rounded-xl mb-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 pt-5 border-t border-gray-200">
      {/* Reactions Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {reactionButtons.map(({ type, emoji, label }) => (
          <button
            key={type}
            onClick={() => handleReaction(type)}
            disabled={loadingReaction === type}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] transition-all ${
              userReactions.has(type)
                ? `${colors.bg} text-white`
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            } ${loadingReaction === type ? "opacity-50 cursor-wait" : ""}`}
          >
            <span>{emoji}</span>
            <span>{label}</span>
            <span className={`ml-1 font-medium ${userReactions.has(type) ? "text-white/80" : "text-gray-400"}`}>
              {reactions[type]}
            </span>
          </button>
        ))}
      </div>

      {/* Star Rating */}
      <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-1">
          <span className="text-[13px] text-gray-500 mr-2">기사 평점:</span>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRating(star)}
              disabled={hasRated || loadingRating}
              className={`text-xl transition-all ${
                hasRated || loadingRating ? "cursor-default" : "cursor-pointer hover:scale-110"
              } ${star <= (hasRated ? rating : 0) ? "text-yellow-400" : "text-gray-300"}`}
            >
              {star <= (hasRated ? rating : 0) ? "⭐" : "☆"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className={`font-bold ${colors.text}`}>{ratingStats.average.toFixed(1)}</span>
          <span className="text-gray-400">({ratingStats.count}명 평가)</span>
        </div>
        {hasRated && (
          <span className="text-[12px] text-green-600 font-medium">
            ✓ 평가 완료
          </span>
        )}
      </div>

      {/* Comments Toggle */}
      <button
        onClick={() => setShowComments(!showComments)}
        className={`flex items-center gap-2 text-[13px] font-medium ${colors.text} hover:opacity-80 transition-opacity mb-3`}
      >
        <span>💬</span>
        <span>토론방 ({comments.length})</span>
        <span className="text-gray-400">{showComments ? "▲" : "▼"}</span>
      </button>

      {/* Comments Section */}
      {showComments && (
        <div className={`p-4 rounded-xl ${colors.light} border ${colors.border}`}>
          {/* Comment Form */}
          <form onSubmit={handleCommentSubmit} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="생각을 나눠보세요..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-[14px] focus:outline-none focus:ring-2 focus:ring-offset-1"
                disabled={loadingComment}
              />
              <button
                type="submit"
                disabled={!newComment.trim() || loadingComment}
                className={`px-4 py-2 ${colors.bg} text-white text-[13px] font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity`}
              >
                {loadingComment ? "..." : "등록"}
              </button>
            </div>
          </form>

          {/* Comments List */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-center text-[13px] text-gray-400 py-4">
                첫 번째 댓글을 남겨보세요!
              </p>
            ) : (
              comments.map((comment) => {
                const commentColors = groupColors[comment.mbti_group] || groupColors.SF;
                const hasLiked = likedComments.has(comment.id);

                return (
                  <div key={comment.id} className="flex gap-3 p-3 bg-white rounded-lg">
                    <div className={`shrink-0 w-8 h-8 ${commentColors.bg} rounded-full flex items-center justify-center text-white text-[11px] font-bold`}>
                      {comment.mbti_group}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-gray-700 leading-relaxed">{comment.text}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[11px] text-gray-400">
                          {new Date(comment.created_at).toLocaleString("ko-KR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <button
                          onClick={() => handleCommentLike(comment.id)}
                          className={`flex items-center gap-1 text-[12px] ${
                            hasLiked ? colors.text : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          <span>{hasLiked ? "❤️" : "🤍"}</span>
                          <span>{comment.likes}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
