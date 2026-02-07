

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight, Sparkles } from "lucide-react";

interface Question {
  id: string;
  question: string;
  options: {
    label: string;
    value: string;
    emoji: string;
    tags: string[];
  }[];
}

const questions: Question[] = [
  {
    id: "morning",
    question: "아침에 눈을 뜨면 가장 먼저 뭘 하세요?",
    options: [
      { label: "스마트폰으로 뉴스/SNS 확인", value: "news", emoji: "📱", tags: ["정보", "트렌드"] },
      { label: "일어나서 바로 씻고 준비", value: "routine", emoji: "🚿", tags: ["실용", "효율"] },
      { label: "조금 더 누워서 생각 정리", value: "think", emoji: "💭", tags: ["성찰", "계획"] },
      { label: "음악이나 유튜브 틀기", value: "media", emoji: "🎵", tags: ["감성", "여유"] },
    ],
  },
  {
    id: "decision",
    question: "중요한 결정을 내릴 때 어떻게 하세요?",
    options: [
      { label: "데이터와 자료를 찾아본다", value: "data", emoji: "📊", tags: ["분석", "논리"] },
      { label: "주변 사람들 의견을 들어본다", value: "people", emoji: "👥", tags: ["공감", "관계"] },
      { label: "직감을 믿고 빠르게 결정", value: "intuition", emoji: "⚡", tags: ["직관", "행동"] },
      { label: "충분히 고민하고 천천히", value: "careful", emoji: "🤔", tags: ["신중", "깊이"] },
    ],
  },
  {
    id: "weekend",
    question: "이상적인 주말은 어떤 모습인가요?",
    options: [
      { label: "새로운 곳 탐험하기", value: "explore", emoji: "🗺️", tags: ["모험", "경험"] },
      { label: "집에서 푹 쉬기", value: "rest", emoji: "🏠", tags: ["휴식", "충전"] },
      { label: "친구/가족과 시간 보내기", value: "social", emoji: "👨‍👩‍👧‍👦", tags: ["관계", "소통"] },
      { label: "밀린 일/공부 정리하기", value: "productive", emoji: "📚", tags: ["성장", "목표"] },
    ],
  },
  {
    id: "news_style",
    question: "뉴스를 볼 때 가장 끌리는 건?",
    options: [
      { label: "숫자와 데이터가 있는 기사", value: "data", emoji: "📈", tags: ["분석", "팩트"] },
      { label: "사람 이야기가 담긴 기사", value: "story", emoji: "📖", tags: ["스토리", "공감"] },
      { label: "핵심만 빠르게 요약된 기사", value: "summary", emoji: "⚡", tags: ["효율", "실용"] },
      { label: "깊은 분석과 인사이트", value: "insight", emoji: "🔍", tags: ["통찰", "맥락"] },
    ],
  },
  {
    id: "value",
    question: "당신에게 더 중요한 건?",
    options: [
      { label: "안정적인 미래", value: "stability", emoji: "🏦", tags: ["안정", "계획"] },
      { label: "자유로운 현재", value: "freedom", emoji: "🦋", tags: ["자유", "경험"] },
      { label: "의미 있는 성장", value: "growth", emoji: "🌱", tags: ["성장", "목표"] },
      { label: "따뜻한 관계", value: "relationship", emoji: "💝", tags: ["관계", "공감"] },
    ],
  },
];

interface Props {
  onComplete: (preferences: UserPreferences) => void;
}

export interface UserPreferences {
  answers: Record<string, string>;
  tags: string[];
  suggestedGroup: "NT" | "NF" | "ST" | "SF";
}

