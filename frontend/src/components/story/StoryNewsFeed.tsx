import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Heart, Share2, ExternalLink, Volume2, RefreshCw, Sparkles, MapPin } from "lucide-react";
import { API_URL } from "@/config/api";
import { Character2D } from "@/components/character/Character3D";

// 여정 메시지 - 고양이 캐릭터가 말하는 컨셉
const JOURNEY_MESSAGES = [
  { index: 0, mood: "waving" as const, message: "냥! 반가워요~ 🐱 오늘 세상에 무슨 일이 있었는지 같이 볼까요?" },
  { index: 3, mood: "happy" as const, message: "벌써 3번째 소식이에요! 잘 따라오고 있어요 ✨" },
  { index: 6, mood: "thinking" as const, message: "흠... 다음엔 어떤 이야기가 있을까냥? 🐾" },
  { index: 9, mood: "excited" as const, message: "냐옹! 10번째 소식이에요! 귀로도 들어볼까요? 🎧" },
  { index: 12, mood: "happy" as const, message: "여기까지 오시다니 대단해요! 물고기 드릴게요 🐟" },
  { index: 15, mood: "excited" as const, message: "이 좋은 소식, 부모님께도 들려드릴까요? 💝" },
  { index: 18, mood: "happy" as const, message: "거의 끝에 도착했어요! 조금만 더 가요~ 🎉" },
];

interface Article {
  news_id: string;
  title: string;
  sub_title: string;
  published_at: string;
  category: string;
  provider: string;
  image_url: string | null;
  content: string;
  original_link: string;
  versions?: Record<string, { title: string; body: string | string[] }>;
}

// 카테고리 매핑
const categoryMap: Record<string, { label: string; color: string; emoji: string }> = {
  "경제": { label: "경제", color: "#3B82F6", emoji: "💰" },
  "정치": { label: "정치", color: "#EF4444", emoji: "🏛️" },
  "사회": { label: "사회", color: "#10B981", emoji: "🏘️" },
  "국제": { label: "세상", color: "#8B5CF6", emoji: "🌍" },
  "IT_과학": { label: "테크", color: "#F59E0B", emoji: "💡" },
  "산업": { label: "산업", color: "#6366F1", emoji: "🏭" },
  "문화": { label: "문화", color: "#EC4899", emoji: "🎨" },
  "스포츠": { label: "스포츠", color: "#14B8A6", emoji: "⚽" },
};

function getCategoryInfo(category: string) {
  return categoryMap[category] || { label: category, color: "#6B7280", emoji: "📰" };
}

function getBodyText(body: string | string[]): string {
  const text = Array.isArray(body) ? body.join("\n\n") : body;
  const clean = text.replace(/\*\*/g, "");
  const paragraphs = clean.split("\n\n").filter(p => p.trim());

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) continue;
    if (trimmed.startsWith("■")) continue;
    if (trimmed.includes("|")) continue;
    if (trimmed.startsWith("---")) continue;
    if (trimmed.length < 20) continue;
    return trimmed;
  }
  return "";
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// 특수 카드 타입
type SpecialCard =
  | { type: "interest"; id: string }
  | { type: "audio"; id: string }
  | { type: "share"; id: string };

interface Props {
  onInterestSelect?: (interests: string[]) => void;
  onAudioTry?: () => void;
  onShare?: () => void;
  onSwitchToFeed?: () => void;
}

