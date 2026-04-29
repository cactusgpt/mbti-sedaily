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

# 오행 키워드 (많을 때 / 부족할 때)
ELEMENT_KEYWORDS = {
    'Wood':  {'positive': '성장, 계획', 'excess': '성급, 분산',    'lack': '목표 없음, 비전 결핍'},
    'Fire':  {'positive': '열정, 창조', 'excess': '조급, 흥분',    'lack': '의욕 없음, 소심'},
    'Earth': {'positive': '안정, 인내', 'excess': '고집, 둔감',    'lack': '불안정, 미숙함'},
    'Metal': {'positive': '판단, 분석', 'excess': '냉정, 완고',    'lack': '우유부단, 추진력 약함'},
    'Water': {'positive': '지혜, 감성', 'excess': '걱정 과다, 게으름', 'lack': '감성 부족, 친화력 약함'},
}
SHENG_CYCLE = ['Wood', 'Fire', 'Earth', 'Metal', 'Water']  # 상생 순서

# 십신별 색상
TEN_GOD_COLOR = {
    '비견(比肩)': '#4A90D9', '겁재(劫財)': '#4A90D9',
    '식신(食神)': '#E8A838', '상관(傷官)': '#E8A838',
    '편재(偏財)': '#C8A060', '정재(正財)': '#C8A060',
    '편관(偏官)': '#7B7B7B', '정관(正官)': '#7B7B7B',
    '편인(偏印)': '#8B6BAE', '정인(正印)': '#8B6BAE',
}

# 천간/지지 오행 색상
STEM_COLOR = {
    '甲': '#4CAF50', '乙': '#81C784',
    '丙': '#F44336', '丁': '#E57373',
    '戊': '#FF9800', '己': '#FFB74D',
    '庚': '#9E9E9E', '辛': '#BDBDBD',
    '壬': '#2196F3', '癸': '#64B5F6',
}
BRANCH_COLOR = {
    '子': '#2196F3', '亥': '#64B5F6',
    '寅': '#4CAF50', '卯': '#81C784',
    '巳': '#F44336', '午': '#E57373',
    '申': '#9E9E9E', '酉': '#BDBDBD',
    '丑': '#FF9800', '辰': '#FFB74D', '未': '#FFA726', '戌': '#FB8C00',
}

# 육친 (일간 기준 십신 → 가족관계)
TEN_GOD_FAMILY = {
    '비견(比肩)': {'male': '형제', 'female': '자매'},
    '겁재(劫財)': {'male': '형제', 'female': '자매'},
    '식신(食神)': {'male': '아들', 'female': '딸'},
    '상관(傷官)': {'male': '딸', 'female': '아들'},
    '편재(偏財)': {'male': '부친', 'female': '부친'},
    '정재(正財)': {'male': '처', 'female': '부친'},
    '편관(偏官)': {'male': '아들', 'female': '남편'},
    '정관(正官)': {'male': '딸', 'female': '남편'},
    '편인(偏印)': {'male': '조모', 'female': '조모'},
    '정인(正印)': {'male': '모친', 'female': '모친'},
}

# 각 주(柱)의 운세 시기
PILLAR_FORTUNE_PERIOD = {
    'year':  {'period': '초년운', 'desc': '조상, 시대상'},
    'month': {'period': '청년운', 'desc': '부모, 사회상'},
    'day':   {'period': '중년운', 'desc': '정체성, 자아'},
    'hour':  {'period': '말년운', 'desc': '자녀운, 결실'},
}

