"""
총운 병렬 생성 — 일간별 10개 프로세스 동시 실행
"""
import json
import boto3
import time
import sys
import concurrent.futures
from pathlib import Path
from botocore.config import Config
from threading import Lock

BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0'
BEDROCK_REGION = 'us-east-1'
S3_BUCKET = 'sedaily-mbti-frontend-dev'
S3_PREFIX = 'saju-cache'
LOCAL_CACHE_DIR = Path(__file__).parent / 'saju-cache-local'
PROGRESS_FILE = LOCAL_CACHE_DIR / '_progress.txt'

progress_lock = Lock()

CG10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
JJ12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
CG_KR = {'甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무', '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계'}
JJ_KR = {'子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해'}
CG_OH = {'甲': '목', '乙': '목', '丙': '화', '丁': '화', '戊': '토', '己': '토', '庚': '금', '辛': '금', '壬': '수', '癸': '수'}
JJ_OH = {'子': '수', '丑': '토', '寅': '목', '卯': '목', '辰': '토', '巳': '화', '午': '화', '未': '토', '申': '금', '酉': '금', '戌': '토', '亥': '수'}

ILGAN_NATURE = {
    '甲': '큰 나무의 기운. 곧고 강직하며 리더십이 있고, 자존심이 높으며 개척자적 기질.',
    '乙': '풀과 꽃의 기운. 유연하고 적응력이 뛰어나며, 부드럽지만 내면은 질기고 끈기 있음.',
    '丙': '태양의 기운. 밝고 열정적이며 사교적. 에너지가 넘치고 추진력이 있으나 성급할 수 있음.',
    '丁': '촛불의 기운. 은은하고 따뜻하며 지적. 한 분야를 깊이 파고드는 집중력이 뛰어남.',
    '戊': '큰 산의 기운. 듬직하고 포용력이 크며 중재자 역할을 잘 함. 안정감이 있으나 변화에 둔감.',
    '己': '논밭의 기운. 온화하고 현실적이며 실속 있음. 모성애가 강하고 인내심이 강함.',
    '庚': '바위와 쇠의 기운. 강인하고 결단력이 있으며 의리가 있음. 냉철하고 직설적.',
    '辛': '보석의 기운. 섬세하고 감수성이 풍부하며 완벽주의적. 심미안이 뛰어남.',
    '壬': '큰 바다의 기운. 지혜롭고 포용력이 크며 자유로운 영혼. 창의적이고 직관력이 뛰어남.',
    '癸': '이슬과 빗물의 기운. 조용하고 직관력이 뛰어나며 깊은 사고력으로 본질을 꿰뚫음.',
}

WOLJI_SEASON = {
    '寅': '봄(초춘)', '卯': '봄(중춘)', '辰': '봄(늦봄)',
    '巳': '여름(초하)', '午': '여름(한여름)', '未': '여름(늦여름)',
    '申': '가을(초추)', '酉': '가을(한가을)', '戌': '가을(늦가을)',
    '亥': '겨울(초동)', '子': '겨울(한겨울)', '丑': '겨울(늦겨울)',
}

MBTI_PERSONAS = {
    'NT': """당신은 사주명리학 전문가이자 '분석가' 성향의 해석자입니다.
성격 특성: 논리적이고 분석적인 사고, 핵심을 구조화해서 설명, 데이터와 근거 중시, 효율적 커뮤니케이션.
해석 방향: 사주의 구조적 특징을 분석하고, 오행의 상생상극 관계를 논리적으로 풀어주세요.
예시: "핵심 포인트 3가지로 정리해드릴게요. 첫째, ..." """,
    'NF': """당신은 사주명리학 전문가이자 '이야기꾼' 성향의 해석자입니다.
성격 특성: 성찰적이고 의미 중시, 사람과 가치에 관심, 큰 그림과 맥락 파악, 공감과 이해 중요.
해석 방향: 사주가 담고 있는 삶의 의미와 성장 가능성에 초점을 맞춰 풀어주세요.
예시: "이 사주가 담고 있는 의미를 함께 생각해볼까요?" """,
    'ST': """당신은 사주명리학 전문가이자 '실용주의자' 성향의 해석자입니다.
성격 특성: 정확하고 체계적, 사실과 데이터 집중, 실용적 정보 중시, 신뢰할 수 있는 정보 전달.
해석 방향: 사주의 명리학적 근거를 명확히 하고, 실생활에 적용할 수 있는 실용적 조언을 제공하세요.
예시: "확인된 사주 구성을 정리하면 다음과 같습니다." """,
    'SF': """당신은 사주명리학 전문가이자 '공감러' 성향의 해석자입니다.
성격 특성: 친근하고 공감, 어려운 것도 쉽게 설명, 실생활 연결, 독자와 소통.
해석 방향: 사주를 친구에게 설명하듯 쉽고 재미있게 풀어주세요. 비유와 예시를 활용하세요.
예시: "쉽게 말하면요, 이 사주는 이런 느낌이에요!" """,
}


