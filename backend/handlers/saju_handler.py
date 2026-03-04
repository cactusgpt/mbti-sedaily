"""
사주 분석 핸들러
순수 로직으로 사주 팔자(四柱八字) 계산 및 분석 결과 반환
"""
import json
import logging
from datetime import datetime, date
from typing import Optional

from config.constants import CORS_HEADERS

logger = logging.getLogger(__name__)

# =============================================================================
# 천간 / 지지 기본 데이터
# =============================================================================

HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
HEAVENLY_STEMS_KR = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계']

EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
EARTHLY_BRANCHES_KR = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해']

# 오행 매핑 (천간)
STEM_ELEMENT = {
    '甲': 'Wood', '乙': 'Wood',
    '丙': 'Fire', '丁': 'Fire',
    '戊': 'Earth', '己': 'Earth',
    '庚': 'Metal', '辛': 'Metal',
    '壬': 'Water', '癸': 'Water',
}

# 오행 매핑 (지지)
BRANCH_ELEMENT = {
    '子': 'Water', '丑': 'Earth', '寅': 'Wood', '卯': 'Wood',
    '辰': 'Earth', '巳': 'Fire', '午': 'Fire', '未': 'Earth',
    '申': 'Metal', '酉': 'Metal', '戌': 'Earth', '亥': 'Water',
}

# 음양 (천간: 0=양, 1=음)
STEM_YIN_YANG = ['양', '음', '양', '음', '양', '음', '양', '음', '양', '음']

# 오행 한글
ELEMENT_KR = {
    'Wood': '목(木)', 'Fire': '화(火)', 'Earth': '토(土)',
    'Metal': '금(金)', 'Water': '수(水)'
}

# 십신 (일간 기준 오행 관계)
TEN_GODS_MAP = {
    # (일간오행, 상대오행, 음양같음여부) -> 십신
    ('Wood',  'Wood',  True):  '비견(比肩)',
    ('Wood',  'Wood',  False): '겁재(劫財)',
    ('Wood',  'Fire',  True):  '식신(食神)',
    ('Wood',  'Fire',  False): '상관(傷官)',
    ('Wood',  'Earth', True):  '편재(偏財)',
    ('Wood',  'Earth', False): '정재(正財)',
    ('Wood',  'Metal', True):  '편관(偏官)',
    ('Wood',  'Metal', False): '정관(正官)',
    ('Wood',  'Water', True):  '편인(偏印)',
    ('Wood',  'Water', False): '정인(正印)',

    ('Fire',  'Fire',  True):  '비견(比肩)',
    ('Fire',  'Fire',  False): '겁재(劫財)',
    ('Fire',  'Earth', True):  '식신(食神)',
    ('Fire',  'Earth', False): '상관(傷官)',
    ('Fire',  'Metal', True):  '편재(偏財)',
    ('Fire',  'Metal', False): '정재(正財)',
    ('Fire',  'Water', True):  '편관(偏官)',
    ('Fire',  'Water', False): '정관(正官)',
    ('Fire',  'Wood',  True):  '편인(偏印)',
    ('Fire',  'Wood',  False): '정인(正印)',

    ('Earth', 'Earth', True):  '비견(比肩)',
    ('Earth', 'Earth', False): '겁재(劫財)',
    ('Earth', 'Metal', True):  '식신(食神)',
    ('Earth', 'Metal', False): '상관(傷官)',
    ('Earth', 'Water', True):  '편재(偏財)',
    ('Earth', 'Water', False): '정재(正財)',
    ('Earth', 'Wood',  True):  '편관(偏官)',
    ('Earth', 'Wood',  False): '정관(正官)',
    ('Earth', 'Fire',  True):  '편인(偏印)',
    ('Earth', 'Fire',  False): '정인(正印)',

    ('Metal', 'Metal', True):  '비견(比肩)',
    ('Metal', 'Metal', False): '겁재(劫財)',
    ('Metal', 'Water', True):  '식신(食神)',
    ('Metal', 'Water', False): '상관(傷官)',
    ('Metal', 'Wood',  True):  '편재(偏財)',
    ('Metal', 'Wood',  False): '정재(正財)',
    ('Metal', 'Fire',  True):  '편관(偏官)',
    ('Metal', 'Fire',  False): '정관(正官)',
    ('Metal', 'Earth', True):  '편인(偏印)',
    ('Metal', 'Earth', False): '정인(正印)',

    ('Water', 'Water', True):  '비견(比肩)',
    ('Water', 'Water', False): '겁재(劫財)',
    ('Water', 'Wood',  True):  '식신(食神)',
    ('Water', 'Wood',  False): '상관(傷官)',
    ('Water', 'Fire',  True):  '편재(偏財)',
    ('Water', 'Fire',  False): '정재(正財)',
    ('Water', 'Earth', True):  '편관(偏官)',
    ('Water', 'Earth', False): '정관(正官)',
    ('Water', 'Metal', True):  '편인(偏印)',
    ('Water', 'Metal', False): '정인(正印)',
}