def get_relation_desc(fortune_element: str, useful_element: str, fortune_type: str = 'annual') -> dict:
    """운의 오행이 용신과 어떤 관계인지 설명과 색상 타입 반환
    fortune_type: 'major'(대운) | 'annual'(세운) | 'monthly'(월운) | 'daily'(일운)
    """
    type_idx = {'major': 0, 'annual': 1, 'monthly': 2, 'daily': 3}.get(fortune_type, 1)

    if fortune_element == useful_element:
        descs = [
            "용신과 같은 기운이 흐르는 시기입니다. 사주에서 가장 필요한 에너지가 충만해지므로 하고자 하는 일에 자신감을 가져도 좋습니다. 새로운 시작, 중요한 결정, 대인관계 모두 긍정적인 흐름을 기대할 수 있습니다.",
            "내가 필요로 하는 기운이 가득 찬 시기입니다. 오랫동안 막혀 있던 일이 자연스럽게 풀리고, 주변 사람들과의 관계도 원활해집니다. 적극적으로 움직이면 좋은 결과를 얻을 수 있습니다.",
            "용신의 기운이 직접 들어오는 시기로, 에너지가 충전되는 느낌을 받을 수 있습니다. 평소보다 판단력이 높아지고 일의 흐름이 순조롭습니다. 중요한 약속이나 계획을 이 시기에 맞추면 좋습니다.",
            "사주에 꼭 필요한 기운이 보충되는 시기입니다. 몸과 마음이 가벼워지고 자신감이 올라옵니다. 새로운 인연이나 기회가 찾아올 수 있으니 열린 마음으로 받아들이세요.",
        ]
        return {'desc': descs[type_idx], 'tone': 'blue'}

    idx_f = SHENG_CYCLE.index(fortune_element)
    idx_u = SHENG_CYCLE.index(useful_element)

    # 상생: fortune이 useful을 생함 (가장 좋음)
    if SHENG_CYCLE[(idx_f + 1) % 5] == useful_element:
        descs = [
            "용신을 직접 생해주는 기운이 들어오는 시기입니다. 막혀 있던 일들이 풀리고 주변의 도움을 받기 쉬운 흐름입니다. 적극적으로 움직일수록 좋은 결과를 얻을 수 있으니 중요한 일을 추진하기에 좋은 때입니다.",
            "내 사주를 도와주는 기운이 강하게 작용하는 시기입니다. 노력한 만큼 결과가 따라오고, 귀인의 도움을 받을 가능성이 높습니다. 평소 미뤄두었던 일을 시작하기에 좋은 타이밍입니다.",
            "용신에게 힘을 불어넣는 기운이 흐르는 시기입니다. 대인관계에서 좋은 인연이 생기거나 예상치 못한 기회가 찾아올 수 있습니다. 자신감을 갖고 적극적으로 행동하세요.",
            "사주의 흐름을 돕는 기운이 작용하는 시기입니다. 작은 노력도 큰 결실로 이어질 수 있으며, 주변 환경이 나에게 우호적으로 돌아갑니다. 긍정적인 마음으로 하루를 시작하세요.",
        ]
        return {'desc': descs[type_idx], 'tone': 'blue'}

    # 상생: useful이 fortune을 생함 (안정적)
    if SHENG_CYCLE[(idx_u + 1) % 5] == fortune_element:
        descs = [
            "용신의 도움을 받아 에너지가 순환하는 시기입니다. 큰 변화보다는 현재의 흐름을 유지하며 내실을 다지는 것이 유리합니다. 무리하게 확장하기보다 기존의 관계와 일을 안정적으로 관리하는 데 집중하세요.",
            "용신이 이 기운을 뒷받침해주는 시기입니다. 급격한 변화보다는 꾸준함이 빛을 발하는 때입니다. 지금 하고 있는 일을 성실하게 이어가면 서서히 좋은 결과가 쌓입니다.",
            "에너지의 흐름이 안정적으로 순환하는 시기입니다. 새로운 도전보다는 현재 진행 중인 일을 마무리하고 정리하는 데 집중하면 좋습니다. 주변 사람들과의 관계도 차분하게 유지하세요.",
            "용신의 기운이 이 시기를 받쳐주고 있습니다. 무리하지 않고 자신의 페이스를 지키는 것이 중요합니다. 작은 것에 감사하며 현재에 충실한 하루를 보내세요.",
        ]
        return {'desc': descs[type_idx], 'tone': 'green'}

    # 상극: fortune이 useful을 극함 (주의)
    if SHENG_CYCLE[(idx_f + 2) % 5] == useful_element:
        descs = [
            "용신을 억누르는 기운이 강해지는 시기입니다. 계획한 일이 예상보다 더디게 진행되거나 주변의 방해를 받을 수 있습니다. 무리한 투자나 새로운 시작보다는 현상 유지에 집중하고, 건강과 체력 관리에도 신경 쓰는 것이 좋습니다.",
            "내 사주의 핵심 기운이 눌리는 시기입니다. 의욕이 앞서더라도 실행은 신중하게 하는 것이 좋습니다. 중요한 계약이나 결정은 이 시기를 피하거나 충분히 검토한 후 진행하세요.",
            "용신의 힘이 약해지는 기운이 흐릅니다. 평소보다 체력 소모가 크거나 집중력이 떨어질 수 있습니다. 무리한 일정을 줄이고 충분한 휴식을 취하며 에너지를 비축하는 것이 현명합니다.",
            "사주의 균형이 흔들릴 수 있는 시기입니다. 감정적인 판단보다는 이성적인 접근이 필요하며, 주변의 조언을 귀담아듣는 것이 도움이 됩니다. 작은 일에도 꼼꼼하게 확인하는 습관을 들이세요.",
        ]
        return {'desc': descs[type_idx], 'tone': 'yellow'}

    # 상극: useful이 fortune을 극함 (어려움)
    if SHENG_CYCLE[(idx_u + 2) % 5] == fortune_element:
        descs = [
            "용신에 의해 억제되는 기운이 흐르는 시기입니다. 예상치 못한 변수나 갈등이 생길 수 있으며 감정 소모가 클 수 있습니다. 중요한 결정은 신중하게 미루고, 충동적인 행동을 자제하며 주변 사람들과의 관계에서 오해가 생기지 않도록 소통에 주의하세요.",
            "이 시기의 기운이 사주와 충돌하는 흐름입니다. 원하는 방향으로 일이 잘 풀리지 않거나 주변과의 마찰이 생길 수 있습니다. 억지로 밀어붙이기보다 한 발 물러서서 상황을 관망하는 지혜가 필요합니다.",
            "기운의 충돌로 예상치 못한 변화가 생길 수 있는 시기입니다. 재정적인 지출이나 건강에 주의가 필요하며, 새로운 사람과의 관계에서도 신중함이 요구됩니다. 기존의 안전한 선택을 우선시하세요.",
            "사주의 흐름과 맞지 않는 기운이 작용하는 시기입니다. 작은 실수가 큰 문제로 이어질 수 있으니 매사에 꼼꼼하게 확인하는 것이 중요합니다. 무리한 계획보다는 오늘 할 수 있는 일에만 집중하세요.",
        ]
        return {'desc': descs[type_idx], 'tone': 'red'}

    return {'desc': "중립적인 기운의 시기입니다. 특별한 길흉보다는 평온한 흐름이 이어집니다.", 'tone': 'green'}

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
    """월주 산출 - 절기 기준 월 교체
    
    월지 고정 매핑:
    1월절(소한) → 축(丑,1), 2월절(입춘) → 인(寅,2), 3월절(경칩) → 묘(卯,3)
    4월절(청명) → 진(辰,4), 5월절(입하) → 사(巳,5), 6월절(망종) → 오(午,6)
    7월절(소서) → 미(未,7), 8월절(입추) → 신(申,8), 9월절(백로) → 유(酉,9)
    10월절(한로) → 술(戌,10), 11월절(입동) → 해(亥,11), 12월절(대설) → 자(子,0)
    """
    # 해당 월의 절입일 이전이면 전월로
    term_day = SOLAR_TERMS_APPROX[month - 1][2]
    if day < term_day:
        month -= 1
        if month == 0:
            month = 12

    # 월지 고정 매핑: 1월절=丑(1), 2월절=寅(2), ..., 11월절=亥(11), 12월절=子(0)
    MONTH_BRANCH = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6,
                    7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 0}
    branch_idx = MONTH_BRANCH[month]

    # 연주 천간 기준 월간 시작점 (갑기년→병인, 을경년→무인, 병신년→경인, 정임년→임인, 무계년→갑인)
    # 인월(2월절) 천간: 갑기=丙(2), 을경=戊(4), 병신=庚(6), 정임=壬(8), 무계=甲(0)
    year_stem_idx, _ = get_year_pillar(year, month, day)
    # 인월 천간 시작 인덱스
    yin_month_stem_start = [2, 4, 6, 8, 0]  # 갑기, 을경, 병신, 정임, 무계
    inweol_stem = yin_month_stem_start[year_stem_idx % 5]

    # 인월(branch=2)부터 순서대로 천간 배정
    # branch_idx 2=인, 3=묘, ..., 11=해, 0=자, 1=축
    month_order = (branch_idx - 2) % 12  # 인월=0, 묘월=1, ...
    stem_idx = (inweol_stem + month_order) % 10

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


