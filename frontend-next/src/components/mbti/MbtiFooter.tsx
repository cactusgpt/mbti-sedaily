

export function MbtiFooter() {
  return (
    <footer className="bg-[var(--color-bg-subtle)] border-t border-[var(--color-border)] py-8">
      <div className="max-w-container mx-auto px-gutter text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          &copy; 2026 서울경제신문. K-Stock Insight MBTI 뉴스레터.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          같은 팩트, 다른 스타일. 당신에게 맞는 경제 뉴스.
        </p>
        <div className="mt-4 flex justify-center gap-4 text-xs text-[var(--color-text-muted)]">
          <a href="https://www.sedaily.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-text)]">
            서울경제 홈
          </a>
          <span>|</span>
          <a href="#" className="hover:text-[var(--color-text)]">개인정보처리방침</a>
        </div>
      </div>
    </footer>
  );
}
