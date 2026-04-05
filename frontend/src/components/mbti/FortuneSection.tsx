import { useState, useEffect } from "react";
import type { MbtiGroupId } from "@/data/mbtiGroups";

interface FortuneData {
  mbti_group: string;
  date: string;
  fortune_title: string;
  fortune_body: string;
  lucky_item: string;
  lucky_color: string;
  lucky_number: number;
  compatibility: string;
  advice: string;
  money_luck: number; // 1-5
  work_luck: number;  // 1-5
  love_luck: number;  // 1-5
}

// 에디터 정보
const editors: Record<MbtiGroupId, { name: string; image: string }> = {
  NT: { name: "시현", image: "/images/editors/sihyun.png" },
  NF: { name: "지원", image: "/images/editors/jiwon.png" },
  ST: { name: "정훈", image: "/images/editors/junghoon.png" },
  SF: { name: "하은", image: "/images/editors/haeun.png" },
};

// MBTI별 목업 운세 데이터
const mockFortunes: Record<MbtiGroupId, FortuneData> = {
  NT: {
    mbti_group: "NT",
    date: new Date().toISOString().split("T")[0],
    fortune_title: "전략적 기회의 날",
    fortune_body: "오늘은 당신의 분석력이 빛을 발하는 날입니다. 복잡한 문제도 논리적으로 접근하면 해결책이 보일 거예요. 장기적인 관점에서 중요한 결정을 내리기 좋은 타이밍입니다. 데이터를 기반으로 한 판단이 좋은 결과로 이어질 것입니다.",
    lucky_item: "파란색 펜",
    lucky_color: "네이비",
    lucky_number: 7,
    compatibility: "NF",
    advice: "직감보다 데이터를 믿으세요",
    money_luck: 4,
    work_luck: 5,
    love_luck: 3,
  },
  NF: {
    mbti_group: "NF",
    date: new Date().toISOString().split("T")[0],
    fortune_title: "영감이 넘치는 하루",
    fortune_body: "오늘은 창의적인 아이디어가 샘솟는 날이에요. 주변 사람들과의 대화에서 뜻밖의 영감을 얻을 수 있습니다. 마음의 소리에 귀 기울여보세요. 진정으로 가치 있는 것이 무엇인지 깨닫게 될 거예요.",
    lucky_item: "향초",
    lucky_color: "라벤더",
    lucky_number: 3,
    compatibility: "SF",
    advice: "감정을 솔직하게 표현해보세요",
    money_luck: 3,
    work_luck: 4,
    love_luck: 5,
  },
  ST: {
    mbti_group: "ST",
    date: new Date().toISOString().split("T")[0],
    fortune_title: "실행력이 빛나는 날",
    fortune_body: "오늘은 계획한 일을 착실히 실행하기 좋은 날입니다. 구체적인 목표를 세우고 하나씩 체크해 나가세요. 작은 성취들이 모여 큰 결과를 만들어낼 거예요. 현실적인 판단이 성공의 열쇠입니다.",
    lucky_item: "손목시계",
    lucky_color: "그레이",
    lucky_number: 8,
    compatibility: "NT",
    advice: "작은 것부터 확실하게 처리하세요",
    money_luck: 5,
    work_luck: 4,
    love_luck: 3,
  },
  SF: {
    mbti_group: "SF",
    date: new Date().toISOString().split("T")[0],
    fortune_title: "따뜻한 인연의 날",
    fortune_body: "오늘은 주변 사람들과의 관계에서 행복을 느끼는 날이에요! 작은 친절이 큰 기쁨으로 돌아올 거예요. 누군가에게 먼저 다가가 보세요. 예상치 못한 좋은 소식이 있을 수도 있어요.",
    lucky_item: "핑크색 머그컵",
    lucky_color: "코랄",
    lucky_number: 2,
    compatibility: "NF",
    advice: "웃음을 잃지 마세요, 좋은 일이 생겨요!",
    money_luck: 3,
    work_luck: 4,
    love_luck: 5,
  },
};