# 절기 데이터 (월주 계산용) - 각 월의 절입 대략 일자 (양력 기준)
# (월, 절기명, 대략 일자)
SOLAR_TERMS_APPROX = [
    (1,  '소한', 6),
    (2,  '입춘', 4),
    (3,  '경칩', 6),
    (4,  '청명', 5),
    (5,  '입하', 6),
    (6,  '망종', 6),
    (7,  '소서', 7),
    (8,  '입추', 7),
    (9,  '백로', 8),
    (10, '한로', 8),
    (11, '입동', 7),
    (12, '대설', 7),
]

# 입춘 대략 일자 (연도별 정밀 계산 생략, 2월 4일 기준)
IPCHUN_APPROX_DAY = 4

# =============================================================================
# 사주 계산 로직
# =============================================================================

def get_year_pillar(year: int, birth_month: int, birth_day: int) -> tuple[int, int]:
    """연주 산출 - 입춘(2월 4일) 기준으로 연도 교체"""
    # 입춘 이전이면 전년도로 처리
    if birth_month < 2 or (birth_month == 2 and birth_day < IPCHUN_APPROX_DAY):
        year -= 1
    stem_idx = (year - 4) % 10
    branch_idx = (year - 4) % 12
    return stem_idx, branch_idx


def get_month_pillar(year: int, month: int, day: int) -> tuple[int, int]:
    """월주 산출 - 절기 기준 월 교체 (근사값)"""
    # 절기 기준으로 월 인덱스 결정
    solar_month = month
    term_day = SOLAR_TERMS_APPROX[month - 1][2]
    if day < term_day:
        solar_month -= 1
        if solar_month == 0:
            solar_month = 12

    # 연주 천간 기준으로 월주 천간 시작점 결정
    year_stem_idx, _ = get_year_pillar(year, month, day)
    # 갑기년: 인월(寅)부터 병인(丙寅), 을경년: 무인(戊寅), ...
    month_stem_base = (year_stem_idx % 5) * 2
    # 인월(寅) = 지지 인덱스 2
    branch_idx = (solar_month + 1) % 12  # 인월=1월 절기 기준
    stem_idx = (month_stem_base + (solar_month - 1)) % 10
    return stem_idx, branch_idx


def get_day_pillar(year: int, month: int, day: int) -> tuple[int, int]:
    """일주 산출 - 갑자일 기준 경과일 계산"""
    # 기준일: 1900-01-01 = 갑술(甲戌) → 간지 인덱스 (10, 10)
    # 갑자(甲子) 기준일: 1900-01-01은 간지 순서상 甲戌 = stem:10, branch:10
    base = date(1900, 1, 1)
    target = date(year, month, day)
    delta = (target - base).days
    # 1900-01-01 = 甲戌: stem_idx=0(甲), branch_idx=10(戌) → 절대 인덱스 = 10
    base_stem = 0
    base_branch = 10
    stem_idx = (base_stem + delta) % 10
    branch_idx = (base_branch + delta) % 12
    return stem_idx, branch_idx


