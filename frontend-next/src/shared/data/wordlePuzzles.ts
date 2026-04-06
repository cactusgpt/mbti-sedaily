/**
 * Wordle Puzzles Data
 * Business and economy related 5-letter words for K-Business Wordle
 */

export interface WordlePuzzle {
  id: number;
  date: string;
  word: string;
  hint?: string; // Optional hint about the word
}

// Valid 5-letter words for guessing (includes answer words + common words)
export const VALID_WORDS: string[] = [
  // Business/Economy terms
  'TRADE', 'STOCK', 'BONDS', 'MONEY', 'FUNDS', 'ASSET', 'GAINS', 'YIELD',
  'PRICE', 'VALUE', 'WORTH', 'COSTS', 'SALES', 'DEALS', 'LOANS', 'DEBTS',
  'BANKS', 'FOREX', 'INDEX', 'SHARE', 'FIRMS', 'CORPS', 'GOODS', 'BRAND',
  'CHART', 'AUDIT', 'TAXES', 'GROSS', 'RATES', 'TREND', 'BOOST', 'HEDGE',
  'MERGE', 'BUYER', 'OWNER', 'BOARD', 'CHIEF', 'QUOTA', 'DRAFT', 'TERMS',
  'BONUS', 'WAGES', 'LABOR', 'UNION', 'QUOTA', 'STAFF', 'HIRES', 'ROLES',

  // Korea/Asia related
  'KOREA', 'SEOUL', 'BUSAN', 'ASIAN', 'JAPAN', 'CHINA', 'TOKYO', 'OSAKA',

  // Tech/Industry
  'CHIPS', 'PHONE', 'ROBOT', 'CLOUD', 'CYBER', 'MEDIA', 'SMART', 'TECHS',
  'STEEL', 'SHIPS', 'AUTOS', 'PARTS', 'BUILD', 'PLANT', 'POWER', 'SOLAR',

  // Common English words (for valid guesses)
  'ABOUT', 'ABOVE', 'ABUSE', 'ACTOR', 'ACUTE', 'ADMIT', 'ADOPT', 'ADULT',
  'AFTER', 'AGAIN', 'AGENT', 'AGREE', 'AHEAD', 'ALARM', 'ALBUM', 'ALERT',
  'ALIEN', 'ALIGN', 'ALIKE', 'ALIVE', 'ALLEY', 'ALLOW', 'ALLOY', 'ALONE',
  'ALONG', 'ALTER', 'AMONG', 'ANGEL', 'ANGER', 'ANGLE', 'ANGRY', 'APART',
  'APPLE', 'APPLY', 'ARENA', 'ARGUE', 'ARISE', 'ARMOR', 'AROMA', 'ARRAY',
  'ARROW', 'ASIDE', 'ASSET', 'AVOID', 'AWARD', 'AWARE', 'AWFUL', 'BASIC',
  'BASIS', 'BEACH', 'BEGIN', 'BEING', 'BELOW', 'BENCH', 'BIRTH', 'BLACK',
  'BLADE', 'BLAME', 'BLANK', 'BLAST', 'BLAZE', 'BLEED', 'BLEND', 'BLESS',
  'BLIND', 'BLOCK', 'BLOOD', 'BLOWN', 'BOARD', 'BOAST', 'BOOST', 'BOOTH',
  'BOUND', 'BOXER', 'BRAIN', 'BRAND', 'BRASS', 'BRAVE', 'BREAD', 'BREAK',
  'BREED', 'BRICK', 'BRIDE', 'BRIEF', 'BRING', 'BROAD', 'BROKE', 'BROWN',
  'BRUSH', 'BUILD', 'BUNCH', 'BURST', 'BUYER', 'CABIN', 'CABLE', 'CALIF',
  'CARRY', 'CARVE', 'CATCH', 'CAUSE', 'CHAIN', 'CHAIR', 'CHAOS', 'CHARM',
  'CHASE', 'CHEAP', 'CHECK', 'CHEEK', 'CHEST', 'CHIEF', 'CHILD', 'CHINA',
  'CHOSE', 'CHUNK', 'CIVIC', 'CIVIL', 'CLAIM', 'CLASS', 'CLEAN', 'CLEAR',
  'CLERK', 'CLICK', 'CLIFF', 'CLIMB', 'CLOCK', 'CLOSE', 'CLOTH', 'CLOUD',
  'COACH', 'COAST', 'COLON', 'COLOR', 'COUCH', 'COUGH', 'COULD', 'COUNT',
  'COURT', 'COVER', 'CRACK', 'CRAFT', 'CRASH', 'CRAZY', 'CREAM', 'CRIME',
  'CRISP', 'CROSS', 'CROWD', 'CROWN', 'CRUEL', 'CRUSH', 'CURVE', 'CYCLE',
  'DAILY', 'DANCE', 'DATED', 'DEALT', 'DEATH', 'DEBUT', 'DECAY', 'DELAY',
  'DELTA', 'DENSE', 'DEPTH', 'DIARY', 'DIGIT', 'DIRTY', 'DISCO', 'DOUBT',
  'DOZEN', 'DRAFT', 'DRAIN', 'DRAMA', 'DRANK', 'DRAWN', 'DREAM', 'DRESS',
  'DRIED', 'DRIFT', 'DRILL', 'DRINK', 'DRIVE', 'DROIT', 'DROVE', 'DROWN',
  'DYING', 'EAGER', 'EARLY', 'EARTH', 'EATEN', 'EIGHT', 'ELITE', 'EMPTY',
  'ENEMY', 'ENJOY', 'ENTER', 'ENTRY', 'EQUAL', 'EQUIP', 'ERROR', 'ESSAY',
  'ETHIC', 'EVENT', 'EVERY', 'EXACT', 'EXCEL', 'EXIST', 'EXTRA', 'FAINT',
  'FAITH', 'FALSE', 'FANCY', 'FATAL', 'FAULT', 'FAVOR', 'FEAST', 'FENCE',
  'FERRY', 'FEVER', 'FEWER', 'FIBER', 'FIELD', 'FIFTH', 'FIFTY', 'FIGHT',
  'FINAL', 'FIRST', 'FIXED', 'FLAME', 'FLASH', 'FLEET', 'FLESH', 'FLOAT',
  'FLOOD', 'FLOOR', 'FLOUR', 'FLUID', 'FLUSH', 'FOCUS', 'FORCE', 'FORGE',
  'FORTH', 'FORTY', 'FORUM', 'FOSSIL', 'FOUND', 'FRAME', 'FRANK', 'FRAUD',
  'FRESH', 'FRONT', 'FRUIT', 'FULLY', 'FUNNY', 'GENRE', 'GHOST', 'GIANT',
  'GIVEN', 'GLASS', 'GLIDE', 'GLOBE', 'GLORY', 'GOING', 'GOODS', 'GRACE',
  'GRADE', 'GRAIN', 'GRAND', 'GRANT', 'GRAPE', 'GRASP', 'GRASS', 'GRAVE',
  'GREAT', 'GREEN', 'GREET', 'GRIEF', 'GRILL', 'GRIND', 'GROSS', 'GROUP',
  'GROVE', 'GROWN', 'GUARD', 'GUESS', 'GUEST', 'GUIDE', 'GUILT', 'HABIT',
  'HANDY', 'HAPPY', 'HARSH', 'HASTE', 'HAVEN', 'HEART', 'HEAVY', 'HEDGE',
  'HELLO', 'hence', 'HENCE', 'HIRED', 'HOBBY', 'HONOR', 'HORSE', 'HOTEL',
  'HOUSE', 'HUMAN', 'HUMOR', 'HURRY', 'IDEAL', 'IMAGE', 'IMPLY', 'INDEX',
  'INDIA', 'INNER', 'INPUT', 'ISSUE', 'JAPAN', 'JEWEL', 'JOINT', 'JONES',
  'JUDGE', 'JUICE', 'JUMBO', 'KEEPS', 'KNOWN', 'LABEL', 'LABOR', 'LADEN',
  'LANCE', 'LARGE', 'LASER', 'LATER', 'LATIN', 'LAUGH', 'LAYER', 'LEARN',
  'LEASE', 'LEAST', 'LEAVE', 'LEGAL', 'LEMON', 'LEVEL', 'LEVER', 'LIGHT',
  'LIMIT', 'LINEN', 'LINER', 'LINKS', 'LINUX', 'LIONS', 'LISTS', 'LITER',
  'LIVED', 'LIVER', 'LIVES', 'LLAMA', 'LOBBY', 'LOCAL', 'LODGE', 'LOGIC',
  'LOOSE', 'LORRY', 'LOTUS', 'LOVED', 'LOVER', 'LOWER', 'LOYAL', 'LUCKY',
  'LUNCH', 'LYING', 'MAGIC', 'MAGMA', 'MAJOR', 'MAKER', 'MANOR', 'MAPLE',
  'MARCH', 'MARRY', 'MARSH', 'MATCH', 'MAYBE', 'MAYOR', 'MEANS', 'MEANT',
  'MEDAL', 'MEDIA', 'MERCY', 'MERGE', 'MERIT', 'MERRY', 'METAL', 'METER',
  'MIDST', 'MIGHT', 'MINOR', 'MINUS', 'MIXED', 'MODEL', 'MODEM', 'MONEY',
  'MONTH', 'MORAL', 'MOTOR', 'MOUNT', 'MOUSE', 'MOUTH', 'MOVED', 'MOVIE',
  'MUDDY', 'MULTI', 'MUSIC', 'NAIVE', 'NAKED', 'NAMED', 'NEEDS', 'NERVE',
  'NEVER', 'NEWLY', 'NIGHT', 'NINTH', 'NOBLE', 'NOISE', 'NORTH', 'NOTED',
  'NOVEL', 'NURSE', 'OCCUR', 'OCEAN', 'OFFER', 'OFTEN', 'OLIVE', 'ONSET',
  'OPERA', 'ORBIT', 'ORDER', 'ORGAN', 'OTHER', 'OUGHT', 'OUTER', 'OWNED',
  'OWNER', 'OXIDE', 'OZONE', 'PAINT', 'PANEL', 'PANIC', 'PAPER', 'PARTY',
  'PASTA', 'PASTE', 'PATCH', 'PAUSE', 'PEACE', 'PEACH', 'PEARL', 'PEDAL',
  'PENNY', 'PERCH', 'PERIL', 'PHASE', 'PHONE', 'PHOTO', 'PIANO', 'PIECE',
  'PILOT', 'PINCH', 'PITCH', 'PIZZA', 'PLACE', 'PLAIN', 'PLANE', 'PLANT',
  'PLATE', 'PLAZA', 'PLEAD', 'PLUMB', 'POEM', 'POEMS', 'POINT', 'POLAR',
  'POLLS', 'POUND', 'POWER', 'PRESS', 'PRICE', 'PRIDE', 'PRIME', 'PRINT',
  'PRIOR', 'PRIZE', 'PROBE', 'PROOF', 'PROUD', 'PROVE', 'PROXY', 'PULSE',
  'PUNCH', 'PUPIL', 'PURSE', 'QUEEN', 'QUERY', 'QUEST', 'QUEUE', 'QUICK',
  'QUIET', 'QUITE', 'QUOTA', 'QUOTE', 'RADAR', 'RADIO', 'RAISE', 'RALLY',
  'RANCH', 'RANGE', 'RAPID', 'RATIO', 'REACH', 'REACT', 'READY', 'REALM',
  'REBEL', 'REFER', 'REIGN', 'RELAX', 'REPLY', 'RIFLE', 'RIGHT', 'RIGID',
  'RISKY', 'RIVAL', 'RIVER', 'ROBOT', 'ROCKY', 'ROMAN', 'ROOFS', 'ROOTS',
  'ROUGH', 'ROUND', 'ROUTE', 'ROYAL', 'RUGBY', 'RULED', 'RULER', 'RURAL',
  'SADLY', 'SAFER', 'SAINT', 'SALAD', 'SALES', 'SALON', 'SAUCE', 'SAVED',
  'SCALE', 'SCARE', 'SCENE', 'SCOPE', 'SCORE', 'SCOUT', 'SCREW', 'SEEKS',
  'SENSE', 'SERUM', 'SERVE', 'SETUP', 'SEVEN', 'SHADE', 'SHAKE', 'SHALL',
  'SHAME', 'SHAPE', 'SHARE', 'SHARP', 'SHEEP', 'SHEER', 'SHEET', 'SHELF',
  'SHELL', 'SHIFT', 'SHINE', 'SHIRT', 'SHOCK', 'SHOOT', 'SHORE', 'SHORT',
  'SHOUT', 'SHOWN', 'SIGHT', 'SIGMA', 'SINCE', 'SIXTH', 'SIXTY', 'SIZED',
  'SKILL', 'SLAVE', 'SLEEP', 'SLICE', 'SLIDE', 'SLOPE', 'SMALL', 'SMART',
  'SMELL', 'SMILE', 'SMOKE', 'SNAKE', 'SNOW', 'SOLAR', 'SOLID', 'SOLVE',
  'SORRY', 'SOUND', 'SOUTH', 'SPACE', 'SPARE', 'SPARK', 'SPEAK', 'SPEED',
  'SPELL', 'SPEND', 'SPENT', 'SPICE', 'SPILL', 'SPINE', 'SPITE', 'SPLIT',
  'SPOKE', 'SPORT', 'SPOTS', 'SPRAY', 'SQUAD', 'STACK', 'STAFF', 'STAGE',
  'STAIN', 'STAKE', 'STAMP', 'STAND', 'STARE', 'START', 'STATE', 'STAYS',
  'STEAM', 'STEEL', 'STEEP', 'STEER', 'STEMS', 'STICK', 'STIFF', 'STILL',
  'STOCK', 'STONE', 'STOOD', 'STOOL', 'STORE', 'STORM', 'STORY', 'STOVE',
  'STRAP', 'STRAW', 'STRIP', 'STUCK', 'STUDY', 'STUFF', 'STYLE', 'SUGAR',
  'SUITE', 'SUNNY', 'SUPER', 'SURGE', 'SWAMP', 'SWEAR', 'SWEAT', 'SWEEP',
  'SWEET', 'SWEPT', 'SWIFT', 'SWING', 'SWISS', 'SWORD', 'TABLE', 'TAKEN',
  'TAKES', 'TALKS', 'TASTE', 'TAXES', 'TEACH', 'TEARS', 'TEENS', 'TEETH',
  'TEMPO', 'TENDS', 'TENOR', 'TENTH', 'TERMS', 'TERRY', 'TESTS', 'TEXAS',
  'THANK', 'THEFT', 'THEME', 'THERE', 'THESE', 'THICK', 'THIEF', 'THING',
  'THINK', 'THIRD', 'THOSE', 'THREE', 'THREW', 'THROW', 'THUMB', 'TIGER',
  'TIGHT', 'TIMER', 'TIMES', 'TIRED', 'TITLE', 'TODAY', 'TOKEN', 'TONNE',
  'TOOLS', 'TOOTH', 'TOPIC', 'TOTAL', 'TOUCH', 'TOUGH', 'TOURS', 'TOWER',
  'TOWNS', 'TRACK', 'TRADE', 'TRAIL', 'TRAIN', 'TRAIT', 'TRASH', 'TREAT',
  'TREES', 'TREND', 'TRIAL', 'TRIBE', 'TRICK', 'TRIED', 'TRIES', 'TRUCK',
  'TRULY', 'TRUNK', 'TRUST', 'TRUTH', 'TUBES', 'TUMOR', 'TUNED', 'TURNS',
  'TWICE', 'TWINS', 'TWIST', 'TYLER', 'TYPES', 'ULTRA', 'UNCLE', 'UNDER',
  'UNION', 'UNITY', 'UNTIL', 'UPPER', 'UPSET', 'URBAN', 'USAGE', 'USUAL',
  'VALID', 'VALUE', 'VALVE', 'VAULT', 'VENUE', 'VERSE', 'VIDEO', 'VIEWS',
  'VIRAL', 'VIRUS', 'VISIT', 'VITAL', 'VIVID', 'VOCAL', 'VOGUE', 'VOICE',
  'VOTER', 'WAGON', 'WAIST', 'WASTE', 'WATCH', 'WATER', 'WAVES', 'WEARY',
  'WEIGH', 'WEIRD', 'WELLS', 'WELSH', 'WHALE', 'WHEAT', 'WHEEL', 'WHERE',
  'WHICH', 'WHILE', 'WHITE', 'WHOLE', 'WHOSE', 'WIDER', 'WIDOW', 'WIDTH',
  'WILLS', 'WINDS', 'WINES', 'WINGS', 'WIPED', 'WIRED', 'WIRES', 'WITCH',
  'WOMAN', 'WOMEN', 'WOODS', 'WORDS', 'WORKS', 'WORLD', 'WORRY', 'WORSE',
  'WORST', 'WORTH', 'WOULD', 'WOUND', 'WRITE', 'WRONG', 'WROTE', 'YACHT',
  'YARDS', 'YEARS', 'YIELD', 'YOUNG', 'YOUTH', 'ZEROS', 'ZONES',
];

