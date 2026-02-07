import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipForward, RotateCcw, Volume2, Home, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { API_URL } from "@/config/api";

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

// 카테고리 이모지
const categoryEmoji: Record<string, string> = {
  "경제": "💰",
  "정치": "🏛️",
  "사회": "🏘️",
  "국제": "🌍",
  "IT_과학": "💡",
  "산업": "🏭",
  "문화": "🎨",
  "스포츠": "⚽",
  "건강": "💪",
  "생활": "🏠",
};

function getBodyText(body: string | string[]): string {
  const text = Array.isArray(body) ? body.join("\n\n") : body;
  const clean = text.replace(/\*\*/g, "").replace(/\n\n+/g, "\n");
  return clean.slice(0, 500);
}

interface Props {
  initialInterests?: string[];
}

export function ElderlyNewsFeed({ initialInterests = [] }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.9); // 느리게 기본
  const [showSettings, setShowSettings] = useState(false);
  const [showInterestCard, setShowInterestCard] = useState(false);
  const [showEndCard, setShowEndCard] = useState(false);
  const [hasAskedInterest, setHasAskedInterest] = useState(false);
  const [greetingDone, setGreetingDone] = useState(false);

  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasAutoPlayed = useRef(false);

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
            page_size: 20,
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

  // Auto-play greeting on first load
  useEffect(() => {
    if (!loading && articles.length > 0 && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      // Small delay then start greeting
      setTimeout(() => {
        speakGreeting();
      }, 1000);
    }
  }, [loading, articles]);

  // Check for interest card at index 2
  useEffect(() => {
    if (currentIndex === 2 && !hasAskedInterest) {
      setShowInterestCard(true);
    }
    // Show end card after 5 articles
    if (currentIndex >= 4 && currentIndex === articles.length - 1) {
      setShowEndCard(true);
    }
  }, [currentIndex, hasAskedInterest, articles.length]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = speechRate;
    utterance.pitch = 1;

    // Try to find a Korean voice
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find(v => v.lang.startsWith("ko"));
    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    utterance.onend = () => {
      setIsPlaying(false);
      onEnd?.();
    };

    utterance.onerror = () => {
      setIsPlaying(false);
    };

    speechRef.current = utterance;
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  }, [speechRate]);

  const speakGreeting = useCallback(() => {
    const greeting = "안녕하세요! 오늘 세상 이야기 들려드릴게요.";
    speak(greeting, () => {
      setGreetingDone(true);
      // Auto-play first article after greeting
      setTimeout(() => {
        speakCurrentArticle();
      }, 500);
    });
  }, [speak]);

  const speakCurrentArticle = useCallback(() => {
    if (articles.length === 0) return;
    const article = articles[currentIndex];
    if (!article) return;

    const version = article.versions?.SF;
    const title = version?.title || article.title;
    const body = version ? getBodyText(version.body) : article.content?.slice(0, 300) || article.sub_title;

    const text = `${title}. ${body}`;
    speak(text);
  }, [articles, currentIndex, speak]);

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopSpeaking();
    } else {
      speakCurrentArticle();
    }
  };

  const goNext = () => {
    stopSpeaking();
    if (currentIndex < articles.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => speakCurrentArticle(), 300);
    }
  };

  const replay = () => {
    stopSpeaking();
    setTimeout(() => speakCurrentArticle(), 100);
  };

  const handleInterestSelect = (interest: string) => {
    setShowInterestCard(false);
    setHasAskedInterest(true);
    // Continue playing
    setTimeout(() => speakCurrentArticle(), 300);
  };

  const handleEndAction = (action: "home" | "notification") => {
    setShowEndCard(false);
    if (action === "home") {
      // PWA install prompt or add to home screen
      alert("홈 화면에 추가하기 기능은 준비 중입니다.");
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-bounce">👵</div>
          <p className="text-2xl text-gray-700 font-medium">
            오늘의 소식을 준비하고 있어요...
          </p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-6">📰</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            아직 오늘의 소식이 없어요
          </h2>
          <p className="text-xl text-gray-600">
            잠시 후 다시 들러주세요
          </p>
        </div>
      </div>
    );
  }

  const article = articles[currentIndex];
  const version = article?.versions?.SF;
  const title = version?.title || article?.title || "";
  const emoji = categoryEmoji[article?.category] || "📰";

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="p-3 hover:bg-amber-100 rounded-2xl transition-colors">
            <Home className="w-7 h-7 text-amber-700" />
          </Link>
          <h1 className="text-xl font-bold text-amber-900">오늘의 세상 이야기</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 hover:bg-amber-100 rounded-2xl transition-colors"
          >
            <Settings className="w-7 h-7 text-amber-700" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Character Greeting */}
        <div className="mb-8 flex items-start gap-4">
          <div className="text-6xl">👵</div>
          <div className="flex-1 bg-white rounded-3xl rounded-tl-lg p-6 shadow-lg border border-amber-200">
            <p className="text-xl text-gray-800 leading-relaxed">
              {!greetingDone
                ? "안녕하세요! 오늘 세상 이야기 들려드릴게요."
                : `${currentIndex + 1}번째 소식이에요.`
              }
            </p>
          </div>
        </div>

        {/* Article Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8 border-2 border-amber-200">
          {/* Category */}
          <div className="bg-amber-100 px-6 py-4 flex items-center gap-3">
            <span className="text-3xl">{emoji}</span>
            <span className="text-xl font-bold text-amber-900">{article.category} 소식</span>
          </div>

          {/* Image */}
          {article.image_url && (
            <div className="h-56 overflow-hidden">
              <img
                src={article.image_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Title */}
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 leading-snug mb-4">
              {title}
            </h2>

            {/* Playing Indicator */}
            {isPlaying && (
              <div className="flex items-center gap-2 text-amber-600">
                <Volume2 className="w-6 h-6 animate-pulse" />
                <span className="text-lg font-medium">읽는 중...</span>
              </div>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="space-y-4">
          {/* Main Controls */}
          <div className="flex gap-4">
            <button
              onClick={replay}
              className="flex-1 py-5 bg-white rounded-2xl shadow-lg border-2 border-amber-300 flex items-center justify-center gap-3 text-amber-800 hover:bg-amber-50 active:scale-95 transition-all"
            >
              <RotateCcw className="w-8 h-8" />
              <span className="text-xl font-bold">다시 듣기</span>
            </button>

            <button
              onClick={goNext}
              disabled={currentIndex >= articles.length - 1}
              className="flex-1 py-5 bg-amber-500 rounded-2xl shadow-lg flex items-center justify-center gap-3 text-white hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipForward className="w-8 h-8" />
              <span className="text-xl font-bold">다음 소식</span>
            </button>
          </div>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className={`w-full py-6 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 ${
              isPlaying
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-10 h-10" />
                <span className="text-2xl font-bold">멈추기</span>
              </>
            ) : (
              <>
                <Play className="w-10 h-10" />
                <span className="text-2xl font-bold">듣기</span>
              </>
            )}
          </button>
        </div>

        {/* Progress */}
        <div className="mt-8 text-center">
          <p className="text-xl text-amber-800 font-medium">
            {currentIndex + 1} / {Math.min(articles.length, 10)} 번째 이야기
          </p>
        </div>
      </main>

      {/* Interest Selection Modal */}
      {showInterestCard && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🤔</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                혹시 더 듣고 싶은<br/>이야기가 있으세요?
              </h2>
            </div>

            <div className="space-y-3">
              {[
                { id: "economy", label: "경제 소식", emoji: "💰" },
                { id: "health", label: "건강 이야기", emoji: "💪" },
                { id: "world", label: "세상 소식", emoji: "🌍" },
                { id: "any", label: "아무거나 좋아요", emoji: "😊" },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleInterestSelect(option.id)}
                  className="w-full py-5 px-6 bg-amber-50 hover:bg-amber-100 rounded-2xl flex items-center gap-4 transition-colors border-2 border-amber-200"
                >
                  <span className="text-3xl">{option.emoji}</span>
                  <span className="text-xl font-bold text-gray-800">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* End Card Modal */}
      {showEndCard && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🌙</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                오늘 이야기는 여기까지예요
              </h2>
              <p className="text-xl text-gray-600">
                내일 또 찾아올게요!
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleEndAction("home")}
                className="w-full py-5 bg-amber-500 text-white rounded-2xl text-xl font-bold hover:bg-amber-600 transition-colors"
              >
                📱 내일도 들을래요
              </button>
              <button
                onClick={() => setShowEndCard(false)}
                className="w-full py-4 text-gray-500 text-lg hover:text-gray-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">⚙️</div>
              <h2 className="text-2xl font-bold text-gray-900">설정</h2>
            </div>

            <div className="mb-6">
              <p className="text-xl font-bold text-gray-800 mb-4">읽는 속도</p>
              <div className="flex gap-3">
                {[
                  { rate: 0.7, label: "느리게" },
                  { rate: 0.9, label: "보통" },
                  { rate: 1.1, label: "빠르게" },
                ].map((option) => (
                  <button
                    key={option.rate}
                    onClick={() => setSpeechRate(option.rate)}
                    className={`flex-1 py-4 rounded-2xl text-lg font-bold transition-colors ${
                      speechRate === option.rate
                        ? "bg-amber-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl text-xl font-bold hover:bg-gray-200 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