def get_hour_pillar(day_stem_idx: int, branch_idx: Optional[int]) -> tuple[Optional[int], Optional[int]]:
    """시주 산출 - 일간 기준, branch_idx는 12시진 인덱스(0=子~11=亥)"""
    if branch_idx is None:
        return None, None
    # 일간 기준 시간 천간 시작점 (갑기일: 갑자시, 을경일: 병자시, ...)
    hour_stem_base = (day_stem_idx % 5) * 2
    stem_idx = (hour_stem_base + branch_idx) % 10
    return stem_idx, branch_idx


def pillar_to_dict(stem_idx: Optional[int], branch_idx: Optional[int]) -> dict:
    if stem_idx is None:
        return {"stem": None, "branch": None, "stem_kr": None, "branch_kr": None,
                "stem_element": None, "branch_element": None}
    return {
        "stem": HEAVENLY_STEMS[stem_idx],
        "branch": EARTHLY_BRANCHES[branch_idx],
        "stem_kr": HEAVENLY_STEMS_KR[stem_idx],
        "branch_kr": EARTHLY_BRANCHES_KR[branch_idx],
        "stem_element": STEM_ELEMENT[HEAVENLY_STEMS[stem_idx]],
        "branch_element": BRANCH_ELEMENT[EARTHLY_BRANCHES[branch_idx]],
        "yin_yang": STEM_YIN_YANG[stem_idx],
    }


def calc_five_elements(pillars: list[dict]) -> dict:
    """오행 분포 계산"""
    counts = {'Wood': 0, 'Fire': 0, 'Earth': 0, 'Metal': 0, 'Water': 0}
    for p in pillars:
        if p.get('stem_element'):
            counts[p['stem_element']] += 1
        if p.get('branch_element'):
            counts[p['branch_element']] += 1
    total = sum(counts.values()) or 1
    return {
        k: {'count': v, 'percent': round(v / total * 100), 'label': ELEMENT_KR[k]}
        for k, v in counts.items()
    }


def get_ten_god(day_stem_idx: int, target_stem_idx: int) -> str:
    """십신 계산"""
    day_elem = STEM_ELEMENT[HEAVENLY_STEMS[day_stem_idx]]
    tgt_elem = STEM_ELEMENT[HEAVENLY_STEMS[target_stem_idx]]
    same_yin_yang = (day_stem_idx % 2) == (target_stem_idx % 2)
    return TEN_GODS_MAP.get((day_elem, tgt_elem, same_yin_yang), '미상')


def find_useful_god(five_elements: dict) -> dict:
    """용신 선정 - 부족한 오행을 용신으로"""
    sorted_elems = sorted(five_elements.items(), key=lambda x: x[1]['count'])
    weakest = sorted_elems[0][0]
    strongest = sorted_elems[-1][0]
    # 상생 관계로 용신 보완
    sheng_cycle = ['Wood', 'Fire', 'Earth', 'Metal', 'Water']
    weakest_idx = sheng_cycle.index(weakest)
    support = sheng_cycle[(weakest_idx - 1) % 5]  # 생해주는 오행
    return {
        'useful_god': ELEMENT_KR[weakest],
        'useful_god_element': weakest,
        'support_element': ELEMENT_KR[support],
        'avoid_element': ELEMENT_KR[strongest],
        'description': f"{ELEMENT_KR[weakest]}이 부족하여 {ELEMENT_KR[weakest]}과 {ELEMENT_KR[support]}이 용신입니다."
    }


