export interface FamousPerson {
  name: string;
  birthYear: number;
  field: string;
  description: string;
  emoji: string;
}

// 월-일 기준 더미 데이터 (MM-DD)
export const FAMOUS_BIRTHDAYS: Record<string, FamousPerson[]> = {
  "01-01": [
    { name: "J.D. 샐린저", birthYear: 1919, field: "작가", description: "《호밀밭의 파수꾼》으로 세계 문학사에 이름을 남긴 미국 소설가", emoji: "✍️" },
    { name: "베토벤 (추정)", birthYear: 1770, field: "음악가", description: "청각을 잃고도 불멸의 교향곡을 남긴 독일 작곡가", emoji: "🎵" },
  ],
  "01-15": [
    { name: "마틴 루터 킹 주니어", birthYear: 1929, field: "인권운동가", description: "미국 흑인 민권운동을 이끈 노벨 평화상 수상자", emoji: "✊" },
    { name: "몰리에르", birthYear: 1622, field: "극작가", description: "《수전노》, 《타르튀프》를 쓴 프랑스 희극의 아버지", emoji: "🎭" },
  ],
  "01-17": [
    { name: "무하마드 알리", birthYear: 1942, field: "권투선수", description: "세계 헤비급 챔피언, '나비처럼 날아 벌처럼 쏜다'의 전설", emoji: "🥊" },
    { name: "벤저민 프랭클린", birthYear: 1706, field: "발명가·정치인", description: "피뢰침을 발명하고 미국 독립선언서에 서명한 건국의 아버지", emoji: "⚡" },
  ],
  "02-12": [
    { name: "찰스 다윈", birthYear: 1809, field: "과학자", description: "《종의 기원》으로 진화론을 정립한 영국의 생물학자", emoji: "🔬" },
    { name: "에이브러햄 링컨", birthYear: 1809, field: "정치인", description: "노예제를 폐지하고 남북전쟁을 이끈 미국 16대 대통령", emoji: "🎩" },
  ],
  "02-14": [
    { name: "프레데릭 더글러스", birthYear: 1818, field: "인권운동가", description: "노예 출신으로 미국 흑인 해방운동을 이끈 연설가·작가", emoji: "✊" },
  ],
  "03-01": [
    { name: "저스틴 비버", birthYear: 1994, field: "가수", description: "유튜브로 발굴된 캐나다 팝스타, 전 세계 10대의 아이콘", emoji: "🎤" },
    { name: "론 하워드", birthYear: 1954, field: "영화감독", description: "《뷰티풀 마인드》, 《아폴로 13》을 연출한 할리우드 거장", emoji: "🎬" },
  ],
  "03-14": [
    { name: "알베르트 아인슈타인", birthYear: 1879, field: "물리학자", description: "상대성 이론으로 현대 물리학의 패러다임을 바꾼 천재 과학자", emoji: "🔬" },
    { name: "스티븐 호킹", birthYear: 1942, field: "물리학자", description: "블랙홀 이론을 정립한 영국의 이론물리학자", emoji: "🌌" },
  ],
  "04-02": [
    { name: "한스 크리스티안 안데르센", birthYear: 1805, field: "작가", description: "《인어공주》, 《미운 오리 새끼》를 쓴 덴마크 동화 작가", emoji: "📖" },
    { name: "마이클 패스벤더", birthYear: 1977, field: "배우", description: "《12년간의 노예》, 《엑스맨》 시리즈로 주목받은 아일랜드 배우", emoji: "🎬" },
  ],
  "04-15": [
    { name: "레오나르도 다빈치", birthYear: 1452, field: "예술가·발명가", description: "《모나리자》를 그리고 헬리콥터를 설계한 르네상스의 천재", emoji: "🎨" },
    { name: "엠마 왓슨", birthYear: 1990, field: "배우", description: "《해리 포터》의 헤르미온느로 전 세계 팬을 사로잡은 영국 배우", emoji: "⚡" },
  ],
  "04-23": [
    { name: "윌리엄 셰익스피어", birthYear: 1564, field: "극작가", description: "《햄릿》, 《로미오와 줄리엣》을 쓴 영문학 최고의 극작가", emoji: "🎭" },
    { name: "세르반테스", birthYear: 1547, field: "작가", description: "《돈키호테》를 쓴 스페인 문학의 거장", emoji: "✍️" },
  ],
  "05-05": [
    { name: "칼 마르크스", birthYear: 1818, field: "철학자·경제학자", description: "《공산당 선언》을 쓴 사회주의 사상의 창시자", emoji: "📚" },
    { name: "아델 (Adele)", birthYear: 1988, field: "가수", description: "《Hello》, 《Rolling in the Deep》으로 세계를 울린 영국 팝스타", emoji: "🎤" },
  ],
  "05-25": [
    { name: "랄프 왈도 에머슨", birthYear: 1803, field: "철학자·작가", description: "미국 초월주의를 이끈 사상가이자 시인", emoji: "📖" },
  ],
  "06-01": [
    { name: "마릴린 먼로", birthYear: 1926, field: "배우", description: "《7년만의 외출》로 할리우드 최고의 섹스 심벌이 된 미국 배우", emoji: "⭐" },
    { name: "모건 프리먼", birthYear: 1937, field: "배우", description: "《쇼생크 탈출》, 《밀리언 달러 베이비》의 명배우", emoji: "🎬" },
  ],
  "06-25": [
    { name: "조지 오웰", birthYear: 1903, field: "작가", description: "《1984》, 《동물농장》으로 전체주의를 비판한 영국 소설가", emoji: "✍️" },
    { name: "안토니오 가우디", birthYear: 1852, field: "건축가", description: "사그라다 파밀리아를 설계한 스페인의 천재 건축가", emoji: "🏛️" },
  ],
  "07-04": [
    { name: "나탈리 포트만", birthYear: 1981, field: "배우", description: "《블랙 스완》으로 아카데미 여우주연상을 수상한 이스라엘계 배우", emoji: "🎬" },
    { name: "제럴드 포드", birthYear: 1913, field: "정치인", description: "워터게이트 사건 이후 미국 38대 대통령에 취임한 정치인", emoji: "🇺🇸" },
  ],
  "07-26": [
    { name: "믹 재거", birthYear: 1943, field: "가수", description: "롤링 스톤스의 프론트맨, 록 음악의 살아있는 전설", emoji: "🎸" },
    { name: "케이트 비커스", birthYear: 1982, field: "모델", description: "영국 왕실 케임브리지 공작부인, 패션 아이콘", emoji: "👑" },
  ],
  "08-04": [
    { name: "버락 오바마", birthYear: 1961, field: "정치인", description: "미국 최초의 흑인 대통령, 노벨 평화상 수상자", emoji: "🇺🇸" },
    { name: "루이 암스트롱", birthYear: 1901, field: "음악가", description: "재즈 트럼펫의 전설, 《What a Wonderful World》의 주인공", emoji: "🎺" },
  ],
  "08-15": [
    { name: "나폴레옹 보나파르트", birthYear: 1769, field: "군인·황제", description: "프랑스 혁명의 영웅에서 황제가 된 유럽 정복자", emoji: "⚔️" },
    { name: "벤 애플렉", birthYear: 1972, field: "배우·감독", description: "《굿 윌 헌팅》 각본으로 아카데미를 수상한 할리우드 스타", emoji: "🎬" },
  ],
  "09-05": [
    { name: "프레디 머큐리", birthYear: 1946, field: "가수", description: "퀸의 보컬, 《Bohemian Rhapsody》로 록 역사를 새로 쓴 전설", emoji: "🎤" },
  ],
  "09-26": [
    { name: "티에리 앙리", birthYear: 1977, field: "축구선수", description: "아스날의 전설, 프랑스 월드컵 우승 멤버", emoji: "⚽" },
    { name: "세르게이 브린", birthYear: 1973, field: "기업인", description: "구글을 공동 창업한 러시아계 미국인 기업가", emoji: "💻" },
  ],
  "10-09": [
    { name: "존 레논", birthYear: 1940, field: "음악가", description: "비틀즈의 멤버, 《Imagine》으로 평화를 노래한 전설", emoji: "🎵" },
    { name: "체 게바라", birthYear: 1928, field: "혁명가", description: "쿠바 혁명을 이끈 아르헨티나 출신의 게릴라 지도자", emoji: "✊" },
  ],
  "10-26": [
    { name: "힐러리 클린턴", birthYear: 1947, field: "정치인", description: "미국 최초의 여성 대통령 후보, 전 국무장관", emoji: "🇺🇸" },
    { name: "사샤 바론 코헨", birthYear: 1971, field: "배우·코미디언", description: "《보랏》으로 세계를 웃긴 영국 코미디 배우", emoji: "😂" },
  ],
  "11-10": [
    { name: "마틴 루터", birthYear: 1483, field: "종교개혁가", description: "95개조 반박문으로 종교개혁을 시작한 독일 신학자", emoji: "⛪" },
    { name: "리오넬 메시", birthYear: 1987, field: "축구선수", description: "FC 바르셀로나와 아르헨티나 국가대표의 살아있는 전설", emoji: "⚽" },
  ],
  "11-29": [
    { name: "C.S. 루이스", birthYear: 1898, field: "작가", description: "《나니아 연대기》를 쓴 영국의 소설가이자 신학자", emoji: "✍️" },
    { name: "노스트라다무스", birthYear: 1503, field: "예언가", description: "수백 년 후를 예언했다고 알려진 프랑스의 점성술사", emoji: "🔮" },
  ],
  "12-05": [
    { name: "월트 디즈니", birthYear: 1901, field: "기업인·애니메이터", description: "미키마우스를 창조하고 디즈니 왕국을 세운 엔터테인먼트의 아버지", emoji: "🏰" },
    { name: "모차르트", birthYear: 1756, field: "음악가", description: "35년의 짧은 생애에 600여 곡을 남긴 오스트리아의 천재 작곡가", emoji: "🎵" },
  ],
  "12-25": [
    { name: "아이작 뉴턴", birthYear: 1642, field: "과학자", description: "만유인력의 법칙을 발견한 영국의 물리학자·수학자", emoji: "🍎" },
    { name: "험프리 보가트", birthYear: 1899, field: "배우", description: "《카사블랑카》의 주인공, 할리우드 황금기의 아이콘", emoji: "🎬" },
  ],
};

const DEFAULT_BIRTHDAYS: FamousPerson[] = [
  { name: "알베르트 아인슈타인", birthYear: 1879, field: "물리학자", description: "상대성 이론으로 현대 물리학의 패러다임을 바꾼 천재 과학자", emoji: "🔬" },
  { name: "레오나르도 다빈치", birthYear: 1452, field: "예술가·발명가", description: "《모나리자》를 그리고 헬리콥터를 설계한 르네상스의 천재", emoji: "🎨" },
];

export function getFamousBirthdays(dateStr: string): FamousPerson[] {
  const d = new Date(dateStr);
  const key = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return FAMOUS_BIRTHDAYS[key] ?? DEFAULT_BIRTHDAYS;
}