def pillar_to_dict(stem_idx: Optional[int], branch_idx: Optional[int],
                   pillar_key: str = 'year', day_stem_idx: Optional[int] = None,
                   gender: str = 'male') -> dict:
    if stem_idx is None:
        return {"stem": None, "branch": None, "stem_kr": None, "branch_kr": None,
                "stem_element": None, "branch_element": None,
                "stem_color": None, "branch_color": None,
                "ten_god_stem": None, "ten_god_branch": None,
                "ten_god_stem_color": None, "ten_god_branch_color": None,
                "family_stem": None, "family_branch": None,
                "fortune_period": PILLAR_FORTUNE_PERIOD[pillar_key]['period'],
                "fortune_desc": PILLAR_FORTUNE_PERIOD[pillar_key]['desc']}
    stem = HEAVENLY_STEMS[stem_idx]
    branch = EARTHLY_BRANCHES[branch_idx]

    # 십신 계산 (일주 천간 기준, 일주 자신은 비견)
    ten_god_stem = None
    ten_god_branch_stem = None
    if day_stem_idx is not None:
        ten_god_stem = get_ten_god(day_stem_idx, stem_idx)
        # 지지 장간(藏干) 대표 천간으로 십신 계산 (지지 오행 → 대표 천간 인덱스)
        branch_rep_stem = {
            '子': 9, '丑': 5, '寅': 0, '卯': 1, '辰': 4, '巳': 3,
            '午': 2, '未': 5, '申': 6, '酉': 7, '戌': 4, '亥': 8,
        }
        rep_idx = branch_rep_stem.get(branch, stem_idx)
        ten_god_branch_stem = get_ten_god(day_stem_idx, rep_idx)

    family_stem = TEN_GOD_FAMILY.get(ten_god_stem, {}).get(gender) if ten_god_stem else None
    family_branch = TEN_GOD_FAMILY.get(ten_god_branch_stem, {}).get(gender) if ten_god_branch_stem else None

    return {
        "stem": stem,
        "branch": branch,
        "stem_kr": HEAVENLY_STEMS_KR[stem_idx],
        "branch_kr": EARTHLY_BRANCHES_KR[branch_idx],
        "stem_element": STEM_ELEMENT[stem],
        "branch_element": BRANCH_ELEMENT[branch],
        "yin_yang": STEM_YIN_YANG[stem_idx],
        "stem_color": STEM_COLOR.get(stem, '#666'),
        "branch_color": BRANCH_COLOR.get(branch, '#666'),
        "ten_god_stem": ten_god_stem,
        "ten_god_branch": ten_god_branch_stem,
        "ten_god_stem_color": TEN_GOD_COLOR.get(ten_god_stem, '#666') if ten_god_stem else None,
        "ten_god_branch_color": TEN_GOD_COLOR.get(ten_god_branch_stem, '#666') if ten_god_branch_stem else None,
        "family_stem": family_stem,
        "family_branch": family_branch,
        "fortune_period": PILLAR_FORTUNE_PERIOD[pillar_key]['period'],
        "fortune_desc": PILLAR_FORTUNE_PERIOD[pillar_key]['desc'],
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
    sheng_cycle = ['Wood', 'Fire', 'Earth', 'Metal', 'Water']
    weakest_idx = sheng_cycle.index(weakest)
    support = sheng_cycle[(weakest_idx - 1) % 5]

    useful_desc = {
        'Wood':  {
            'text': "목(木) 기운이 부족합니다. 목(木)은 성장·도전·창의의 에너지로, 이 기운을 보충하면 추진력과 새로운 시작의 힘이 강해집니다.",
            'tips': ['나무·식물 가까이', '초록색 계열', '동쪽 방향', '새벽 기상', '운동·스트레칭'],
        },
        'Fire':  {
            'text': "화(火) 기운이 부족합니다. 화(火)는 열정·표현·사교의 에너지로, 이 기운을 보충하면 자신감과 대인관계 운이 좋아집니다.",
            'tips': ['밝고 따뜻한 환경', '붉은색 계열', '남쪽 방향', '사람 많은 곳', '촛불·조명'],
        },
        'Earth': {
            'text': "토(土) 기운이 부족합니다. 토(土)는 안정·신뢰·중심의 에너지로, 이 기운을 보충하면 재물운과 건강운이 안정됩니다.",
            'tips': ['황토·흙 가까이', '노란색·갈색 계열', '중앙·중심부', '규칙적인 식사', '명상·요가'],
        },
        'Metal': {
            'text': "금(金) 기운이 부족합니다. 금(金)은 결단·원칙·집중의 에너지로, 이 기운을 보충하면 판단력과 실행력이 강해집니다.",
            'tips': ['금속 소품 활용', '흰색·은색 계열', '서쪽 방향', '정리정돈', '계획 세우기'],
        },
        'Water': {
            'text': "수(水) 기운이 부족합니다. 수(水)는 지혜·유연·통찰의 에너지로, 이 기운을 보충하면 직관력과 학습 능력이 높아집니다.",
            'tips': ['물 가까운 환경', '검정·파란색 계열', '북쪽 방향', '독서·공부', '충분한 수분 섭취'],
        },
    }

    avoid_desc = {
        'Wood':  "목(木)이 과다하여 고집과 충동이 강해질 수 있습니다.",
        'Fire':  "화(火)가 과다하여 감정 기복과 과소비에 주의가 필요합니다.",
        'Earth': "토(土)가 과다하여 변화에 둔감하고 답답함을 줄 수 있습니다.",
        'Metal': "금(金)이 과다하여 지나친 완벽주의와 냉정함이 나타날 수 있습니다.",
        'Water': "수(水)가 과다하여 우유부단함과 감정 과잉에 주의가 필요합니다.",
    }

    support_desc = {
        'Wood':  "수(水)는 목(木)을 생해주는 희신으로, 학습·여행·새로운 인연이 도움이 됩니다.",
        'Fire':  "목(木)은 화(火)를 생해주는 희신으로, 창의적 활동과 성장 환경이 도움이 됩니다.",
        'Earth': "화(火)는 토(土)를 생해주는 희신으로, 열정적인 활동과 사교가 도움이 됩니다.",
        'Metal': "토(土)는 금(金)을 생해주는 희신으로, 안정적인 기반과 꾸준한 노력이 도움이 됩니다.",
        'Water': "금(金)은 수(水)를 생해주는 희신으로, 원칙적이고 체계적인 환경이 도움이 됩니다.",
    }

    # 오행별 키워드 상태 분류
    total_count = sum(v['count'] for v in five_elements.values()) or 1
    element_status = []
    for elem, data in five_elements.items():
        pct = data['count'] / total_count
        if pct >= 0.35:
            state = 'excess'
        elif pct <= 0.1:
            state = 'lack'
        else:
            state = 'balanced'
        kw = ELEMENT_KEYWORDS[elem]
        element_status.append({
            'element': ELEMENT_KR[elem],
            'state': state,
            'keywords': kw['excess'] if state == 'excess' else (kw['lack'] if state == 'lack' else kw['positive']),
            'state_label': '과다' if state == 'excess' else ('부족' if state == 'lack' else '균형'),
        })

    return {
        'useful_god': ELEMENT_KR[weakest],
        'useful_god_element': weakest,
        'support_element': ELEMENT_KR[support],
        'avoid_element': ELEMENT_KR[strongest],
        'description': useful_desc[weakest]['text'],
        'description_tips': useful_desc[weakest]['tips'],
        'support_description': support_desc[weakest],
        'avoid_description': avoid_desc[strongest],
        'element_status': element_status,
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
            'element_raw': STEM_ELEMENT[HEAVENLY_STEMS[s_idx]],
        })
    return fortunes