// 그룹별 색상 테마
const groupColors: Record<MbtiGroupId, { bg: string; accent: string; light: string }> = {
  NT: { bg: "from-indigo-500 to-purple-600", accent: "indigo", light: "indigo-50" },
  NF: { bg: "from-purple-500 to-pink-500", accent: "purple", light: "purple-50" },
  ST: { bg: "from-slate-600 to-gray-700", accent: "slate", light: "slate-50" },
  SF: { bg: "from-rose-400 to-orange-400", accent: "rose", light: "rose-50" },
};

// 별 아이콘 렌더링
function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < rating ? "text-yellow-400" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

interface Props {
  mbtiGroup: MbtiGroupId;
}

export function FortuneSection({ mbtiGroup }: Props) {
  const [fortune, setFortune] = useState<FortuneData | null>(null);
  const [loading, setLoading] = useState(true);

  const editor = editors[mbtiGroup];
  const colors = groupColors[mbtiGroup];

  useEffect(() => {
    // 목업 데이터 로딩 시뮬레이션
    setLoading(true);
    const timer = setTimeout(() => {
      setFortune(mockFortunes[mbtiGroup]);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [mbtiGroup]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm">{editor.name} 에디터가 운세를 준비하고 있어요...</p>
      </div>
    );
  }

  if (!fortune) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">운세를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일 ${["일", "월", "화", "수", "목", "금", "토"][today.getDay()]}요일`;

  return (
    <div className="max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <p className="text-sm text-gray-500 mb-2">{dateStr}</p>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">오늘의 운세</h2>
        <p className="text-sm text-gray-600">
          <span className="font-medium">{editor.name}</span> 에디터의 {mbtiGroup} 맞춤 운세
        </p>
      </div>

      {/* 메인 운세 카드 */}
      <div className={`bg-gradient-to-br ${colors.bg} rounded-2xl p-6 text-white mb-6 shadow-lg`}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl">
            {mbtiGroup === "NT" && "🔮"}
            {mbtiGroup === "NF" && "✨"}
            {mbtiGroup === "ST" && "📊"}
            {mbtiGroup === "SF" && "💝"}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">{fortune.fortune_title}</h3>
            <p className="text-white/80 text-sm">{mbtiGroup} 그룹 전용</p>
          </div>
        </div>
        <p className="text-white/95 leading-relaxed text-[15px]">
          {fortune.fortune_body}
        </p>
      </div>

      {/* 운세 지수 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>📈</span> 오늘의 운세 지수
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">금전운</p>
            <StarRating rating={fortune.money_luck} />
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">업무운</p>
            <StarRating rating={fortune.work_luck} />
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">애정운</p>
            <StarRating rating={fortune.love_luck} />
          </div>
        </div>
      </div>

      {/* 행운 아이템 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">행운의 아이템</p>
          <p className="font-medium text-gray-900">{fortune.lucky_item}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">행운의 색상</p>
          <p className="font-medium text-gray-900">{fortune.lucky_color}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">행운의 숫자</p>
          <p className="font-medium text-gray-900">{fortune.lucky_number}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">잘 맞는 그룹</p>
          <p className="font-medium text-gray-900">{fortune.compatibility}</p>
        </div>
      </div>

      {/* 오늘의 조언 */}
      <div className={`bg-${colors.light} rounded-xl p-5 border border-${colors.accent}-100`}>
        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <span>💬</span> {editor.name} 에디터의 한마디
        </h4>
        <p className="text-gray-700 text-[15px]">"{fortune.advice}"</p>
      </div>

      {/* 안내 문구 */}
      <p className="text-center text-xs text-gray-400 mt-8">
        운세는 재미로 봐주세요! 오늘 하루도 화이팅 💪
      </p>
    </div>
  );
}
