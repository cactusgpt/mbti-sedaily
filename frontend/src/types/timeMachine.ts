export interface DayNews {
  title: string;
  summary?: string;  // 선택적 — 크롤링 시 없을 수 있음
  category: string;
  url?: string;      // 원문 링크
}

export interface HistoricalEvent {
  year: number;
  title: string;
  description: string;
  category: string;
  image: string;
}

export interface TimeMachineData {
  news: DayNews[];
  historicalEvents: HistoricalEvent[];
}