def get_current_fortune(birth_year: int, major_fortunes: list[dict], useful_element: str) -> dict:
    """현재 대운·세운·월운·일운 반환"""
    now = datetime.now()
    current_year = now.year
    current_month = now.month
    current_day = now.day
    current_age = current_year - birth_year

    # 현재 대운 찾기
    current_major = major_fortunes[0]
    for f in major_fortunes:
        if f['age'] <= current_age:
            current_major = f

    # 세운 (올해 간지)
    annual_stem_idx = (current_year - 4) % 10
    annual_branch_idx = (current_year - 4) % 12

    # 월운 (이번 달 월주)
    m_stem, m_branch = get_month_pillar(current_year, current_month, current_day)

    # 일운 (오늘 일주)
    d_stem, d_branch = get_day_pillar(current_year, current_month, current_day)

    major_rel   = get_relation_desc(current_major['element_raw'], useful_element, 'major')
    annual_rel  = get_relation_desc(STEM_ELEMENT[HEAVENLY_STEMS[annual_stem_idx]], useful_element, 'annual')
    monthly_rel = get_relation_desc(STEM_ELEMENT[HEAVENLY_STEMS[m_stem]], useful_element, 'monthly')
    daily_rel   = get_relation_desc(STEM_ELEMENT[HEAVENLY_STEMS[d_stem]], useful_element, 'daily')

    return {
        'current_age': current_age,
        'major_fortune': {
            **current_major,
            'desc': major_rel['desc'],
            'tone': major_rel['tone'],
        },
        'annual_fortune': {
            'year': current_year,
            'stem': HEAVENLY_STEMS[annual_stem_idx],
            'branch': EARTHLY_BRANCHES[annual_branch_idx],
            'stem_kr': HEAVENLY_STEMS_KR[annual_stem_idx],
            'branch_kr': EARTHLY_BRANCHES_KR[annual_branch_idx],
            'element': ELEMENT_KR[STEM_ELEMENT[HEAVENLY_STEMS[annual_stem_idx]]],
            'desc': annual_rel['desc'],
            'tone': annual_rel['tone'],
        },
        'monthly_fortune': {
            'month': current_month,
            'stem': HEAVENLY_STEMS[m_stem],
            'branch': EARTHLY_BRANCHES[m_branch],
            'stem_kr': HEAVENLY_STEMS_KR[m_stem],
            'branch_kr': EARTHLY_BRANCHES_KR[m_branch],
            'element': ELEMENT_KR[STEM_ELEMENT[HEAVENLY_STEMS[m_stem]]],
            'desc': monthly_rel['desc'],
            'tone': monthly_rel['tone'],
        },
        'daily_fortune': {
            'date': f"{current_year}-{current_month:02d}-{current_day:02d}",
            'stem': HEAVENLY_STEMS[d_stem],
            'branch': EARTHLY_BRANCHES[d_branch],
            'stem_kr': HEAVENLY_STEMS_KR[d_stem],
            'branch_kr': EARTHLY_BRANCHES_KR[d_branch],
            'element': ELEMENT_KR[STEM_ELEMENT[HEAVENLY_STEMS[d_stem]]],
            'desc': daily_rel['desc'],
            'tone': daily_rel['tone'],
        },
    }


