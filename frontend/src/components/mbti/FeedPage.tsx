import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { MbtiGroupId } from "@/data/mbtiGroups";
import { API_URL } from "@/config/api";
import { ArticleView } from "./ArticleView";
import { UserMenu } from "@/components/auth/UserMenu";
import { mockArticles } from "@/data/mockArticles";
import { BarChart3, BookOpen, Lightbulb, Coffee, Coins, Rocket, Globe, Sparkles, Calendar, Newspaper, Users, Camera, TrendingUp } from "lucide-react";

// 프리페칭 캐시
const prefetchCache = new Map<string, Article>();

// 스크롤 기반 애니메이션 컴포넌트
const ScrollReveal = ({
  children,
  delay = 0,
  className = "",
  id
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  id?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      id={id}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(60px)',
        transition: 'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {children}
    </div>
  );
};

interface MbtiVersion {
  title: string;
  subtitle: string;
  body: string | string[];
  key_points: string[];
  closing_line: string;
  tone: string;
  image_url?: string;
}

interface Article {
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

interface Props {
  selectedGroup: MbtiGroupId;
  onChangeGroup: () => void;
  onSwitchToStory?: () => void;
  onMbtiChange?: (group: MbtiGroupId) => void;
}

// 아이콘 매핑
const questionIcons = {
  chart: BarChart3,
  book: BookOpen,
  lightbulb: Lightbulb,
  coffee: Coffee,
  coins: Coins,
  rocket: Rocket,
  globe: Globe,
  sparkles: Sparkles,
};

// 오늘의 질문 데이터
const dailyQuestions = [
  {
    id: "q1",
    question: "뉴스를 읽을 때,\n당신의 스타일은?",
    subtitle: "AI가 당신에게 맞는 뉴스를 찾아드려요",
    options: [
      { id: "data", label: "팩트와 데이터 중심", desc: "숫자로 증명된 정보가 좋아요", iconType: "chart" as const, mbti: "NT" as MbtiGroupId },
      { id: "story", label: "스토리와 맥락 중심", desc: "왜 그런지 이해하고 싶어요", iconType: "book" as const, mbti: "NF" as MbtiGroupId },
      { id: "practical", label: "실용적 정보 중심", desc: "바로 활용할 수 있으면 좋겠어요", iconType: "lightbulb" as const, mbti: "ST" as MbtiGroupId },
      { id: "easy", label: "쉽고 재미있게", desc: "부담없이 읽고 싶어요", iconType: "coffee" as const, mbti: "SF" as MbtiGroupId },
    ],
  },
  {
    id: "q2",
    question: "오늘 가장 끌리는\n뉴스 주제는?",
    subtitle: "관심사를 기반으로 피드를 구성해요",
    options: [
      { id: "economy", label: "경제·금융", desc: "돈의 흐름을 읽고 싶어요", iconType: "coins" as const, category: "경제" },
      { id: "tech", label: "테크·미래", desc: "새로운 기술이 궁금해요", iconType: "rocket" as const, category: "테크" },
      { id: "world", label: "글로벌·국제", desc: "세계 이슈가 궁금해요", iconType: "globe" as const, category: "세계" },
      { id: "life", label: "라이프·트렌드", desc: "일상의 변화가 궁금해요", iconType: "sparkles" as const, category: "사회" },
    ],
  },
];

// MBTI 페르소나 정보
const personaInfo: Record<MbtiGroupId, { name: string; style: string; color: string }> = {
  NT: { name: "분석가", style: "데이터와 논리로 본질을 꿰뚫어요", color: "bg-blue-500" },
  NF: { name: "이야기꾼", style: "사람과 감정의 결을 읽어내요", color: "bg-purple-500" },
  ST: { name: "실용가", style: "핵심만 쏙쏙, 바로 써먹을 수 있게", color: "bg-green-500" },
  SF: { name: "친구", style: "편하게 수다 떨듯 알려드려요", color: "bg-orange-500" },
};

// 아카이빙된 문장 타입
interface ArchivedSentence {
  id: string;
  text: string;
  articleId: string;
  articleTitle: string;
  articlePublishedAt?: string; // 기사 발행일
  createdAt: Date; // 저장일
}

function cleanMarkdown(text: string): string {
  return text.replace(/\*\*/g, '');
}

function getBodyText(body: string | string[]): string {
  const text = cleanMarkdown(Array.isArray(body) ? body.join('\n\n') : body);
  const paragraphs = text.split("\n\n").filter(p => p.trim());
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) continue;
    if (trimmed.startsWith('■')) continue;
    if (trimmed.includes('|')) continue;
    if (trimmed.startsWith('---')) continue;
    if (trimmed.length < 20) continue;
    return trimmed.slice(0, 200);
  }
  return "";
}

// 날짜 헬퍼 함수들
const formatDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

const getWeekDays = (baseDate: Date): Date[] => {
  const day = baseDate.getDay();
  const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1); // 월요일 시작
  const monday = new Date(baseDate);
  monday.setDate(diff);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
};

const isSameDay = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const getMonthDays = (year: number, month: number): (Date | null)[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = (firstDay.getDay() + 6) % 7; // 월요일 시작

  const days: (Date | null)[] = [];
  for (let i = 0; i < startPadding; i++) days.push(null);
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  return days;
};