export function StoryNewsFeed({ onInterestSelect, onAudioTry, onShare, onSwitchToFeed }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedArticles, setLikedArticles] = useState<Set<string>>(new Set());
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [showInterestCard, setShowInterestCard] = useState(false);
  const [showAudioCard, setShowAudioCard] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [interestDismissed, setInterestDismissed] = useState(false);
  const [audioDismissed, setAudioDismissed] = useState(false);
  const [shareDismissed, setShareDismissed] = useState(false);
  const [showJourneyMessage, setShowJourneyMessage] = useState(true);
  const [characterMood, setCharacterMood] = useState<"happy" | "excited" | "thinking" | "waving" | "neutral">("waving");

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isDragging = useRef(false);

  // 현재 인덱스에 맞는 여정 메시지 찾기
  const currentJourneyMessage = useMemo(() => {
    const message = JOURNEY_MESSAGES.find(m => m.index === currentIndex);
    return message || null;
  }, [currentIndex]);

  // 캐릭터 무드 업데이트
  useEffect(() => {
    if (currentJourneyMessage) {
      setCharacterMood(currentJourneyMessage.mood);
      setShowJourneyMessage(true);
    } else {
      // 좋아요가 많으면 excited
      if (likedArticles.size >= 5) {
        setCharacterMood("excited");
      } else if (likedArticles.size >= 2) {
        setCharacterMood("happy");
      } else {
        setCharacterMood("neutral");
      }
    }
  }, [currentIndex, currentJourneyMessage, likedArticles.size]);

  // Fetch articles
  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

        const res = await fetch(`${API_URL}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "*",
            filters: {
              published_from: today,
              published_until: tomorrow,
            },
            page: 1,
            page_size: 30,
          }),
        });
        const data = await res.json();
        setArticles(data.articles || []);
      } catch (e) {
        console.error("Failed to fetch:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, []);

  // Check for special cards based on index
  useEffect(() => {
    if (!interestDismissed && currentIndex === 4) {
      setShowInterestCard(true);
    }
    if (!audioDismissed && currentIndex === 9) {
      setShowAudioCard(true);
    }
    if (!shareDismissed && currentIndex === 14) {
      setShowShareCard(true);
    }
  }, [currentIndex, interestDismissed, audioDismissed, shareDismissed]);

  const goNext = useCallback(() => {
    if (showInterestCard || showAudioCard || showShareCard) return;
    if (currentIndex < articles.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, articles.length, showInterestCard, showAudioCard, showShareCard]);

  const goPrev = useCallback(() => {
    if (showInterestCard || showAudioCard || showShareCard) return;
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, showInterestCard, showAudioCard, showShareCard]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  // Click navigation (tap left/right side of screen)
  const handleClick = (e: React.MouseEvent) => {
    if (showInterestCard || showAudioCard || showShareCard) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const width = rect.width;

    // Left 30% = prev, Right 30% = next
    if (clickX < width * 0.3) {
      goPrev();
    } else if (clickX > width * 0.7) {
      goNext();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  const toggleLike = (articleId: string) => {
    setLikedArticles(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  };

  const handleInterestSelect = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const confirmInterests = () => {
    onInterestSelect?.(selectedInterests);
    setShowInterestCard(false);
    setInterestDismissed(true);
  };

  const skipInterests = () => {
    setShowInterestCard(false);
    setInterestDismissed(true);
  };

  const handleAudioTry = () => {
    onAudioTry?.();
    setShowAudioCard(false);
    setAudioDismissed(true);
  };

  const skipAudio = () => {
    setShowAudioCard(false);
    setAudioDismissed(true);
  };

  const handleShare = () => {
    onShare?.();
    const shareUrl = `${window.location.origin}/listen`;
    // Try native share API
    if (navigator.share) {
      navigator.share({
        title: "세상 이야기 - 음성 뉴스",
        text: "엄마/아빠, 이거 틀어놓으면 매일 세상 소식 들려줘요 🎧",
        url: shareUrl,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`엄마/아빠, 이거 틀어놓으면 매일 세상 소식 들려줘요 🎧\n${shareUrl}`);
      alert("링크가 복사되었어요! 카카오톡이나 문자로 보내주세요.");
    }
    setShowShareCard(false);
    setShareDismissed(true);
  };

  const skipShare = () => {
    setShowShareCard(false);
    setShareDismissed(true);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-white/30 border-t-white rounded-full mx-auto mb-4" />
          <p className="text-white/70">오늘의 소식을 가져오는 중...</p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center px-8">
          <div className="text-6xl mb-4">📰</div>
          <h2 className="text-xl font-bold text-white mb-2">아직 오늘의 소식이 없어요</h2>
          <p className="text-white/60">잠시 후 다시 확인해주세요</p>
        </div>
      </div>
    );
  }

  const article = articles[currentIndex];
  const catInfo = getCategoryInfo(article.category);
  const isLiked = likedArticles.has(article.news_id);
  const summary = article.versions?.SF
    ? getBodyText(article.versions.SF.body)
    : article.content?.slice(0, 200) || article.sub_title;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex gap-1 p-2 pt-safe">
        {articles.slice(0, 20).map((_, idx) => (
          <div
            key={idx}
            className="h-1 flex-1 rounded-full overflow-hidden bg-white/30"
          >
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: idx < currentIndex ? "100%" : idx === currentIndex ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Main Card */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Background Image */}
        {article.image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${article.image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90" />
          </div>
        )}

        {!article.image_url && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
        )}

        {/* Content */}
        <div className="relative z-10 w-full h-full flex flex-col justify-end p-6 pb-24">
          {/* Character & Journey Message */}
          {(currentJourneyMessage || currentIndex === 0) && showJourneyMessage && (
            <div className="absolute top-16 left-4 right-4 animate-slideDown z-30">
              <div className="flex items-start gap-3 max-w-[320px]">
                {/* 캐릭터 아바타 */}
                <div className="flex-shrink-0 animate-bounceIn">
                  <Character2D mood={characterMood} size="medium" />
                </div>

                {/* 말풍선 */}
                <div className="flex-1 bg-white/95 backdrop-blur-md rounded-2xl rounded-tl-sm p-4 shadow-xl animate-fadeIn">
                  <p className="text-gray-800 text-sm font-medium leading-relaxed">
                    {currentJourneyMessage?.message || "안녕하세요! 👋 저와 함께 오늘의 세상 이야기를 떠나볼까요?"}
                  </p>

                  {/* 여정 진행률 */}
                  <div className="mt-3 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-violet-500" />
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((currentIndex / 20) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{Math.min(currentIndex + 1, 20)}/20</span>
                  </div>
                </div>

                {/* 닫기 버튼 */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowJourneyMessage(false); }}
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/80 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* 미니 캐릭터 (여정 메시지 없을 때) */}
          {!currentJourneyMessage && !showJourneyMessage && currentIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowJourneyMessage(true); }}
              className="absolute top-16 left-4 z-30 animate-bounceIn"
            >
              <Character2D mood={characterMood} size="medium" className="opacity-90 hover:opacity-100 transition-opacity" />
            </button>
          )}

          {/* Category Badge */}
          <div className="mb-3">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-medium"
              style={{ backgroundColor: catInfo.color }}
            >
              <span>{catInfo.emoji}</span>
              <span>{catInfo.label}</span>
            </span>
            <span className="ml-2 text-white/60 text-sm">
              {formatTimeAgo(article.published_at)}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4">
            {article.versions?.SF?.title || article.title}
          </h1>

          {/* Summary */}
          <p className="text-white/80 text-base leading-relaxed line-clamp-4 mb-6">
            {summary}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLike(article.news_id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                isLiked
                  ? "bg-red-500 text-white"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-sm font-medium">유용해요</span>
            </button>

            <a
              href={article.original_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="text-sm font-medium">더 알아보기</span>
            </a>
          </div>
        </div>

        {/* Navigation Arrows (Desktop) */}
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-0 hidden md:block"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex === articles.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-0 hidden md:block"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Click/Tap Zones */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1/3 z-20 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-1/3 z-20 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        />

        {/* Swipe Hint (Mobile, only on first card) */}
        {currentIndex === 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/60 text-sm animate-pulse z-30">
            <ChevronLeft className="w-4 h-4" />
            <span>탭하거나 밀어서 다음 소식</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Interest Selection Card (after 5 cards) */}
      {showInterestCard && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🤔</div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                어떤 소식이 더 궁금하세요?
              </h2>
              <p className="text-gray-500 text-sm">
                여러 개 선택해도 괜찮아요
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { id: "economy", label: "경제/금융", emoji: "💰" },
                { id: "life", label: "생활/건강", emoji: "🏠" },
                { id: "world", label: "세상 이야기", emoji: "🌍" },
                { id: "culture", label: "문화/스포츠", emoji: "🎨" },
              ].map((interest) => (
                <button
                  key={interest.id}
                  onClick={() => handleInterestSelect(interest.id)}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    selectedInterests.includes(interest.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-1">{interest.emoji}</div>
                  <div className="text-sm font-medium text-gray-800">{interest.label}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setSelectedInterests(["economy", "life", "world", "culture"]);
              }}
              className="w-full py-2 text-gray-500 text-sm mb-4 hover:text-gray-700"
            >
              전부 다! ✨
            </button>

            <div className="flex gap-3">
              <button
                onClick={skipInterests}
                className="flex-1 py-3 rounded-xl text-gray-500 hover:bg-gray-100 transition-all"
              >
                나중에
              </button>
              <button
                onClick={confirmInterests}
                className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-all"
              >
                선택 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Experience Card (after 10 cards) */}
      {showAudioCard && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🎧</div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                이 소식, 귀로도 들어보시겠어요?
              </h2>
              <p className="text-gray-500 text-sm">
                따뜻한 목소리로 뉴스를 들려드릴게요
              </p>
            </div>

            <button
              onClick={handleAudioTry}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium flex items-center justify-center gap-2 mb-4 hover:opacity-90 transition-all"
            >
              <Volume2 className="w-5 h-5" />
              들어보기
            </button>

            <button
              onClick={skipAudio}
              className="w-full py-3 text-gray-500 hover:text-gray-700"
            >
              다음에 들어볼게요
            </button>
          </div>
        </div>
      )}

      {/* Share to Parents Card (after 15 cards) */}
      {showShareCard && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">💝</div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                이 따뜻한 소식,<br/>부모님께도 들려드릴까요?
              </h2>
              <p className="text-gray-500 text-sm">
                부모님도 세상 이야기 좋아하시잖아요
              </p>
            </div>

            <button
              onClick={handleShare}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium flex items-center justify-center gap-2 mb-4 hover:opacity-90 transition-all"
            >
              <Share2 className="w-5 h-5" />
              부모님께 보내드리기
            </button>

            <button
              onClick={skipShare}
              className="w-full py-3 text-gray-500 hover:text-gray-700"
            >
              나중에 할게요
            </button>
          </div>
        </div>
      )}

      {/* Card Counter */}
      <div className="absolute bottom-4 right-4 z-20 px-3 py-1 bg-white/20 rounded-full text-white text-sm">
        {currentIndex + 1} / {Math.min(articles.length, 20)}
      </div>

      {/* 피드 모드로 전환 버튼 */}
      {onSwitchToFeed && (
        <button
          onClick={(e) => { e.stopPropagation(); onSwitchToFeed(); }}
          className="absolute bottom-4 left-4 z-30 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur rounded-full text-gray-700 text-sm font-medium shadow-lg hover:bg-white transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          목록으로
        </button>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
          50% { box-shadow: 0 0 20px 10px rgba(139, 92, 246, 0.2); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideDown {
          animation: slideDown 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .animate-bounceIn {
          animation: bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .pt-safe {
          padding-top: max(0.5rem, env(safe-area-inset-top));
        }
        /* Better touch handling */
        .select-none {
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
          touch-action: pan-y;
        }
      `}</style>
    </div>
  );
}
