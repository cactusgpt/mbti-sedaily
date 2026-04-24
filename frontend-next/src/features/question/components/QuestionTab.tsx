import { BarChart3, BookOpen, Lightbulb, Coffee, Coins, Rocket, Globe, Sparkles } from "lucide-react";
import type { MbtiGroupId } from "@/shared/data/mbtiGroups";

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
export const dailyQuestions = [
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

export interface DailyQuestionItem {
  id: string;
  question: string;
  subtitle?: string;
  options: {
    id: string;
    label: string;
    desc?: string;
    iconType?: keyof typeof questionIcons;
    mbti?: MbtiGroupId;
    category?: string;
  }[];
}

interface Props {
  currentQuestionIndex: number;
  selectedAnswers: Record<string, string>;
  onSelectAnswer: (questionId: string, optionId: string, mbti?: MbtiGroupId) => void;
  onSkip: () => void;
  questions?: DailyQuestionItem[];
}

export function QuestionTab({
  currentQuestionIndex,
  selectedAnswers,
  onSelectAnswer,
  onSkip,
  questions,
}: Props) {
  const activeQuestions = questions && questions.length > 0 ? questions : dailyQuestions;
  const currentQuestion = activeQuestions[Math.min(currentQuestionIndex, activeQuestions.length - 1)];

  return (
    <div className="min-h-[calc(100vh-130px)] flex flex-col">
      {/* 진행 표시 - 상단 고정 */}
      <div className="max-w-[600px] w-full mx-auto px-6 pt-8">
        <div className="flex gap-2">
          {activeQuestions.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                idx <= currentQuestionIndex ? "bg-blue-500" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <p className="text-[13px] text-gray-400 mt-3">
          {currentQuestionIndex + 1} / {activeQuestions.length}
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
                onClick={() => onSelectAnswer(
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
          onClick={onSkip}
          className="w-full py-4 text-[14px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          오늘은 그냥 둘러볼게요
        </button>
      </div>
    </div>
  );
}