// Daily puzzle words (business/economy focused)
export const DAILY_WORDS: WordlePuzzle[] = [
  { id: 1, date: '2026-01-19', word: 'TRADE', hint: 'Exchange of goods' },
  { id: 2, date: '2026-01-20', word: 'STOCK', hint: 'Ownership in a company' },
  { id: 3, date: '2026-01-21', word: 'BONDS', hint: 'Fixed income securities' },
  { id: 4, date: '2026-01-22', word: 'KOREA', hint: 'Peninsula nation' },
  { id: 5, date: '2026-01-23', word: 'FUNDS', hint: 'Investment pool' },
  { id: 6, date: '2026-01-24', word: 'ASSET', hint: 'Valuable resource' },
  { id: 7, date: '2026-01-25', word: 'GAINS', hint: 'Profits earned' },
  { id: 8, date: '2026-01-26', word: 'YIELD', hint: 'Return on investment' },
  { id: 9, date: '2026-01-27', word: 'PRICE', hint: 'Cost of goods' },
  { id: 10, date: '2026-01-28', word: 'VALUE', hint: 'Worth of something' },
  { id: 11, date: '2026-01-29', word: 'SALES', hint: 'Revenue transactions' },
  { id: 12, date: '2026-01-30', word: 'DEALS', hint: 'Business agreements' },
  { id: 13, date: '2026-01-31', word: 'LOANS', hint: 'Borrowed money' },
  { id: 14, date: '2026-02-01', word: 'BANKS', hint: 'Financial institutions' },
  { id: 15, date: '2026-02-02', word: 'FOREX', hint: 'Currency market' },
  { id: 16, date: '2026-02-03', word: 'INDEX', hint: 'Market benchmark' },
  { id: 17, date: '2026-02-04', word: 'SHARE', hint: 'Equity unit' },
  { id: 18, date: '2026-02-05', word: 'FIRMS', hint: 'Companies' },
  { id: 19, date: '2026-02-06', word: 'GOODS', hint: 'Products for sale' },
  { id: 20, date: '2026-02-07', word: 'BRAND', hint: 'Company identity' },
  { id: 21, date: '2026-02-08', word: 'CHART', hint: 'Visual data display' },
  { id: 22, date: '2026-02-09', word: 'AUDIT', hint: 'Financial review' },
  { id: 23, date: '2026-02-10', word: 'TAXES', hint: 'Government levies' },
  { id: 24, date: '2026-02-11', word: 'RATES', hint: 'Interest percentages' },
  { id: 25, date: '2026-02-12', word: 'TREND', hint: 'Market direction' },
  { id: 26, date: '2026-02-13', word: 'BOOST', hint: 'Increase sharply' },
  { id: 27, date: '2026-02-14', word: 'HEDGE', hint: 'Risk protection' },
  { id: 28, date: '2026-02-15', word: 'MERGE', hint: 'Combine companies' },
  { id: 29, date: '2026-02-16', word: 'BUYER', hint: 'Purchaser' },
  { id: 30, date: '2026-02-17', word: 'OWNER', hint: 'Property holder' },
  { id: 31, date: '2026-02-18', word: 'BOARD', hint: 'Directors group' },
  { id: 32, date: '2026-02-19', word: 'CHIEF', hint: 'Top executive' },
  { id: 33, date: '2026-02-20', word: 'BONUS', hint: 'Extra payment' },
  { id: 34, date: '2026-02-21', word: 'WAGES', hint: 'Worker pay' },
  { id: 35, date: '2026-02-22', word: 'LABOR', hint: 'Workforce' },
  { id: 36, date: '2026-02-23', word: 'UNION', hint: 'Worker organization' },
  { id: 37, date: '2026-02-24', word: 'STAFF', hint: 'Employees' },
  { id: 38, date: '2026-02-25', word: 'CHIPS', hint: 'Semiconductors' },
  { id: 39, date: '2026-02-26', word: 'PHONE', hint: 'Mobile device' },
  { id: 40, date: '2026-02-27', word: 'ROBOT', hint: 'Automated machine' },
  { id: 41, date: '2026-02-28', word: 'CLOUD', hint: 'Online storage' },
  { id: 42, date: '2026-03-01', word: 'MEDIA', hint: 'News outlets' },
  { id: 43, date: '2026-03-02', word: 'SMART', hint: 'Intelligent tech' },
  { id: 44, date: '2026-03-03', word: 'STEEL', hint: 'Metal industry' },
  { id: 45, date: '2026-03-04', word: 'SHIPS', hint: 'Maritime vessels' },
  { id: 46, date: '2026-03-05', word: 'AUTOS', hint: 'Car industry' },
  { id: 47, date: '2026-03-06', word: 'BUILD', hint: 'Construction' },
  { id: 48, date: '2026-03-07', word: 'PLANT', hint: 'Factory' },
  { id: 49, date: '2026-03-08', word: 'POWER', hint: 'Energy' },
  { id: 50, date: '2026-03-09', word: 'SOLAR', hint: 'Sun energy' },
  { id: 51, date: '2026-03-10', word: 'SEOUL', hint: 'Korean capital' },
  { id: 52, date: '2026-03-11', word: 'ASIAN', hint: 'Continental region' },
  { id: 53, date: '2026-03-12', word: 'MONEY', hint: 'Currency' },
  { id: 54, date: '2026-03-13', word: 'WORTH', hint: 'Net value' },
  { id: 55, date: '2026-03-14', word: 'COSTS', hint: 'Expenses' },
  { id: 56, date: '2026-03-15', word: 'DEBTS', hint: 'Owed money' },
  { id: 57, date: '2026-03-16', word: 'GROSS', hint: 'Before deductions' },
  { id: 58, date: '2026-03-17', word: 'QUOTA', hint: 'Limited amount' },
  { id: 59, date: '2026-03-18', word: 'DRAFT', hint: 'Preliminary version' },
  { id: 60, date: '2026-03-19', word: 'TERMS', hint: 'Conditions' },
];

// Get today's puzzle
export function getTodaysPuzzle(): WordlePuzzle {
  const today = new Date().toISOString().split('T')[0];
  const puzzle = DAILY_WORDS.find(p => p.date === today);

  if (puzzle) return puzzle;

  // Fallback: use day of year to pick a word
  const startOfYear = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date().getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const index = dayOfYear % DAILY_WORDS.length;

  return DAILY_WORDS[index];
}

// Check if a word is valid for guessing
export function isValidWord(word: string): boolean {
  return VALID_WORDS.includes(word.toUpperCase());
}