def get_personality_profile(five_elements: dict, day_stem_idx: int) -> dict:
    """성격·적성 요약"""
    dominant = max(five_elements.items(), key=lambda x: x[1]['count'])[0]
    profiles = {
        'Wood': {
            'personality': '진취적이고 창의적이며 성장 지향적입니다. 새로운 것을 시작하는 데 강하고, 도전을 두려워하지 않는 개척자 기질이 있습니다. 경쟁심이 강하고 자존심이 높아 쉽게 굽히지 않으며, 한번 목표를 세우면 끝까지 밀어붙이는 추진력이 있습니다. 다만 고집이 세고 융통성이 부족할 수 있어 타인과의 조율이 중요합니다.',
            'strength': '리더십, 창의력, 추진력, 도전정신',
            'career': '기획, 창업, 교육, 스포츠, 정치',
        },
        'Fire': {
            'personality': '열정적이고 표현력이 강하며 사교적입니다. 사람들을 이끄는 카리스마가 있고, 어디서든 주목받는 존재감을 발휘합니다. 감수성이 풍부하고 직관이 뛰어나 예술적 재능을 타고난 경우가 많습니다. 감정 기복이 있을 수 있고 충동적인 면이 있어 냉정한 판단이 필요한 순간에는 한 발 물러서는 연습이 도움이 됩니다.',
            'strength': '표현력, 열정, 사교성, 직관력, 카리스마',
            'career': '예술, 방송, 영업, 정치, 연예, 강연',
        },
        'Earth': {
            'personality': '안정적이고 신뢰감이 있으며 현실적입니다. 중재자 역할을 잘 하고, 주변 사람들에게 든든한 버팀목이 되어줍니다. 성실하고 책임감이 강해 맡은 일을 끝까지 완수하는 편입니다. 변화보다는 안정을 선호하고 보수적인 성향이 있어 새로운 환경에 적응하는 데 시간이 걸릴 수 있습니다.',
            'strength': '신뢰성, 안정감, 포용력, 성실함, 책임감',
            'career': '금융, 부동산, 행정, 의료, 농업, 요식업',
        },
        'Metal': {
            'personality': '원칙적이고 결단력이 있으며 완벽주의 성향이 있습니다. 옳고 그름에 대한 기준이 명확하고, 불의를 참지 못하는 정의로운 면이 있습니다. 논리적이고 분석적인 사고로 복잡한 문제를 명쾌하게 해결하는 능력이 뛰어납니다. 다만 지나친 완벽주의로 스트레스를 받거나 타인에게 엄격하게 보일 수 있어 유연함을 기르는 것이 중요합니다.',
            'strength': '결단력, 정확성, 원칙, 논리력, 정의감',
            'career': '법조, 군경, 엔지니어링, 회계, 외과, 금융',
        },
        'Water': {
            'personality': '지혜롭고 유연하며 직관력이 뛰어납니다. 상황 적응력이 강하고 눈치가 빨라 어떤 환경에서도 자신의 자리를 찾아냅니다. 깊은 사색을 즐기고 철학적인 면이 있어 남들이 보지 못하는 본질을 꿰뚫는 통찰력이 있습니다. 우유부단하거나 감정을 지나치게 내면에 담아두는 경향이 있어 적극적인 표현이 도움이 됩니다.',
            'strength': '지혜, 유연성, 직관력, 통찰력, 적응력',
            'career': '연구, IT, 철학, 무역, 심리상담, 작가',
        },
    }
    return {
        'dominant_element': ELEMENT_KR[dominant],
        **profiles.get(dominant, profiles['Earth'])
    }


