/**
 * 날짜별 Front Page Unboxing 영상 설정
 *
 * 업데이트: ./scripts/update-video.sh YYYY-MM-DD VIDEO_URL
 */

export const DAILY_VIDEOS: Record<string, string> = {
  "2026-01-05": "https://youtu.be/RlBO28BG4l0",
  "2026-01-04": "https://youtu.be/qxrPKJxlD8k",
  "2026-01-03": "https://youtu.be/qxrPKJxlD8k",
};

// 기본 영상 (날짜에 영상 없을 때)
export const DEFAULT_VIDEO = "https://youtu.be/qxrPKJxlD8k";

// 날짜로 영상 찾기
export function getVideoForDate(dateString: string): string {
  const date = dateString.slice(0, 10); // "2026-01-05"
  return DAILY_VIDEOS[date] || DEFAULT_VIDEO;
}
