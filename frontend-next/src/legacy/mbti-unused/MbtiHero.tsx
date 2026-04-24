

export function MbtiHero() {
  return (
    <section className="bg-[var(--color-bg)] py-16 md:py-24">
      <div className="max-w-container mx-auto px-gutter text-center">
        <p className="text-[var(--color-text-muted)] text-sm mb-4" style={{ fontFamily: '"Noto Sans KR", sans-serif' }}>
          MBTI 맞춤 경제 뉴스 서비스
        </p>
        <h1
          className="text-3xl md:text-5xl font-bold text-[var(--color-text)] leading-tight mb-6"
          style={{ fontFamily: '"Noto Sans KR", sans-serif' }}
        >
          같은 뉴스,<br />
          <span className="bg-gradient-to-r from-blue-500 via-violet-500 to-orange-500 bg-clip-text text-transparent">
            4가지 스타일
          </span>
          로 읽다
        </h1>
        <p className="text-[var(--color-text-light)] text-base md:text-lg leading-relaxed max-w-xl mx-auto mb-8">
          같은 뉴스도 사람마다 읽는 방식이 다릅니다.
          <br />
          당신의 MBTI에 맞는 스타일로 경제 뉴스를 만나보세요.
          <br />
          <strong className="text-[var(--color-text)]">팩트는 그대로, 전달 방식만 바꿉니다.</strong>
        </p>
        <a
          href="#mbti-select"
          className="inline-block px-8 py-3 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          style={{ fontFamily: '"Noto Sans KR", sans-serif' }}
        >
          내 뉴스 스타일 찾기 ↓
        </a>
      </div>
    </section>
  );
}
