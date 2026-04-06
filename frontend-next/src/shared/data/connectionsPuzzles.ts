/**
 * K-Business Connections Puzzles
 * Daily puzzles about Korean companies grouped by categories
 */

export interface ConnectionGroup {
  category: string;
  items: string[];
  difficulty: 1 | 2 | 3 | 4; // 1 = easiest, 4 = hardest
  color: string; // Tailwind color class
}

export interface ConnectionsPuzzle {
  id: number;
  date: string; // YYYY-MM-DD
  groups: ConnectionGroup[];
}

export const connectionsPuzzles: ConnectionsPuzzle[] = [
  {
    id: 1,
    date: "2025-01-01",
    groups: [
      {
        category: "Semiconductor Companies",
        items: ["Samsung Electronics", "SK Hynix", "DB HiTek", "Key Foundry"],
        difficulty: 1,
        color: "bg-blue-500",
      },
      {
        category: "Automobile Manufacturers",
        items: ["Hyundai Motor", "Kia", "Genesis", "Ssangyong"],
        difficulty: 2,
        color: "bg-green-500",
      },
      {
        category: "IT Platform Companies",
        items: ["Naver", "Kakao", "Coupang", "Toss"],
        difficulty: 2,
        color: "bg-yellow-500",
      },
      {
        category: "K-POP Entertainment",
        items: ["HYBE", "SM Entertainment", "JYP", "YG Entertainment"],
        difficulty: 3,
        color: "bg-purple-500",
      },
    ],
  },
  {
    id: 2,
    date: "2025-01-02",
    groups: [
      {
        category: "Retail & E-commerce",
        items: ["Lotte Shopping", "Shinsegae", "Homeplus", "GS Retail"],
        difficulty: 2,
        color: "bg-blue-500",
      },
      {
        category: "Telecommunications",
        items: ["SK Telecom", "KT", "LG U+", "SK Broadband"],
        difficulty: 1,
        color: "bg-green-500",
      },
      {
        category: "Cosmetics & Beauty",
        items: ["Amorepacific", "LG H&H", "Clio", "Innisfree"],
        difficulty: 3,
        color: "bg-yellow-500",
      },
      {
        category: "Shipbuilding",
        items: ["HD Hyundai", "Samsung Heavy", "Hanwha Ocean", "K Shipbuilding"],
        difficulty: 4,
        color: "bg-purple-500",
      },
    ],
  },
  {
    id: 3,
    date: "2025-01-03",
    groups: [
      {
        category: "Banking",
        items: ["KB Kookmin", "Shinhan Bank", "Hana Bank", "Woori Bank"],
        difficulty: 1,
        color: "bg-blue-500",
      },
      {
        category: "Food & Beverage",
        items: ["CJ CheilJedang", "Nongshim", "Orion", "Lotte Confectionery"],
        difficulty: 2,
        color: "bg-green-500",
      },
      {
        category: "Battery Manufacturers",
        items: ["LG Energy Solution", "Samsung SDI", "SK Innovation", "SK On"],
        difficulty: 3,
        color: "bg-yellow-500",
      },
      {
        category: "Display Technology",
        items: ["LG Display", "Samsung Display", "BOE Korea", "Innolux Korea"],
        difficulty: 4,
        color: "bg-purple-500",
      },
    ],
  },
  {
    id: 4,
    date: "2025-01-04",
    groups: [
      {
        category: "Gaming Companies",
        items: ["Krafton", "NCSoft", "Nexon", "Pearl Abyss"],
        difficulty: 2,
        color: "bg-blue-500",
      },
      {
        category: "Chemical Companies",
        items: ["LG Chem", "Lotte Chemical", "Hanwha Solutions", "SK Chemicals"],
        difficulty: 3,
        color: "bg-green-500",
      },
      {
        category: "Airlines",
        items: ["Korean Air", "Asiana Airlines", "Jeju Air", "Jin Air"],
        difficulty: 1,
        color: "bg-yellow-500",
      },
      {
        category: "Pharmaceutical",
        items: ["Samsung Biologics", "Celltrion", "SK Biopharmaceuticals", "Hanmi Pharm"],
        difficulty: 4,
        color: "bg-purple-500",
      },
    ],
  },
  {
    id: 5,
    date: "2025-01-05",
    groups: [
      {
        category: "Electronics & Appliances",
        items: ["Samsung", "LG Electronics", "Coway", "Daewoo"],
        difficulty: 1,
        color: "bg-blue-500",
      },
      {
        category: "Construction & Engineering",
        items: ["Samsung C&T", "Hyundai E&C", "Daewoo E&C", "GS E&C"],
        difficulty: 2,
        color: "bg-green-500",
      },
      {
        category: "Steel & Metals",
        items: ["POSCO", "Hyundai Steel", "Dongkuk Steel", "SeAH Steel"],
        difficulty: 3,
        color: "bg-yellow-500",
      },
      {
        category: "Fintech Startups",
        items: ["Toss", "Kakao Pay", "Naver Pay", "Payco"],
        difficulty: 4,
        color: "bg-purple-500",
      },
    ],
  },
];

/**
 * Get puzzle by date or return today's puzzle
 */
export function getPuzzleByDate(date?: string): ConnectionsPuzzle {
  const targetDate = date || new Date().toISOString().split("T")[0];

  // Find puzzle by date
  const puzzle = connectionsPuzzles.find((p) => p.date === targetDate);

  // If not found, cycle through puzzles based on day number
  if (!puzzle) {
    const daysSinceEpoch = Math.floor(
      new Date(targetDate).getTime() / (1000 * 60 * 60 * 24)
    );
    const index = daysSinceEpoch % connectionsPuzzles.length;
    return connectionsPuzzles[index];
  }

  return puzzle;
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
