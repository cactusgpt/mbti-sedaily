export interface InvestmentOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
  // 연도별 현재가치 배수 (1,000,000원 투자 기준)
  multiplierByYear: Record<number, number>;
  tagline: (multiple: number) => string;
}

export const INVESTMENT_OPTIONS: InvestmentOption[] = [
  {
    id: "kospi",
    label: "코스피 매수",
    emoji: "📈",
    description: "그날 코스피 ETF에 전액 투자",
    multiplierByYear: {
      1990: 3.7,  1991: 4.2,  1992: 3.8,  1993: 3.0,  1994: 2.5,
      1995: 2.9,  1996: 3.9,  1997: 6.8,  1998: 4.6,  1999: 2.5,
      2000: 5.1,  2001: 3.7,  2002: 4.1,  2003: 3.2,  2004: 2.9,
      2005: 1.9,  2006: 1.8,  2007: 1.4,  2008: 2.3,  2009: 1.5,
      2010: 1.3,  2011: 1.4,  2012: 1.3,  2013: 1.3,  2014: 1.3,
      2015: 1.3,  2016: 1.3,  2017: 1.1,  2018: 1.3,  2019: 1.2,
      2020: 0.9,  2021: 0.9,  2022: 1.2,  2023: 1.0,  2024: 1.1,
    },
    tagline: (m) =>
      m >= 5 ? "위기를 기회로 만든 투자자입니다." :
      m >= 2 ? "꾸준한 장기 투자의 힘을 보여줬습니다." :
      "시장은 언제나 회복합니다. 조금만 더 기다렸다면.",
  },
  {
    id: "bitcoin",
    label: "비트코인 투자",
    emoji: "₿",
    description: "그날 비트코인에 전액 투자",
    multiplierByYear: {
      1990: 1,    1991: 1,    1992: 1,    1993: 1,    1994: 1,
      1995: 1,    1996: 1,    1997: 1,    1998: 1,    1999: 1,
      2000: 1,    2001: 1,    2002: 1,    2003: 1,    2004: 1,
      2005: 1,    2006: 1,    2007: 1,    2008: 1,    2009: 15000,
      2010: 9000, 2011: 800,  2012: 400,  2013: 50,   2014: 30,
      2015: 25,   2016: 18,   2017: 8,    2018: 12,   2019: 8,
      2020: 4,    2021: 2.5,  2022: 3.5,  2023: 1.8,  2024: 1.3,
    },
    tagline: (m) =>
      m >= 1000 ? "전설이 됐을 겁니다. 팔지만 않았다면." :
      m >= 10   ? "인생이 바뀌었을 투자입니다." :
      m <= 1    ? "비트코인이 아직 존재하지 않던 시절입니다." :
      "나쁘지 않은 수익이지만, 더 일찍 샀다면...",
  },
  {
    id: "cash",
    label: "현금 보유",
    emoji: "💵",
    description: "그냥 통장에 넣어두기",
    multiplierByYear: {
      1990: 0.42, 1991: 0.44, 1992: 0.46, 1993: 0.48, 1994: 0.50,
      1995: 0.52, 1996: 0.54, 1997: 0.56, 1998: 0.58, 1999: 0.60,
      2000: 0.62, 2001: 0.64, 2002: 0.66, 2003: 0.68, 2004: 0.70,
      2005: 0.72, 2006: 0.74, 2007: 0.76, 2008: 0.78, 2009: 0.80,
      2010: 0.82, 2011: 0.84, 2012: 0.86, 2013: 0.88, 2014: 0.90,
      2015: 0.92, 2016: 0.93, 2017: 0.94, 2018: 0.95, 2019: 0.96,
      2020: 0.97, 2021: 0.97, 2022: 0.98, 2023: 0.99, 2024: 1.0,
    },
    tagline: () => "안전하지만, 물가는 당신의 돈을 조금씩 갉아먹었습니다.",
  },
];

const INITIAL_AMOUNT = 1_000_000;

export function calcInvestment(optionId: string, year: number) {
  const option = INVESTMENT_OPTIONS.find((o) => o.id === optionId)!;
  const multiplier = option.multiplierByYear[year] ?? 1;
  const currentValue = Math.round(INITIAL_AMOUNT * multiplier);
  const returnRate = ((multiplier - 1) * 100);
  return {
    initialAmount: INITIAL_AMOUNT,
    currentValue,
    multiplier,
    returnRate,
    tagline: option.tagline(multiplier),
  };
}
