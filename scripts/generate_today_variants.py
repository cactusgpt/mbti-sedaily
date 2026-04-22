"""
오늘의 운세 카테고리 설명 추가 variant 생성
- 기존 today-parts.json의 category 섹션을 배열 구조로 확장
- 각 (카테고리, MBTI, 십성) 셀마다 총 3개 variant 보유
- 기존 1개 + 신규 2개 생성 = 400 추가 호출
"""
import json
import boto3
import concurrent.futures
from pathlib import Path
from botocore.config import Config
from threading import Lock

BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0'
BEDROCK_REGION = 'us-east-1'
OUTPUT_FILE = Path(__file__).parent.parent / 'frontend-next' / 'public' / 'saju-cache' / 'today-parts.json'

progress_lock = Lock()

MBTI_PERSONAS = {
    'NT': """당신은 사주명리학 전문가이자 '분석가' 성향의 해석자입니다.
성격 특성: 논리적이고 분석적, 핵심을 구조화, 데이터와 근거 중시, 효율적 커뮤니케이션.
말투: 간결하고 핵심적, "~입니다", 넘버링 선호, 분석적 관점.
예시: "핵심 포인트를 정리하면 다음과 같습니다."
""",
    'NF': """당신은 사주명리학 전문가이자 '이야기꾼' 성향의 해석자입니다.
성격 특성: 성찰적이고 의미 중시, 사람과 가치 관심, 큰 그림 파악, 공감과 이해.
말투: 따뜻하고 사려 깊음, "~이에요", 의미와 배경 함께, 질문을 통해 생각 유도.
예시: "이 기운이 담고 있는 의미를 함께 생각해볼까요?"
""",
    'ST': """당신은 사주명리학 전문가이자 '실용주의자' 성향의 해석자입니다.
성격 특성: 정확하고 체계적, 사실과 데이터 집중, 실용적 정보 중시, 신뢰할 수 있는 정보.
말투: 명확하고 정확, "~입니다"/"~습니다" 격식체, 체크리스트 형태 선호.
주의: "확인된 바에 따르면", "분석됩니다" 같은 AI 보고서 투의 상투어는 피하고, 바로 본론으로 들어가세요.
""",
    'SF': """당신은 사주명리학 전문가이자 '공감러' 성향의 해석자입니다.
성격 특성: 친근하고 공감, 어려운 것도 쉽게, 실생활 연결, 독자와 소통.
말투: 친구처럼 편안한 말투, "~해요"/"~거든요", 비유와 예시 활용, 이모지 자연스럽게.
예시: "쉽게 말하면요, 이건 이런 느낌이에요!"
""",
}