# =============================================================================
# 신살 (神殺) 계산
# =============================================================================
# 신살 (神殺) 계산
# =============================================================================

# 삼합 그룹 → 도화/역마/화개/망신 타겟
_SAMHAP_GROUPS = [
    {'members': {'申', '子', '辰'}, 'dowhwa': '酉', 'yeokma': '寅', 'hwagae': '辰', 'mangsin': '酉'},
    {'members': {'寅', '午', '戌'}, 'dowhwa': '卯', 'yeokma': '申', 'hwagae': '戌', 'mangsin': '卯'},
    {'members': {'亥', '卯', '未'}, 'dowhwa': '子', 'yeokma': '巳', 'hwagae': '未', 'mangsin': '子'},
    {'members': {'巳', '酉', '丑'}, 'dowhwa': '午', 'yeokma': '亥', 'hwagae': '丑', 'mangsin': '午'},
]

# 원진살 쌍
_WONJIN_PAIRS = [{'子', '未'}, {'丑', '午'}, {'寅', '巳'}, {'卯', '辰'}, {'申', '亥'}, {'酉', '戌'}]

# 충(沖) 쌍
_CHUNG_PAIRS = [{'子', '午'}, {'丑', '未'}, {'寅', '申'}, {'卯', '酉'}, {'辰', '戌'}, {'巳', '亥'}]

# 형살 그룹
_HYEONG_GROUPS = [{'寅', '巳', '申'}, {'丑', '戌', '未'}, {'子', '卯'}]

# 괴강살 일주
_GOEGANG_PILLARS = {'庚辰', '壬辰', '庚戌', '壬戌'}

# 양인살: 일간 → 지지
_YANGIN_MAP = {
    '甲': '卯', '乙': '寅', '丙': '午', '丁': '巳',
    '戊': '午', '己': '巳', '庚': '酉', '辛': '申',
    '壬': '子', '癸': '亥',
}

# 백호대살: 일지와 충 관계 (子午 / 丑未 / 寅申 / 卯酉 / 辰戌 / 巳亥)
_BAEKHO_CHUNG = {'子': '午', '午': '子', '丑': '未', '未': '丑',
                 '寅': '申', '申': '寅', '卯': '酉', '酉': '卯',
                 '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳'}

# 현침살: 辰戌丑未 중 2개 이상
_HYEONCHIM_BRANCHES = {'辰', '戌', '丑', '未'}

# 천덕귀인: 월지 기준 천간
_CHEONDEOK_MAP = {
    '寅': '丁', '卯': '申', '辰': '壬', '巳': '辛',
    '午': '亥', '未': '甲', '申': '癸', '酉': '寅',
    '戌': '丙', '亥': '乙', '子': '巳', '丑': '庚',
}

# 월덕귀인: 월지 삼합 기준 천간
_WOLDEOK_MAP = {
    '寅': '丙', '午': '丙', '戌': '丙',  # 寅午戌 → 丙
    '申': '壬', '子': '壬', '辰': '壬',  # 申子辰 → 壬
    '亥': '甲', '卯': '甲', '未': '甲',  # 亥卯未 → 甲
    '巳': '庚', '酉': '庚', '丑': '庚',  # 巳酉丑 → 庚
}

# 공망(空亡): 60갑자 기준 일주 → 공망 지지 2개
_GONGMANG_TABLE = {
    '甲子': ('戌', '亥'), '甲戌': ('申', '酉'), '甲申': ('午', '未'),
    '甲午': ('辰', '巳'), '甲辰': ('寅', '卯'), '甲寅': ('子', '丑'),
    '乙丑': ('戌', '亥'), '乙亥': ('申', '酉'), '乙酉': ('午', '未'),
    '乙未': ('辰', '巳'), '乙巳': ('寅', '卯'), '乙卯': ('子', '丑'),
    '丙寅': ('戌', '亥'), '丙子': ('申', '酉'), '丙戌': ('午', '未'),
    '丙申': ('辰', '巳'), '丙午': ('寅', '卯'), '丙辰': ('子', '丑'),
    '丁卯': ('戌', '亥'), '丁丑': ('申', '酉'), '丁亥': ('午', '未'),
    '丁酉': ('辰', '巳'), '丁未': ('寅', '卯'), '丁巳': ('子', '丑'),
    '戊辰': ('戌', '亥'), '戊寅': ('申', '酉'), '戊子': ('午', '未'),
    '戊戌': ('辰', '巳'), '戊申': ('寅', '卯'), '戊午': ('子', '丑'),
    '己巳': ('戌', '亥'), '己卯': ('申', '酉'), '己丑': ('午', '未'),
    '己亥': ('辰', '巳'), '己酉': ('寅', '卯'), '己未': ('子', '丑'),
    '庚午': ('戌', '亥'), '庚辰': ('申', '酉'), '庚寅': ('午', '未'),
    '庚子': ('辰', '巳'), '庚戌': ('寅', '卯'), '庚申': ('子', '丑'),
    '辛未': ('戌', '亥'), '辛巳': ('申', '酉'), '辛卯': ('午', '未'),
    '辛丑': ('辰', '巳'), '辛亥': ('寅', '卯'), '辛酉': ('子', '丑'),
    '壬申': ('戌', '亥'), '壬午': ('申', '酉'), '壬辰': ('午', '未'),
    '壬寅': ('辰', '巳'), '壬子': ('寅', '卯'), '壬戌': ('子', '丑'),
    '癸酉': ('戌', '亥'), '癸未': ('申', '酉'), '癸巳': ('午', '未'),
    '癸卯': ('辰', '巳'), '癸丑': ('寅', '卯'), '癸亥': ('子', '丑'),
}

