// 마크다운 클린업 — 리스트 프리뷰용 (구조 마커·테이블 제거)
export function cleanMarkdown(text: string): string {
  return text
    .split('\n')
    .filter(line => {
      const t = line.trim();
      // 구조 태그 행 제거: [핵심 키워드], [체크포인트], [결론: ...], [마음을 울리는 질문] 등
      if (/^\[.*\]$/.test(t)) return false;
      // 마크다운 테이블 행 (| 로 시작하거나 |---| 패턴)
      if (/^\|/.test(t)) return false;
      // 수평선
      if (/^-{3,}$/.test(t)) return false;
      // 마크다운 헤딩
      if (/^#{1,6}\s/.test(t)) return false;
      return true;
    })
    .join('\n')
    // 인라인 마크다운 제거
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/[■✓]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 본문 텍스트 추출
export function getBodyText(body: string | string[]): string {
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