# 베이스 카테고리 텍스트 (engine.ts와 동일)
CATEGORY_BASE = {
    '재물운': {
        '비견': '같은 분야에 있는 동료나 경쟁자와 부딪치면서 뜻하지 않은 지출이 생길 수 있는 날입니다. 친구나 지인의 부탁으로 돈이 나갈 수 있으니 거절할 때는 확실하게 하고, 공동 투자나 동업보다는 자기만의 판단으로 움직이는 것이 훨씬 유리합니다.',
        '겁재': '충동적인 소비 욕구가 올라오고 예상치 못한 지출이 발생하기 쉬운 날입니다. 세일이나 광고에 쉽게 흔들리고, 남에게 돈을 빌려주거나 보증을 서는 일이 생기면 손해로 이어질 수 있습니다.',
        '식신': '여유로운 마음에서 자연스럽게 수입이 따라오는 날입니다. 먹고 마시는 데 쓰는 비용이 늘지만 그만큼 만족감이 크고, 취미나 관심사가 수익으로 연결될 가능성도 보입니다.',
        '상관': '아이디어나 표현력으로 돈을 벌 수 있는 기회가 열리지만, 말 한마디 실수로 계약이 어긋날 수 있는 날입니다. 계약서·견적서는 숫자와 조건을 한 번 더 확인하세요.',
        '편재': '투자·사업·부업 등 활동적인 재물의 흐름이 강해지는 날입니다. 새로운 수익원이 눈에 들어오고 사교 자리에서 좋은 기회가 연결될 수 있으니 적극적으로 움직여보세요.',
        '정재': '꾸준히 쌓아온 노력이 숫자로 돌아오는 안정적인 날입니다. 월급·이자·렌트 수입 같은 정기 수입이 원활하고, 저축이나 장기 재테크에 하나를 더 얹기 좋은 타이밍입니다.',
        '편관': '예상 밖의 비용이 갑자기 튀어나올 수 있는 날입니다. 세금, 벌금, 수리비, 의료비 등 의무적 지출이 발생할 가능성이 있으니 비상금을 미리 점검해 두세요.',
        '정관': '규칙적이고 투명한 재정 관리가 빛을 발하는 날입니다. 회사나 공공 경로를 통한 수입, 계약서 기반의 거래가 안정적으로 진행되며, 공식적인 절차를 거친 돈의 흐름이 좋은 결과를 가져옵니다.',
        '편인': '직관이 날카로워져 평소 보이지 않던 투자 포인트가 눈에 들어올 수 있는 날입니다. 다만 근거 없이 감만으로 큰돈을 움직이면 손실로 돌아올 수 있으니, 데이터나 전문가 의견으로 한 번 더 검증하세요.',
        '정인': '윗사람이나 부모, 스승으로부터 재정적 도움이나 조언을 받기 좋은 날입니다. 교육·자격증·책 등 지식에 쓰는 돈은 장기적으로 이자가 붙어 돌아올 가능성이 높습니다.',
    },
    '건강운': {
        '비견': '체력은 평소보다 좋은 편이지만, 경쟁심이나 승부욕 때문에 무리하기 쉬운 날입니다. 운동을 할 때 남과 비교해 강도를 올리기보다 본인 페이스를 지키세요.',
        '겁재': '스트레스가 몸으로 나타날 수 있는 날입니다. 두통, 소화 불량, 장 트러블 같은 증상이 올 수 있으니 과음·과식을 피하고 자극적인 음식을 줄이세요.',
        '식신': '전반적으로 컨디션이 좋고 식욕과 소화력도 원활한 날입니다. 좋아하는 사람과 함께하는 건강한 식사가 기분을 더욱 끌어올려 줍니다.',
        '상관': '신경이 예민해져 불면, 두통, 목·어깨 결림이 올 수 있는 날입니다. 말을 많이 하는 자리에서 에너지 소모가 크니 중간중간 조용한 시간을 확보해 주세요.',
        '편재': '활동량이 많아지는 날로 야외 활동이나 운동에 적합합니다. 걷기·등산·자전거 같은 유산소 운동으로 에너지를 발산하면 기분도 함께 맑아집니다.',
        '정재': '규칙적인 생활 리듬이 그대로 건강으로 이어지는 날입니다. 식사·수면 시간을 정해두고 가벼운 스트레칭이나 홈트를 꾸준히 하면 몸이 한결 가벼워집니다.',
        '편관': '긴장과 압박으로 몸이 경직되기 쉬운 날입니다. 뒷목, 어깨, 허리가 뭉치고 혈압이 오를 수 있으니 의식적으로 호흡을 깊게 하고 쉬는 시간을 자주 가지세요.',
        '정관': '절제된 생활이 건강의 비결이 되는 날입니다. 정해진 시간에 식사하고 일찍 잠자리에 드는 것만으로도 컨디션이 안정적으로 유지됩니다.',
        '편인': '정신적 피로가 몸의 피로보다 크게 느껴질 수 있는 날입니다. 생각이 많아져 눈의 피로, 두통, 소화 불량이 겹쳐 올 수 있으니 스크린 타임을 줄이세요.',
        '정인': '심신이 안정되고 회복력이 좋아지는 날입니다. 충분한 수면과 균형 잡힌 식사로 몸을 돌보면 그동안 쌓였던 피로가 풀리는 것이 느껴집니다.',
    },
    '연애운': {
        '비견': '상대와 주도권 다툼이 생기기 쉬운 날입니다. 서로 고집을 내세우면 작은 일이 크게 번질 수 있으니, 오늘은 한 발 물러서 상대의 입장을 먼저 들어주세요.',
        '겁재': '연인 사이에 질투와 의심이 고개를 드는 날입니다. 상대의 사소한 행동이 크게 보일 수 있으니 감정적으로 반응하기 전 사실부터 확인하세요.',
        '식신': '편안하고 즐거운 데이트가 어울리는 날입니다. 맛집에 가거나 함께 요리를 해보는 것만으로도 행복이 배가 됩니다.',
        '상관': '감정 표현이 풍부해지는 날이지만, 너무 직설적이거나 비판적으로 말하면 상대에게 상처가 될 수 있습니다. 할 말이 있다면 "나는 이렇게 느꼈어" 방식으로 전달해 보세요.',
        '편재': '새로운 만남의 기회가 열리는 날입니다. 사교 모임, 동호회, 지인 소개 등 평소와 다른 자리에서 매력적인 인연을 만날 수 있습니다.',
        '정재': '진심과 정성이 통하는 날입니다. 화려한 이벤트보다 손편지, 도시락, 작은 선물처럼 꾸준한 마음이 드러나는 표현이 더 큰 감동을 줍니다.',
        '편관': '관계에서 부담이나 압박을 느낄 수 있는 날입니다. 오늘은 서로의 공간을 인정하는 것이 오히려 관계를 깊게 만드는 길이니, 거리감을 죄책감 없이 유지해 보세요.',
        '정관': '격식을 갖춘 만남, 진지한 대화가 잘 어울리는 날입니다. 상견례, 가족 모임, 미래를 논의하는 진중한 자리라면 좋은 인상을 남기기 쉽습니다.',
        '편인': '상대방의 내면을 깊이 이해하게 되는 특별한 날입니다. 조용한 카페, 산책길, 별을 보는 곳처럼 차분한 분위기에서 둘만의 대화가 예상보다 깊어질 수 있습니다.',
        '정인': '따뜻한 감정이 자연스럽게 흐르는 날입니다. 연인과 가족 같은 편안함이 느껴지고, 함께 있는 것만으로 안정감이 커집니다.',
    },
    '직장운': {
        '비견': '동료와 협업하며 역할을 나눠 일하기 좋은 날입니다. 각자 잘하는 영역을 명확히 하면 시너지가 나지만, 영역이 겹치면 갈등으로 이어지기 쉬우니 오늘 중 R&R을 다시 정리해 두세요.',
        '겁재': '직장 내 경쟁이 심해지고, 믿었던 사람에게서 섭섭함을 느낄 수 있는 날입니다. 뒷말이나 정치적 분위기에 휘말리지 말고, 가시적인 결과물로 승부하는 것이 최선입니다.',
        '식신': '창의적 아이디어와 여유로운 태도가 인정받는 날입니다. 브레인스토밍 미팅에서 좋은 발상이 떠오르고, 부드러운 분위기 속에서 팀 분위기도 한결 가벼워집니다.',
        '상관': '상사나 동료에게 날카로운 말이 튀어나올 수 있는 날입니다. 맞는 말이라도 표현이 공격적이면 반감을 사기 쉬우니, 비판은 대안과 함께 묶어서 말하세요.',
        '편재': '영업·마케팅·대외 활동에서 성과가 나기 좋은 날입니다. 외부 미팅, 네트워킹 이벤트, 거래처 방문 등 사람을 만나는 일정이 생산적입니다.',
        '정재': '꼼꼼한 실무 처리가 빛나는 날입니다. 보고서·기획안·숫자 작업에 집중하면 좋은 평가가 따라오고, 상사의 디테일한 피드백도 긍정적으로 돌아옵니다.',
        '편관': '갑작스러운 업무 변동이나 상사의 긴급 지시가 날아올 수 있는 날입니다. 당황하지 말고 우선순위를 즉시 재정렬하고, 처리하지 못한 일은 솔직하게 커뮤니케이션해 기한을 조정하세요.',
        '정관': '조직 안에서 인정받기 좋은 날입니다. 규정·절차를 충실히 따르며 공식적인 루트로 일을 진행하면 승진·평가·보너스로 연결될 가능성이 있습니다.',
        '편인': '새로운 기술·방법론·도구를 업무에 적용하기 좋은 날입니다. 평소 배우고 싶었던 프로그램을 공부하거나, 기존 프로세스를 개선하는 아이디어를 실험해 보세요.',
        '정인': '멘토·선배·상사의 조언이 크게 도움이 되는 날입니다. 혼자 끌어안고 고민하지 말고 믿을 만한 선배에게 커피 한 잔 청해 보세요.',
    },
    '학업운': {
        '비견': '스터디 그룹이나 토론에서 서로 자극을 주고받기 좋은 날입니다. 혼자 공부할 땐 놓쳤던 포인트를 친구들과 맞춰보며 빈틈을 채울 수 있고, 같은 목표를 가진 사람들과 나누는 시간이 집중력도 끌어올립니다.',
        '겁재': '집중력이 쉽게 흐트러지고 유혹이 많아지는 날입니다. SNS·게임·쇼핑 광고에 시간이 훌쩍 빠질 수 있으니, 스마트폰을 다른 방에 두거나 앱을 잠그는 장치를 활용하세요.',
        '식신': '이해력과 흡수력이 좋아 새로운 과목에 도전하기 좋은 날입니다. 어려웠던 개념도 오늘 차분히 읽으면 술술 들어오니, 미뤄뒀던 챕터를 펼쳐 보세요.',
        '상관': '비판적 사고와 표현력이 살아나는 날입니다. 에세이, 논술, 서술형 문제에 강점을 발휘할 수 있으니 글쓰기 위주의 학습을 배치해 보세요.',
        '편재': '실용적인 공부가 잘 되는 날입니다. 자격증, 실무 스킬, 어학 회화 등 바로 써먹을 수 있는 분야에 시간을 투자하세요.',
        '정재': '꼼꼼한 복습과 정리가 효과적인 날입니다. 암기 과목이나 공식, 개념 정리 노트 만들기에 시간을 투자하면 오래 남는 지식으로 자리 잡습니다.',
        '편관': '시험 압박감이나 성적에 대한 불안이 크게 느껴질 수 있는 날입니다. 완벽을 추구하다 손도 못 대는 것보다, 출제 빈도 높은 핵심만 먼저 잡는 전략이 필요합니다.',
        '정관': '체계적 학습 계획이 효과를 발휘하는 날입니다. 시간표를 짜서 꾸준히 공부하면 성과가 잘 쌓이고, 정해진 틀 안에서 움직일 때 안정감을 느낄 수 있습니다.',
        '편인': '직관과 영감이 뛰어나게 작동하는 날입니다. 창의적 문제 해결, 연구, 논문 분석, 예술 창작 등 남다른 관점이 필요한 작업에 몰입하기 좋습니다.',
        '정인': '학습 능력이 최고조에 이르는 날로, 새로운 지식을 흡수하기에 이보다 좋은 타이밍이 없습니다. 집중 공부로 중요한 단원을 정리하거나, 평소 어렵다고 느꼈던 분야에 도전해 보세요.',
    },
}

