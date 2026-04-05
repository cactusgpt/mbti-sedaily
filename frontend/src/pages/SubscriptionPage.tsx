import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Crown, Sparkles, Headphones, Zap, Shield, Check } from "lucide-react";

type PlanType = "monthly" | "yearly";

export default function SubscriptionPage() {
  const { user, isAuthenticated } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("yearly");

  const isSubscribed = false;

  const plans: Record<PlanType, {
    price: number;
    period: string;
    description: string;
    originalPrice?: number;
    badge?: string;
    monthlyPrice?: number;
  }> = {
    monthly: {
      price: 4900,
      period: "월",
      description: "부담 없이 시작",
    },
    yearly: {
      price: 49000,
      originalPrice: 58800,
      period: "년",
      description: "2개월 무료",
      badge: "추천",
      monthlyPrice: 4083,
    },
  };

  const features = [
    {
      icon: Headphones,
      title: "무제한 오디오",
      description: "모든 기사를 음성으로",
    },
    {
      icon: Sparkles,
      title: "AI 심층 분석",
      description: "MBTI 맞춤 인사이트",
    },
    {
      icon: Zap,
      title: "실시간 알림",
      description: "관심 뉴스 즉시 알림",
    },
    {
      icon: Shield,
      title: "광고 제거",
      description: "깔끔한 읽기 경험",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px]" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-4">
          <Link to="/" className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-white/60" />
          </Link>
          <h1 className="text-[17px] font-semibold text-white">구독</h1>
        </div>
      </header>

      <main className="relative max-w-lg mx-auto px-5 pb-12">
        {/* Hero */}
        <div className="text-center pt-6 pb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 rounded-3xl mb-5 shadow-2xl shadow-orange-500/25">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-[28px] font-bold text-white mb-2 tracking-tight">
            AI LENS PRO
          </h2>
          <p className="text-white/50 text-[15px]">
            나만의 프리미엄 뉴스 경험
          </p>
        </div>

        {/* Plan Selection */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {(["monthly", "yearly"] as PlanType[]).map((plan) => {
            const isSelected = selectedPlan === plan;
            return (
              <button
                key={plan}
                onClick={() => setSelectedPlan(plan)}
                className={`relative p-5 rounded-2xl transition-all duration-300 ${
                  isSelected
                    ? "bg-gradient-to-br from-amber-500/20 to-orange-500/10 ring-2 ring-amber-500/50"
                    : "bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                {plans[plan].badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-bold rounded-full shadow-lg">
                    {plans[plan].badge}
                  </span>
                )}
                <p className="text-[13px] text-white/40 mb-2 font-medium">
                  {plan === "monthly" ? "월간" : "연간"}
                </p>
                <p className="text-[26px] font-bold text-white tracking-tight">
                  ₩{plans[plan].price.toLocaleString()}
                </p>
                {plans[plan].monthlyPrice && (
                  <p className="text-[12px] text-amber-400 mt-1">
                    월 ₩{plans[plan].monthlyPrice.toLocaleString()}
                  </p>
                )}
                {plans[plan].originalPrice && (
                  <p className="text-[12px] text-white/30 line-through mt-0.5">
                    ₩{plans[plan].originalPrice.toLocaleString()}
                  </p>
                )}
                <p className="text-[12px] text-white/50 mt-2">{plans[plan].description}</p>
              </button>
            );
          })}
        </div>

        {/* Features */}
        <div className="bg-white/[0.03] rounded-3xl p-6 mb-6">
          <h3 className="text-[15px] font-semibold text-white mb-5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            PRO 혜택
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-white/10 to-white/5">
                  <feature.icon className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-white">{feature.title}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compare */}
        <div className="bg-white/[0.03] rounded-3xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-white">플랜 비교</h3>
            <div className="flex gap-8 text-[11px] font-medium">
              <span className="text-white/40 w-14 text-center">무료</span>
              <span className="text-amber-400 w-14 text-center">PRO</span>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { feature: "뉴스 요약", free: "5건/일", pro: "무제한" },
              { feature: "오디오 청취", free: "1분", pro: "전체" },
              { feature: "AI 분석", free: "기본", pro: "심층" },
              { feature: "광고", free: "있음", pro: "없음" },
            ].map((item, index) => (
              <div key={index} className="flex items-center py-2 border-b border-white/5 last:border-0">
                <span className="flex-1 text-[13px] text-white/60">{item.feature}</span>
                <span className="w-14 text-center text-[12px] text-white/30">{item.free}</span>
                <span className="w-14 text-center text-[12px] text-white font-medium">{item.pro}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold text-[15px] rounded-2xl hover:opacity-90 transition-all active:scale-[0.98] shadow-xl shadow-orange-500/20">
          {selectedPlan === "yearly"
            ? "연간 구독 시작하기"
            : "월간 구독 시작하기"
          }
        </button>

        <p className="text-center text-[11px] text-white/30 mt-4">
          언제든 취소 가능 · 7일 무료 체험
        </p>

        {/* User Status (if logged in) */}
        {isAuthenticated && user && (
          <div className="mt-8 p-4 bg-white/[0.03] rounded-2xl">
            <div className="flex items-center gap-3">
              {user.picture ? (
                <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white/70">
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white truncate">{user.name || "사용자"}</p>
                <p className="text-[11px] text-white/40 truncate">{user.email}</p>
              </div>
              <span className={`px-3 py-1.5 text-[11px] font-bold rounded-full ${
                isSubscribed
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                  : "bg-white/10 text-white/50"
              }`}>
                {isSubscribed ? "PRO" : "무료"}
              </span>
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="mt-10">
          <h3 className="text-[13px] font-semibold text-white/60 mb-4">자주 묻는 질문</h3>
          <div className="space-y-2">
            {[
              {
                q: "언제든지 해지할 수 있나요?",
                a: "네, 설정에서 언제든지 해지 가능합니다.",
              },
              {
                q: "결제 수단은요?",
                a: "카드, 카카오페이, 네이버페이를 지원합니다.",
              },
              {
                q: "환불이 가능한가요?",
                a: "7일 이내 미사용 시 전액 환불됩니다.",
              },
            ].map((faq, index) => (
              <details key={index} className="group">
                <summary className="px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl text-[13px] text-white/70 cursor-pointer list-none flex items-center justify-between transition-colors">
                  {faq.q}
                  <svg className="w-4 h-4 text-white/30 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="px-4 py-3 text-[12px] text-white/40">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