def calc_major_fortune(birth_year: int, birth_month: int, birth_day: int,
                        gender: str, year_stem_idx: int) -> list[dict]:
    """대운 산출"""
    # 양남음녀 → 순행, 음남양녀 → 역행
    is_yang_stem = (year_stem_idx % 2 == 0)
    is_male = (gender == 'male')
    forward = (is_yang_stem and is_male) or (not is_yang_stem and not is_male)

    # 생월 절입일까지 일수 계산 (근사)
    term_day = SOLAR_TERMS_APPROX[birth_month - 1][2]
    if forward:
        days_to_term = term_day - birth_day
        if days_to_term < 0:
            next_month = birth_month % 12 + 1
            days_to_term = SOLAR_TERMS_APPROX[next_month - 1][2] + (30 - birth_day)
    else:
        days_to_term = birth_day - term_day
        if days_to_term < 0:
            prev_month = (birth_month - 2) % 12 + 1
            days_to_term = birth_day + (30 - SOLAR_TERMS_APPROX[prev_month - 1][2])

    start_age = max(1, round(days_to_term / 3))

    # 월주 기준으로 대운 간지 순행/역행
    month_stem, month_branch = get_month_pillar(birth_year, birth_month, birth_day)

    fortunes = []
    for i in range(8):
        age = start_age + i * 10
        if forward:
            s_idx = (month_stem + i + 1) % 10
            b_idx = (month_branch + i + 1) % 12
        else:
            s_idx = (month_stem - i - 1) % 10
            b_idx = (month_branch - i - 1) % 12
        fortunes.append({
            'age': age,
            'year': birth_year + age,
            'stem': HEAVENLY_STEMS[s_idx],
            'branch': EARTHLY_BRANCHES[b_idx],
            'stem_kr': HEAVENLY_STEMS_KR[s_idx],
            'branch_kr': EARTHLY_BRANCHES_KR[b_idx],
            'element': ELEMENT_KR[STEM_ELEMENT[HEAVENLY_STEMS[s_idx]]],
        })
    return fortunes


def get_current_fortune(birth_year: int, major_fortunes: list[dict]) -> dict:
    """현재 대운·세운 반환"""
    current_year = datetime.now().year
    current_age = current_year - birth_year

    # 현재 대운 찾기
    current_major = major_fortunes[0]
    for f in major_fortunes:
        if f['age'] <= current_age:
            current_major = f

    # 세운 (올해 간지)
    annual_stem_idx = (current_year - 4) % 10
    annual_branch_idx = (current_year - 4) % 12

    return {
        'current_age': current_age,
        'major_fortune': current_major,
        'annual_fortune': {
            'year': current_year,
            'stem': HEAVENLY_STEMS[annual_stem_idx],
            'branch': EARTHLY_BRANCHES[annual_branch_idx],
            'stem_kr': HEAVENLY_STEMS_KR[annual_stem_idx],
            'branch_kr': EARTHLY_BRANCHES_KR[annual_branch_idx],
        }
    }


def get_personality_profile(five_elements: dict, day_stem_idx: int) -> dict:
    """성격·적성 요약"""
    dominant = max(five_elements.items(), key=lambda x: x[1]['count'])[0]
    profiles = {
        'Wood': {
            'personality': '진취적이고 창의적이며 성장 지향적입니다. 새로운 것을 시작하는 데 강합니다.',
            'strength': '리더십, 창의력, 추진력',
            'career': '기획, 창업, 교육, 스포츠',
        },
        'Fire': {
            'personality': '열정적이고 표현력이 강하며 사교적입니다. 사람들을 이끄는 카리스마가 있습니다.',
            'strength': '표현력, 열정, 사교성',
            'career': '예술, 방송, 영업, 정치',
        },
        'Earth': {
            'personality': '안정적이고 신뢰감이 있으며 현실적입니다. 중재자 역할을 잘 합니다.',
            'strength': '신뢰성, 안정감, 포용력',
            'career': '금융, 부동산, 행정, 의료',
        },
        'Metal': {
            'personality': '원칙적이고 결단력이 있으며 완벽주의 성향이 있습니다.',
            'strength': '결단력, 정확성, 원칙',
            'career': '법조, 군경, 엔지니어링, 회계',
        },
        'Water': {
            'personality': '지혜롭고 유연하며 직관력이 뛰어납니다. 상황 적응력이 강합니다.',
            'strength': '지혜, 유연성, 직관력',
            'career': '연구, IT, 철학, 무역',
        },
    }
    return {
        'dominant_element': ELEMENT_KR[dominant],
        **profiles.get(dominant, profiles['Earth'])
    }