VARIANT_INSTRUCTIONS = [
    # variant 1: 다른 관점/예시로 접근
    "이전 버전과는 다른 각도에서 접근해 주세요. 다른 구체적 예시·사례·상황을 들어 풀어주되, 전달하려는 핵심 메시지는 유지하세요.",
    # variant 2: 또 다른 접근
    "이전과 또 다른 각도에서 풀어주세요. 전혀 다른 구체적 예시·상황을 들어 설명하되, 핵심 메시지는 유지하세요.",
]


def get_bedrock_client():
    return boto3.client(
        'bedrock-runtime',
        region_name=BEDROCK_REGION,
        config=Config(read_timeout=120, connect_timeout=30, retries={'max_attempts': 3}),
    )


def call_claude(client, system_prompt: str, user_message: str) -> str:
    request_body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 800,
        "system": [{"type": "text", "text": system_prompt}],
        "messages": [{"role": "user", "content": user_message}],
    })
    response = client.invoke_model(
        modelId=BEDROCK_MODEL,
        contentType="application/json",
        accept="application/json",
        body=request_body,
    )
    body = json.loads(response['body'].read())
    return body.get('content', [{}])[0].get('text', '').strip()


def make_prompt(category: str, key: str, base_text: str, variant_instruction: str) -> str:
    return f"""다음은 오늘의 '{category}' 카테고리에서 십성 '{key}'에 해당하는 조언 문장입니다.
이 내용을 당신의 성격과 말투에 맞게 리라이팅해 주세요.
원본의 핵심 메시지는 유지하되, 문체·어조·단어 선택은 당신의 성격에 맞게 자유롭게 바꾸세요.
3~5문장, 150~300자로 작성하세요. 구체적 조언·팁이 담기도록 하세요.
마크다운 헤더 없이 자연스러운 문단으로만 써주세요.

{variant_instruction}

[원본]
{base_text}"""