export function FeedPage({ selectedGroup, onMbtiChange }: Props) {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewArticle, setViewArticle] = useState<Article | null>(null);

  // 날짜 관련 상태
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // 질문 관련 상태
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showQuestions, setShowQuestions] = useState(true);

  // 아카이빙 관련 상태 - 목업 데이터
  const [archivedSentences, setArchivedSentences] = useState<ArchivedSentence[]>(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 86400000);
    const threeDaysAgo = new Date(today.getTime() - 3 * 86400000);

    return [
      // 오늘 저장한 문장들
      {
        id: 'mock-1',
        text: '인공지능이 인간의 창의성을 대체하는 것이 아니라, 인간의 창의성을 증폭시키는 도구로 활용될 때 가장 큰 가치를 발휘한다.',
        articleId: 'article-001',
        articleTitle: 'AI 시대, 인간 창의성의 새로운 가능성',
        articlePublishedAt: today.toISOString(),
        createdAt: new Date(today.getTime() + 10 * 3600000), // 오늘 오전 10시
      },
      {
        id: 'mock-2',
        text: '주식시장에서 가장 위험한 말은 "이번엔 다르다"이다. 역사는 반복되지 않지만, 운율은 맞춘다.',
        articleId: 'article-002',
        articleTitle: '2024년 글로벌 증시 전망과 투자 전략',
        articlePublishedAt: today.toISOString(),
        createdAt: new Date(today.getTime() + 14 * 3600000), // 오늘 오후 2시
      },
      // 어제 저장한 문장들
      {
        id: 'mock-3',
        text: '반도체 산업의 핵심은 더 이상 칩의 크기가 아니라, 에너지 효율성과 특화된 아키텍처에 있다.',
        articleId: 'article-003',
        articleTitle: '차세대 반도체 전쟁, 승자는 누구인가',
        articlePublishedAt: yesterday.toISOString(),
        createdAt: new Date(yesterday.getTime() + 9 * 3600000), // 어제 오전 9시
      },
      {
        id: 'mock-4',
        text: '스타트업의 성공은 아이디어가 아니라 실행력에서 결정된다. 좋은 아이디어는 넘쳐나지만, 끝까지 실행하는 팀은 드물다.',
        articleId: 'article-004',
        articleTitle: '유니콘 기업의 공통점: 실행력의 비밀',
        articlePublishedAt: yesterday.toISOString(),
        createdAt: new Date(yesterday.getTime() + 16 * 3600000), // 어제 오후 4시
      },
      {
        id: 'mock-5',
        text: '기후 변화 대응은 선택이 아닌 필수가 되었고, ESG는 기업의 생존 전략으로 자리잡았다.',
        articleId: 'article-005',
        articleTitle: 'ESG 경영, 지속가능한 성장의 열쇠',
        articlePublishedAt: yesterday.toISOString(),
        createdAt: new Date(yesterday.getTime() + 11 * 3600000), // 어제 오전 11시
      },
      // 2일 전
      {
        id: 'mock-6',
        text: '금리 인상 사이클의 끝이 보이기 시작했다. 이제 투자자들은 피벗 이후의 시장을 준비해야 한다.',
        articleId: 'article-006',
        articleTitle: '중앙은행의 피벗, 시장은 어떻게 반응할까',
        articlePublishedAt: twoDaysAgo.toISOString(),
        createdAt: new Date(twoDaysAgo.getTime() + 13 * 3600000),
      },
      // 3일 전
      {
        id: 'mock-7',
        text: '원격 근무가 일상이 된 시대, 기업 문화는 물리적 공간이 아닌 공유된 가치와 신뢰로 구축된다.',
        articleId: 'article-007',
        articleTitle: '하이브리드 워크 시대의 조직 문화',
        articlePublishedAt: threeDaysAgo.toISOString(),
        createdAt: new Date(threeDaysAgo.getTime() + 15 * 3600000),
      },
      {
        id: 'mock-8',
        text: '데이터는 21세기의 석유라고 불리지만, 정제되지 않은 데이터는 그저 소음에 불과하다.',
        articleId: 'article-008',
        articleTitle: '빅데이터 시대, 진짜 가치는 어디에',
        articlePublishedAt: threeDaysAgo.toISOString(),
        createdAt: new Date(threeDaysAgo.getTime() + 10 * 3600000),
      },
    ];
  });
  const [showArchive, setShowArchive] = useState(false);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<"question" | "feed" | "community" | "archive" | "dna">("question");
  const [dnaViewMode, setDnaViewMode] = useState<"radar" | "chart">("radar");
  const [dnaSubTab, setDnaSubTab] = useState<"analysis" | "birthday">("analysis");
  const [birthdayInput, setBirthdayInput] = useState(() => localStorage.getItem("user_birthday") || "");

  // 펼친 기사 상태
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());

  // 내 서랍 날짜 필터
  const [archiveDate, setArchiveDate] = useState<Date>(new Date()); // 오늘부터 시작
  const [showArchiveCalendar, setShowArchiveCalendar] = useState(false);
  const [archiveCalendarMonth, setArchiveCalendarMonth] = useState<Date>(new Date());

  // 선택된 문장 상태 (아카이빙용)
  const [selectedSentence, setSelectedSentence] = useState<{
    text: string;
    articleId: string;
    articleTitle: string;
  } | null>(null);

  // 저장 완료 토스트
  const [showSaveToast, setShowSaveToast] = useState(false);

  // 토스트 표시 함수
  const showToast = () => {
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2500);
  };

  // 텍스트 선택 상태 (플로팅 버튼용)
  const [textSelection, setTextSelection] = useState<{
    text: string;
    articleId: string;
    articleTitle: string;
    articlePublishedAt?: string;
    position: { x: number; y: number };
  } | null>(null);

  // 텍스트 선택 감지
  const handleTextSelect = (articleId: string, articleTitle: string, articlePublishedAt?: string) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selectedText.length > 5) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();

      if (rect) {
        setTextSelection({
          text: selectedText,
          articleId,
          articleTitle,
          articlePublishedAt,
          position: {
            x: rect.left + rect.width / 2,
            y: rect.top - 10
          }
        });
      }
    }
  };

  // 선택 해제 감지
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim().length === 0) {
        // 약간의 딜레이를 주어 버튼 클릭이 가능하도록
        setTimeout(() => {
          const currentSelection = window.getSelection();
          if (!currentSelection || currentSelection.toString().trim().length === 0) {
            setTextSelection(null);
          }
        }, 200);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // 커뮤니티 관련 상태
  const [selectedPost, setSelectedPost] = useState<typeof communityPosts[0] | null>(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [selectedArchiveForPost, setSelectedArchiveForPost] = useState<ArchivedSentence | null>(null);
  const [postComment, setPostComment] = useState("");
  // 인라인 댓글 펼침 상태
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [showAllComments, setShowAllComments] = useState<Set<string>>(new Set());
  const [inlineComment, setInlineComment] = useState<{ [key: string]: string }>({});
  // 투표 상태: 'up' | 'down' | null
  const [userVotes, setUserVotes] = useState<{ [postId: string]: 'up' | 'down' | null }>({});
  // 유저 프로필 모달
  const [selectedUser, setSelectedUser] = useState<{ userName: string; userMbti: string; userAvatar: string } | null>(null);
  // 랭킹 기간 필터
  const [rankingPeriod, setRankingPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // 오디오 플레이어 상태 (목업)
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [currentPlayingArticle, setCurrentPlayingArticle] = useState<{
    title: string;
    category: string;
  } | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [hasUnlockedAudio, setHasUnlockedAudio] = useState(false); // 구독자 여부

  // 1분 미리듣기 제한 (전체 3분 중 33.3%)
  const FREE_PREVIEW_LIMIT = 33.3;

  // 오디오 재생 시작 (목업)
  const startAudioBriefing = () => {
    const firstArticle = articles[0];
    if (firstArticle) {
      setCurrentPlayingArticle({
        title: firstArticle.title,
        category: firstArticle.category
      });
      setShowAudioPlayer(true);
      setIsPlaying(true);
      setAudioProgress(0);
    }
  };

  // 프로그레스 애니메이션 (목업) - 1분 제한
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const maxProgress = hasUnlockedAudio ? 100 : FREE_PREVIEW_LIMIT;

    if (isPlaying && audioProgress < maxProgress) {
      interval = setInterval(() => {
        setAudioProgress(prev => {
          const next = prev + 0.5;
          // 1분 도달 시 페이월 표시
          if (!hasUnlockedAudio && next >= FREE_PREVIEW_LIMIT) {
            setIsPlaying(false);
            setShowPaywall(true);
            return FREE_PREVIEW_LIMIT;
          }
          return Math.min(next, maxProgress);
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, audioProgress, hasUnlockedAudio]);

  // 유저 프로필 데이터 (온도, 칭호, MBTI, 아바타)
  const userProfiles: { [key: string]: { temperature: number; title: string; titleType: 'crown' | 'star' | 'lightning' | 'heart' | 'book' | 'chart'; badges: { name: string; type: 'trophy' | 'fire' | 'chat' | 'bulb' | 'target' | 'chart' }[]; mbti: string; avatar: string } } = {
    "서연": { temperature: 48.5, title: "분석의 여왕", titleType: "crown", badges: [{ name: "추천왕", type: "trophy" }, { name: "데이터러버", type: "chart" }], mbti: "INTJ", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=analyst&backgroundColor=e8f4f8&scale=90" },
    "하은": { temperature: 52.3, title: "스토리텔러", titleType: "star", badges: [{ name: "수다쟁이", type: "chat" }, { name: "트렌드세터", type: "target" }], mbti: "ENFP", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=storyteller&backgroundColor=faf5ff&scale=90" },
    "지우": { temperature: 44.8, title: "실용주의자", titleType: "lightning", badges: [{ name: "아이디어뱅크", type: "bulb" }], mbti: "ISTP", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=practical&backgroundColor=f0fdf4&scale=90" },
    "민준": { temperature: 56.2, title: "친화력甲", titleType: "heart", badges: [{ name: "공감왕", type: "trophy" }], mbti: "ESFJ", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=friend&backgroundColor=fff7ed&scale=90" },
    "도윤": { temperature: 41.2, title: "전략가", titleType: "chart", badges: [{ name: "인사이트", type: "bulb" }], mbti: "ENTJ", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=leader&backgroundColor=fef3c7&scale=90" },
    "수아": { temperature: 49.7, title: "문장수집가", titleType: "book", badges: [{ name: "필사러", type: "chat" }], mbti: "INFJ", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=dreamer&backgroundColor=e0e7ff&scale=90" },
    "예준": { temperature: 38.5, title: "지식탐구자", titleType: "book", badges: [{ name: "논리왕", type: "trophy" }], mbti: "INTP", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=thinker&backgroundColor=f3e8ff&scale=90" },
    "시우": { temperature: 58.9, title: "액션히어로", titleType: "lightning", badges: [{ name: "속도왕", type: "fire" }], mbti: "ESTP", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=action&backgroundColor=fce7f3&scale=90" },
    "지아": { temperature: 47.3, title: "감성러버", titleType: "heart", badges: [{ name: "힐링메이커", type: "target" }], mbti: "ISFP", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=artist&backgroundColor=ccfbf1&scale=90" },
    "현우": { temperature: 43.1, title: "원칙주의자", titleType: "chart", badges: [{ name: "팩트체커", type: "target" }], mbti: "ESTJ", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=exec&backgroundColor=fee2e2&scale=90" },
    "유나": { temperature: 54.6, title: "응원단장", titleType: "star", badges: [{ name: "에너자이저", type: "fire" }], mbti: "ENFJ", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=mentor&backgroundColor=dbeafe&scale=90" },
    "준서": { temperature: 42.0, title: "신뢰의 아이콘", titleType: "heart", badges: [{ name: "약속지킴이", type: "trophy" }], mbti: "ISTJ", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=steady&backgroundColor=fef9c3&scale=90" },
    "채원": { temperature: 61.2, title: "분위기메이커", titleType: "star", badges: [{ name: "파티플래너", type: "target" }], mbti: "ESFP", avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=performer&backgroundColor=d1fae5&scale=90" },
  };

  // 타이틀 아이콘 SVG
  const TitleIcon = ({ type, className = "w-4 h-4" }: { type: string; className?: string }) => {
    const icons: { [key: string]: JSX.Element } = {
      crown: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.5 5 5.5.5-4 4 1 5.5-5-3-5 3 1-5.5-4-4 5.5-.5L12 3z" /></svg>,
      star: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>,
      lightning: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
      heart: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>,
      book: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>,
      chart: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
    };
    return icons[type] || icons.star;
  };

  // 뱃지 아이콘 SVG
  const BadgeIcon = ({ type, className = "w-3 h-3" }: { type: string; className?: string }) => {
    const icons: { [key: string]: JSX.Element } = {
      trophy: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>,
      fire: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>,
      chat: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>,
      bulb: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>,
      target: <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" /></svg>,
    };
    return icons[type] || icons.trophy;
  };

  // 온도에 따른 색상
  const getTemperatureColor = (temp: number) => {
    if (temp >= 55) return "text-red-500";
    if (temp >= 45) return "text-orange-500";
    if (temp >= 35) return "text-yellow-500";
    return "text-blue-500";
  };

  const getTemperatureBarColor = (temp: number) => {
    if (temp >= 55) return "from-red-400 to-orange-400";
    if (temp >= 45) return "from-orange-400 to-yellow-400";
    if (temp >= 35) return "from-yellow-400 to-green-400";
    return "from-blue-400 to-cyan-400";
  };

  // 커뮤니티 목업 데이터 - 아카이빙 문장 + 코멘트 형태
  const [communityPosts, setCommunityPosts] = useState([
    {
      id: "p1",
      userName: "서연",
      userMbti: "INTJ",
      userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=analyst&backgroundColor=e8f4f8&scale=90",
      timeAgo: "방금 전",
      archivedSentence: "AI 반도체 점유율 32%로 1위를 탈환했다는 것은 단순한 수치 이상의 의미를 갖는다.",
      userComment: "드디어 삼성이 움직이기 시작했다. HBM 기술력만 따라잡으면 진짜 반격 시작일듯",
      articleTitle: "반도체 전쟁, 삼성의 반격이 시작됐다",
      tags: ["반도체", "삼성전자", "HBM"],
      upvotes: 34,
      commentCount: 12,
      commentList: [
        { id: "c1", userName: "지우", userMbti: "ISTP", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=practical&backgroundColor=f0fdf4&scale=90", text: "HBM4 양산 시점이 관건일듯", timeAgo: "10분 전", likes: 5 },
        { id: "c2", userName: "하은", userMbti: "ENFP", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=storyteller&backgroundColor=faf5ff&scale=90", text: "엔비디아 납품 물량이 늘어나야 진짜 의미있지 않을까요?", timeAgo: "30분 전", likes: 8 },
        { id: "c3", userName: "민준", userMbti: "ESFJ", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=friend&backgroundColor=fff7ed&scale=90", text: "삼성 화이팅", timeAgo: "1시간 전", likes: 2 },
        { id: "c3a", userName: "도윤", userMbti: "ENTJ", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=leader&backgroundColor=fef3c7&scale=90", text: "TSMC랑 격차 줄이려면 최소 2년은 걸릴 듯", timeAgo: "2시간 전", likes: 11 },
        { id: "c3b", userName: "수아", userMbti: "INFJ", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=dreamer&backgroundColor=e0e7ff&scale=90", text: "파운드리 점유율도 같이 봐야 전체 그림이 보여요", timeAgo: "2시간 전", likes: 7 },
        { id: "c3c", userName: "예준", userMbti: "INTP", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=thinker&backgroundColor=f3e8ff&scale=90", text: "HBM3E는 이미 양산 중이고 HBM4가 내년 상반기 목표라던데", timeAgo: "3시간 전", likes: 15 },
        { id: "c3d", userName: "시우", userMbti: "ESTP", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=action&backgroundColor=fce7f3&scale=90", text: "주가는 이미 반영된 거 아닌가요?", timeAgo: "4시간 전", likes: 4 },
        { id: "c3e", userName: "지아", userMbti: "ISFP", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=artist&backgroundColor=ccfbf1&scale=90", text: "장기 투자 관점에서 보면 좋은 뉴스", timeAgo: "5시간 전", likes: 9 },
        { id: "c3f", userName: "현우", userMbti: "ESTJ", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=exec&backgroundColor=fee2e2&scale=90", text: "실적으로 증명해야 진짜죠", timeAgo: "6시간 전", likes: 6 },
        { id: "c3g", userName: "유나", userMbti: "ENFJ", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=mentor&backgroundColor=dbeafe&scale=90", text: "한국 반도체 화이팅입니다!", timeAgo: "7시간 전", likes: 3 },
        { id: "c3h", userName: "준서", userMbti: "ISTJ", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=steady&backgroundColor=fef9c3&scale=90", text: "객관적 데이터 감사합니다", timeAgo: "8시간 전", likes: 2 },
        { id: "c3i", userName: "채원", userMbti: "ESFP", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=performer&backgroundColor=d1fae5&scale=90", text: "드디어 좋은 소식이네요 ㅎㅎ", timeAgo: "어제", likes: 1 },
      ],
    },
    {
      id: "p2",
      userName: "하은",
      userMbti: "ENFP",
      userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=storyteller&backgroundColor=faf5ff&scale=90",
      timeAgo: "1시간 전",
      archivedSentence: "금리 인하 시점이 예상보다 빨라질 수 있다는 신호다.",
      userComment: "예금 만기 되면 어디로 옮겨야 하나... 채권 ETF 알아봐야겠다",
      articleTitle: "연준의 새로운 메시지, 시장은 어떻게 반응할까",
      tags: ["금리", "연준", "채권"],
      upvotes: 67,
      commentCount: 23,
      commentList: [
        { id: "c4", userName: "서연", userMbti: "INTJ", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=analyst&backgroundColor=e8f4f8&scale=90", text: "KODEX 국고채 10년 추천드려요", timeAgo: "20분 전", likes: 12 },
        { id: "c5", userName: "지우", userMbti: "ISTP", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=practical&backgroundColor=f0fdf4&scale=90", text: "저는 미국 장기채 ETF로 갈아탔어요", timeAgo: "45분 전", likes: 7 },
      ],
    },
    {
      id: "p3",
      userName: "지우",
      userMbti: "ISTP",
      userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=practical&backgroundColor=f0fdf4&scale=90",
      timeAgo: "3시간 전",
      archivedSentence: "전기차 배터리 가격이 kWh당 100달러 아래로 떨어지면 내연기관차와의 가격 경쟁이 본격화된다.",
      userComment: "지금 차 바꾸려는데 이거 보고 1년만 더 기다리기로 함",
      articleTitle: "배터리 가격 하락, 전기차 대중화 앞당긴다",
      tags: ["전기차", "배터리"],
      upvotes: 89,
      commentCount: 31,
      commentList: [
        { id: "c6", userName: "민준", userMbti: "ESFJ", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=friend&backgroundColor=fff7ed&scale=90", text: "저도 기다리는 중.. 충전 인프라도 더 좋아지겠죠", timeAgo: "1시간 전", likes: 15 },
        { id: "c7", userName: "서연", userMbti: "INTJ", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=analyst&backgroundColor=e8f4f8&scale=90", text: "LFP 배터리 가격 하락이 더 빠를 것 같아요", timeAgo: "2시간 전", likes: 9 },
      ],
    },
    {
      id: "p4",
      userName: "민준",
      userMbti: "ESFJ",
      userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=friend&backgroundColor=fff7ed&scale=90",
      timeAgo: "5시간 전",
      archivedSentence: "이번 실적은 시장 예상치를 15% 상회하는 수준으로, 3분기 연속 어닝 서프라이즈를 기록했다.",
      userComment: "빅테크 진짜 무섭다... 떨어질 때 좀 살걸",
      articleTitle: "빅테크 실적 시즌, 예상을 뛰어넘다",
      tags: ["빅테크", "실적", "투자"],
      upvotes: 45,
      commentCount: 8,
      commentList: [
        { id: "c8", userName: "서연", userMbti: "INTJ", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=analyst&backgroundColor=e8f4f8&scale=90", text: "지금이라도 늦지 않았어요 장기 투자 관점에서는", timeAgo: "3시간 전", likes: 6 },
      ],
    },
    {
      id: "p5",
      userName: "서연",
      userMbti: "INTJ",
      userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=analyst&backgroundColor=e8f4f8&scale=90",
      timeAgo: "어제",
      archivedSentence: "부동산 PF 부실 우려가 현실화되면서 건설사들의 자금 조달에 빨간불이 켜졌다.",
      userComment: "분양가 떨어지면 좋겠는데... 현실적으로 힘들려나",
      articleTitle: "건설업계, PF 위기 본격화",
      tags: ["부동산", "PF", "건설"],
      upvotes: 52,
      commentCount: 19,
      commentList: [
        { id: "c9", userName: "지우", userMbti: "ISTP", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=practical&backgroundColor=f0fdf4&scale=90", text: "분양가는 안떨어지고 할인분양만 늘어날듯", timeAgo: "5시간 전", likes: 11 },
        { id: "c10", userName: "하은", userMbti: "ENFP", userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=storyteller&backgroundColor=faf5ff&scale=90", text: "지방은 이미 많이 떨어졌더라고요", timeAgo: "8시간 전", likes: 4 },
      ],
    },
  ]);

  // 인기 태그
  const trendingTags = ["반도체", "금리", "전기차", "AI", "부동산", "빅테크", "투자"];

  // 프리페칭
  const prefetchingRef = useRef<Set<string>>(new Set());

  const prefetchArticle = useCallback((article: Article) => {
    const id = article.news_id;
    if (id.startsWith('mock-')) return;
    if (prefetchCache.has(id) || prefetchingRef.current.has(id)) return;
    if (article.versions && Object.keys(article.versions).length === 4) return;

    prefetchingRef.current.add(id);
    // 먼저 S3에서 상세 정보 가져오기 시도
    fetch(`${API_URL}/s3-article/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          // S3에 없으면 기존 API로 fallback
          return fetch(`${API_URL}/api/article/${id}`).then(r => r.json());
        }
        return data;
      })
      .then(data => {
        const enrichedArticle: Article = {
          ...article,
          content: data.content_ko || article.content,
          ...(data.version_NT?.body && data.version_NF?.body && data.version_ST?.body && data.version_SF?.body
            ? { versions: { NT: data.version_NT, NF: data.version_NF, ST: data.version_ST, SF: data.version_SF } }
            : {}),
        };
        prefetchCache.set(id, enrichedArticle);
      })
      .catch(() => {})
      .finally(() => prefetchingRef.current.delete(id));
  }, []);

  const openArticle = useCallback((article: Article) => {
    const cachedArticle = prefetchCache.get(article.news_id);
    setViewArticle(cachedArticle || article);
    window.history.pushState({ articleId: article.news_id }, "", `#article-${article.news_id}`);
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (viewArticle && !event.state?.articleId) setViewArticle(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [viewArticle]);

  const handleCloseArticle = useCallback(() => {
    if (viewArticle) window.history.back();
  }, [viewArticle]);

  // 기사 로드 - S3에서 선택된 날짜 기사 가져오기
  useEffect(() => {
    async function fetchArticles() {
      try {
        setLoading(true);
        const dateStr = formatDateStr(selectedDate);
        // S3에서 해당 날짜 기사 가져오기
        const res = await fetch(`${API_URL}/s3-articles?date=${dateStr}&limit=30`);
        const data = await res.json();
        if (data.articles?.length > 0) {
          setArticles(data.articles);
        } else {
          // S3에 기사가 없으면 기존 search API로 fallback
          const targetDate = selectedDate.toISOString().slice(0, 10);
          const nextDay = new Date(selectedDate);
          nextDay.setDate(nextDay.getDate() + 1);
          const searchRes = await fetch(`${API_URL}/api/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: "*",
              filters: { published_from: targetDate, published_until: nextDay.toISOString().slice(0, 10) },
              page: 1,
              page_size: 30,
            }),
          });
          const searchData = await searchRes.json();
          if (searchData.articles?.length > 0) {
            setArticles(searchData.articles);
          } else {
            setArticles([]);
          }
        }
      } catch {
        setArticles([]);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, [selectedDate]);

  // 질문 답변 선택
  const handleSelectAnswer = (questionId: string, optionId: string, mbti?: MbtiGroupId) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));

    // MBTI 변경이 있으면 적용
    if (mbti && onMbtiChange) {
      onMbtiChange(mbti);
      localStorage.setItem("mbti-group", mbti);
    }

    // 다음 질문으로 또는 피드로
    if (currentQuestionIndex < dailyQuestions.length - 1) {
      setTimeout(() => setCurrentQuestionIndex(prev => prev + 1), 300);
    } else {
      setTimeout(() => {
        setShowQuestions(false);
        setActiveTab("feed");
      }, 500);
    }
  };

  // 문장 아카이빙
  const archiveSentence = (text: string, articleId: string, articleTitle: string, articlePublishedAt?: string) => {
    const newSentence: ArchivedSentence = {
      id: `${articleId}-${Date.now()}`,
      text,
      articleId,
      articleTitle,
      articlePublishedAt,
      createdAt: new Date(),
    };
    setArchivedSentences(prev => [newSentence, ...prev]);
  };

  const currentQuestion = dailyQuestions[currentQuestionIndex];
  const persona = personaInfo[selectedGroup];

  // 뉴스 DNA 데이터 (예시)
  const newsDNA = {
    economy: 75,
    tech: 60,
    world: 40,
    society: 30,
    culture: 20,
    politics: 45,
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      {/* Header - 1단 통합 */}
      <header className="sticky top-0 bg-white z-[100] border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center h-[56px] gap-10">
            {/* 로고 */}
            <h1 className="text-[20px] font-bold text-gray-900 tracking-tight flex-shrink-0">AI LENS</h1>

            {/* 탭 */}
            <nav className="flex items-center gap-1 flex-1">
              <button
                onClick={() => {
                  setShowQuestions(true);
                  setCurrentQuestionIndex(0);
                  setSelectedAnswers({});
                  setActiveTab("question");
                }}
                className={`px-4 py-2 text-[14px] font-medium rounded-lg transition-colors duration-200 ${
                  activeTab === "question"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                오늘의 질문
              </button>

              <button
                onClick={() => {
                  setShowQuestions(false);
                  setActiveTab("feed");
                }}
                className={`px-4 py-2 text-[14px] font-medium rounded-lg transition-colors duration-200 ${
                  activeTab === "feed"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                뉴스피드
              </button>

              <button
                onClick={() => setActiveTab("community")}
                className={`px-4 py-2 text-[14px] font-medium rounded-lg transition-colors duration-200 ${
                  activeTab === "community"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                커뮤니티
              </button>

              <button
                onClick={() => setActiveTab("archive")}
                className={`px-4 py-2 text-[14px] font-medium rounded-lg transition-colors duration-200 ${
                  activeTab === "archive"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  내 서랍
                  {archivedSentences.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full min-w-[18px] text-center">
                      {archivedSentences.length}
                    </span>
                  )}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("dna")}
                className={`px-4 py-2 text-[14px] font-medium rounded-lg transition-colors duration-200 ${
                  activeTab === "dna"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                나의 DNA
              </button>
            </nav>

            {/* 우측 메뉴 */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className={`px-3 py-1.5 rounded-full ${persona.color} bg-opacity-10`}>
                <span className={`text-[13px] font-medium ${persona.color.replace('bg-', 'text-')}`}>
                  {persona.name}
                </span>
              </div>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1">
        {/* 질문 모드 */}
        {showQuestions && activeTab === "question" && (
          <div className="min-h-[calc(100vh-130px)] flex flex-col">
            {/* 진행 표시 - 상단 고정 */}
            <div className="max-w-[600px] w-full mx-auto px-6 pt-8">
              <div className="flex gap-2">
                {dailyQuestions.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      idx <= currentQuestionIndex ? "bg-blue-500" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>
              <p className="text-[13px] text-gray-400 mt-3">
                {currentQuestionIndex + 1} / {dailyQuestions.length}
              </p>
            </div>

            {/* 질문 영역 - 중앙 정렬 */}
            <div className="flex-1 flex flex-col justify-center max-w-[640px] w-full mx-auto px-6 py-10">
              {/* AI 브랜딩 */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-[13px] font-medium text-blue-600">AI LENS</span>
              </div>

              {/* 질문 */}
              <h2 className="text-[28px] md:text-[32px] font-bold text-gray-900 leading-snug mb-3 whitespace-pre-line">
                {currentQuestion.question}
              </h2>

              {/* 서브타이틀 */}
              {'subtitle' in currentQuestion && (
                <p className="text-[15px] text-gray-400 mb-10">
                  {currentQuestion.subtitle}
                </p>
              )}

              {/* 선택지 - 2열 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentQuestion.options.map((option) => {
                  const isSelected = selectedAnswers[currentQuestion.id] === option.id;
                  const IconComponent = 'iconType' in option ? questionIcons[option.iconType as keyof typeof questionIcons] : null;

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelectAnswer(
                        currentQuestion.id,
                        option.id,
                        'mbti' in option ? option.mbti : undefined
                      )}
                      className={`p-5 rounded-2xl text-left transition-all duration-200 border ${
                        isSelected
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:shadow-md active:scale-[0.98]"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {IconComponent && (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "bg-white/20" : "bg-blue-50"
                          }`}>
                            <IconComponent className={`w-5 h-5 ${isSelected ? "text-white" : "text-blue-500"}`} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[15px] font-semibold ${isSelected ? "text-white" : "text-gray-900"}`}>
                            {option.label}
                          </p>
                          {'desc' in option && (
                            <p className={`text-[13px] mt-1 ${isSelected ? "text-white/70" : "text-gray-400"}`}>
                              {option.desc}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 건너뛰기 - 하단 고정 */}
            <div className="max-w-[600px] w-full mx-auto px-6 pb-8">
              <button
                onClick={() => {
                  setShowQuestions(false);
                  setActiveTab("feed");
                }}
                className="w-full py-4 text-[14px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                오늘은 그냥 둘러볼게요
              </button>
            </div>
          </div>
        )}

        {/* 피드 모드 - 인터랙티브 에디토리얼 스타일 */}
        {activeTab === "feed" && !showQuestions && (
          <div className="min-h-screen bg-white">
            {/* 스타일 정의 */}
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700;900&display=swap');

              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(40px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }

              @keyframes scaleIn {
                from {
                  opacity: 0;
                  transform: scale(0.9);
                }
                to {
                  opacity: 1;
                  transform: scale(1);
                }
              }

              .editorial-fade-in {
                animation: fadeInUp 0.8s ease-out forwards;
                opacity: 0;
              }

              .editorial-scale-in {
                animation: scaleIn 0.6s ease-out forwards;
                opacity: 0;
              }

              .editorial-title {
                font-family: 'Noto Serif KR', serif;
              }

              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }

              @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            {/* 상단 고정 주간 네비게이션 */}
            <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              {/* 월/주 네비게이션 */}
              <div className="flex items-center justify-center gap-4 py-3 px-4">
                <button
                  onClick={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(newDate.getDate() - 7);
                    setSelectedDate(newDate);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    setCalendarMonth(new Date(selectedDate));
                    setShowCalendar(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="text-[16px] font-semibold text-gray-800">
                    {selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(newDate.getDate() + 7);
                    if (newDate <= new Date()) setSelectedDate(newDate);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* 주간 날짜 탭 */}
              <div className="flex justify-center gap-1 px-4 pb-3">
                {getWeekDays(selectedDate).map((day) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const isFuture = day > new Date();
                  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => !isFuture && setSelectedDate(day)}
                      disabled={isFuture}
                      className={`flex flex-col items-center px-3 py-2 rounded-xl transition-all duration-200 min-w-[48px] ${
                        isSelected
                          ? "bg-blue-500 text-white"
                          : isToday
                            ? "bg-gray-100 text-gray-900 font-semibold"
                            : isFuture
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-[11px] mb-1">{dayNames[day.getDay()]}</span>
                      <span className="text-[16px] font-medium">{day.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 캘린더 팝업 */}
            {showCalendar && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCalendar(false)}>
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-[340px]" onClick={(e) => e.stopPropagation()}>
                  {/* 캘린더 헤더 */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-[18px] font-bold">
                      {calendarMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                    </span>
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* 요일 헤더 */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
                      <div key={d} className="text-center text-[12px] text-gray-400 py-2">{d}</div>
                    ))}
                  </div>

                  {/* 날짜 그리드 */}
                  <div className="grid grid-cols-7 gap-1">
                    {getMonthDays(calendarMonth.getFullYear(), calendarMonth.getMonth()).map((day, idx) => {
                      if (!day) return <div key={idx} />;
                      const isSelected = isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());
                      const isFuture = day > new Date();

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (!isFuture) {
                              setSelectedDate(day);
                              setShowCalendar(false);
                            }
                          }}
                          disabled={isFuture}
                          className={`aspect-square flex items-center justify-center rounded-full text-[14px] transition-all ${
                            isSelected
                              ? "bg-blue-500 text-white font-bold"
                              : isToday
                                ? "bg-gray-200 text-gray-900 font-semibold"
                                : isFuture
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  {/* 오늘로 이동 버튼 */}
                  <button
                    onClick={() => {
                      setSelectedDate(new Date());
                      setShowCalendar(false);
                    }}
                    className="w-full mt-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                  >
                    오늘로 이동
                  </button>
                </div>
              </div>
            )}

            {/* MBTI 스위처 + 기사 개수 */}
            <div className="pt-8 pb-6 px-6">
              <div className="max-w-[800px] mx-auto">
                {/* MBTI 유형 스위처 */}
                {(() => {
                  const typeInfo = {
                    NT: {
                      name: "분석가",
                      color: "bg-purple-500",
                      textColor: "text-purple-600",
                      ringColor: "ring-purple-200",
                      shadowColor: "shadow-purple-200/50",
                      avatar: "/editors/intj.png",
                      tagline: "논리와 전략으로 세상을 읽는 사람"
                    },
                    NF: {
                      name: "이야기꾼",
                      color: "bg-rose-500",
                      textColor: "text-rose-600",
                      ringColor: "ring-rose-200",
                      shadowColor: "shadow-rose-200/50",
                      avatar: "/editors/infp.png",
                      tagline: "의미와 가능성을 발견하는 사람"
                    },
                    ST: {
                      name: "실용주의자",
                      color: "bg-emerald-500",
                      textColor: "text-emerald-600",
                      ringColor: "ring-emerald-200",
                      shadowColor: "shadow-emerald-200/50",
                      avatar: "/editors/istj.png",
                      tagline: "사실과 경험을 중시하는 사람"
                    },
                    SF: {
                      name: "공감러",
                      color: "bg-amber-500",
                      textColor: "text-amber-600",
                      ringColor: "ring-amber-200",
                      shadowColor: "shadow-amber-200/50",
                      avatar: "/editors/esfp.png",
                      tagline: "사람과 순간을 소중히 여기는 사람"
                    },
                  };

                  return (
                    <>
                      <div className="flex items-center justify-center gap-10 mb-5">
                        {(["NT", "NF", "ST", "SF"] as const).map((type) => {
                          const isSelected = selectedGroup === type;
                          return (
                            <button
                              key={type}
                              onClick={() => onMbtiChange?.(type)}
                              className="flex flex-col items-center gap-3 group transition-transform duration-300 hover:-translate-y-0.5"
                            >
                              {/* 캐릭터 아바타 with 글로우 효과 */}
                              <div className="relative">
                                {/* 선택 시 배경 글로우 - 은은하게 */}
                                {isSelected && (
                                  <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${typeInfo[type].color}`} />
                                )}
                                <div className={`relative w-[76px] h-[76px] rounded-full overflow-hidden transition-all duration-500 ease-out bg-white ${
                                  isSelected
                                    ? `ring-[2.5px] ${typeInfo[type].ringColor} shadow-lg`
                                    : "ring-1 ring-gray-100 opacity-35 grayscale group-hover:grayscale-0 group-hover:opacity-100 group-hover:ring-gray-200 group-hover:shadow-md"
                                }`}>
                                  <img
                                    src={typeInfo[type].avatar}
                                    alt={typeInfo[type].name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                              {/* 타입 라벨 */}
                              <span className={`px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all duration-300 ${
                                isSelected
                                  ? `${typeInfo[type].color} text-white`
                                  : "bg-transparent text-gray-300 group-hover:text-gray-500"
                              }`}>
                                {type}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {/* 선택된 유형 한줄 소개 */}
                      <div className="text-center mb-2">
                        <p className="text-[13px] text-gray-500 transition-all duration-300">
                          <span className={`font-semibold ${typeInfo[selectedGroup].textColor}`}>{typeInfo[selectedGroup].name}</span>
                          <span className="mx-2 text-gray-200">|</span>
                          <span className="font-light">{typeInfo[selectedGroup].tagline}</span>
                        </p>
                      </div>
                    </>
                  );
                })()}

              </div>
            </div>

            {/* 기사 개수 배지 + 오디오 브리핑 버튼 */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="inline-flex items-center justify-center px-4 py-2 bg-gray-50 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100/50">
                <span className="text-[13px] text-gray-500 font-medium">
                  {articles.length > 0 ? (
                    <>
                      <span className="text-gray-900 font-bold">{articles.length}</span>
                      <span className="ml-1">개의 기사</span>
                    </>
                  ) : "기사가 없습니다"}
                </span>
              </div>

              {/* 오디오 브리핑 버튼 */}
              {articles.length > 0 && (
                <button
                  onClick={startAudioBriefing}
                  className={`group inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
                    showAudioPlayer
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg'
                      : 'bg-white text-gray-600 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-100/80 hover:border-amber-200 hover:shadow-[0_4px_12px_rgba(251,191,36,0.15)]'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    showAudioPlayer
                      ? 'bg-white/20'
                      : 'bg-gradient-to-r from-amber-400 to-orange-500 group-hover:scale-110'
                  }`}>
                    <svg className={`w-3 h-3 ${showAudioPlayer ? 'text-white' : 'text-white'}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <span className="text-[13px] font-medium">
                    {showAudioPlayer ? '브리핑 중' : '오디오 브리핑'}
                  </span>
                </button>
              )}
            </div>

            {/* 기사 목록 - 에디토리얼 스타일 */}
            {loading ? (
              <div className="max-w-[800px] mx-auto px-8 py-10 space-y-16">
                {[1,2,3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-16 mb-6" />
                    <div className="h-10 bg-gray-200 rounded w-full mb-4" />
                    <div className="h-6 bg-gray-100 rounded w-4/5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-[800px] mx-auto px-8 py-10">
                {articles.slice(0, 12).map((article, idx) => {
                  const v = article.versions?.[selectedGroup];
                  const title = v?.title || article.title;
                  const bodyText = v?.body
                    ? (Array.isArray(v.body) ? v.body.join('\n\n') : v.body)
                    : article.content || "";
                  const cleanBody = cleanMarkdown(bodyText);
                  const contentText = cleanBody.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

                  const isExpanded = expandedArticles.has(article.news_id);

                  const toggleExpand = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setExpandedArticles(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(article.news_id)) {
                        newSet.delete(article.news_id);
                      } else {
                        newSet.add(article.news_id);
                      }
                      return newSet;
                    });
                  };

                  return (
                    <ScrollReveal key={article.news_id} delay={idx * 50}>
                      <article
                        id={`article-${idx}`}
                        className="mb-20 last:mb-0"
                      >
                      {/* 번호 - 크고 굵게 */}
                      <div className="mb-4">
                        <span className="text-[32px] font-black text-gray-900">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </div>

                      {/* 카테고리 */}
                      <div className="mb-4">
                        <span className="inline-block px-3 py-1 bg-gray-50 text-[12px] font-medium text-gray-600 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-gray-100/60">
                          {article.category}
                        </span>
                      </div>

                      {/* 제목 - 큰 세리프 폰트 */}
                      <h2 className="editorial-title text-[24px] md:text-[32px] font-bold text-gray-900 leading-[1.3] mb-5">
                        {title}
                      </h2>

                      {/* 본문 */}
                      <div className={`text-[17px] text-gray-600 leading-[1.9] mb-5 overflow-hidden transition-all duration-700 ease-out ${
                        isExpanded ? 'max-h-[4000px] opacity-100' : 'max-h-[150px]'
                      }`}>
                        {isExpanded ? (
                          // 펼쳐진 상태: 드래그로 텍스트 선택 가능
                          <div
                            className="select-text cursor-text"
                            onMouseUp={() => handleTextSelect(article.news_id, title, article.published_at)}
                            onTouchEnd={() => handleTextSelect(article.news_id, title, article.published_at)}
                          >
                            <p className="whitespace-pre-wrap leading-[2]">
                              {contentText}
                            </p>
                          </div>
                        ) : (
                          // 접힌 상태: 그라데이션 페이드
                          <div className="relative">
                            <p className="whitespace-pre-wrap">
                              {contentText.slice(0, 250)}
                            </p>
                            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
                          </div>
                        )}
                      </div>

                      {/* 더보기/접기 버튼 - 중앙 정렬 */}
                      <div className="flex justify-center mt-6">
                        <button
                          onClick={toggleExpand}
                          className={`group flex items-center gap-2 px-6 py-2.5 rounded-full text-[14px] font-medium transition-all duration-300 ${
                            isExpanded
                              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm hover:shadow-md'
                          }`}
                        >
                          <span>{isExpanded ? '접기' : '더보기'}</span>
                          <svg
                            className={`w-4 h-4 transition-transform duration-500 ease-out ${isExpanded ? 'rotate-180' : 'group-hover:translate-y-0.5'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* 펼쳐진 상태일 때 힌트 */}
                      {isExpanded && (
                        <p className="text-center text-[12px] text-gray-400 mt-3" style={{ animation: 'fadeIn 0.5s ease-out 0.3s both' }}>
                          드래그하여 문장을 저장하세요
                        </p>
                      )}

                      {/* 구분선 */}
                      {idx < articles.slice(0, 12).length - 1 && (
                        <div className="mt-12 border-b border-gray-100" />
                      )}
                    </article>
                  </ScrollReveal>
                  );
                })}

                {/* 마무리 섹션 */}
                <ScrollReveal className="mt-32 text-center" id="feed-footer">
                  <p className="editorial-title text-[24px] text-gray-400 mb-4">
                    오늘의 브리핑이 끝났습니다
                  </p>
                  <p className="text-[16px] text-gray-300">
                    내일 또 만나요
                  </p>
                </ScrollReveal>
              </div>
            )}

            {/* 하단 여백 */}
            <div className="h-32" />
          </div>
        )}

        {/* 커뮤니티 모드 - 아카이빙 + 코멘트 */}
        {activeTab === "community" && (
          <div className="min-h-screen bg-white">
            {/* 상단 고정 주간 네비게이션 */}
            <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              {/* 월/주 네비게이션 */}
              <div className="flex items-center justify-center gap-4 py-3 px-4">
                <button
                  onClick={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(newDate.getDate() - 7);
                    setSelectedDate(newDate);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    setCalendarMonth(new Date(selectedDate));
                    setShowCalendar(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="text-[16px] font-semibold text-gray-800">
                    {selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(newDate.getDate() + 7);
                    if (newDate <= new Date()) {
                      setSelectedDate(newDate);
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* 주간 날짜 탭 */}
              <div className="flex justify-center gap-1 px-4 pb-3">
                {getWeekDays(selectedDate).map((day) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const isFuture = day > new Date();
                  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => !isFuture && setSelectedDate(day)}
                      disabled={isFuture}
                      className={`flex flex-col items-center px-3 py-2 rounded-xl transition-all duration-200 min-w-[48px] ${
                        isSelected
                          ? "bg-blue-500 text-white"
                          : isToday
                            ? "bg-gray-100 text-gray-900 font-semibold"
                            : isFuture
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-[11px] mb-1">{dayNames[day.getDay()]}</span>
                      <span className="text-[16px] font-medium">{day.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 캘린더 팝업 */}
            {showCalendar && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCalendar(false)}>
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-[340px]" onClick={(e) => e.stopPropagation()}>
                  {/* 캘린더 헤더 */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-[18px] font-bold">
                      {calendarMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                    </span>
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* 요일 헤더 */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
                      <div key={d} className="text-center text-[12px] text-gray-400 py-2">{d}</div>
                    ))}
                  </div>

                  {/* 날짜 그리드 */}
                  <div className="grid grid-cols-7 gap-1">
                    {getMonthDays(calendarMonth.getFullYear(), calendarMonth.getMonth()).map((day, idx) => {
                      if (!day) return <div key={idx} />;
                      const isSelected = isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());
                      const isFuture = day > new Date();

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (!isFuture) {
                              setSelectedDate(day);
                              setShowCalendar(false);
                            }
                          }}
                          disabled={isFuture}
                          className={`aspect-square flex items-center justify-center rounded-full text-[14px] transition-all ${
                            isSelected
                              ? "bg-blue-500 text-white font-bold"
                              : isToday
                                ? "bg-gray-200 text-gray-900 font-semibold"
                                : isFuture
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  {/* 오늘로 이동 버튼 */}
                  <button
                    onClick={() => {
                      setSelectedDate(new Date());
                      setShowCalendar(false);
                    }}
                    className="w-full mt-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                  >
                    오늘로 이동
                  </button>
                </div>
              </div>
            )}

            <div className="max-w-[1100px] mx-auto px-6 py-8">
              <div className="flex gap-10">
                {/* 메인 피드 */}
                <div className="flex-1 max-w-[680px]">
                  {/* 인기 태그 */}
                  <div className="mb-8 flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-200 ${
                      selectedTag === null
                        ? "bg-blue-500 text-white shadow-sm"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    전체
                  </button>
                  {trendingTags.map((tag, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-200 ${
                        selectedTag === tag
                          ? "bg-blue-500 text-white shadow-sm"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                {/* 포스트 목록 */}
                <div className="space-y-5">
                  {communityPosts
                    .filter(post => selectedTag === null || post.tags.includes(selectedTag))
                    .map((post) => (
                    <div
                      key={post.id}
                      className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-gray-100/80 transition-all duration-300 ease-out overflow-hidden group"
                    >
                      {/* 유저 정보 */}
                      <div className="p-6 pb-0">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedUser({ userName: post.userName, userMbti: post.userMbti, userAvatar: post.userAvatar })}
                            className="w-11 h-11 rounded-full overflow-hidden bg-gray-50 ring-2 ring-gray-100 hover:ring-gray-300 transition-all cursor-pointer"
                          >
                            <img
                              src={post.userAvatar}
                              alt={post.userName}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedUser({ userName: post.userName, userMbti: post.userMbti, userAvatar: post.userAvatar })}
                                className="text-[14px] font-semibold text-gray-900 hover:text-gray-600 transition-colors cursor-pointer"
                              >
                                {post.userName}
                              </button>
                              <span className="px-1.5 py-0.5 bg-gradient-to-r from-slate-100 to-gray-100 rounded text-[10px] font-bold text-gray-500 tracking-wide">
                                {post.userMbti}
                              </span>
                            </div>
                            <p className="text-[12px] text-gray-400">{post.timeAgo}</p>
                          </div>
                        </div>
                      </div>

                      {/* 아카이빙한 문장 (하이라이트) */}
                      <div className="mx-6 mt-5 p-4 bg-gradient-to-r from-amber-50 to-yellow-50/50 border-l-[3px] border-amber-400 rounded-r-lg">
                        <p className="text-[15px] text-gray-800 leading-[1.75] font-medium">
                          "{post.archivedSentence}"
                        </p>
                        <p className="text-[12px] text-gray-400 mt-3 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          {post.articleTitle}
                        </p>
                      </div>

                      {/* 유저 코멘트 */}
                      <div className="px-6 py-5">
                        <p className="text-[15px] text-gray-800 leading-[1.7]">
                          {post.userComment}
                        </p>
                      </div>

                      {/* 태그 */}
                      <div className="px-6 pb-4 flex flex-wrap gap-2">
                        {post.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-gray-50 rounded-md text-[11px] text-gray-500 font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* 반응 버튼 */}
                      <div className="px-6 py-4 border-t border-gray-50 flex items-center gap-2">
                        {/* 업다운 투표 그룹 */}
                        <div className="flex items-center bg-gray-50 rounded-full overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentVote = userVotes[post.id];
                              if (currentVote === 'up') {
                                // 이미 upvote한 상태 → 취소
                                setUserVotes(prev => ({ ...prev, [post.id]: null }));
                                setCommunityPosts(prev => prev.map(p =>
                                  p.id === post.id ? { ...p, upvotes: p.upvotes - 1 } : p
                                ));
                              } else {
                                // upvote
                                setUserVotes(prev => ({ ...prev, [post.id]: 'up' }));
                                setCommunityPosts(prev => prev.map(p =>
                                  p.id === post.id ? { ...p, upvotes: p.upvotes + (currentVote === 'down' ? 2 : 1) } : p
                                ));
                              }
                            }}
                            className={`flex items-center gap-1 px-3 py-2 transition-all duration-200 ${
                              userVotes[post.id] === 'up'
                                ? 'text-emerald-600 bg-emerald-50'
                                : 'text-gray-500 hover:bg-gray-100'
                            }`}
                          >
                            <svg className="w-4 h-4" fill={userVotes[post.id] === 'up' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <span className={`px-2 text-[13px] font-semibold min-w-[32px] text-center ${
                            userVotes[post.id] === 'up' ? 'text-emerald-600' :
                            userVotes[post.id] === 'down' ? 'text-rose-500' : 'text-gray-600'
                          }`}>
                            {post.upvotes}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentVote = userVotes[post.id];
                              if (currentVote === 'down') {
                                // 이미 downvote한 상태 → 취소
                                setUserVotes(prev => ({ ...prev, [post.id]: null }));
                                setCommunityPosts(prev => prev.map(p =>
                                  p.id === post.id ? { ...p, upvotes: p.upvotes + 1 } : p
                                ));
                              } else {
                                // downvote
                                setUserVotes(prev => ({ ...prev, [post.id]: 'down' }));
                                setCommunityPosts(prev => prev.map(p =>
                                  p.id === post.id ? { ...p, upvotes: p.upvotes - (currentVote === 'up' ? 2 : 1) } : p
                                ));
                              }
                            }}
                            className={`flex items-center gap-1 px-3 py-2 transition-all duration-200 ${
                              userVotes[post.id] === 'down'
                                ? 'text-rose-500 bg-rose-50'
                                : 'text-gray-400 hover:bg-gray-100'
                            }`}
                          >
                            <svg className="w-4 h-4" fill={userVotes[post.id] === 'down' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedComments(prev => {
                              const next = new Set(prev);
                              if (next.has(post.id)) {
                                next.delete(post.id);
                              } else {
                                next.add(post.id);
                              }
                              return next;
                            });
                          }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200 ml-1 ${
                            expandedComments.has(post.id) ? 'bg-gray-100' : 'hover:bg-gray-50'
                          }`}
                        >
                          <svg className={`w-4 h-4 ${expandedComments.has(post.id) ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span className={`text-[13px] ${expandedComments.has(post.id) ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{post.commentCount}</span>
                          <svg className={`w-3 h-3 transition-transform duration-200 ${expandedComments.has(post.id) ? 'rotate-180 text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200"
                        >
                          <svg className="w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200"
                        >
                          <svg className="w-[18px] h-[18px] text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </button>
                      </div>

                      {/* 인라인 댓글 섹션 */}
                      {expandedComments.has(post.id) && (
                        <div
                          className="border-t border-gray-100 bg-gray-50/50"
                          onClick={(e) => e.stopPropagation()}
                          style={{ animation: 'slideDown 0.2s ease-out' }}
                        >
                          <style>{`
                            @keyframes slideDown {
                              from { opacity: 0; max-height: 0; }
                              to { opacity: 1; max-height: 500px; }
                            }
                          `}</style>

                          {/* 댓글 입력 */}
                          <div className="px-6 py-4 border-b border-gray-100">
                            <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-amber-50 ring-1 ring-amber-100 flex-shrink-0">
                                <img
                                  src="https://api.dicebear.com/7.x/notionists/svg?seed=me&backgroundColor=fef3c7&scale=90"
                                  alt="나"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 flex gap-2">
                                <input
                                  type="text"
                                  value={inlineComment[post.id] || ''}
                                  onChange={(e) => setInlineComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                                  placeholder="댓글을 입력하세요..."
                                  className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent"
                                />
                                <button
                                  onClick={() => {
                                    if (inlineComment[post.id]?.trim()) {
                                      setCommunityPosts(prev => prev.map(p => {
                                        if (p.id === post.id) {
                                          return {
                                            ...p,
                                            commentCount: p.commentCount + 1,
                                            commentList: [
                                              { id: `c${Date.now()}`, userName: "나", userMbti: selectedGroup, userAvatar: "https://api.dicebear.com/7.x/notionists/svg?seed=me&backgroundColor=fef3c7&scale=90", text: inlineComment[post.id], timeAgo: "방금 전", likes: 0 },
                                              ...p.commentList
                                            ]
                                          };
                                        }
                                        return p;
                                      }));
                                      setInlineComment(prev => ({ ...prev, [post.id]: '' }));
                                    }
                                  }}
                                  disabled={!inlineComment[post.id]?.trim()}
                                  className="px-4 py-2.5 bg-blue-500 text-white rounded-full text-[13px] font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                  등록
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* 댓글 목록 */}
                          <div className="px-6 py-4 space-y-4">
                            {(showAllComments.has(post.id) ? post.commentList : post.commentList.slice(0, 3)).map((comment, idx) => (
                              <div
                                key={comment.id}
                                className="flex gap-3"
                                style={{ animation: `fadeIn 0.3s ease-out ${idx * 0.05}s both` }}
                              >
                                <button
                                  onClick={() => setSelectedUser({ userName: comment.userName, userMbti: comment.userMbti, userAvatar: comment.userAvatar })}
                                  className="w-8 h-8 rounded-full overflow-hidden bg-gray-50 ring-1 ring-gray-100 hover:ring-gray-300 flex-shrink-0 transition-all"
                                >
                                  <img
                                    src={comment.userAvatar}
                                    alt={comment.userName}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <button
                                      onClick={() => setSelectedUser({ userName: comment.userName, userMbti: comment.userMbti, userAvatar: comment.userAvatar })}
                                      className="text-[13px] font-medium text-gray-900 hover:text-gray-600 transition-colors"
                                    >
                                      {comment.userName}
                                    </button>
                                    <span className="px-1 py-0.5 bg-gray-100 rounded text-[9px] font-bold text-gray-400 tracking-wide">{comment.userMbti}</span>
                                    <span className="text-[11px] text-gray-400">{comment.timeAgo}</span>
                                  </div>
                                  <p className="text-[14px] text-gray-700 leading-relaxed">{comment.text}</p>
                                  <button className="mt-1.5 text-[12px] text-gray-400 flex items-center gap-1 hover:text-gray-600 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
                                    </svg>
                                    {comment.likes}
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* 댓글 더보기 */}
                            {post.commentList.length > 3 && !showAllComments.has(post.id) && (
                              <button
                                onClick={() => setShowAllComments(prev => new Set(prev).add(post.id))}
                                className="w-full py-3 text-[13px] text-gray-500 font-medium hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                              >
                                댓글 {post.commentList.length - 3}개 더보기
                              </button>
                            )}

                            {/* 접기 버튼 */}
                            {showAllComments.has(post.id) && post.commentList.length > 3 && (
                              <button
                                onClick={() => setShowAllComments(prev => {
                                  const next = new Set(prev);
                                  next.delete(post.id);
                                  return next;
                                })}
                                className="w-full py-3 text-[13px] text-gray-500 font-medium hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                              >
                                접기
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 사이드바 */}
              <div className="hidden lg:block w-[320px] flex-shrink-0">
                <div className="sticky top-20 space-y-5">
                  {/* 글쓰기 CTA */}
                  <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100/80">
                    <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
                      오늘 읽은 뉴스에서<br />인상 깊은 문장이 있나요?
                    </p>
                    <button
                      onClick={() => setShowWriteModal(true)}
                      className="w-full py-3.5 bg-blue-500 text-white rounded-xl text-[14px] font-semibold hover:bg-blue-600 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      내 문장 공유하기
                    </button>
                  </div>

                  {/* 인기 글 */}
                  <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100/80">
                    <h4 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-5">이번 주 인기</h4>
                    <div className="space-y-5">
                      <div className="group cursor-pointer">
                        <p className="text-[14px] text-gray-800 leading-relaxed line-clamp-2 mb-2 group-hover:text-gray-600 transition-colors">"AI 반도체 점유율 32%로 1위를 탈환했다는 것은..."</p>
                        <p className="text-[12px] text-gray-400 font-medium">추천 34</p>
                      </div>
                      <div className="h-px bg-gray-100" />
                      <div className="group cursor-pointer">
                        <p className="text-[14px] text-gray-800 leading-relaxed line-clamp-2 mb-2 group-hover:text-gray-600 transition-colors">"전기차 배터리 가격이 kWh당 100달러 아래로..."</p>
                        <p className="text-[12px] text-gray-400 font-medium">추천 89</p>
                      </div>
                    </div>
                  </div>

                  {/* 공감온도 랭킹 */}
                  <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100/80">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide">공감온도 TOP</h4>
                      <div className="flex bg-gray-100 rounded-lg p-0.5">
                        {[
                          { key: 'daily', label: '일' },
                          { key: 'weekly', label: '주' },
                          { key: 'monthly', label: '월' },
                        ].map((period) => (
                          <button
                            key={period.key}
                            onClick={() => setRankingPeriod(period.key as 'daily' | 'weekly' | 'monthly')}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                              rankingPeriod === period.key
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {period.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {Object.entries(userProfiles)
                        .sort(([,a], [,b]) => b.temperature - a.temperature)
                        .slice(0, 5)
                        .map(([name, profile], idx) => {
                          return (
                            <button
                              key={name}
                              onClick={() => setSelectedUser({ userName: name, userMbti: profile.mbti, userAvatar: profile.avatar })}
                              className="w-full flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                              {/* 순위 */}
                              <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                                idx === 0 ? 'bg-amber-100 text-amber-600' :
                                idx === 1 ? 'bg-gray-200 text-gray-600' :
                                idx === 2 ? 'bg-orange-100 text-orange-600' :
                                'text-gray-400'
                              }`}>
                                {idx + 1}
                              </span>

                              {/* 아바타 */}
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-50 ring-1 ring-gray-100">
                                <img
                                  src={profile.avatar}
                                  alt={name}
                                  className="w-full h-full object-cover"
                                />
                              </div>

                              {/* 정보 */}
                              <div className="flex-1 text-left">
                                <span className="text-[13px] font-medium text-gray-900">{name}</span>
                              </div>

                              {/* 온도 */}
                              <span className={`text-[13px] font-bold ${getTemperatureColor(profile.temperature)}`}>
                                {profile.temperature.toFixed(1)}°
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* 아카이브 모드 */}
        {activeTab === "archive" && (
          <div className="min-h-[calc(100vh-120px)]">
            {/* 날짜 네비게이션 - 뉴스피드와 동일한 스타일 */}
            {archivedSentences.length > 0 && (
              <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
                {/* 월/주 네비게이션 */}
                <div className="flex items-center justify-center gap-4 py-3 px-4">
                  <button
                    onClick={() => {
                      const current = archiveDate || new Date();
                      const newDate = new Date(current);
                      newDate.setDate(newDate.getDate() - 7);
                      setArchiveDate(newDate);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <button
                    onClick={() => {
                      setArchiveCalendarMonth(archiveDate || new Date());
                      setShowArchiveCalendar(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span className="text-[16px] font-semibold text-gray-800">
                      {(archiveDate || new Date()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => {
                      const current = archiveDate || new Date();
                      const newDate = new Date(current);
                      newDate.setDate(newDate.getDate() + 7);
                      if (newDate <= new Date()) setArchiveDate(newDate);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* 주간 날짜 탭 */}
                <div className="flex justify-center gap-1 px-4 pb-3">
                  {getWeekDays(archiveDate || new Date()).map((day) => {
                    const isSelected = archiveDate && isSameDay(day, archiveDate);
                    const isToday = isSameDay(day, new Date());
                    const isFuture = day > new Date();
                    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                    // 해당 날짜에 저장된 문장이 있는지
                    const hasSentences = archivedSentences.some(s => isSameDay(new Date(s.createdAt), day));

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => !isFuture && setArchiveDate(day)}
                        disabled={isFuture}
                        className={`relative flex flex-col items-center px-3 py-2 rounded-xl transition-all duration-200 min-w-[48px] ${
                          isSelected
                            ? "bg-blue-500 text-white"
                            : isToday
                              ? "bg-gray-100 text-gray-900 font-semibold"
                              : isFuture
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <span className="text-[11px] mb-1">{dayNames[day.getDay()]}</span>
                        <span className="text-[16px] font-medium">{day.getDate()}</span>
                        {hasSentences && !isSelected && (
                          <span className="absolute bottom-1 w-1 h-1 bg-amber-400 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 아카이브 캘린더 팝업 */}
            {showArchiveCalendar && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowArchiveCalendar(false)}>
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-[340px]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setArchiveCalendarMonth(new Date(archiveCalendarMonth.getFullYear(), archiveCalendarMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-[18px] font-bold">
                      {archiveCalendarMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                    </span>
                    <button
                      onClick={() => setArchiveCalendarMonth(new Date(archiveCalendarMonth.getFullYear(), archiveCalendarMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
                      <div key={d} className="text-center text-[12px] text-gray-400 py-2">{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {getMonthDays(archiveCalendarMonth.getFullYear(), archiveCalendarMonth.getMonth()).map((day, idx) => {
                      if (!day) return <div key={idx} />;
                      const isSelected = archiveDate && isSameDay(day, archiveDate);
                      const isToday = isSameDay(day, new Date());
                      const isFuture = day > new Date();
                      // 해당 날짜에 저장된 문장이 있는지 확인
                      const hasSentences = archivedSentences.some(s => isSameDay(new Date(s.createdAt), day));

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (!isFuture) {
                              setArchiveDate(day);
                              setShowArchiveCalendar(false);
                            }
                          }}
                          disabled={isFuture}
                          className={`aspect-square flex flex-col items-center justify-center rounded-full text-[14px] transition-all relative ${
                            isSelected
                              ? "bg-blue-500 text-white font-bold"
                              : isToday
                                ? "bg-gray-200 text-gray-900 font-semibold"
                                : isFuture
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {day.getDate()}
                          {hasSentences && !isSelected && (
                            <span className="absolute bottom-1 w-1 h-1 bg-amber-400 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      setArchiveDate(new Date());
                      setShowArchiveCalendar(false);
                    }}
                    className="w-full mt-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                  >
                    오늘로 이동
                  </button>
                </div>
              </div>
            )}

            <div className="max-w-[600px] mx-auto px-6 py-12">

              {archivedSentences.length === 0 ? (
                // 빈 상태 - 감성적인 디자인
                <div className="text-center py-20">
                  <div
                    className="relative w-24 h-24 mx-auto mb-8"
                    style={{ animation: 'float 4s ease-in-out infinite' }}
                  >
                    <style>{`
                      @keyframes float {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-10px); }
                      }
                    `}</style>
                    <div className="absolute inset-0 bg-amber-200/30 rounded-3xl rotate-6" />
                    <div className="absolute inset-0 bg-amber-100/50 rounded-3xl -rotate-3" />
                    <div className="absolute inset-0 bg-white rounded-3xl shadow-sm flex items-center justify-center">
                      <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </div>
                  </div>

                  <h2 className="text-[24px] font-bold text-gray-900 mb-3">
                    아직 비어있는 서랍
                  </h2>
                  <p className="text-[15px] text-gray-500 leading-relaxed mb-10">
                    뉴스를 읽다 마음에 남는 문장이 있다면<br/>
                    드래그해서 이곳에 보관해보세요
                  </p>

                  <button
                    onClick={() => setActiveTab("feed")}
                    className="group px-8 py-4 bg-blue-500 text-white rounded-2xl text-[15px] font-medium hover:bg-blue-600 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <span className="flex items-center gap-2">
                      오늘의 뉴스 읽기
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                </div>
              ) : (
                <>
                  {/* 헤더 - 개인화된 메시지 */}
                  <div className="text-center mb-12" style={{ animation: 'fadeIn 0.6s ease-out' }}>
                    <p className="text-[14px] text-amber-600 font-medium mb-2">
                      {archivedSentences.length === 1 ? '첫 번째 문장을 저장했어요' :
                       archivedSentences.length < 5 ? '컬렉션이 시작되었어요' :
                       archivedSentences.length < 10 ? '멋진 컬렉션이 만들어지고 있어요' :
                       '당신만의 인사이트가 쌓이고 있어요'}
                    </p>
                    <h2 className="text-[28px] font-bold text-gray-900">
                      {archivedSentences.length}개의 문장
                    </h2>
                  </div>

                  {/* 오늘의 회상 카드 (2개 이상일 때) */}
                  {archivedSentences.length >= 2 && (
                    <div
                      className="mb-10 p-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border border-amber-100/50"
                      style={{ animation: 'fadeIn 0.6s ease-out 0.1s both' }}
                    >
                      <p className="text-[12px] text-amber-600 font-medium mb-4 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        이 문장, 기억하시나요?
                      </p>
                      <p className="text-[18px] text-gray-800 leading-[1.8] font-medium editorial-title">
                        "{archivedSentences[Math.floor(Math.random() * archivedSentences.length)]?.text.slice(0, 100)}{archivedSentences[0]?.text.length > 100 ? '...' : ''}"
                      </p>
                    </div>
                  )}

                  {/* 날짜별 그룹화된 문장 목록 */}
                  {(() => {
                    // 선택된 날짜로 필터링
                    const filteredSentences = archivedSentences.filter(s => isSameDay(new Date(s.createdAt), archiveDate));

                    if (filteredSentences.length === 0) {
                      return (
                        <div className="text-center py-16">
                          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-[16px] text-gray-600 mb-2">
                            {archiveDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}에는
                          </p>
                          <p className="text-[14px] text-gray-400">저장한 문장이 없어요</p>
                        </div>
                      );
                    }

                    // 선택된 날짜의 문장 목록 표시
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-[13px] font-semibold text-gray-500">
                            {archiveDate?.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                          </span>
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-[12px] text-gray-400">{filteredSentences.length}개</span>
                        </div>

                        {filteredSentences.map((sentence, idx) => {
                          const savedDate = new Date(sentence.createdAt);
                          const timeStr = savedDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

                          return (
                            <div
                              key={sentence.id}
                              className="group relative"
                              style={{ animation: `fadeIn 0.4s ease-out ${0.1 + idx * 0.03}s both` }}
                            >
                              <div className="bg-white rounded-2xl p-5 border border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-gray-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 flex gap-4">
                                <div className="flex-shrink-0 w-1 bg-gradient-to-b from-amber-400 to-amber-200 rounded-full" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[16px] text-gray-800 leading-[1.9] mb-4">
                                    {sentence.text}
                                  </p>
                                  <div className="flex items-center justify-between">
                                    <button
                                      onClick={() => {
                                        const article = articles.find(a => a.news_id === sentence.articleId);
                                        if (article) {
                                          setActiveTab("feed");
                                          setTimeout(() => {
                                            setExpandedArticles(prev => new Set(prev).add(sentence.articleId));
                                            document.getElementById(`article-${articles.findIndex(a => a.news_id === sentence.articleId)}`)?.scrollIntoView({ behavior: 'smooth' });
                                          }, 100);
                                        }
                                      }}
                                      className="flex items-center gap-2 text-[13px] text-gray-500 hover:text-gray-900 transition-colors group/link"
                                    >
                                      <svg className="w-4 h-4 text-gray-400 group-hover/link:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                      </svg>
                                      <span className="truncate max-w-[200px]">{sentence.articleTitle}</span>
                                    </button>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-gray-300">저장 {timeStr}</span>
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(`"${sentence.text}"\n- ${sentence.articleTitle}`);
                                            showToast();
                                          }}
                                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => setArchivedSentences(prev => prev.filter(s => s.id !== sentence.id))}
                                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                          <svg className="w-4 h-4 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* AI 기반 추천 섹션 */}
                  {archivedSentences.length >= 1 && (
                    <div className="mt-12 pt-8 border-t border-gray-100" style={{ animation: 'fadeIn 0.6s ease-out 0.3s both' }}>
                      {/* AI 추천 헤더 */}
                      <div className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-2xl p-5 mb-6">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-100/60 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-[15px] font-bold text-gray-900">AI가 찾은 관련 뉴스</h3>
                              <span className="px-2 py-0.5 bg-violet-100 text-violet-600 text-[10px] font-semibold rounded-full">AI</span>
                            </div>
                            <p className="text-[13px] text-gray-500 leading-relaxed">
                              저장한 {archivedSentences.length}개의 문장을 분석해서<br/>
                              관심사에 맞는 뉴스를 추천해드려요
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 추천 기사 목록 - 저장된 문장의 기사는 제외 */}
                      <div className="space-y-3">
                        {articles
                          .filter(article => !archivedSentences.some(s => s.articleId === article.news_id))
                          .slice(0, 3)
                          .map((article, idx) => (
                          <button
                            key={article.news_id}
                            onClick={() => {
                              setActiveTab("feed");
                              setTimeout(() => {
                                setExpandedArticles(prev => new Set(prev).add(article.news_id));
                                document.getElementById(`article-${idx}`)?.scrollIntoView({ behavior: 'smooth' });
                              }, 100);
                            }}
                            className="w-full text-left p-4 bg-white border border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-violet-200 hover:bg-violet-50/30 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] rounded-xl transition-all duration-200 group/rec"
                          >
                            <div className="flex items-start gap-3">
                              {/* 매칭 점수 */}
                              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-violet-100 to-blue-100 rounded-xl flex flex-col items-center justify-center">
                                <span className="text-[14px] font-bold text-violet-600">{95 - idx * 7}%</span>
                                <span className="text-[9px] text-violet-400">매칭</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-medium text-gray-800 line-clamp-2 group-hover/rec:text-violet-900 transition-colors">
                                  {article.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[11px] text-gray-400">{article.category}</span>
                                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                                  <span className="text-[11px] text-violet-500">저장한 문장과 유사</span>
                                </div>
                              </div>
                              <svg className="w-4 h-4 text-gray-300 group-hover/rec:text-violet-500 flex-shrink-0 mt-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* 더보기 */}
                      <button className="w-full mt-4 py-3 text-[13px] text-gray-500 hover:text-violet-600 transition-colors flex items-center justify-center gap-1">
                        더 많은 추천 보기
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* 마무리 메시지 */}
                  <div
                    className="mt-16 text-center"
                    style={{ animation: 'fadeIn 0.6s ease-out 0.5s both' }}
                  >
                    <p className="text-[14px] text-gray-400 mb-6">
                      더 많은 문장을 발견해보세요
                    </p>
                    <button
                      onClick={() => setActiveTab("feed")}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl text-[14px] font-medium hover:bg-gray-200 transition-colors"
                    >
                      뉴스피드로 돌아가기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* DNA 모드 */}
        {activeTab === "dna" && (
          <div className="max-w-[900px] mx-auto px-6 py-8">
            <div className="text-center mb-6">
              <h2 className="text-[24px] font-bold text-gray-900 mb-2">나의 뉴스 DNA</h2>
              <p className="text-[15px] text-gray-500">
                당신이 관심 갖는 세상의 모습
              </p>
            </div>

            {/* DNA 서브 탭 */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setDnaSubTab("analysis")}
                  className={`px-6 py-2.5 text-[14px] font-medium rounded-lg transition-all ${
                    dnaSubTab === "analysis"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  나의 분석
                </button>
                <button
                  onClick={() => setDnaSubTab("birthday")}
                  className={`px-6 py-2.5 text-[14px] font-medium rounded-lg transition-all ${
                    dnaSubTab === "birthday"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  생일 기록
                </button>
              </div>
            </div>

            {/* 나의 분석 탭 */}
            {dnaSubTab === "analysis" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 관심 분야 분석 - 시각화/차트 토글 */}
              <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full">
                {/* 헤더 + 토글 */}
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[15px] font-bold text-gray-900">관심 분야 분석</h3>
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setDnaViewMode("radar")}
                      className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${
                        dnaViewMode === "radar"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      시각화
                    </button>
                    <button
                      onClick={() => setDnaViewMode("chart")}
                      className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${
                        dnaViewMode === "chart"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      차트
                    </button>
                  </div>
                </div>

                {/* 레이더 차트 뷰 */}
                {dnaViewMode === "radar" && (
                  <div className="flex flex-col items-center">
                    <div className="relative w-full aspect-square max-w-[240px] mx-auto" style={{ perspective: '500px' }}>
                      <svg
                        viewBox="0 0 200 200"
                        className="w-full h-full"
                        style={{ transform: 'rotateX(8deg)' }}
                      >
                        <defs>
                          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={
                              persona.color === 'bg-green-500' ? '#86efac' :
                              persona.color === 'bg-blue-500' ? '#93c5fd' :
                              persona.color === 'bg-violet-500' ? '#c4b5fd' : '#fed7aa'
                            } stopOpacity="0.6" />
                            <stop offset="100%" stopColor={
                              persona.color === 'bg-green-500' ? '#4ade80' :
                              persona.color === 'bg-blue-500' ? '#60a5fa' :
                              persona.color === 'bg-violet-500' ? '#a78bfa' : '#fb923c'
                            } stopOpacity="0.4" />
                          </linearGradient>
                        </defs>

                        {/* 배경 육각형 그리드 */}
                        {[85, 68, 51, 34, 17].map((size, i) => {
                          const points = Array.from({ length: 6 }, (_, j) => {
                            const angle = (j * 60 - 90) * (Math.PI / 180);
                            const x = 100 + size * Math.cos(angle);
                            const y = 100 + size * Math.sin(angle);
                            return `${x},${y}`;
                          }).join(' ');
                          return (
                            <polygon
                              key={i}
                              points={points}
                              fill="none"
                              stroke="#e5e7eb"
                              strokeWidth={i === 0 ? "0.75" : "0.5"}
                            />
                          );
                        })}

                        {/* 축 라인 */}
                        {Array.from({ length: 6 }, (_, i) => {
                          const angle = (i * 60 - 90) * (Math.PI / 180);
                          const x2 = 100 + 85 * Math.cos(angle);
                          const y2 = 100 + 85 * Math.sin(angle);
                          return (
                            <line
                              key={i}
                              x1="100"
                              y1="100"
                              x2={x2}
                              y2={y2}
                              stroke="#f3f4f6"
                              strokeWidth="0.5"
                            />
                          );
                        })}

                        {/* 데이터 영역 */}
                        {(() => {
                          const values = [
                            newsDNA.economy,
                            newsDNA.tech,
                            newsDNA.politics,
                            newsDNA.society,
                            newsDNA.culture,
                            newsDNA.world,
                          ];
                          const points = values.map((val, i) => {
                            const angle = (i * 60 - 90) * (Math.PI / 180);
                            const r = (val / 100) * 80;
                            const x = 100 + r * Math.cos(angle);
                            const y = 100 + r * Math.sin(angle);
                            return `${x},${y}`;
                          }).join(' ');

                          const strokeColor = persona.color === 'bg-green-500' ? '#16a34a' :
                                              persona.color === 'bg-blue-500' ? '#2563eb' :
                                              persona.color === 'bg-violet-500' ? '#7c3aed' : '#ea580c';

                          return (
                            <>
                              <polygon
                                points={points}
                                fill="url(#areaGradient)"
                                stroke={strokeColor}
                                strokeWidth="1.5"
                                strokeLinejoin="round"
                                className="transition-all duration-500"
                              />
                              {/* 데이터 포인트 */}
                              {values.map((val, i) => {
                                const angle = (i * 60 - 90) * (Math.PI / 180);
                                const r = (val / 100) * 80;
                                const x = 100 + r * Math.cos(angle);
                                const y = 100 + r * Math.sin(angle);
                                return (
                                  <g key={i}>
                                    <circle cx={x} cy={y} r="4" fill="white" stroke={strokeColor} strokeWidth="1.5" />
                                  </g>
                                );
                              })}
                            </>
                          );
                        })()}
                      </svg>

                      {/* 라벨들 */}
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                        <span className="text-[12px] font-semibold text-slate-600">경제</span>
                      </div>
                      <div className="absolute top-[15%] -right-6">
                        <span className="text-[12px] font-semibold text-slate-600">테크</span>
                      </div>
                      <div className="absolute bottom-[15%] -right-6">
                        <span className="text-[12px] font-semibold text-slate-600">정치</span>
                      </div>
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                        <span className="text-[12px] font-semibold text-slate-600">사회</span>
                      </div>
                      <div className="absolute bottom-[15%] -left-6">
                        <span className="text-[12px] font-semibold text-slate-600">문화</span>
                      </div>
                      <div className="absolute top-[15%] -left-6">
                        <span className="text-[12px] font-semibold text-slate-600">세계</span>
                      </div>
                    </div>

                    {/* 범례 */}
                    <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
                      <div className={`w-3 h-3 rounded-full ${persona.color}`} />
                      <span className="text-[13px] text-gray-700 font-medium">{selectedGroup} 유형 관심사</span>
                    </div>
                  </div>
                )}

                {/* 바 차트 뷰 */}
                {dnaViewMode === "chart" && (
                  <div className="space-y-3.5 py-2">
                    {Object.entries(newsDNA).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-[13px] text-gray-500 w-8">
                          {key === "economy" ? "경제" :
                           key === "tech" ? "테크" :
                           key === "world" ? "세계" :
                           key === "society" ? "사회" :
                           key === "culture" ? "문화" : "정치"}
                        </span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              persona.color === 'bg-green-500' ? 'bg-green-400' :
                              persona.color === 'bg-blue-500' ? 'bg-blue-400' :
                              persona.color === 'bg-violet-500' ? 'bg-violet-400' : 'bg-orange-400'
                            }`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="text-[12px] text-gray-400 w-9 text-right">{value}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 비슷한 DNA */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] h-fit">
                <h3 className="text-[15px] font-bold text-gray-900 mb-3">비슷한 DNA를 가진 사람들</h3>
                <p className="text-[14px] text-gray-500 mb-5">
                  1,234명이 비슷한 관심사를 가지고 있어요
                </p>
                <button
                  onClick={() => setActiveTab("community")}
                  className="w-full py-3.5 bg-blue-500 rounded-xl text-[14px] font-medium text-white hover:bg-blue-600 transition-colors"
                >
                  커뮤니티 둘러보기
                </button>
              </div>
            </div>
            )}

            {/* 생일 기록 탭 */}
            {dnaSubTab === "birthday" && (() => {
              const savedBirthday = localStorage.getItem("user_birthday");
              const todayStr = new Date().toISOString().split("T")[0];

              const handleSaveBirthday = () => {
                if (birthdayInput) {
                  localStorage.setItem("user_birthday", birthdayInput);
                  navigate(`/timemachine?date=${birthdayInput}&mode=birthday`);
                }
              };

              const handleViewBirthday = () => {
                if (savedBirthday) {
                  navigate(`/timemachine?date=${savedBirthday}&mode=birthday`);
                }
              };

              const handleClearBirthday = () => {
                localStorage.removeItem("user_birthday");
                setBirthdayInput("");
              };

              return (
              <div className="max-w-[520px] mx-auto">
                <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-[18px] font-bold text-gray-900 mb-2">내 생일의 기록</h3>
                    <p className="text-[14px] text-gray-500">그날, 세상은 어땠을까요?</p>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-8">
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-2 bg-gray-50 rounded-xl flex items-center justify-center">
                        <Newspaper className="w-5 h-5 text-gray-600" />
                      </div>
                      <p className="text-[12px] text-gray-500">뉴스</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-2 bg-gray-50 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-600" />
                      </div>
                      <p className="text-[12px] text-gray-500">유명인</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-2 bg-gray-50 rounded-xl flex items-center justify-center">
                        <Camera className="w-5 h-5 text-gray-600" />
                      </div>
                      <p className="text-[12px] text-gray-500">사진</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-2 bg-gray-50 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-gray-600" />
                      </div>
                      <p className="text-[12px] text-gray-500">투자</p>
                    </div>
                  </div>

                  {savedBirthday ? (
                    <>
                      <div className="bg-blue-50 rounded-xl p-4 mb-6">
                        <p className="text-[13px] text-blue-600 text-center">
                          내 생일: <span className="font-semibold">{new Date(savedBirthday).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
                        </p>
                      </div>
                      <button
                        onClick={handleViewBirthday}
                        className="w-full py-3.5 bg-blue-500 rounded-xl text-[14px] font-medium text-white hover:bg-blue-600 transition-colors mb-3"
                      >
                        내 생일 기록 보기
                      </button>
                      <button
                        onClick={handleClearBirthday}
                        className="w-full py-2.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        생일 변경하기
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] text-gray-500 text-center mb-4">
                        생일을 입력하면 그날의 기록을 볼 수 있어요
                      </p>
                      <input
                        type="date"
                        value={birthdayInput}
                        max={todayStr}
                        min="1950-01-01"
                        onChange={(e) => setBirthdayInput(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-gray-800 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 mb-4"
                      />
                      <button
                        onClick={handleSaveBirthday}
                        disabled={!birthdayInput}
                        className="w-full py-3.5 bg-blue-500 rounded-xl text-[14px] font-medium text-white hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        내 생일 기록 확인하기
                      </button>
                    </>
                  )}
                </div>

                {/* 타임머신 링크 */}
                <div className="mt-6 text-center">
                  <button
                    onClick={() => navigate("/timemachine")}
                    className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    다른 날짜 탐색하기 →
                  </button>
                </div>
              </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* Article View */}
      {viewArticle && (
        <ArticleView
          article={viewArticle}
          currentGroup={selectedGroup}
          onClose={handleCloseArticle}
          onChangeGroup={() => {}}
          onArchiveSentence={archiveSentence}
        />
      )}

      {/* 유저 프로필 모달 */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white w-full max-w-[480px] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'modalIn 0.25s ease-out' }}
          >
            <style>{`
              @keyframes modalIn {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>

            {/* 프로필 헤더 */}
            {(() => {
              const profile = userProfiles[selectedUser.userName] || { level: 1, exp: 0, temperature: 36.5, title: "뉴비", titleType: "star", badges: [] };
              return (
                <div className="relative bg-gradient-to-br from-slate-50 to-gray-100 p-6 pb-4">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-sm transition-all"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-5">
                    {/* 아바타 */}
                    <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-white shadow-lg flex-shrink-0">
                      <img src={selectedUser.userAvatar} alt={selectedUser.userName} className="w-full h-full object-cover" />
                    </div>

                    {/* 유저 정보 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[20px] font-bold text-gray-900">{selectedUser.userName}</h3>
                        <span className="px-2 py-0.5 bg-white rounded text-[11px] font-bold text-gray-500 shadow-sm">
                          {selectedUser.userMbti}
                        </span>
                      </div>

                      {/* 칭호 */}
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="text-gray-400">
                          <TitleIcon type={profile.titleType} className="w-4 h-4" />
                        </span>
                        <span className="text-[13px] font-medium text-gray-600">{profile.title}</span>
                      </div>

                      {/* 온도 */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">공감온도</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${getTemperatureBarColor(profile.temperature)} rounded-full transition-all`}
                            style={{ width: `${Math.min(profile.temperature, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[14px] font-bold ${getTemperatureColor(profile.temperature)}`}>
                          {profile.temperature.toFixed(1)}°
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">받은 추천이 많을수록 상승</p>
                    </div>
                  </div>

                  {/* 뱃지 */}
                  {profile.badges.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200/50">
                      {profile.badges.map((badge, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-full text-[11px] text-gray-600 shadow-sm">
                          <BadgeIcon type={badge.type} className="w-3 h-3 text-gray-400" />
                          {badge.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 활동 통계 */}
            <div className="grid grid-cols-3 border-b border-gray-100 bg-white">
              {(() => {
                const userPosts = communityPosts.filter(p => p.userName === selectedUser.userName);
                const userComments = communityPosts.flatMap(p => p.commentList).filter(c => c.userName === selectedUser.userName);
                const totalLikes = userPosts.reduce((sum, p) => sum + p.upvotes, 0);
                return (
                  <>
                    <div className="py-4 text-center border-r border-gray-100">
                      <p className="text-[18px] font-bold text-gray-900">{userPosts.length}</p>
                      <p className="text-[11px] text-gray-400">작성 글</p>
                    </div>
                    <div className="py-4 text-center border-r border-gray-100">
                      <p className="text-[18px] font-bold text-gray-900">{userComments.length}</p>
                      <p className="text-[11px] text-gray-400">댓글</p>
                    </div>
                    <div className="py-4 text-center">
                      <p className="text-[18px] font-bold text-gray-900">{totalLikes}</p>
                      <p className="text-[11px] text-gray-400">받은 추천</p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* 활동 내역 */}
            <div className="max-h-[320px] overflow-y-auto">
              {/* 작성한 글 */}
              {communityPosts.filter(p => p.userName === selectedUser.userName).length > 0 && (
                <div className="p-5 border-b border-gray-100">
                  <h4 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-4">작성한 글</h4>
                  <div className="space-y-3">
                    {communityPosts.filter(p => p.userName === selectedUser.userName).map(post => (
                      <div key={post.id} className="p-4 bg-gray-50 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-gray-100 hover:shadow-[0_2px_6px_rgba(0,0,0,0.05)] transition-all cursor-pointer">
                        <p className="text-[14px] text-gray-800 leading-relaxed line-clamp-2 mb-2">
                          "{post.archivedSentence}"
                        </p>
                        <div className="flex items-center gap-3 text-[12px] text-gray-400">
                          <span>{post.timeAgo}</span>
                          <span>추천 {post.upvotes}</span>
                          <span>댓글 {post.commentCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 작성한 댓글 */}
              {(() => {
                const userComments = communityPosts.flatMap(p =>
                  p.commentList.filter(c => c.userName === selectedUser.userName).map(c => ({
                    ...c,
                    postSentence: p.archivedSentence
                  }))
                );
                if (userComments.length === 0) return null;
                return (
                  <div className="p-5">
                    <h4 className="text-[13px] font-bold text-gray-500 uppercase tracking-wide mb-4">작성한 댓글</h4>
                    <div className="space-y-3">
                      {userComments.slice(0, 5).map(comment => (
                        <div key={comment.id} className="p-4 bg-gray-50 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                          <p className="text-[14px] text-gray-800 leading-relaxed mb-2">{comment.text}</p>
                          <p className="text-[12px] text-gray-400 line-clamp-1">
                            "{comment.postSentence.slice(0, 40)}..." 글에 댓글
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* 활동 없음 */}
              {communityPosts.filter(p => p.userName === selectedUser.userName).length === 0 &&
               communityPosts.flatMap(p => p.commentList).filter(c => c.userName === selectedUser.userName).length === 0 && (
                <div className="p-10 text-center">
                  <p className="text-gray-400">아직 활동 내역이 없어요</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 커뮤니티 글 상세보기 모달 */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full max-w-[600px] max-h-[90vh] rounded-t-3xl md:rounded-2xl overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-[16px] font-bold text-gray-900">글 상세</h3>
              <button
                onClick={() => setSelectedPost(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto">
              {/* 원글 */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-50 ring-2 ring-gray-100">
                    <img
                      src={selectedPost.userAvatar}
                      alt={selectedPost.userName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-medium text-gray-900">{selectedPost.userName}</p>
                      <span className="px-1.5 py-0.5 bg-gradient-to-r from-slate-100 to-gray-100 rounded text-[10px] font-bold text-gray-500 tracking-wide">
                        {selectedPost.userMbti}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-400">{selectedPost.timeAgo}</p>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg mb-4">
                  <p className="text-[15px] text-gray-800">"{selectedPost.archivedSentence}"</p>
                  <p className="text-[12px] text-gray-400 mt-2">{selectedPost.articleTitle}</p>
                </div>

                <p className="text-[15px] text-gray-900 mb-4">{selectedPost.userComment}</p>

                <div className="flex items-center gap-4 text-[13px] text-gray-500">
                  <span>추천 {selectedPost.upvotes}</span>
                  <span>댓글 {selectedPost.commentCount}</span>
                </div>
              </div>

              {/* 댓글 목록 */}
              <div className="p-5">
                <h4 className="text-[14px] font-bold text-gray-900 mb-4">댓글 {selectedPost.commentList.length}개</h4>
                <div className="space-y-4">
                  {selectedPost.commentList.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-50 ring-1 ring-gray-100 flex-shrink-0">
                        <img
                          src={comment.userAvatar}
                          alt={comment.userName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-medium text-gray-900">{comment.userName}</span>
                          <span className="px-1 py-0.5 bg-gray-100 rounded text-[9px] font-bold text-gray-400 tracking-wide">{comment.userMbti}</span>
                          <span className="text-[11px] text-gray-400">{comment.timeAgo}</span>
                        </div>
                        <p className="text-[14px] text-gray-700 leading-relaxed">{comment.text}</p>
                        <button className="mt-2 text-[12px] text-gray-400 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
                          </svg>
                          {comment.likes}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 댓글 입력 */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-amber-50 ring-1 ring-amber-100 flex-shrink-0">
                  <img
                    src="https://api.dicebear.com/7.x/notionists/svg?seed=me&backgroundColor=fef3c7&scale=90"
                    alt="나"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="댓글을 입력하세요"
                    className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                  <button
                    onClick={() => {
                      if (newComment.trim()) {
                        // 댓글 추가 로직
                        const updatedPosts = communityPosts.map(p => {
                          if (p.id === selectedPost.id) {
                            return {
                              ...p,
                              commentCount: p.commentCount + 1,
                              commentList: [
                                { id: `c${Date.now()}`, userName: "나", userMbti: selectedGroup, userAvatar: `https://api.dicebear.com/7.x/notionists/svg?seed=me&backgroundColor=fef3c7&scale=90`, text: newComment, timeAgo: "방금 전", likes: 0 },
                                ...p.commentList
                              ]
                            };
                          }
                          return p;
                        });
                        setCommunityPosts(updatedPosts);
                        const updated = updatedPosts.find(p => p.id === selectedPost.id);
                        if (updated) setSelectedPost(updated);
                        setNewComment("");
                      }
                    }}
                    className="px-4 py-2.5 bg-blue-500 text-white rounded-full text-[14px] font-medium hover:bg-blue-600 transition-colors"
                  >
                    등록
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 텍스트 선택 시 하단 고정 저장바 */}
      {textSelection && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200]"
          style={{ animation: 'slideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          <style>{`
            @keyframes slideUp {
              from { opacity: 0; transform: translateX(-50%) translateY(20px); }
              to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-w-[90vw] w-[400px]">
            {/* 선택된 텍스트 미리보기 */}
            <p className="text-[14px] text-gray-600 line-clamp-2 mb-3 leading-relaxed">
              "{textSelection.text.length > 80 ? textSelection.text.slice(0, 80) + '...' : textSelection.text}"
            </p>

            {/* 버튼 영역 */}
            <div className="flex gap-2">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTextSelection(null);
                  window.getSelection()?.removeAllRanges();
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-[14px] font-medium hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  archiveSentence(
                    textSelection.text,
                    textSelection.articleId,
                    textSelection.articleTitle,
                    textSelection.articlePublishedAt
                  );
                  setTextSelection(null);
                  window.getSelection()?.removeAllRanges();
                  showToast();
                }}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl text-[14px] font-medium hover:bg-blue-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 문장 아카이빙 - 미니멀 팝업 (기존 방식 유지) */}
      {selectedSentence && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={() => setSelectedSentence(null)}
        >
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          />

          {/* 카드 */}
          <div
            className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          >
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes scaleIn {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>

            {/* 닫기 버튼 */}
            <button
              onClick={() => setSelectedSentence(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors z-10"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 콘텐츠 */}
            <div className="p-6 pt-12">
              {/* 선택된 문장 */}
              <div className="relative mb-5">
                <div className="absolute -left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-amber-300 rounded-full" />
                <p className="text-[16px] text-gray-800 leading-[1.8] pl-4 font-medium">
                  {selectedSentence.text}
                </p>
              </div>

              {/* 출처 */}
              <p className="text-[13px] text-gray-400 mb-6 pl-4">
                — {selectedSentence.articleTitle}
              </p>
            </div>

            {/* 저장 버튼 */}
            <div className="px-6 pb-6">
              <button
                onClick={() => {
                  archiveSentence(
                    selectedSentence.text,
                    selectedSentence.articleId,
                    selectedSentence.articleTitle
                  );
                  setSelectedSentence(null);
                  showToast();
                }}
                className="w-full py-4 bg-blue-500 text-white rounded-xl text-[15px] font-medium hover:bg-blue-600 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                내 서랍에 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 저장 완료 토스트 */}
      {showSaveToast && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] px-5 py-3 bg-blue-500 text-white rounded-full shadow-lg flex items-center gap-2"
          style={{ animation: 'toastIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          <style>{`
            @keyframes toastIn {
              from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.95); }
              to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
            }
          `}</style>
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-[14px] font-medium">내 서랍에 저장했어요</span>
        </div>
      )}

      {/* 글쓰기 모달 */}
      {showWriteModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full max-w-[600px] max-h-[90vh] rounded-t-3xl md:rounded-2xl overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <button
                onClick={() => {
                  setShowWriteModal(false);
                  setSelectedArchiveForPost(null);
                  setPostComment("");
                }}
                className="text-[14px] text-gray-500"
              >
                취소
              </button>
              <h3 className="text-[16px] font-bold text-gray-900">새 글 작성</h3>
              <button
                onClick={() => {
                  if (selectedArchiveForPost && postComment.trim()) {
                    // 새 글 추가
                    const newPost = {
                      id: `p${Date.now()}`,
                      userName: persona.name,
                      userMbti: selectedGroup,
                      userAvatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${persona.name}&backgroundColor=fef3c7&scale=90`,
                      timeAgo: "방금 전",
                      archivedSentence: selectedArchiveForPost.text,
                      userComment: postComment,
                      articleTitle: selectedArchiveForPost.articleTitle,
                      tags: ["새글"],
                      upvotes: 0,
                      commentCount: 0,
                      commentList: [],
                    };
                    setCommunityPosts([newPost, ...communityPosts]);
                    setShowWriteModal(false);
                    setSelectedArchiveForPost(null);
                    setPostComment("");
                  }
                }}
                disabled={!selectedArchiveForPost || !postComment.trim()}
                className={`text-[14px] font-medium ${
                  selectedArchiveForPost && postComment.trim()
                    ? "text-blue-600"
                    : "text-gray-300"
                }`}
              >
                게시
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* 내 아카이브에서 선택 */}
              <div className="mb-6">
                <h4 className="text-[14px] font-bold text-gray-900 mb-3">내 서랍에서 문장 선택</h4>
                {archivedSentences.length === 0 ? (
                  <div className="p-6 bg-gray-50 rounded-xl text-center shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <p className="text-[14px] text-gray-500">저장한 문장이 없어요</p>
                    <p className="text-[13px] text-gray-400 mt-1">뉴스를 읽고 문장을 저장해보세요</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {archivedSentences.map((sentence) => (
                      <button
                        key={sentence.id}
                        onClick={() => setSelectedArchiveForPost(sentence)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          selectedArchiveForPost?.id === sentence.id
                            ? "border-gray-900 bg-gray-50 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                            : "border-gray-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-gray-300 hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
                        }`}
                      >
                        <p className="text-[14px] text-gray-800 line-clamp-2">"{sentence.text}"</p>
                        <p className="text-[12px] text-gray-400 mt-1">{sentence.articleTitle}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 선택된 문장 미리보기 */}
              {selectedArchiveForPost && (
                <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                  <p className="text-[15px] text-gray-800">"{selectedArchiveForPost.text}"</p>
                  <p className="text-[12px] text-gray-400 mt-2">{selectedArchiveForPost.articleTitle}</p>
                </div>
              )}

              {/* 코멘트 입력 */}
              <div>
                <h4 className="text-[14px] font-bold text-gray-900 mb-3">내 생각 덧붙이기</h4>
                <textarea
                  value={postComment}
                  onChange={(e) => setPostComment(e.target.value)}
                  placeholder="이 문장에 대한 내 생각을 적어보세요"
                  rows={4}
                  className="w-full p-4 bg-gray-50 rounded-xl text-[15px] resize-none shadow-[0_1px_3px_rgba(0,0,0,0.03)_inset] focus:outline-none focus:ring-2 focus:ring-gray-300 focus:shadow-[0_2px_8px_rgba(0,0,0,0.04)_inset]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 하단 오디오 플레이어 (목업) */}
      {showAudioPlayer && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
          {/* 프로그레스 바 - 클릭/드래그 가능 */}
          <div
            className="absolute top-0 left-0 right-0 h-3 -mt-1.5 cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const percentage = (clickX / rect.width) * 100;
              const maxProgress = hasUnlockedAudio ? 100 : FREE_PREVIEW_LIMIT;
              setAudioProgress(Math.min(Math.max(0, percentage), maxProgress));
            }}
            onMouseDown={(e) => {
              const handleDrag = (moveEvent: MouseEvent) => {
                const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                if (rect) {
                  const dragX = moveEvent.clientX - rect.left;
                  const percentage = (dragX / rect.width) * 100;
                  const maxProgress = hasUnlockedAudio ? 100 : FREE_PREVIEW_LIMIT;
                  setAudioProgress(Math.min(Math.max(0, percentage), maxProgress));
                }
              };
              const handleUp = () => {
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', handleUp);
              };
              document.addEventListener('mousemove', handleDrag);
              document.addEventListener('mouseup', handleUp);
            }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-gray-200 group-hover:h-[5px] transition-all">
              <div
                className="h-full bg-gray-900 relative"
                style={{ width: `${audioProgress}%` }}
              >
                {/* 드래그 핸들 */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-900 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" />
              </div>
            </div>
          </div>

          <div className="max-w-[600px] mx-auto px-4 py-2.5">
            <div className="flex items-center gap-3">
              {/* 페르소나 아바타 */}
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-xl overflow-hidden">
                  <img
                    src={
                      selectedGroup === 'NT' ? '/editors/intj.png' :
                      selectedGroup === 'NF' ? '/editors/infp.png' :
                      selectedGroup === 'ST' ? '/editors/istj.png' : '/editors/esfp.png'
                    }
                    alt="AI 에디터"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* 재생 중 표시 */}
                {isPlaying && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                    <div className="flex items-end gap-[1.5px] h-2">
                      <span className="w-[2px] bg-white rounded-full animate-[soundbar1_0.4s_ease-in-out_infinite]" />
                      <span className="w-[2px] bg-white rounded-full animate-[soundbar2_0.4s_ease-in-out_infinite_0.1s]" />
                      <span className="w-[2px] bg-white rounded-full animate-[soundbar3_0.4s_ease-in-out_infinite_0.2s]" />
                    </div>
                  </div>
                )}
              </div>

              {/* 재생 정보 */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 truncate leading-tight">
                  {currentPlayingArticle?.title || '오늘의 뉴스 브리핑'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {Math.floor(audioProgress * 3 / 100)}:{String(Math.floor((audioProgress * 180 / 100) % 60)).padStart(2, '0')}
                    <span className="mx-0.5">/</span>
                    {hasUnlockedAudio ? '3:00' : '1:00'}
                  </span>
                  {!hasUnlockedAudio && (
                    <span className="text-[10px] font-medium text-amber-600">미리듣기</span>
                  )}
                </div>
              </div>

              {/* 컨트롤 버튼 */}
              <div className="flex items-center">
                {/* 이전 콘텐츠 */}
                <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
                  <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
                  </svg>
                </button>

                {/* 5초 뒤로 */}
                <button
                  onClick={() => {
                    const newProgress = Math.max(0, audioProgress - (5 / 180) * 100);
                    setAudioProgress(newProgress);
                  }}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors relative"
                  title="5초 뒤로"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.5 8V4L7 9l5.5 5v-4c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4.5c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                  </svg>
                  <span className="absolute text-[8px] font-bold" style={{ top: '52%', left: '50%', transform: 'translate(-50%, -50%)' }}>5</span>
                </button>

                {/* 재생/일시정지 */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all active:scale-95 mx-1"
                >
                  {isPlaying ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* 5초 앞으로 */}
                <button
                  onClick={() => {
                    const maxProgress = hasUnlockedAudio ? 100 : FREE_PREVIEW_LIMIT;
                    const newProgress = Math.min(maxProgress, audioProgress + (5 / 180) * 100);
                    setAudioProgress(newProgress);
                    if (!hasUnlockedAudio && newProgress >= FREE_PREVIEW_LIMIT) {
                      setIsPlaying(false);
                      setShowPaywall(true);
                    }
                  }}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors relative"
                  title="5초 앞으로"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.5 8V4l5.5 5-5.5 5v-4c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                  </svg>
                  <span className="absolute text-[8px] font-bold" style={{ top: '52%', left: '50%', transform: 'translate(-50%, -50%)' }}>5</span>
                </button>

                {/* 다음 콘텐츠 */}
                <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
                  <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                  </svg>
                </button>

                {/* 닫기 */}
                <button
                  onClick={() => {
                    setShowAudioPlayer(false);
                    setIsPlaying(false);
                    setAudioProgress(0);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all ml-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 이퀄라이저 애니메이션 스타일 */}
          <style>{`
            @keyframes soundbar1 {
              0%, 100% { height: 30%; }
              50% { height: 100%; }
            }
            @keyframes soundbar2 {
              0%, 100% { height: 60%; }
              50% { height: 30%; }
            }
            @keyframes soundbar3 {
              0%, 100% { height: 45%; }
              50% { height: 90%; }
            }
          `}</style>
        </div>
      )}

      {/* 구독/결제 페이월 모달 */}
      {showPaywall && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPaywall(false)}>
          <div
            className="w-full sm:max-w-[420px] bg-white sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden animate-[slideUp_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 그래픽 */}
            <div className="relative h-32 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center overflow-hidden">
              {/* 배경 패턴 */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-4 left-8 w-16 h-16 border-2 border-white rounded-full" />
                <div className="absolute bottom-2 right-12 w-24 h-24 border-2 border-white rounded-full" />
                <div className="absolute top-8 right-4 w-8 h-8 bg-white/30 rounded-full" />
              </div>

              {/* 아이콘 */}
              <div className="relative flex items-center gap-3">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                </div>
                <div className="text-white">
                  <p className="text-[13px] font-medium opacity-90">1분 미리듣기 완료</p>
                  <p className="text-[20px] font-bold">전체 듣기 잠금해제</p>
                </div>
              </div>

              {/* 닫기 버튼 */}
              <button
                onClick={() => setShowPaywall(false)}
                className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/30 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 콘텐츠 */}
            <div className="p-6">
              {/* 혜택 리스트 */}
              <div className="space-y-3 mb-6">
                {[
                  { icon: "headphones", text: "AI 페르소나 음성 브리핑 무제한" },
                  { icon: "articles", text: "모든 MBTI 스타일 기사 열람" },
                  { icon: "archive", text: "문장 아카이빙 무제한 저장" },
                  { icon: "community", text: "커뮤니티 프리미엄 배지" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.icon === "headphones" && (
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424" />
                        </svg>
                      )}
                      {item.icon === "articles" && (
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      )}
                      {item.icon === "archive" && (
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                        </svg>
                      )}
                      {item.icon === "community" && (
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[14px] text-gray-700">{item.text}</span>
                  </div>
                ))}
              </div>

              {/* 가격 옵션 */}
              <div className="space-y-3 mb-6">
                {/* 월간 구독 */}
                <button className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-all text-left group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[15px] font-semibold text-gray-900">월간 구독</p>
                      <p className="text-[13px] text-gray-500">매월 자동 결제</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[18px] font-bold text-gray-900">4,900원</p>
                      <p className="text-[12px] text-gray-400">/월</p>
                    </div>
                  </div>
                </button>

                {/* 연간 구독 - 추천 */}
                <button className="w-full p-4 border-2 border-amber-400 bg-amber-50/50 rounded-xl hover:bg-amber-50 transition-all text-left relative overflow-hidden">
                  {/* 추천 배지 */}
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                    2개월 무료
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[15px] font-semibold text-gray-900">연간 구독</p>
                      <p className="text-[13px] text-amber-600 font-medium">17% 할인</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] text-gray-400 line-through">58,800원</p>
                      <p className="text-[18px] font-bold text-amber-600">49,000원</p>
                      <p className="text-[12px] text-gray-400">/년</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* CTA 버튼 */}
              <button
                onClick={() => {
                  // 구독 페이지로 이동
                  setShowPaywall(false);
                  navigate("/subscription");
                }}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-orange-200 active:scale-[0.98]"
              >
                지금 시작하기
              </button>

              {/* 하단 안내 */}
              <p className="text-center text-[12px] text-gray-400 mt-4">
                언제든 취소 가능 · 7일 무료 체험
              </p>
            </div>
          </div>

          {/* 슬라이드 업 애니메이션 */}
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}

    </div>
  );
}
