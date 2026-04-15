'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const editors = [
  {
    id: 'NT',
    name: '민철',
    nickname: '분석가',
    avatar: '/editors/intj.png',
    // 딥 인디고 → 퍼플
    bgFrom: '#0f0a2e',
    bgVia: '#1a1550',
    bgTo: '#2d1b69',
    accent: '#a78bfa',     // violet-400
    accentSoft: '#7c3aed', // violet-600
    tagline: '논리와 전략으로 세상을 읽는 사람',
    personality: '감정? 그건 변수에 안 넣습니다.',
    description: '민철은 뉴스를 읽을 때 감정을 철저히 배제해요. 원인과 결과, 데이터와 근거만으로 기사를 판단하죠. "왜 이 타이밍에 이 이슈가 터졌는가?"를 항상 먼저 생각하고, 기사 30개를 비교 분석한 뒤 논리적 정합성이 가장 높은 기사 하나를 골라요.',
    newsStyle: '기사의 인과관계를 추적하고, 다른 매체와 비교 분석합니다. 감정적 프레이밍이 들어간 기사는 걸러내요.',
    catchphrase: ['"구조적으로 흥미로운 기사인데."', '"논리적으로 봤을 때..."', '"팩트 체크 다 해봤는데 문제 없음."'],
    likes: '데이터 기반 분석 기사, 인과관계가 선명한 기사, 다른 시각을 제시하는 칼럼',
    dislikes: '감정 호소형 기사, 근거 없는 주장, 클릭베이트',
  },
  {
    id: 'NF',
    name: '하은',
    nickname: '이야기꾼',
    avatar: '/editors/infp.png',
    // 딥 로즈 → 마젠타
    bgFrom: '#2a0a1e',
    bgVia: '#4a1235',
    bgTo: '#6b1d4a',
    accent: '#f472b6',     // pink-400
    accentSoft: '#db2777', // pink-600
    tagline: '의미와 가능성을 발견하는 사람',
    personality: '기사 읽다가 멍때리는 거... 저만 그런가요...?',
    description: '하은은 뉴스에서 숫자가 아니라 사람을 봐요. 경제 기사를 읽어도 "이 뒤에 어떤 사람들이 있을까?" 생각하고, 읽다가 마음이 움직이면 한참을 멍하니 있기도 해요. 기사를 추천할 때도 조심스럽게, 진심을 담아서 나눠요.',
    newsStyle: '숫자 뒤에 숨겨진 사람 이야기를 찾아요. 읽고 나면 "왜?"라는 질문이 남는 기사를 좋아해요.',
    catchphrase: ['"음... 이건 그냥 지나칠 수 없어서요."', '"읽다 보니 마음이 움직이는 부분이..."', '"같이... 천천히 읽어봐요."'],
    likes: '사람 이야기가 담긴 기사, 의미 있는 변화를 다룬 기사, 진심이 느껴지는 글',
    dislikes: '차가운 숫자만 나열한 기사, 자극적인 제목, 사람을 도구로 다루는 기사',
  },
  {
    id: 'ST',
    name: '준서',
    nickname: '실용주의자',
    avatar: '/editors/istj.png',
    // 딥 티얼 → 에메랄드
    bgFrom: '#0a1f1a',
    bgVia: '#0f3028',
    bgTo: '#134e3a',
    accent: '#34d399',     // emerald-400
    accentSoft: '#059669', // emerald-600
    tagline: '사실과 경험을 중시하는 사람',
    personality: '결론부터 말씀드림. 시간은 금임.',
    description: '준서는 군더더기를 싫어해요. 기사 30개를 훑되 3분 안에 끝냄. 실질적으로 도움 되는 기사 하나만 골라서 결론부터 전달하죠. "이거 하나만 읽으면 됨" — 그게 준서 스타일이에요.',
    newsStyle: '팩트만 봅니다. 감상 없이 결론부터, 이유는 나중에. 실무에 바로 써먹을 수 있는 정보를 우선합니다.',
    catchphrase: ['"결론부터 — 이것만 읽으면 됨."', '"시간 없으면 첫 세 문단만."', '"30개 봤는데 이게 제일 실속 있음."'],
    likes: '팩트 중심 기사, 실무에 도움 되는 기사, 짧고 굵은 기사',
    dislikes: '감성 포장된 기사, 쓸데없이 긴 서론, 결론 없는 기사',
  },
  {
    id: 'SF',
    name: '소율',
    nickname: '공감러',
    avatar: '/editors/esfp.png',
    // 딥 앰버 → 오렌지
    bgFrom: '#1f1206',
    bgVia: '#3d220d',
    bgTo: '#5c3512',
    accent: '#fbbf24',     // amber-400
    accentSoft: '#d97706', // amber-600
    tagline: '사람과 순간을 소중히 여기는 사람',
    personality: '헐 여러분 이거 꼭 봐야 해요!!!!',
    description: '소율은 혼자 기사 읽는 걸 못 참아요. 재밌는 기사 발견하면 바로 단톡방에 공유하고, "야 이거 봤어??" 하면서 친구한테 카톡을 보내죠. 기사를 추천하는 이유는 정보 전달이 아니라, 같이 신나고 싶어서!',
    newsStyle: '재밌고, 친구한테 공유하고 싶고, 대화 소재가 되는 기사를 골라요. 혼자 보기 아까운 기사가 제일 좋은 기사!',
    catchphrase: ['"아 잠깐만요 이거 꼭 봐야 해요!!!! ✨"', '"헐헐헐 이거 안 보면 진심 손해 ㄹㅇ"', '"점심시간에 같이 얘기하면 대화 2시간은 감!!"'],
    likes: '트렌디한 기사, 반전 있는 기사, SNS에서 화제인 기사',
    dislikes: '딱딱한 보고서형 기사, 재미없는 기사, 공유하기 민망한 기사',
  },
];