SAL_INFO = {
    '도화살':   {'desc': '사람을 끄는 자력이 있습니다. 시선이 몰리고 관계 이슈가 많습니다. 외모뿐 아니라 분위기·말투·감정선까지 매혹 포인트가 됩니다. 강하면 연애사도 많고 구설도 따라옵니다. 예술·마케팅·방송 쪽에 쓰면 강점이 됩니다.', 'emoji': '🌸'},
    '역마살':   {'desc': '정착보다 이동에서 기회가 생깁니다. 이직·출장·해외 인연·이사가 잦습니다. 한곳에 오래 있으면 답답함을 느낍니다. 잘 쓰면 글로벌형 커리어, 못 쓰면 방황으로 이어집니다.', 'emoji': '🐎'},
    '화개살':   {'desc': '고독의 방이 하나 있습니다. 혼자 사색해야 에너지가 충전됩니다. 예술·철학·종교·연구 적성이 있습니다. 인간관계가 얕게 많기보다 깊게 적은 편입니다. 강하면 고립감으로 이어질 수 있습니다.', 'emoji': '🎨'},
    '원진살':   {'desc': '설명하기 힘든 감정 꼬임이 있습니다. 처음엔 끌리는데 오래가면 피곤한 관계가 됩니다. 연애·동업에서 감정 소모가 큽니다. 대신 인간 심리를 꿰뚫는 통찰력이 뛰어납니다.', 'emoji': '🌀'},
    '충(沖)':   {'desc': '깨짐과 이동의 에너지입니다. 갑작스러운 변화와 계획 수정이 따릅니다. 단순한 사고라기보다 "판이 뒤집히는" 느낌입니다. 사업·직장에 있으면 구조조정·이사·역할 변경 등으로 나타납니다.', 'emoji': '💥'},
    '형살':     {'desc': '외부 폭발보다 내부 마찰이 큽니다. 스스로를 몰아붙이거나 인간관계에서 미묘한 긴장이 생깁니다. 예민함이 장점이 되면 디테일에 강한 장인 기질로 발휘됩니다.', 'emoji': '⚠️'},
    '괴강살':   {'desc': '극단적 추진력이 있습니다. 흑백이 분명하고 리더·법·군·기술직에 강합니다. 감정이 아니라 원칙으로 움직입니다. 부드러움이 부족하면 독선처럼 보일 수 있습니다.', 'emoji': '👑'},
    '양인살':   {'desc': '기세와 자존심이 강합니다. 통제받기 싫어하고 추진력과 승부욕이 넘칩니다. 운동선수·사업가 기질이 있습니다. 감정 조절이 안 되면 관계 충돌로 이어집니다.', 'emoji': '⚔️'},
    '백호대살': {'desc': '결단이 빠르고 위기에서 강해집니다. 의료·군·구조 직군 적성이 있습니다. 과감한 선택을 두려워하지 않습니다. 무모함과 한 끗 차이이므로 신중함이 필요합니다.', 'emoji': '🐯'},
    '현침살':   {'desc': '말과 글이 칼끝처럼 정확합니다. 분석·비판·토론에 강합니다. 감정이 섞이면 상처도 잘 남기므로 표현 방식에 주의가 필요합니다.', 'emoji': '🪡'},
    '천덕귀인': {'desc': '위기 때 보호막이 생깁니다. 큰 사고로 번지지 않는 구조를 타고났습니다. 윗사람 복이 있고 어려운 순간에 뜻밖의 조력자가 나타납니다.', 'emoji': '✨'},
    '월덕귀인': {'desc': '인간관계 완충 능력이 있습니다. 갈등이 커지지 않고 주변에서 은근히 도와주는 사람이 생깁니다. 관계의 마찰을 자연스럽게 흡수하는 복이 있습니다.', 'emoji': '🌙'},
    '공망':     {'desc': '기대한 게 비어 있는 느낌이 있습니다. 특정 영역에서 허탈감이 반복됩니다. 대신 집착을 줄이면 자유로워지고, 철학적으로 성숙해지는 계기가 됩니다.', 'emoji': '🕳️'},
    '망신살':   {'desc': '체면·구설 이슈가 생기기 쉽습니다. 이미지 관리가 필요합니다. 대신 대중 노출 직업에서는 오히려 활용 가능한 에너지가 됩니다.', 'emoji': '😶'},
}


def _get_samhap_group(branch: str) -> Optional[dict]:
    """지지가 속한 삼합 그룹 반환"""
    for g in _SAMHAP_GROUPS:
        if branch in g['members']:
            return g
    return None


