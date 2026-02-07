import { REPORTER_NAME_MAP, TITLE_MAP, LOCATION_MAP } from '@/constants/reporterNames';
import Aromanize from 'aromanize';

// Precompile regex pattern for title removal (performance optimization)
const TITLES_REGEX = new RegExp(Object.keys(TITLE_MAP).join('|'), 'g');

/**
 * 한글 byline에서 영어 이름만 추출 (메타데이터용)
 *
 * @example
 * "워싱턴=이태규 특파원" → "Tae-gyu Lee"
 * "김윤수 기자" → "Yoon-su Kim"
 */
export function getReporterNameInEnglish(byline: string): string {
  if (!byline || byline.trim() === '') {
    return 'Seoul Economic Daily';
  }

  try {
    const original = byline.trim();

    // 1. 전체 byline으로 먼저 검색 (직책 포함)
    if (REPORTER_NAME_MAP[original]) {
      return REPORTER_NAME_MAP[original];
    }

    // 2. 한글 이름만 추출해서 검색
    const name = extractKoreanName(byline);
    if (!name) return 'Seoul Economic Daily';

    // 매핑 테이블에서 찾기
    if (REPORTER_NAME_MAP[name]) {
      return REPORTER_NAME_MAP[name];
    }

    // aromanize로 자동 변환
    if (/^[가-힣]{2,4}$/.test(name)) {
      return romanizeKoreanName(name);
    }

    return 'Seoul Economic Daily';
  } catch (error) {
    return 'Seoul Economic Daily';
  }
}

/**
 * 한글 byline을 영어로 변환 (UI 표시용)
 * byline_en이 있으면 우선 사용, 없으면 byline을 변환
 *
 * @param byline - 한글 byline (예: "김윤수 기자")
 * @param byline_en - 영어 byline (DynamoDB에서 제공, 선택사항)
 * @returns "By [Reporter Name]" 형식의 영어 byline
 *
 * @example
 * convertByline("김우보 기자", "Kim U-Bo") → "By Kim U-Bo"
 * convertByline("워싱턴=이태규 특파원") → "By Washington - Lee Tae-Gyu (Correspondent)"
 */
export function convertByline(byline: string, byline_en?: string): string {
  // 1. byline_en이 있으면 우선 사용 (DB에서 이미 번역됨)
  if (byline_en && byline_en.trim()) {
    return `By ${byline_en.trim()}`;
  }

  // 2. byline_en이 없으면 byline 변환 (fallback)
  if (!byline || byline.trim() === '') {
    return 'By Seoul Economic Daily';
  }

  try {
    const original = byline.trim();

    // 3. 전체 byline으로 먼저 검색 (직책 포함)
    if (REPORTER_NAME_MAP[original]) {
      return `By ${REPORTER_NAME_MAP[original]}`;
    }

    // 4. byline 파싱
    let name = original;

    // 직책 제거 (정규식 사용으로 성능 개선)
    name = name.replace(TITLES_REGEX, '').trim();

    // 지역=이름 형식 처리 (예: "워싱턴=이태규")
    if (name.includes('=')) {
      name = name.split('=')[1]?.trim() || name;
    }

    // 공백 정리
    name = name.trim();

    // 5. 매핑 테이블에서 찾기 (파싱된 이름으로)
    if (REPORTER_NAME_MAP[name]) {
      return `By ${REPORTER_NAME_MAP[name]}`;
    }

    // 6. 매핑에 없으면 aromanize로 자동 변환
    if (/^[가-힣]{2,4}$/.test(name)) {
      const englishName = romanizeKoreanName(name);
      return `By ${englishName}`;
    }

    // 7. 변환 실패 시 기본값
    return 'By Seoul Economic Daily';
  } catch (error) {
    console.error('Failed to convert byline:', error);
    return 'By Seoul Economic Daily';
  }
}

/**
 * 한글 이름을 로마자로 변환 (성을 뒤로)
 * "이태규" → "Tae-gyu Lee"
 */
function romanizeKoreanName(koreanName: string): string {
  if (koreanName.length < 2) {
    return Aromanize.romanize(koreanName);
  }

  // 성(첫 글자)과 이름(나머지) 분리
  const surname = koreanName[0];
  const givenName = koreanName.slice(1);

  // 각각 로마자화
  const surnameRoman = capitalizeFirst(Aromanize.romanize(surname));
  const givenNameRoman = romanizeGivenName(givenName);

  // 서양식 순서: 이름 + 성
  return `${givenNameRoman} ${surnameRoman}`;
}

/**
 * 이름 부분 로마자화 (하이픈 추가)
 * "태규" → "Tae-gyu"
 */
function romanizeGivenName(givenName: string): string {
  if (givenName.length === 1) {
    return capitalizeFirst(Aromanize.romanize(givenName));
  }

  if (givenName.length === 2) {
    // 각 글자 개별 로마자화 후 하이픈으로 연결
    const first = Aromanize.romanize(givenName[0]);
    const second = Aromanize.romanize(givenName[1]);
    return `${capitalizeFirst(first)}-${second.toLowerCase()}`;
  }

  // 3글자 이상
  return capitalizeFirst(Aromanize.romanize(givenName));
}

function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * byline에서 한글 이름만 추출
 */
function extractKoreanName(byline: string): string | null {
  let name = byline.trim();

  // 직책 제거 (정규식 사용으로 성능 개선)
  name = name.replace(TITLES_REGEX, '').trim();

  // 지역=이름 형식 처리 (예: "워싱턴=이태규")
  if (name.includes('=')) {
    name = name.split('=')[1]?.trim() || name;
  }

  // 공백 정리
  name = name.trim();

  // 한글 이름인지 확인
  if (/^[가-힣]{2,4}$/.test(name)) {
    return name;
  }

  return null;
}
