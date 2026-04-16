'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Newspaper, MessageCircle, Heart, ThumbsDown, Sparkles, Volume2, Loader2, Pause } from 'lucide-react';
import { playEditorIntro, stopAudio, isPlaying } from '@/shared/lib/elevenlabs';

/*
 * 색상 시스템 — Radix Sand Dark + WCAG AA
 *
 * 배경:  #111110  (Sand 1)
 * 표면:  #1e1d1b  (Sand 3)
 * 텍스트: high #eeeeec (16.9:1) / body #d4d2cd (12.5:1) / sub #b5b3ad (9.4:1)
 *         muted #908e88 (5.8:1) / dim #6f6d66 (3.6:1, 장식 대형 텍스트만)
 * 보더:  #2a2a28 (Sand 4) / #3b3a37 (Sand 6)
 * Accent: muted jewel tones, HSL 채도 28-45%, 명도 58-66%
 */

const T = {
  high: '#eeeeec',
  body: '#d4d2cd',
  sub: '#b5b3ad',
  muted: '#908e88',
  dim: '#6f6d66',
  bg: '#111110',
  surface: '#1e1d1b',
  border: '#2a2a28',
};

const editors = [
  {
    id: 'NT',
    name: '민철',
    nickname: '분석가',
    avatar: '/editors/intj.png',
    accent: '#a48cc8',
    accentDim: 'rgba(164,140,200,',
    glow: '#8870b0',
    tagline: '논리와 전략으로 세상을 읽는 사람',
    personality: '감정?\n그건 변수에 안 넣습니다.',
    description: '민철은 뉴스를 읽을 때 감정을 철저히 배제해요. 원인과 결과, 데이터와 근거만으로 기사를 판단하죠. "왜 이 타이밍에 이 이슈가 터졌는가?"를 항상 먼저 생각하고, 기사 30개를 비교 분석한 뒤 논리적 정합성이 가장 높은 기사 하나를 골라요.',
    newsStyle: '기사의 인과관계를 추적하고, 다른 매체와 비교 분석합니다. 감정적 프레이밍이 들어간 기사는 걸러내요.',
    catchphrase: ['구조적으로 흥미로운 기사인데.', '논리적으로 봤을 때...', '팩트 체크 다 해봤는데 문제 없음.'],
    likes: '데이터 기반 분석 기사, 인과관계가 선명한 기사, 다른 시각을 제시하는 칼럼',
    dislikes: '감정 호소형 기사, 근거 없는 주장, 클릭베이트',
  },
  {
    id: 'NF',
    name: '하은',
    nickname: '이야기꾼',
    avatar: '/editors/infp.png',
    accent: '#c4899e',
    accentDim: 'rgba(196,137,158,',
    glow: '#a87088',
    tagline: '의미와 가능성을 발견하는 사람',
    personality: '기사 읽다가 멍때리는 거...\n저만 그런가요...?',
    description: '하은은 뉴스에서 숫자가 아니라 사람을 봐요. 경제 기사를 읽어도 "이 뒤에 어떤 사람들이 있을까?" 생각하고, 읽다가 마음이 움직이면 한참을 멍하니 있기도 해요. 기사를 추천할 때도 조심스럽게, 진심을 담아서 나눠요.',
    newsStyle: '숫자 뒤에 숨겨진 사람 이야기를 찾아요. 읽고 나면 "왜?"라는 질문이 남는 기사를 좋아해요.',
    catchphrase: ['음... 이건 그냥 지나칠 수 없어서요.', '읽다 보니 마음이 움직이는 부분이...', '같이... 천천히 읽어봐요.'],
    likes: '사람 이야기가 담긴 기사, 의미 있는 변화를 다룬 기사, 진심이 느껴지는 글',
    dislikes: '차가운 숫자만 나열한 기사, 자극적인 제목, 사람을 도구로 다루는 기사',
  },
  {
    id: 'ST',
    name: '준서',
    nickname: '실용주의자',
    avatar: '/editors/istj.png',
    accent: '#7db89a',
    accentDim: 'rgba(125,184,154,',
    glow: '#5ea07e',
    tagline: '사실과 경험을 중시하는 사람',
    personality: '결론부터 말씀드림.\n시간은 금임.',
    description: '준서는 군더더기를 싫어해요. 기사 30개를 훑되 3분 안에 끝냄. 실질적으로 도움 되는 기사 하나만 골라서 결론부터 전달하죠. "이거 하나만 읽으면 됨" — 그게 준서 스타일이에요.',
    newsStyle: '팩트만 봅니다. 감상 없이 결론부터, 이유는 나중에. 실무에 바로 써먹을 수 있는 정보를 우선합니다.',
    catchphrase: ['결론부터 — 이것만 읽으면 됨.', '시간 없으면 첫 세 문단만.', '30개 봤는데 이게 제일 실속 있음.'],
    likes: '팩트 중심 기사, 실무에 도움 되는 기사, 짧고 굵은 기사',
    dislikes: '감성 포장된 기사, 쓸데없이 긴 서론, 결론 없는 기사',
  },
  {
    id: 'SF',
    name: '소율',
    nickname: '공감러',
    avatar: '/editors/esfp.png',
    accent: '#c9a660',
    accentDim: 'rgba(201,166,96,',
    glow: '#a88840',
    tagline: '사람과 순간을 소중히 여기는 사람',
    personality: '헐 여러분\n이거 꼭 봐야 해요!!!!',
    description: '소율은 혼자 기사 읽는 걸 못 참아요. 재밌는 기사 발견하면 바로 단톡방에 공유하고, "야 이거 봤어??" 하면서 친구한테 카톡을 보내죠. 기사를 추천하는 이유는 정보 전달이 아니라, 같이 신나고 싶어서!',
    newsStyle: '재밌고, 친구한테 공유하고 싶고, 대화 소재가 되는 기사를 골라요. 혼자 보기 아까운 기사가 제일 좋은 기사!',
    catchphrase: ['아 잠깐만요 이거 꼭 봐야 해요!!!!', '헐헐헐 이거 안 보면 진심 손해 ㄹㅇ', '점심시간에 같이 얘기하면 대화 2시간은 감!!'],
    likes: '트렌디한 기사, 반전 있는 기사, SNS에서 화제인 기사',
    dislikes: '딱딱한 보고서형 기사, 재미없는 기사, 공유하기 민망한 기사',
  },
];

