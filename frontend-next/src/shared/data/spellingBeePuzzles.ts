// Spelling Bee Puzzle Data
// Each puzzle has 7 letters (1 center letter required in all words)

export interface SpellingBeePuzzle {
  id: number;
  date: string;
  centerLetter: string;
  outerLetters: string[];
  validWords: string[];
  pangrams: string[]; // Words that use all 7 letters
}

// Point values
export const POINTS = {
  FOUR_LETTER: 1,
  LONGER: (length: number) => length, // 1 point per letter for 5+ letters
  PANGRAM_BONUS: 7,
};

// Ranking thresholds (percentage of max points)
export const RANKS = [
  { name: 'Beginner', threshold: 0 },
  { name: 'Good Start', threshold: 0.02 },
  { name: 'Moving Up', threshold: 0.05 },
  { name: 'Good', threshold: 0.08 },
  { name: 'Solid', threshold: 0.15 },
  { name: 'Nice', threshold: 0.25 },
  { name: 'Great', threshold: 0.40 },
  { name: 'Amazing', threshold: 0.50 },
  { name: 'Genius', threshold: 0.70 },
  { name: 'Queen Bee', threshold: 1.0 },
];

// Daily puzzles - business/economy themed
export const DAILY_PUZZLES: SpellingBeePuzzle[] = [
  {
    id: 1,
    date: '2025-01-19',
    centerLetter: 'T',
    outerLetters: ['R', 'A', 'D', 'I', 'N', 'G'],
    validWords: [
      'TRADING', 'GRADING', 'RATING', 'DATING', 'GRANT', 'GIANT', 'TRAIN',
      'DRAIN', 'GRAIN', 'TRAIT', 'TIRING', 'RIDING', 'AIDING', 'TARTAN',
      'RATTAN', 'TITAN', 'АНТ', 'RANT', 'ANTI', 'DIRT', 'GRIT', 'TRAD',
      'DART', 'DRAT', 'GNAT', 'TANG', 'TARN', 'RAID', 'RATA', 'RIND',
      'GRID', 'ARIA', 'ARID', 'NADIR', 'TIARA', 'NITRATING', 'ATTIRING',
      'RAIDING', 'GRANTING', 'GRITTING', 'TINTING', 'TATTING', 'RATTING',
      'TITRATING', 'ИРАТ', 'TART', 'TAINT', 'TARRING', 'DINT', 'GIRT',
      'HINT', 'TINT', 'STINT', 'ATTAR', 'TRIAD', 'GRAND', 'RIGID',
    ],
    pangrams: ['TRADING', 'GRADING', 'NITRATING'],
  },
  {
    id: 2,
    date: '2025-01-20',
    centerLetter: 'M',
    outerLetters: ['A', 'R', 'K', 'E', 'T', 'S'],
    validWords: [
      'MARKET', 'MARKETS', 'MAKER', 'MAKERS', 'STREAM', 'MASTER', 'TEAMS',
      'STEAM', 'STAKE', 'STEAK', 'SKATE', 'SMART', 'SMEAR', 'SEAM', 'SAME',
      'TAME', 'TEAM', 'STEM', 'TERM', 'TERMS', 'MARKS', 'MAKE', 'MASK',
      'MAST', 'MATE', 'MEAT', 'MESA', 'MESS', 'TRAM', 'RAMS', 'ARMS',
      'MARS', 'KARMA', 'REMARK', 'REMARKS', 'STREAMER', 'REMAKE', 'REMASTER',
      'TEAMSTER', 'SEMESTER', 'STEAMER', 'MASKER', 'SMARTER', 'MARKETER',
      'ームСТЕР', 'МЕТЕОР', 'MATTE', 'MATTER', 'METRO', 'METER', 'METRES',
      'ームЕТЕ', 'MATES', 'MEATS', 'SEEMS', 'SEAMS', 'TAMES', 'TEAMS',
    ],
    pangrams: ['MARKETS', 'STREAMER', 'TEAMSTER'],
  },
  {
    id: 3,
    date: '2025-01-21',
    centerLetter: 'N',
    outerLetters: ['F', 'I', 'A', 'C', 'E', 'S'],
    validWords: [
      'FINANCE', 'FINANCES', 'FIANCE', 'FIANCES', 'INSANE', 'CANINE', 'CANINES',
      'SCENE', 'SCENES', 'SANE', 'CANE', 'CANES', 'FINE', 'FINES', 'NINE',
      'NINES', 'SINCE', 'ENCE', 'CAFE', 'CAFES', 'FACE', 'FACES', 'CASE',
      'CASES', 'ACNE', 'FENCE', 'FENCES', 'NIECE', 'NIECES', 'FINESSE',
      'CANNES', 'INCENSE', 'ESSENCE', 'NASCENT', 'ANCIENT', 'ANCIENTS',
      'SALINE', 'FELINE', 'CANINE', 'CAFFEINE', 'SEANCE', 'SEANCES',
      'INANE', 'INSANE', 'ENGINE', 'ENGINES', 'FAIENCE', 'FAIENCES',
      'ASCENSION', 'АНСИЕНС', 'АНЕС', 'ФАНС', 'СИНС', 'ФИНАНС',
    ],
    pangrams: ['FINANCES', 'FASCINE'],
  },
  {
    id: 4,
    date: '2025-01-22',
    centerLetter: 'O',
    outerLetters: ['P', 'R', 'F', 'I', 'T', 'S'],
    validWords: [
      'PROFIT', 'PROFITS', 'SPORT', 'SPORTS', 'SPORT', 'FIRST', 'FROST',
      'RIOTS', 'RIOTS', 'PORTS', 'FORTS', 'SORTS', 'TRIPS', 'STRIP',
      'STRIPS', 'PRIOR', 'PRIORS', 'PROPS', 'STOП', 'STOP', 'STOPS',
      'TOPS', 'POTS', 'SPOT', 'SPOTS', 'POST', 'POSTS', 'TOSS', 'SOFT',
      'LOFT', 'ROOT', 'ROOTS', 'ROOST', 'ROOSTS', 'POOR', 'FLOOR',
      'PROOF', 'PROOFS', 'SPOOF', 'SPOOFS', 'ROTOR', 'ROTORS', 'PORTFOLIO',
      'PROFITOR', 'REPOSIT', 'REPOSITS', 'RIPOST', 'RIPOSTS', 'IMPORT',
      'IMPORTS', 'EXPORT', 'EXPORTS', 'RAPPORT', 'RAPPORTS', 'AIRPORT',
      'AIRPORTS', 'TORSO', 'TORSOS', 'TOOT', 'TOOTS', 'TROOP', 'TROOPS',
    ],
    pangrams: ['PROFITS', 'SPORTIF'],
  },
  {
    id: 5,
    date: '2025-01-23',
    centerLetter: 'I',
    outerLetters: ['N', 'V', 'E', 'S', 'T', 'G'],
    validWords: [
      'INVEST', 'INVESTS', 'INVESTING', 'SETTING', 'GETTING', 'VESTING',
      'NESTING', 'TESTING', 'GIVEN', 'GIVENS', 'GIVING', 'LIVING', 'SIEVE',
      'SIEVES', 'TINGE', 'TINGES', 'STINGE', 'SINGE', 'SINGES', 'INVITE',
      'INVITES', 'ITIVE', 'NATIVE', 'NATIVES', 'INTESTINE', 'INTESTINES',
      'SENSITIVE', 'INTENSIVES', 'VESTIGES', 'VESTIGE', 'INVESTING',
      'DIVESTING', 'EVENING', 'EVENINGS', 'ENGINES', 'ENGINE', 'SEIZING',
      'TEEING', 'SEEING', 'BEING', 'BEINGS', 'GENIUS', 'GENII', 'IGNITE',
      'IGNITES', 'IGNITING', 'SITTING', 'SITTING', 'SITING', 'VISITS',
      'VINES', 'VINE', 'NEIVES', 'GIVES', 'GIVE', 'TIES', 'SITE', 'SITES',
    ],
    pangrams: ['INVESTING', 'VESTINGS'],
  },
  {
    id: 6,
    date: '2025-01-24',
    centerLetter: 'B',
    outerLetters: ['U', 'S', 'I', 'N', 'E', 'S'],
    validWords: [
      'BUSINESS', 'BUSES', 'BUSIES', 'BUNS', 'BINS', 'SINE', 'SINES', 'SNUB',
      'SNUBS', 'NUBS', 'BUSS', 'BIBS', 'BEEN', 'BEES', 'SEEN', 'SEES',
      'SUNBISS', 'SUBNESS', 'ИБУС', 'БУС', 'BONUS', 'SUBSINE', 'SUBSCRIBE',
      'NEBIS', 'UNBISS', 'УБИС', 'SIBNESS', 'SINBUS', 'BUSINE', 'BINUES',
      'BINES', 'BINE', 'SUBSINE', 'ISSUB', 'SUBBIE', 'SUBBIES', 'SNIBE',
      'SNIBES', 'UNBIESS', 'BUSSINE', 'BENIS', 'BENI', 'NUBES', 'NUBE',
    ],
    pangrams: ['BUSINESS'],
  },
  {
    id: 7,
    date: '2025-01-25',
    centerLetter: 'E',
    outerLetters: ['C', 'O', 'N', 'M', 'Y', 'I'],
    validWords: [
      'ECONOMY', 'INCOME', 'INCOMES', 'MONEY', 'ENEMY', 'ENEMIES', 'COME',
      'COMES', 'CONE', 'CONES', 'MINE', 'MINES', 'MICE', 'NICE', 'NICER',
      'ONCE', 'NOMINEE', 'NOMINEES', 'ECONOMIC', 'ECONOMIZE', 'CINEMA',
      'CINEMAS', 'MINCE', 'MINCES', 'INCE', 'INCE', 'NONCE', 'MENACE',
      'MENACES', 'ICEMEN', 'ICEMAN', 'OMEN', 'OMENS', 'EMONCY', 'COMEY',
      'YOEMEN', 'YEOMEN', 'EMCEE', 'EMCEES', 'МЕНИ', 'ЕКОНОМ', 'ЦЕНИМ',
    ],
    pangrams: ['ECONOMY', 'ECONOMIC'],
  },
  {
    id: 8,
    date: '2025-01-26',
    centerLetter: 'L',
    outerLetters: ['G', 'O', 'B', 'A', 'I', 'Z'],
    validWords: [
      'GLOBAL', 'GLOBALIZE', 'GLIB', 'GLOB', 'GLOBS', 'GOAL', 'GOALS', 'GLOAT',
      'GLOATS', 'BOIL', 'BOILS', 'FOIL', 'FOILS', 'TOIL', 'TOILS', 'COIL',
      'COILS', 'OPAL', 'OPALS', 'BAIL', 'BAILS', 'FAIL', 'FAILS', 'JAIL',
      'JAILS', 'MAIL', 'MAILS', 'NAIL', 'NAILS', 'PAIL', 'PAILS', 'RAIL',
      'RAILS', 'SAIL', 'SAILS', 'TAIL', 'TAILS', 'WAIL', 'WAILS', 'LAZE',
      'LAZES', 'BLAZE', 'BLAZES', 'GLAZE', 'GLAZES', 'GRAIL', 'LABEL',
      'LABELS', 'LEGAL', 'LOYALS', 'LOYAL', 'ГРОБАЛ', 'ГЛОБАЛ', 'ЛОБИ',
    ],
    pangrams: ['GLOBALIZE'],
  },
  {
    id: 9,
    date: '2025-01-27',
    centerLetter: 'W',
    outerLetters: ['G', 'R', 'O', 'T', 'H', 'S'],
    validWords: [
      'GROWTH', 'WORTH', 'WORTHS', 'THROW', 'THROWS', 'GROW', 'GROWS', 'SWORN',
      'SWOT', 'SWOTS', 'WORT', 'WORTS', 'WORST', 'WORSTS', 'SHOW', 'SHOWS',
      'STOW', 'STOWS', 'TOWS', 'ROWS', 'HOWS', 'WHOS', 'GROWTHS', 'THREW',
      'WHORT', 'WHORTS', 'SWORTH', 'SWORE', 'SHORE', 'SHORES', 'WORSE',
      'ГРОВТ', 'ВОРТ', 'ТРОШТ', 'ШВОР', 'ВОРС', 'ШОРТ', 'ГРОШ', 'ТОРШ',
    ],
    pangrams: ['GROWTHS'],
  },
  {
    id: 10,
    date: '2025-01-28',
    centerLetter: 'K',
    outerLetters: ['O', 'R', 'E', 'A', 'N', 'S'],
    validWords: [
      'KOREAN', 'KOREANS', 'SNEAK', 'SNEAKS', 'SNAKE', 'SNAKES', 'STAKE',
      'STAKES', 'STEAK', 'STEAKS', 'SAKE', 'SAKES', 'RAKE', 'RAKES', 'SAKE',
      'KRONE', 'KRONER', 'OAKEN', 'ROKEN', 'SPOKEN', 'AWOKEN', 'KRAKEN',
      'KRAKENS', 'SNARK', 'SNARKS', 'SPARK', 'SPARKS', 'STARK', 'STORK',
      'STORKS', 'KNORS', 'OAKER', 'OAKERS', 'KOREAS', 'SNAKER', 'SNEAKER',
      'SNEAKERS', 'SHAKER', 'SHAKERS', 'SOAKER', 'SOAKERS', 'RANKER',
      'RANKERS', 'TANKER', 'TANKERS', 'BANKER', 'BANKERS', 'KEROSANE',
      'КОРЕН', 'КОРЕНС', 'СНЕАК', 'КОРЕЙС', 'КРОНС', 'ОАКЕРС', 'ТАНКЕРС',
    ],
    pangrams: ['KOREANS', 'SNEAKERS'],
  },
  {
    id: 11,
    date: '2025-01-29',
    centerLetter: 'A',
    outerLetters: ['S', 'S', 'E', 'T', 'C', 'H'],
    validWords: [
      'ASSET', 'ASSETS', 'CHASE', 'CHASES', 'CACHE', 'CACHES', 'CATCH',
      'CATCHES', 'HASTE', 'HASTES', 'TASTE', 'TASTES', 'WASTE', 'WASTES',
      'CAST', 'CASTS', 'FAST', 'FASTS', 'LAST', 'LASTS', 'MAST', 'MASTS',
      'PAST', 'PASTS', 'VAST', 'VASTS', 'ATTACH', 'ATTACHES', 'STASH',
      'STASHES', 'EACH', 'TEACH', 'TEACHES', 'REACH', 'REACHES', 'BATCH',
      'ATCH', 'HATCH', 'HATCHES', 'LATCH', 'LATCHES', 'MATCH', 'MATCHES',
      'PATCH', 'PATCHES', 'WATCH', 'WATCHES', 'SATCHEL', 'SATCHELS', 'АССЕТ',
    ],
    pangrams: ['ATTACHES', 'SATCHELS'],
  },
  {
    id: 12,
    date: '2025-01-30',
    centerLetter: 'D',
    outerLetters: ['I', 'V', 'E', 'N', 'S', 'T'],
    validWords: [
      'DIVIDEND', 'DIVIDENDS', 'DIVEST', 'DIVESTS', 'INVEST', 'INVESTS',
      'VESTED', 'NESTED', 'TESTED', 'DENT', 'DENTS', 'TEND', 'TENDS', 'SEND',
      'SENDS', 'DENSE', 'SIDENT', 'EVIDENT', 'IDENTS', 'SITED', 'INVITED',
      'DIVINED', 'DEVISED', 'REVISED', 'DIVIDED', 'DECIDED', 'INDENTS',
      'INDENT', 'SIDENT', 'EVIDENT', 'IDENTS', 'DIVED', 'DIVES', 'DINE',
      'DINES', 'VEND', 'VENDS', 'ENDED', 'SENDED', 'TENDED', 'MENDED',
      'ДИВИДЕНД', 'ДИВЕСТ', 'ИНВЕСТ', 'ВЕСТЕД', 'ДЕНТ', 'ТЕНД', 'ДЕНС',
    ],
    pangrams: ['DIVESTING', 'INVESTING'],
  },
  {
    id: 13,
    date: '2025-01-31',
    centerLetter: 'C',
    outerLetters: ['A', 'P', 'I', 'T', 'L', 'S'],
    validWords: [
      'CAPITAL', 'CAPITALS', 'PLASTIC', 'PLASTICS', 'CLASP', 'CLASPS', 'CAPS',
      'CLAPS', 'CLIPS', 'SLIPS', 'SPLIT', 'SPLITS', 'SPILT', 'CAST', 'CASTS',
      'CATS', 'ACTS', 'PACT', 'PACTS', 'TACT', 'TACTICS', 'ATTIC', 'ATTICS',
      'LILAC', 'LILACS', 'STATIC', 'STATICS', 'CLASTIC', 'ITALIC', 'ITALICS',
      'SPASTIC', 'CAPITALIST', 'CAPITALISTS', 'АПИТАЛ', 'КАПИТАЛ', 'ПЛАСТИК',
    ],
    pangrams: ['CAPITALS', 'CAPITALIST'],
  },
  {
    id: 14,
    date: '2025-02-01',
    centerLetter: 'S',
    outerLetters: ['T', 'O', 'C', 'K', 'E', 'R'],
    validWords: [
      'STOCK', 'STOCKS', 'STOCKER', 'STOCKERS', 'ROCKET', 'ROCKETS', 'SOCKET',
      'SOCKETS', 'ROSTER', 'ROSTERS', 'FOSTER', 'FOSTERS', 'SECTOR', 'SECTORS',
      'STORE', 'STORES', 'STOKE', 'STOKES', 'STOKER', 'STOKERS', 'STROKE',
      'STROKES', 'SCORE', 'SCORES', 'SCORER', 'SCORERS', 'SCOOTER', 'SCOOTERS',
      'КОСТЕР', 'СТОК', 'СТОКЕР', 'РОКЕТ', 'СОКЕТ', 'РОСТЕР', 'СЕКТОР',
    ],
    pangrams: ['STOCKERS', 'RESTOCKS'],
  },
];