def get_bedrock_client():
    """각 스레드별 bedrock 클라이언트"""
    return boto3.client(
        'bedrock-runtime',
        region_name=BEDROCK_REGION,
        config=Config(read_timeout=120, connect_timeout=30, retries={'max_attempts': 3}),
    )


def get_s3_client():
    return boto3.client('s3', region_name='us-east-1')


def call_claude(client, system_prompt, user_message):
    request_body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2048,
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
    return body.get('content', [{}])[0].get('text', '')


def load_progress():
    if PROGRESS_FILE.exists():
        return set(PROGRESS_FILE.read_text(encoding='utf-8').strip().split('\n'))
    return set()


def save_progress(key):
    with progress_lock:
        with open(PROGRESS_FILE, 'a', encoding='utf-8') as f:
            f.write(key + '\n')


def process_chongun(ilgan, ilji, wolji, done):
    """단일 총운 조합 처리"""
    key = f"chongun/{ilgan}_{ilji}_{wolji}.json"
    if key in done:
        return None

    bedrock = get_bedrock_client()
    s3 = get_s3_client()

    ilgan_kr = CG_KR[ilgan]
    ilji_kr = JJ_KR[ilji]
    wolji_kr = JJ_KR[wolji]

    base_info = f"""사주 정보:
- 일간: {ilgan_kr}({ilgan}), 오행: {CG_OH[ilgan]}
- 일지: {ilji_kr}({ilji}), 오행: {JJ_OH[ilji]}
- 월지: {wolji_kr}({wolji}), 오행: {JJ_OH[wolji]}, 계절: {WOLJI_SEASON.get(wolji, '')}
- 일간 성향: {ILGAN_NATURE.get(ilgan, '')}

이 사주의 총운(전체적인 성격과 운명의 흐름)을 해석해주세요.
500~800자로 작성하세요. 일간의 성격, 계절의 영향, 일주(일간+일지) 조합의 의미를 포함해주세요."""

    result = {}
    for group, persona in MBTI_PERSONAS.items():
        result[group] = call_claude(bedrock, persona, base_info)

    # Save
    data_json = json.dumps(result, ensure_ascii=False, indent=2)
    path = LOCAL_CACHE_DIR / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data_json, encoding='utf-8')

    s3.put_object(
        Bucket=S3_BUCKET, Key=f"{S3_PREFIX}/{key}",
        Body=data_json, ContentType='application/json',
        CacheControl='public, max-age=86400',
    )
    save_progress(key)
    return key


def main():
    LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    done = load_progress()

    # 모든 조합 생성
    tasks = []
    for ilgan in CG10:
        for ilji in JJ12:
            for wolji in JJ12:
                key = f"chongun/{ilgan}_{ilji}_{wolji}.json"
                if key not in done:
                    tasks.append((ilgan, ilji, wolji))

    total = len(CG10) * len(JJ12) * len(JJ12)
    remaining = len(tasks)
    completed = total - remaining
    print(f"=== 총운 병렬 생성: {total}개 (완료: {completed}, 남은: {remaining}) ===\n", flush=True)

    if not tasks:
        print("모두 완료!", flush=True)
        return

    workers = 1  # rate limit 방지
    count = [completed]

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(process_chongun, ilgan, ilji, wolji, done): (ilgan, ilji, wolji)
            for ilgan, ilji, wolji in tasks
        }
        for future in concurrent.futures.as_completed(futures):
            ilgan, ilji, wolji = futures[future]
            try:
                result = future.result()
                if result:
                    count[0] += 1
                    print(f"[{count[0]}/{total}] {result}", flush=True)
            except Exception as e:
                print(f"[ERROR] chongun/{ilgan}_{ilji}_{wolji}.json: {e}", flush=True)

    print(f"\n=== 완료: {count[0]}/{total} ===", flush=True)


if __name__ == '__main__':
    main()