/* ── personality 전용 줄바꿈 ── */
function NL({ text }: { text: string }) {
  const parts = text.split('\n');
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((line, i) => (
        <span key={i}>
          {line}
          {i < parts.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

/* ── Scroll FadeIn ── */
function FadeIn({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} ${className}`}
      style={{ transitionDuration: '1000ms', transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function EditorsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen overflow-x-hidden relative" style={{ backgroundColor: T.bg, color: T.high }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700;900&display=swap');
        .serif { font-family: 'Noto Serif KR', serif; }
      `}</style>

      {/*
        글로우를 개별 섹션이 아닌 최상위에 absolute로 배치
        → overflow-hidden 필요 없음 → 경계선 없음
      */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {editors.map((editor, idx) => {
          const isEven = idx % 2 === 1;
          // 히어로(100vh) + 섹션당 대략 높이 기준으로 글로우 위치 계산
          const topPercent = 12 + idx * 22;
          return (
            <div
              key={editor.id}
              className="absolute rounded-full blur-[280px]"
              style={{
                backgroundColor: editor.glow,
                opacity: 0.035,
                width: '1100px',
                height: '900px',
                top: `${topPercent}%`,
                left: isEven ? '55%' : '-8%',
                transform: 'translate(-30%, -30%)',
              }}
            />
          );
        })}
      </div>

      {/* ── Hero ── */}
      <section className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full opacity-[0.06] blur-[200px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, #8870b0 0%, #a87088 60%, transparent 80%)' }} />

        <FadeIn className="text-center">
          <p className="text-[11px] tracking-[0.4em] uppercase mb-10" style={{ color: T.dim }}>
            AI Lens Editors
          </p>
          <h1 className="serif text-[36px] md:text-[54px] font-bold leading-[1.15] mb-6">
            당신의 뉴스를<br />읽어주는 사람들
          </h1>
          <p className="text-[15px] md:text-[17px] leading-relaxed max-w-[380px] mx-auto" style={{ color: T.sub }}>
            같은 기사도 누가 읽느냐에 따라 달라져요.<br />
            당신과 닮은 에디터를 만나보세요.
          </p>
        </FadeIn>

        {/* Avatars — 모바일 대응: gap 줄이고 flex-wrap */}
        <FadeIn delay={400} className="mt-20 flex justify-center flex-wrap gap-8 md:gap-16">
          {editors.map((e, i) => (
            <FadeIn key={e.id} delay={500 + i * 150} className="flex flex-col items-center gap-3 group cursor-default">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full opacity-0 group-hover:opacity-25 blur-xl transition-opacity duration-700"
                  style={{ backgroundColor: e.glow }} />
                <div className="w-[60px] h-[60px] md:w-[76px] md:h-[76px] rounded-full p-[2px]"
                  style={{ background: `linear-gradient(135deg, ${e.accent}50, transparent 60%, ${e.accent}30)` }}>
                  <img src={e.avatar} alt={e.name} className="w-full h-full rounded-full object-cover" style={{ backgroundColor: T.surface }} />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[12px] font-medium" style={{ color: T.sub }}>{e.name}</p>
                <p className="text-[10px]" style={{ color: T.muted }}>{e.nickname}</p>
              </div>
            </FadeIn>
          ))}
        </FadeIn>

        {/* Scroll */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <p className="text-[9px] tracking-[0.3em] uppercase" style={{ color: T.dim }}>Scroll</p>
          <svg className="w-3 h-3" style={{ color: T.dim }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7" />
          </svg>
        </div>
      </section>

      {/* ── Editors ── */}
      {editors.map((editor, idx) => {
        const isEven = idx % 2 === 1;

        return (
          <section key={editor.id} className="relative px-6 pt-10 pb-20 md:pt-16 md:pb-28">
            <div className="relative z-10 max-w-[960px] mx-auto">
              {/* Type label */}
              <FadeIn>
                <div className="flex items-center gap-3 mb-14">
                  <span className="text-[10px] font-semibold tracking-[0.3em] uppercase" style={{ color: editor.accent }}>
                    {editor.id}
                  </span>
                  <div className="flex-1 h-[1px]" style={{ backgroundColor: T.border }} />
                </div>
              </FadeIn>

              {/* Avatar + intro — 교차 배치 */}
              <div className={`flex flex-col ${isEven ? 'md:flex-row-reverse' : 'md:flex-row'} items-center md:items-start gap-10 md:gap-16 mb-16`}>
                {/* Avatar */}
                <FadeIn className="flex-shrink-0">
                  <div className="relative group">
                    <div className="absolute -inset-10 rounded-full opacity-[0.08] blur-3xl transition-opacity duration-1000 group-hover:opacity-[0.15]"
                      style={{ backgroundColor: editor.glow }} />
                    <div className="w-[170px] h-[170px] md:w-[210px] md:h-[210px] rounded-full p-[2.5px]"
                      style={{ background: `linear-gradient(160deg, ${editor.accent}60, ${editor.accent}10 50%, ${editor.accent}40)` }}>
                      <img src={editor.avatar} alt={editor.name}
                        className="w-full h-full rounded-full object-cover"
                        style={{ backgroundColor: T.surface }} />
                    </div>
                  </div>
                </FadeIn>

                {/* Text */}
                <FadeIn delay={150} className={`flex-1 text-center ${isEven ? 'md:text-right' : 'md:text-left'}`}>
                  <h2 className="serif text-[34px] md:text-[48px] font-bold leading-tight mb-2">
                    {editor.name}
                  </h2>
                  <p className="text-[13px] font-medium mb-3" style={{ color: editor.accent }}>
                    {editor.nickname} &middot; {editor.tagline}
                  </p>

                  {/* Quote — 좌우 정렬에 따라 따옴표 위치 반전 */}
                  <div className={`relative mb-10 ${isEven ? 'md:pl-0 md:pr-8' : 'pl-8'}`}>
                    <span
                      className={`absolute -top-4 serif text-[60px] leading-none select-none ${isEven ? 'md:-right-2 -left-2 md:left-auto' : '-left-2'}`}
                      style={{ color: `${editor.accentDim}0.12)` }}
                    >
                      {isEven ? <span className="hidden md:inline">&rdquo;</span> : null}
                      {isEven ? <span className="md:hidden">&ldquo;</span> : <>&ldquo;</>}
                    </span>
                    <p className="serif text-[20px] md:text-[24px] font-normal italic leading-[1.6]"
                      style={{ color: T.muted }}>
                      <NL text={editor.personality} />
                    </p>
                  </div>

                  <p className="text-[14px] md:text-[15px] leading-[2] max-w-[520px] mx-auto md:mx-0"
                    style={{
                      color: T.body,
                      ...(isEven ? { marginLeft: 'auto', marginRight: 0 } : {}),
                    }}>
                    {editor.description}
                  </p>
                </FadeIn>
              </div>

              {/* ── Cards ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                {/* 뉴스 스타일 */}
                <FadeIn delay={200}>
                  <div className="h-full rounded-2xl p-6 transition-all duration-500 hover:translate-y-[-2px]"
                    style={{
                      backgroundColor: `${editor.accentDim}0.05)`,
                      border: `1px solid ${editor.accentDim}0.10)`,
                      boxShadow: `0 0 0 0 transparent`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 32px ${editor.accentDim}0.08)`; e.currentTarget.style.borderColor = `${editor.accentDim}0.20)`; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 0 0 transparent`; e.currentTarget.style.borderColor = `${editor.accentDim}0.10)`; }}
                  >
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${editor.accentDim}0.12)` }}>
                        <Newspaper size={14} style={{ color: editor.accent }} />
                      </div>
                      <h3 className="text-[12px] font-semibold tracking-wide" style={{ color: editor.accent }}>
                        뉴스 읽는 스타일
                      </h3>
                    </div>
                    <p className="text-[13px] leading-[1.9]" style={{ color: T.sub }}>
                      {editor.newsStyle}
                    </p>
                  </div>
                </FadeIn>

                {/* 입버릇 */}
                <FadeIn delay={300}>
                  <div className="h-full rounded-2xl p-6 transition-all duration-500 hover:translate-y-[-2px]"
                    style={{
                      backgroundColor: `${editor.accentDim}0.05)`,
                      border: `1px solid ${editor.accentDim}0.10)`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 32px ${editor.accentDim}0.08)`; e.currentTarget.style.borderColor = `${editor.accentDim}0.20)`; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = `${editor.accentDim}0.10)`; }}
                  >
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${editor.accentDim}0.12)` }}>
                        <MessageCircle size={14} style={{ color: editor.accent }} />
                      </div>
                      <h3 className="text-[12px] font-semibold tracking-wide" style={{ color: editor.accent }}>
                        입버릇
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {editor.catchphrase.map((phrase, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <Sparkles size={11} className="mt-[5px] flex-shrink-0" style={{ color: `${editor.accentDim}0.4)` }} />
                          <p className="text-[13px] italic leading-relaxed" style={{ color: T.sub }}>
                            {phrase}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>

                {/* 취향 */}
                <FadeIn delay={400}>
                  <div className="h-full rounded-2xl p-6 transition-all duration-500 hover:translate-y-[-2px]"
                    style={{
                      backgroundColor: `${editor.accentDim}0.05)`,
                      border: `1px solid ${editor.accentDim}0.10)`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 32px ${editor.accentDim}0.08)`; e.currentTarget.style.borderColor = `${editor.accentDim}0.20)`; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = `${editor.accentDim}0.10)`; }}
                  >
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${editor.accentDim}0.12)` }}>
                        <Heart size={14} style={{ color: editor.accent }} />
                      </div>
                      <h3 className="text-[12px] font-semibold tracking-wide" style={{ color: editor.accent }}>
                        취향
                      </h3>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Heart size={10} fill={editor.accent} style={{ color: editor.accent }} />
                        <p className="text-[10px] font-bold tracking-wider" style={{ color: editor.accent }}>LIKE</p>
                      </div>
                      <p className="text-[12px] leading-[1.8]" style={{ color: T.sub }}>
                        {editor.likes}
                      </p>
                    </div>

                    <div className="pt-3" style={{ borderTop: `1px solid ${editor.accentDim}0.08)` }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <ThumbsDown size={10} style={{ color: T.muted }} />
                        <p className="text-[10px] font-bold tracking-wider" style={{ color: T.muted }}>DISLIKE</p>
                      </div>
                      <p className="text-[12px] leading-[1.8]" style={{ color: T.muted }}>
                        {editor.dislikes}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              </div>

              {/* 에디터 CTA */}
              <FadeIn delay={500}>
                <div className="mt-10 flex justify-center">
                  <button
                    onClick={() => router.push(`/?tab=feed&editor=${editor.id}`)}
                    className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-[13px] font-medium transition-all duration-500 hover:scale-[1.03]"
                    style={{
                      backgroundColor: `${editor.accentDim}0.10)`,
                      border: `1px solid ${editor.accentDim}0.18)`,
                      color: editor.accent,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = `${editor.accentDim}0.18)`;
                      e.currentTarget.style.boxShadow = `0 0 24px ${editor.accentDim}0.12)`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = `${editor.accentDim}0.10)`;
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    {editor.name}의 뉴스 읽으러 가기
                    <svg className="w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </FadeIn>
            </div>
          </section>
        );
      })}

      {/* ── CTA ── */}
      <section className="relative py-28 md:py-36 px-6 flex flex-col items-center justify-center">
        <FadeIn className="relative z-10 text-center">
          <h2 className="serif text-[28px] md:text-[40px] font-bold leading-tight mb-5">
            나에게 맞는 에디터로<br />뉴스 읽기
          </h2>
          <p className="text-[14px] mb-12" style={{ color: T.sub }}>
            같은 뉴스도 다르게 읽히는 경험을 해보세요.
          </p>
          <button
            onClick={() => router.push('/?tab=feed')}
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-[14px] font-medium transition-all duration-500 hover:scale-[1.02]"
            style={{
              backgroundColor: 'rgba(238,238,236,0.08)',
              border: `1px solid ${T.border}`,
              color: T.high,
            }}
          >
            뉴스피드로 돌아가기
            <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </FadeIn>
      </section>

      <div className="h-16" />
    </div>
  );
}
