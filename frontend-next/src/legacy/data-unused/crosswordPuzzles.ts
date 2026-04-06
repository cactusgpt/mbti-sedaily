// Crossword Puzzle Data for Korean Business/Economy Theme

export interface CrosswordClue {
  number: number;
  clue: string;
  answer: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

export interface CrosswordPuzzle {
  id: number;
  date: string;
  title: string;
  gridSize: number;
  clues: CrosswordClue[];
}

// Generate grid from clues
export function generateGrid(puzzle: CrosswordPuzzle): (string | null)[][] {
  const grid: (string | null)[][] = Array(puzzle.gridSize)
    .fill(null)
    .map(() => Array(puzzle.gridSize).fill(null));

  puzzle.clues.forEach((clue) => {
    const { answer, row, col, direction } = clue;
    for (let i = 0; i < answer.length; i++) {
      if (direction === 'across') {
        grid[row][col + i] = '';
      } else {
        grid[row + i][col] = '';
      }
    }
  });

  return grid;
}

// Puzzles collection - Korean Business/Economy themed
const puzzles: CrosswordPuzzle[] = [
  {
    id: 1,
    date: "2026-01-25",
    title: "Korean Tech Giants",
    gridSize: 10,
    clues: [
      // Across
      { number: 1, clue: "Korea's largest conglomerate, known for Galaxy phones", answer: "SAMSUNG", row: 0, col: 0, direction: 'across' },
      { number: 4, clue: "Major Korean automaker, means 'modern' in Korean", answer: "HYUNDAI", row: 2, col: 2, direction: 'across' },
      { number: 6, clue: "Korean messaging app giant (company)", answer: "KAKAO", row: 4, col: 0, direction: 'across' },
      { number: 8, clue: "Korea's main stock exchange index", answer: "KOSPI", row: 6, col: 4, direction: 'across' },
      { number: 10, clue: "Korean e-commerce giant, 'Rocket Delivery'", answer: "COUPANG", row: 8, col: 1, direction: 'across' },
      // Down
      { number: 2, clue: "Memory chip maker, competes with Samsung", answer: "SKHYNIX", row: 0, col: 2, direction: 'down' },
      { number: 3, clue: "Korean search engine and tech company", answer: "NAVER", row: 0, col: 6, direction: 'down' },
      { number: 5, clue: "Korean steel giant, based in Pohang", answer: "POSCO", row: 2, col: 4, direction: 'down' },
      { number: 7, clue: "Korean battery maker for EVs", answer: "LG", row: 4, col: 3, direction: 'down' },
      { number: 9, clue: "Korean Air's parent company name", answer: "HANJIN", row: 6, col: 8, direction: 'down' },
    ],
  },
  {
    id: 2,
    date: "2026-01-26",
    title: "Korean Economy Basics",
    gridSize: 10,
    clues: [
      // Across
      { number: 1, clue: "Bank of Korea's key interest ____", answer: "RATE", row: 0, col: 0, direction: 'across' },
      { number: 3, clue: "Korea's currency unit", answer: "WON", row: 0, col: 6, direction: 'across' },
      { number: 5, clue: "Korea's central bank (abbr.)", answer: "BOK", row: 2, col: 3, direction: 'across' },
      { number: 7, clue: "Major Korean export product", answer: "CHIPS", row: 4, col: 0, direction: 'across' },
      { number: 9, clue: "Free ____ Agreement (Korea-US)", answer: "TRADE", row: 6, col: 2, direction: 'across' },
      { number: 11, clue: "Samsung's smartphone brand", answer: "GALAXY", row: 8, col: 3, direction: 'across' },
      // Down
      { number: 2, clue: "Korean tech startup hub area", answer: "TEHERAN", row: 0, col: 2, direction: 'down' },
      { number: 4, clue: "Korea's GDP growth measure", answer: "GROWTH", row: 0, col: 7, direction: 'down' },
      { number: 6, clue: "Korean chaebols' family ____", answer: "CONTROL", row: 2, col: 5, direction: 'down' },
      { number: 8, clue: "Import/export balance", answer: "TRADE", row: 4, col: 0, direction: 'down' },
      { number: 10, clue: "Korean shipbuilding city", answer: "ULSAN", row: 6, col: 6, direction: 'down' },
    ],
  },
  {
    id: 3,
    date: "2026-01-27",
    title: "K-Business Leaders",
    gridSize: 10,
    clues: [
      // Across
      { number: 1, clue: "Samsung's founding family name", answer: "LEE", row: 0, col: 0, direction: 'across' },
      { number: 3, clue: "Hyundai founder's family name", answer: "CHUNG", row: 0, col: 5, direction: 'across' },
      { number: 5, clue: "LG's original name: Lucky ____", answer: "GOLDSTAR", row: 2, col: 1, direction: 'across' },
      { number: 7, clue: "Korean conglomerate structure", answer: "CHAEBOL", row: 4, col: 2, direction: 'across' },
      { number: 9, clue: "SK Group founder's family name", answer: "CHEY", row: 6, col: 0, direction: 'across' },
      { number: 11, clue: "Korean corporate governance issue", answer: "HEIR", row: 8, col: 4, direction: 'across' },
      // Down
      { number: 2, clue: "Korean business district in Seoul", answer: "GANGNAM", row: 0, col: 1, direction: 'down' },
      { number: 4, clue: "Korean corporate tax ____", answer: "REFORM", row: 0, col: 7, direction: 'down' },
      { number: 6, clue: "Lotte founder's nationality origin", answer: "JAPAN", row: 2, col: 3, direction: 'down' },
      { number: 8, clue: "Doosan's heavy industry focus", answer: "POWER", row: 4, col: 5, direction: 'down' },
      { number: 10, clue: "Hanwha's defense ____", answer: "ARMS", row: 6, col: 2, direction: 'down' },
    ],
  },
  {
    id: 4,
    date: "2026-01-28",
    title: "Korean Finance",
    gridSize: 10,
    clues: [
      // Across
      { number: 1, clue: "Korean investment ____ company", answer: "FUND", row: 0, col: 0, direction: 'across' },
      { number: 3, clue: "Korea's secondary stock market", answer: "KOSDAQ", row: 0, col: 5, direction: 'across' },
      { number: 5, clue: "Korean government ____ (debt)", answer: "BONDS", row: 2, col: 2, direction: 'across' },
      { number: 7, clue: "Samsung's financial arm: Samsung ____", answer: "LIFE", row: 4, col: 0, direction: 'across' },
      { number: 9, clue: "Korean won vs dollar ____", answer: "FOREX", row: 6, col: 3, direction: 'across' },
      { number: 11, clue: "IPO: Initial Public ____", answer: "OFFERING", row: 8, col: 1, direction: 'across' },
      // Down
      { number: 2, clue: "KB Financial ____ (bank)", answer: "GROUP", row: 0, col: 2, direction: 'down' },
      { number: 4, clue: "Shinhan ____ (major Korean bank)", answer: "BANK", row: 0, col: 7, direction: 'down' },
      { number: 6, clue: "Korean insurance market leader", answer: "SAMSUNG", row: 2, col: 4, direction: 'down' },
      { number: 8, clue: "Hana Financial ____", answer: "TRUST", row: 4, col: 0, direction: 'down' },
      { number: 10, clue: "Korean fintech payment app", answer: "TOSS", row: 6, col: 6, direction: 'down' },
    ],
  },
  {
    id: 5,
    date: "2026-01-29",
    title: "Korean Industries",
    gridSize: 10,
    clues: [
      // Across
      { number: 1, clue: "Korea's main export: semi____", answer: "CONDUCTOR", row: 0, col: 0, direction: 'across' },
      { number: 4, clue: "Korean shipbuilding leader: HD ____", answer: "HYUNDAI", row: 2, col: 2, direction: 'across' },
      { number: 6, clue: "LG's display technology", answer: "OLED", row: 4, col: 0, direction: 'across' },
      { number: 8, clue: "Korean EV battery type", answer: "LITHIUM", row: 6, col: 2, direction: 'across' },
      { number: 10, clue: "Korean cosmetics brand: Amore____", answer: "PACIFIC", row: 8, col: 1, direction: 'across' },
      // Down
      { number: 2, clue: "SK's chemical division focus", answer: "PETRO", row: 0, col: 3, direction: 'down' },
      { number: 3, clue: "Korean auto parts giant: ____Mobis", answer: "HYUNDAI", row: 0, col: 7, direction: 'down' },
      { number: 5, clue: "Samsung's chip factory type", answer: "FAB", row: 2, col: 5, direction: 'down' },
      { number: 7, clue: "Korean steel product", answer: "SHEET", row: 4, col: 1, direction: 'down' },
      { number: 9, clue: "Hanwha's solar ____ business", answer: "PANEL", row: 6, col: 6, direction: 'down' },
    ],
  },
];

// Get puzzle by date or cycle through available puzzles
export function getTodaysPuzzle(): CrosswordPuzzle {
  const today = new Date();
  const dayIndex = today.getDate() % puzzles.length;
  return puzzles[dayIndex];
}

export function getPuzzleById(id: number): CrosswordPuzzle | undefined {
  return puzzles.find((p) => p.id === id);
}

export function getAllPuzzles(): CrosswordPuzzle[] {
  return puzzles;
}