# =============================================================================
# Lambda 핸들러
# =============================================================================

def lambda_handler(event: dict, context) -> dict:
    """
    사주 분석 엔드포인트

    Request body:
    {
        "birth_year": 1995,
        "birth_month": 8,
        "birth_day": 15,
        "birth_hour": 14,   // optional (null 가능)
        "gender": "male" | "female"
    }
    """
    try:
        request_context = event.get('requestContext', {})
        http_method = (
            request_context.get('http', {}).get('method')
            or event.get('httpMethod', 'GET')
        )

        if http_method == 'OPTIONS':
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

        import base64
        body = event.get('body', '{}')
        if event.get('isBase64Encoded') and body:
            body = base64.b64decode(body).decode('utf-8')
        if isinstance(body, str):
            body = json.loads(body) if body else {}

        birth_year  = int(body.get('birth_year', 0))
        birth_month = int(body.get('birth_month', 0))
        birth_day   = int(body.get('birth_day', 0))
        birth_hour  = body.get('birth_hour')  # 12시진 인덱스 (0=子~11=亥), None 허용
        gender      = body.get('gender', 'male')

        if birth_hour is not None:
            birth_hour = int(birth_hour)

        # 유효성 검사
        if not (1900 <= birth_year <= 2025 and 1 <= birth_month <= 12 and 1 <= birth_day <= 31):
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': '생년월일이 올바르지 않습니다.'}, ensure_ascii=False)
            }

        # 사주 팔자 계산
        y_stem, y_branch = get_year_pillar(birth_year, birth_month, birth_day)
        m_stem, m_branch = get_month_pillar(birth_year, birth_month, birth_day)
        d_stem, d_branch = get_day_pillar(birth_year, birth_month, birth_day)
        h_stem, h_branch = get_hour_pillar(d_stem, birth_hour)

        year_pillar  = pillar_to_dict(y_stem, y_branch)
        month_pillar = pillar_to_dict(m_stem, m_branch)
        day_pillar   = pillar_to_dict(d_stem, d_branch)
        hour_pillar  = pillar_to_dict(h_stem, h_branch)

        all_pillars = [year_pillar, month_pillar, day_pillar]
        if h_stem is not None:
            all_pillars.append(hour_pillar)

        # 오행 분포
        five_elements = calc_five_elements(all_pillars)

        # 십신 분석 (연·월·시 천간 기준)
        ten_gods = {}
        for label, stem_idx in [('연간', y_stem), ('월간', m_stem), ('시간', h_stem)]:
            if stem_idx is not None:
                ten_gods[label] = get_ten_god(d_stem, stem_idx)

        # 용신
        useful_god = find_useful_god(five_elements)

        # 대운
        major_fortunes = calc_major_fortune(birth_year, birth_month, birth_day, gender, y_stem)

        # 현재 운세
        current_fortune = get_current_fortune(birth_year, major_fortunes)

        # 성격 프로필
        personality = get_personality_profile(five_elements, d_stem)

        result = {
            'saju_pillar': {
                'year':  year_pillar,
                'month': month_pillar,
                'day':   day_pillar,
                'hour':  hour_pillar,
            },
            'five_elements_balance': five_elements,
            'ten_gods_analysis': ten_gods,
            'useful_god': useful_god,
            'major_fortune_cycle': major_fortunes,
            'current_fortune': current_fortune,
            'personality_profile': personality,
        }

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(result, ensure_ascii=False)
        }

    except Exception as e:
        logger.error(f"Saju handler error: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': '서버 오류가 발생했습니다.'}, ensure_ascii=False)
        }