function calculateGroup(answers: Record<string, string>): "NT" | "NF" | "ST" | "SF" {
  // 간단한 로직: 답변 패턴에 따라 그룹 추천
  const allTags: string[] = [];

  questions.forEach(q => {
    const answer = answers[q.id];
    const option = q.options.find(o => o.value === answer);
    if (option) {
      allTags.push(...option.tags);
    }
  });

  const tagCounts = {
    분석: 0, 논리: 0, 팩트: 0, 효율: 0, 실용: 0, // ST, NT
    통찰: 0, 깊이: 0, 맥락: 0, 성찰: 0, 계획: 0, // NT, NF
    공감: 0, 관계: 0, 스토리: 0, 소통: 0, // SF, NF
    감성: 0, 여유: 0, 경험: 0, 자유: 0, // SF
  };

  allTags.forEach(tag => {
    if (tag in tagCounts) {
      tagCounts[tag as keyof typeof tagCounts]++;
    }
  });

  // 점수 계산
  const ntScore = tagCounts.분석 + tagCounts.논리 + tagCounts.통찰 + tagCounts.깊이 + tagCounts.맥락;
  const nfScore = tagCounts.통찰 + tagCounts.성찰 + tagCounts.공감 + tagCounts.관계 + tagCounts.깊이;
  const stScore = tagCounts.분석 + tagCounts.팩트 + tagCounts.효율 + tagCounts.실용 + tagCounts.계획;
  const sfScore = tagCounts.공감 + tagCounts.관계 + tagCounts.스토리 + tagCounts.감성 + tagCounts.소통;

  const scores = { NT: ntScore, NF: nfScore, ST: stScore, SF: sfScore };
  const maxGroup = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0] as "NT" | "NF" | "ST" | "SF";

  return maxGroup;
}

export function ConversationalOnboarding({ onComplete }: Props) {
  const { user, isAuthenticated, signInWithGoogle, isLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep) / questions.length) * 100;

  const handleSelect = (value: string) => {
    if (isAnimating) return;

    setIsAnimating(true);
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));

    setTimeout(() => {
      if (currentStep < questions.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        setShowResult(true);
      }
      setIsAnimating(false);
    }, 400);
  };

  const handleComplete = () => {
    const allTags: string[] = [];
    questions.forEach(q => {
      const answer = answers[q.id];
      const option = q.options.find(o => o.value === answer);
      if (option) allTags.push(...option.tags);
    });

    const suggestedGroup = calculateGroup(answers);

    onComplete({
      answers,
      tags: [...new Set(allTags)],
      suggestedGroup,
    });
  };

  // 로그인 필요 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              나만의 뉴스 여정
            </h1>
            <p className="text-gray-500 mb-8">
              로그인하고 맞춤 뉴스를 시작하세요
            </p>

            <button
              onClick={signInWithGoogle}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="font-medium text-gray-700">Google로 시작하기</span>
            </button>

            <p className="text-xs text-gray-400 mt-6">
              로그인하면 취향 분석이 저장되고<br />
              맞춤 뉴스 타임라인을 볼 수 있어요
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 결과 화면
  if (showResult) {
    const suggestedGroup = calculateGroup(answers);
    const groupInfo = {
      NT: { name: "분석형", emoji: "📊", color: "blue", desc: "데이터와 논리로 핵심을 파악하는" },
      NF: { name: "통찰형", emoji: "💡", color: "violet", desc: "의미와 맥락을 깊이 읽는" },
      ST: { name: "실용형", emoji: "✅", color: "green", desc: "팩트 중심으로 빠르게 파악하는" },
      SF: { name: "공감형", emoji: "💬", color: "orange", desc: "쉽고 친근하게 이해하는" },
    };
    const info = groupInfo[suggestedGroup];

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-5xl mb-4">{info.emoji}</div>

            <p className="text-sm text-gray-500 mb-2">
              {user?.name}님의 뉴스 스타일은
            </p>

            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {info.name}
            </h2>

            <p className="text-gray-600 mb-8">
              {info.desc} 스타일이에요
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-8">
              <p className="text-sm text-gray-500 mb-2">나의 관심 키워드</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[...new Set(
                  questions.flatMap(q => {
                    const answer = answers[q.id];
                    const option = q.options.find(o => o.value === answer);
                    return option?.tags || [];
                  })
                )].slice(0, 6).map((tag, i) => (
                  <span key={i} className="px-3 py-1 bg-white rounded-full text-sm text-gray-600 border border-gray-200">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={handleComplete}
              className="w-full py-4 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              나만의 뉴스 타임라인 보기
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 질문 화면
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div
          className="h-full bg-gray-900 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <header className="p-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="text-sm text-gray-400">
            {currentStep + 1} / {questions.length}
          </span>
          <span className="text-sm text-gray-600 font-medium">
            {user?.name}님
          </span>
        </div>
      </header>

      {/* Question */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div
            className={`transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center leading-snug">
              {currentQuestion.question}
            </h2>

            <div className="space-y-3">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className="w-full p-5 bg-white rounded-xl border-2 border-gray-100 hover:border-gray-300 hover:shadow-md transition-all text-left flex items-center gap-4 group"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">
                    {option.emoji}
                  </span>
                  <span className="text-gray-800 font-medium">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