function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDuration: '800ms', transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function EditorsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700;900&display=swap');
        .serif { font-family: 'Noto Serif KR', serif; }
      `}</style>

      {/* ── 히어로 ── */}
      <section className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6">
        {/* 미묘한 배경 글로우 */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-20 blur-[150px]"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }} />

        <FadeIn className="text-center">
          <p className="text-xs tracking-[0.35em] text-white/25 uppercase mb-8">AI Lens Editors</p>
          <h1 className="serif text-[34px] md:text-[52px] font-bold leading-[1.2] mb-5">
            당신의 뉴스를<br />읽어주는 사람들
          </h1>
          <p className="text-[15px] md:text-[17px] text-white/35 leading-relaxed max-w-[400px] mx-auto">
            같은 기사도 누가 읽느냐에 따라 달라져요.<br />
            당신과 닮은 에디터를 만나보세요.
          </p>
        </FadeIn>

        {/* 아바타 프리뷰 */}
        <FadeIn delay={400} className="mt-16 flex justify-center gap-10 md:gap-14">
          {editors.map((e, i) => (
            <FadeIn key={e.id} delay={500 + i * 120} className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-2 rounded-full opacity-30 blur-xl"
                  style={{ backgroundColor: e.accent }} />
                <img
                  src={e.avatar}
                  alt={e.name}
                  className="relative w-16 h-16 md:w-20 md:h-20 rounded-full object-cover ring-[1.5px] ring-white/15"
                />
              </div>
              <div className="text-center">
                <p className="text-[12px] font-medium text-white/60">{e.name}</p>
                <p className="text-[10px] text-white/25">{e.nickname}</p>
              </div>
            </FadeIn>
          ))}
        </FadeIn>

        {/* 스크롤 힌트 */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 animate-bounce">
          <p className="text-[10px] text-white/15 tracking-[0.2em]">SCROLL</p>
          <svg className="w-3.5 h-3.5 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7" />
          </svg>
        </div>
      </section>

      {/* ── 에디터 섹션 ── */}
      {editors.map((editor, idx) => {
        // 이전/다음 색상 — 자연스러운 블렌딩용
        const prevColor = idx === 0 ? '#080808' : editors[idx - 1].bgTo;
        const nextColor = idx === editors.length - 1 ? '#080808' : editors[idx + 1].bgFrom;

        return (
          <section key={editor.id} className="relative">
            {/* 위쪽 블렌드: 이전 섹션 색 → 현재 색 */}
            <div className="h-32 md:h-48" style={{
              background: `linear-gradient(to bottom, ${prevColor}, ${editor.bgFrom})`
            }} />

            {/* 메인 콘텐츠 영역 */}
            <div className="px-6 py-16 md:py-24" style={{
              background: `linear-gradient(135deg, ${editor.bgFrom} 0%, ${editor.bgVia} 40%, ${editor.bgTo} 100%)`
            }}>
              {/* 배경 장식 — 은은한 글로우 */}
              <div className="absolute right-0 top-1/3 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[100px] pointer-events-none"
                style={{ backgroundColor: editor.accent }} />

              <div className="relative z-10 max-w-[880px] mx-auto">
                {/* 에디터 ID 뱃지 */}
                <FadeIn>
                  <div className="flex items-center gap-2 mb-10">
                    <div className="w-8 h-[1px]" style={{ backgroundColor: editor.accent }} />
                    <span className="text-[11px] font-semibold tracking-[0.25em] uppercase" style={{ color: editor.accent }}>
                      {editor.id} Type
                    </span>
                  </div>
                </FadeIn>

                {/* 상단: 아바타 + 소개 */}
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12 mb-14">
                  <FadeIn className="flex-shrink-0">
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-full opacity-20 blur-2xl"
                        style={{ backgroundColor: editor.accent }} />
                      <div className="relative w-[140px] h-[140px] md:w-[180px] md:h-[180px] rounded-full overflow-hidden ring-2 ring-white/10">
                        <img src={editor.avatar} alt={editor.name} className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </FadeIn>

                  <FadeIn delay={150} className="text-center md:text-left flex-1">
                    <h2 className="serif text-[30px] md:text-[42px] font-bold leading-tight mb-1.5">
                      {editor.name}
                    </h2>
                    <p className="text-[14px] font-medium mb-6" style={{ color: editor.accent }}>
                      {editor.nickname} · {editor.tagline}
                    </p>
                    <p className="text-[20px] md:text-[24px] text-white/30 font-light italic mb-7 leading-snug">
                      &ldquo;{editor.personality}&rdquo;
                    </p>
                    <p className="text-[14px] md:text-[15px] text-white/55 leading-[1.9] max-w-[520px]">
                      {editor.description}
                    </p>
                  </FadeIn>
                </div>

                {/* 카드 그리드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <FadeIn delay={200}>
                    <div className="rounded-2xl p-5 md:p-6 bg-white/[0.04] border border-white/[0.06]">
                      <h3 className="text-[12px] font-semibold tracking-wide mb-3" style={{ color: editor.accent }}>
                        뉴스 읽는 스타일
                      </h3>
                      <p className="text-[13px] text-white/50 leading-[1.85]">{editor.newsStyle}</p>
                    </div>
                  </FadeIn>

                  <FadeIn delay={300}>
                    <div className="rounded-2xl p-5 md:p-6 bg-white/[0.04] border border-white/[0.06]">
                      <h3 className="text-[12px] font-semibold tracking-wide mb-3" style={{ color: editor.accent }}>
                        입버릇
                      </h3>
                      <div className="space-y-2.5">
                        {editor.catchphrase.map((phrase, i) => (
                          <p key={i} className="text-[13px] text-white/45 italic leading-relaxed">{phrase}</p>
                        ))}
                      </div>
                    </div>
                  </FadeIn>

                  <FadeIn delay={400}>
                    <div className="rounded-2xl p-5 md:p-6 bg-white/[0.04] border border-white/[0.06]">
                      <h3 className="text-[12px] font-semibold tracking-wide mb-3" style={{ color: editor.accent }}>
                        취향
                      </h3>
                      <div className="mb-3.5">
                        <p className="text-[10px] font-bold text-emerald-400/70 mb-1 tracking-wider">LIKE</p>
                        <p className="text-[12px] text-white/45 leading-relaxed">{editor.likes}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-red-400/70 mb-1 tracking-wider">DISLIKE</p>
                        <p className="text-[12px] text-white/45 leading-relaxed">{editor.dislikes}</p>
                      </div>
                    </div>
                  </FadeIn>
                </div>
              </div>
            </div>

            {/* 아래쪽 블렌드: 현재 색 → 다음 섹션 색 */}
            <div className="h-32 md:h-48" style={{
              background: `linear-gradient(to bottom, ${editor.bgTo}, ${nextColor})`
            }} />
          </section>
        );
      })}

      {/* ── CTA ── */}
      <section className="relative py-28 md:py-36 px-6 flex flex-col items-center justify-center">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full opacity-10 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, #f472b6 50%, transparent 70%)' }} />

        <FadeIn className="relative z-10 text-center">
          <h2 className="serif text-[26px] md:text-[38px] font-bold leading-tight mb-4">
            나에게 맞는 에디터로<br />뉴스 읽기
          </h2>
          <p className="text-[14px] text-white/30 mb-10">
            같은 뉴스도 다르게 읽히는 경험을 해보세요.
          </p>
          <button
            onClick={() => router.push('/?tab=feed')}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-gray-900 rounded-full text-[14px] font-semibold hover:bg-white/90 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(255,255,255,0.15)]"
          >
            뉴스피드로 돌아가기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </FadeIn>
      </section>
    </div>
  );
}