def calc_special_stars(
    day_stem_idx: int,
    day_branch_idx: int,
    year_stem_idx: int,
    year_branch_idx: int,
    month_stem_idx: int,
    month_branch_idx: int,
    hour_stem_idx: Optional[int],
    hour_branch_idx: Optional[int],
) -> list[dict]:
    """신살(神殺) 계산"""
    results = []

    day_stem   = HEAVENLY_STEMS[day_stem_idx]
    day_branch = EARTHLY_BRANCHES[day_branch_idx]
    month_branch = EARTHLY_BRANCHES[month_branch_idx]

    # 전체 지지 목록
    branch_idxs = [year_branch_idx, month_branch_idx, day_branch_idx]
    if hour_branch_idx is not None:
        branch_idxs.append(hour_branch_idx)
    branch_chars = [EARTHLY_BRANCHES[b] for b in branch_idxs]
    branch_set   = set(branch_chars)

    # 전체 천간 목록
    stem_idxs = [year_stem_idx, month_stem_idx, day_stem_idx]
    if hour_stem_idx is not None:
        stem_idxs.append(hour_stem_idx)
    stem_chars = [HEAVENLY_STEMS[s] for s in stem_idxs]
    stem_set   = set(stem_chars)

    # ── 삼합 기반 살 (일지 기준 삼합 그룹) ──────────────────────────────
    group = _get_samhap_group(day_branch)
    if group:
        if group['dowhwa'] in branch_set:
            results.append({'name': '도화살(桃花殺)', **SAL_INFO['도화살']})
        if group['yeokma'] in branch_set:
            results.append({'name': '역마살(驛馬殺)', **SAL_INFO['역마살']})
        if group['hwagae'] in branch_set:
            results.append({'name': '화개살(華蓋殺)', **SAL_INFO['화개살']})
        if group['mangsin'] in branch_set and group['mangsin'] != day_branch:
            results.append({'name': '망신살(亡身殺)', **SAL_INFO['망신살']})

    # ── 원진살 ────────────────────────────────────────────────────────────
    for pair in _WONJIN_PAIRS:
        if pair.issubset(branch_set):
            results.append({'name': '원진살(怨嗔殺)', **SAL_INFO['원진살']})
            break

    # ── 충(沖) ────────────────────────────────────────────────────────────
    for pair in _CHUNG_PAIRS:
        if pair.issubset(branch_set):
            results.append({'name': '충(沖)', **SAL_INFO['충(沖)']})
            break

    # ── 형살 ─────────────────────────────────────────────────────────────
    for grp in _HYEONG_GROUPS:
        if grp.issubset(branch_set):
            results.append({'name': '형살(刑殺)', **SAL_INFO['형살']})
            break

    # ── 괴강살 (일주 기준) ────────────────────────────────────────────────
    if (day_stem + day_branch) in _GOEGANG_PILLARS:
        results.append({'name': '괴강살(魁罡殺)', **SAL_INFO['괴강살']})

    # ── 양인살 (일간 기준) ────────────────────────────────────────────────
    yangin_target = _YANGIN_MAP.get(day_stem)
    if yangin_target and yangin_target in branch_set:
        results.append({'name': '양인살(羊刃殺)', **SAL_INFO['양인살']})

    # ── 백호대살 (일지와 충 관계 지지가 사주에 존재) ─────────────────────
    baekho_target = _BAEKHO_CHUNG.get(day_branch)
    if baekho_target and baekho_target in branch_set:
        results.append({'name': '백호대살(白虎大殺)', **SAL_INFO['백호대살']})

    # ── 현침살 (辰戌丑未 2개 이상) ───────────────────────────────────────
    if len(_HYEONCHIM_BRANCHES & branch_set) >= 2:
        results.append({'name': '현침살(懸針殺)', **SAL_INFO['현침살']})

    # ── 천덕귀인 (월지 기준 해당 천간 존재) ──────────────────────────────
    cheondeok_target = _CHEONDEOK_MAP.get(month_branch)
    if cheondeok_target and cheondeok_target in stem_set:
        results.append({'name': '천덕귀인(天德貴人)', **SAL_INFO['천덕귀인']})

    # ── 월덕귀인 (월지 삼합 기준 천간 존재) ──────────────────────────────
    woldeok_target = _WOLDEOK_MAP.get(month_branch)
    if woldeok_target and woldeok_target in stem_set:
        results.append({'name': '월덕귀인(月德貴人)', **SAL_INFO['월덕귀인']})

    # ── 공망 (일주 기준 60갑자표) ────────────────────────────────────────
    gongmang_pair = _GONGMANG_TABLE.get(day_stem + day_branch)
    if gongmang_pair:
        gongmang_hit = set(gongmang_pair) & branch_set
        if gongmang_hit:
            results.append({'name': '공망(空亡)', **SAL_INFO['공망']})

    return results


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
        if not (1900 <= birth_year <= 2100 and 1 <= birth_month <= 12 and 1 <= birth_day <= 31):
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

        year_pillar  = pillar_to_dict(y_stem, y_branch, 'year',  d_stem, gender)
        month_pillar = pillar_to_dict(m_stem, m_branch, 'month', d_stem, gender)
        day_pillar   = pillar_to_dict(d_stem, d_branch, 'day',   d_stem, gender)
        hour_pillar  = pillar_to_dict(h_stem, h_branch, 'hour',  d_stem, gender)

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
        current_fortune = get_current_fortune(birth_year, major_fortunes, useful_god['useful_god_element'])

        # 성격 프로필
        personality = get_personality_profile(five_elements, d_stem)

        # 신살
        special_stars = calc_special_stars(
            d_stem, d_branch,
            y_stem, y_branch,
            m_stem, m_branch,
            h_stem, h_branch,
        )

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
            'special_stars': special_stars,
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