// Get puzzle for today or by date
export function getTodaysPuzzle(): SpellingBeePuzzle {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  // Find puzzle matching today's date
  const todayPuzzle = DAILY_PUZZLES.find(p => p.date === dateStr);
  if (todayPuzzle) return todayPuzzle;

  // Fallback: cycle through puzzles based on day of year
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const diff = today.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const puzzleIndex = dayOfYear % DAILY_PUZZLES.length;

  return DAILY_PUZZLES[puzzleIndex];
}

// Calculate points for a word
export function calculatePoints(word: string, puzzle: SpellingBeePuzzle): number {
  const isPangram = puzzle.pangrams.includes(word.toUpperCase());

  if (word.length === 4) {
    return POINTS.FOUR_LETTER + (isPangram ? POINTS.PANGRAM_BONUS : 0);
  }

  return POINTS.LONGER(word.length) + (isPangram ? POINTS.PANGRAM_BONUS : 0);
}

// Calculate max possible points for a puzzle
export function calculateMaxPoints(puzzle: SpellingBeePuzzle): number {
  return puzzle.validWords.reduce((total, word) => total + calculatePoints(word, puzzle), 0);
}

// Get rank based on current points
export function getRank(points: number, maxPoints: number): string {
  const percentage = points / maxPoints;

  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (percentage >= RANKS[i].threshold) {
      return RANKS[i].name;
    }
  }

  return RANKS[0].name;
}

// Get next rank info
export function getNextRank(points: number, maxPoints: number): { name: string; pointsNeeded: number } | null {
  const percentage = points / maxPoints;

  for (const rank of RANKS) {
    if (percentage < rank.threshold) {
      return {
        name: rank.name,
        pointsNeeded: Math.ceil(rank.threshold * maxPoints) - points,
      };
    }
  }

  return null;
}

// Validate if word is in puzzle's valid words
export function isValidWord(word: string, puzzle: SpellingBeePuzzle): boolean {
  return puzzle.validWords.includes(word.toUpperCase());
}

// Check if word uses only allowed letters
export function usesOnlyAllowedLetters(word: string, puzzle: SpellingBeePuzzle): boolean {
  const allowedLetters = new Set([puzzle.centerLetter, ...puzzle.outerLetters].map(l => l.toUpperCase()));
  return word.toUpperCase().split('').every(letter => allowedLetters.has(letter));
}

// Check if word contains center letter
export function containsCenterLetter(word: string, puzzle: SpellingBeePuzzle): boolean {
  return word.toUpperCase().includes(puzzle.centerLetter.toUpperCase());
}