def process_task(task):
    """단일 태스크 처리"""
    category, group, key, base_text, variant_idx = task
    client = get_bedrock_client()
    persona = MBTI_PERSONAS[group]
    prompt = make_prompt(category, key, base_text, VARIANT_INSTRUCTIONS[variant_idx])
    try:
        text = call_claude(client, persona, prompt)
        return (category, group, key, variant_idx, text)
    except Exception as e:
        print(f'[ERROR] {category}/{group}/{key}/v{variant_idx}: {e}', flush=True)
        return (category, group, key, variant_idx, None)


def main():
    # 기존 파일 로드
    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        result = json.load(f)

    # category를 배열 구조로 변환 (기존 string → [string])
    for cat in CATEGORY_BASE:
        if cat not in result.get('category', {}):
            continue
        for group in MBTI_PERSONAS:
            if group not in result['category'][cat]:
                continue
            for key in list(result['category'][cat][group].keys()):
                current = result['category'][cat][group][key]
                if isinstance(current, str):
                    result['category'][cat][group][key] = [current]
                # else: already array

    # 태스크 생성: 각 셀마다 variant 1, 2 추가 (variant 0은 기존 값)
    tasks = []
    for cat in CATEGORY_BASE:
        for group in MBTI_PERSONAS:
            for key, base in CATEGORY_BASE[cat].items():
                existing = result['category'][cat][group][key]
                for variant_idx in [0, 1]:  # 2개 추가
                    array_idx = variant_idx + 1  # variant 0은 기존, 1과 2 채움
                    if array_idx < len(existing):
                        continue  # 이미 채워져 있음
                    tasks.append((cat, group, key, base, variant_idx))

    total_cells = len(CATEGORY_BASE) * len(MBTI_PERSONAS) * 10
    total_variants_needed = total_cells * 3
    existing_count = sum(
        len(result['category'][cat][group][key])
        for cat in CATEGORY_BASE
        for group in MBTI_PERSONAS
        for key in result['category'][cat].get(group, {})
    )
    print(f'=== 카테고리 variant 생성: {len(tasks)}개 추가 (기존 {existing_count}/{total_variants_needed}) ===', flush=True)

    if not tasks:
        print('모두 완료!', flush=True)
        return

    workers = 5
    count = [existing_count]
    save_lock = Lock()

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_task, t): t for t in tasks}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res is None or res[4] is None:
                continue
            category, group, key, variant_idx, text = res
            with save_lock:
                arr = result['category'][category][group][key]
                while len(arr) <= variant_idx + 1:
                    arr.append(None)
                arr[variant_idx + 1] = text  # variant 0은 기존, 1·2 채움
                # 정리: None 제거
                result['category'][category][group][key] = [x for x in arr if x is not None]
                count[0] += 1
                if count[0] % 20 == 0:
                    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                        json.dump(result, f, ensure_ascii=False, indent=2)
            print(f'[{count[0]}/{total_variants_needed}] {category}/{group}/{key} variant{variant_idx+1} ({len(text)}자)', flush=True)

    # 최종 저장
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f'\n=== 완료: {count[0]}/{total_variants_needed}, 저장: {OUTPUT_FILE} ===', flush=True)


if __name__ == '__main__':
    main()
