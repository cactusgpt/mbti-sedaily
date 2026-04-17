"""
사주 해석 리라이팅 배치 생성 스크립트
- 총운: 일간(10) × 일지(12) × 월지(12) = 1,440 조합 × 4 MBTI
- 오늘의 운세: 일간(10) × 일진(60갑자) = 600 조합 × 4 MBTI
- 결과를 S3에 JSON 파일로 저장
"""
import json
import boto3
import os
import sys
import time
from pathlib import Path
from botocore.config import Config

# ── 설정 ──
BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0'
BEDROCK_REGION = 'us-east-1'
S3_BUCKET = 'sedaily-mbti-frontend-dev'
S3_PREFIX = 'saju-cache'
LOCAL_CACHE_DIR = Path(__file__).parent / 'saju-cache-local'

bedrock = boto3.client(
    'bedrock-runtime',
    region_name=BEDROCK_REGION,
    config=Config(read_timeout=120, connect_timeout=30, retries={'max_attempts': 3}),
)
s3 = boto3.client('s3', region_name='us-east-1')

# ── 사주 데이터 ──
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

# 60갑자
GAPJA60 = []
for i in range(60):
    GAPJA60.append(f"{CG10[i % 10]}{JJ12[i % 12]}")

# ── MBTI 페르소나 (성격 특성 + 예시만, 말투 배제) ──
MBTI_PERSONAS = {
    'NT': """당신은 사주명리학 전문가이자 '분석가' 성향의 해석자입니다.

성격 특성:
- 논리적이고 분석적인 사고를 좋아합니다
- 핵심을 빠르게 파악하고 구조화해서 설명합니다
- 데이터와 근거를 중시합니다
- 효율적인 커뮤니케이션을 선호합니다

해석 방향: 사주의 구조적 특징을 분석하고, 오행의 상생상극 관계를 논리적으로 풀어주세요.
예시: "핵심 포인트 3가지로 정리해드릴게요. 첫째, ..."
""",
    'NF': """당신은 사주명리학 전문가이자 '이야기꾼' 성향의 해석자입니다.

성격 특성:
- 성찰적이고 의미를 중시합니다
- 사람과 가치에 관심이 많습니다
- 큰 그림과 맥락을 잘 파악합니다
- 공감과 이해를 중요하게 생각합니다

해석 방향: 사주가 담고 있는 삶의 의미와 성장 가능성에 초점을 맞춰 풀어주세요.
예시: "이 사주가 담고 있는 의미를 함께 생각해볼까요?"
""",
    'ST': """당신은 사주명리학 전문가이자 '실용주의자' 성향의 해석자입니다.

성격 특성:
- 정확하고 체계적인 것을 좋아합니다
- 사실과 데이터에 집중합니다
- 실용적인 정보를 중시합니다
- 신뢰할 수 있는 정보 전달이 중요합니다

해석 방향: 사주의 명리학적 근거를 명확히 하고, 실생활에 적용할 수 있는 실용적 조언을 제공하세요.
예시: "확인된 사주 구성을 정리하면 다음과 같습니다."
""",
    'SF': """당신은 사주명리학 전문가이자 '공감러' 성향의 해석자입니다.

성격 특성:
- 친근하고 공감을 잘 합니다
- 어려운 것도 쉽게 설명합니다
- 실생활과 연결해서 이야기합니다
- 독자와의 소통을 즐깁니다

해석 방향: 사주를 친구에게 설명하듯 쉽고 재미있게 풀어주세요. 비유와 예시를 활용하세요.
예시: "쉽게 말하면요, 이 사주는 이런 느낌이에요!"
""",
}


def call_claude(system_prompt: str, user_message: str) -> str:
    """Bedrock Claude 호출"""
    request_body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2048,
        "system": [{"type": "text", "text": system_prompt}],
        "messages": [{"role": "user", "content": user_message}],
    })

    response = bedrock.invoke_model(
        modelId=BEDROCK_MODEL,
        contentType="application/json",
        accept="application/json",
        body=request_body,
    )
    body = json.loads(response['body'].read())
    return body.get('content', [{}])[0].get('text', '')


def generate_chongun(ilgan: str, ilji: str, wolji: str) -> dict:
    """총운 리라이팅 생성 (4 MBTI 그룹)"""
    ilgan_kr = CG_KR[ilgan]
    ilji_kr = JJ_KR[ilji]
    wolji_kr = JJ_KR[wolji]
    ilgan_oh = CG_OH[ilgan]
    ilji_oh = JJ_OH[ilji]
    wolji_oh = JJ_OH[wolji]
    season = WOLJI_SEASON.get(wolji, '')
    nature = ILGAN_NATURE.get(ilgan, '')

    base_info = f"""사주 정보:
- 일간: {ilgan_kr}({ilgan}), 오행: {ilgan_oh}
- 일지: {ilji_kr}({ilji}), 오행: {ilji_oh}
- 월지: {wolji_kr}({wolji}), 오행: {wolji_oh}, 계절: {season}
- 일간 성향: {nature}

이 사주의 총운(전체적인 성격과 운명의 흐름)을 해석해주세요.
500~800자로 작성하세요. 일간의 성격, 계절의 영향, 일주(일간+일지) 조합의 의미를 포함해주세요."""

    result = {}
    for group, persona in MBTI_PERSONAS.items():
        text = call_claude(persona, base_info)
        result[group] = text
        time.sleep(0.5)  # Rate limit

    return result


def generate_today_fortune(ilgan: str, day_ganji: str) -> dict:
    """오늘의 운세 리라이팅 생성 (4 MBTI 그룹)"""
    ilgan_kr = CG_KR[ilgan]
    ilgan_oh = CG_OH[ilgan]
    day_cg = day_ganji[0]
    day_jj = day_ganji[1]
    day_cg_kr = CG_KR[day_cg]
    day_jj_kr = JJ_KR[day_jj]
    day_oh = CG_OH[day_cg]

    # 십성 계산
    OI = {'목': 0, '화': 1, '토': 2, '금': 3, '수': 4}
    SSN = [['비견', '겁재'], ['식신', '상관'], ['편재', '정재'], ['편관', '정관'], ['편인', '정인']]
    m = OI[CG_OH[ilgan]]
    x = OI[CG_OH[day_cg]]
    d = (x - m + 5) % 5
    yin_ilgan = ilgan in '乙丁己辛癸'
    yin_target = day_cg in '乙丁己辛癸'
    ss = SSN[d][0 if yin_ilgan == yin_target else 1]

    base_info = f"""사주 정보:
- 나의 일간: {ilgan_kr}({ilgan}), 오행: {ilgan_oh}
- 오늘의 일진: {day_cg_kr}{day_jj_kr}({day_ganji}), 천간 오행: {day_oh}
- 오늘의 십성: {ss}

오늘 하루의 운세를 해석해주세요.
400~600자로 작성하세요. 십성의 의미, 재물운, 건강운, 대인관계 조언을 포함해주세요."""

    result = {}
    for group, persona in MBTI_PERSONAS.items():
        text = call_claude(persona, base_info)
        result[group] = text
        time.sleep(0.5)

    return result


def save_to_s3(key: str, data: dict):
    """S3에 JSON 저장"""
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f"{S3_PREFIX}/{key}",
        Body=json.dumps(data, ensure_ascii=False, indent=2),
        ContentType='application/json',
        CacheControl='public, max-age=86400',
    )


def save_local(key: str, data: dict):
    """로컬에도 백업 저장"""
    path = LOCAL_CACHE_DIR / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def load_progress(progress_file: Path) -> set:
    """진행 상태 로드"""
    if progress_file.exists():
        return set(progress_file.read_text(encoding='utf-8').strip().split('\n'))
    return set()


def save_progress(progress_file: Path, key: str):
    """진행 상태 저장"""
    with open(progress_file, 'a', encoding='utf-8') as f:
        f.write(key + '\n')


def run_test(count: int = 5):
    """소규모 테스트: 총운 3개 + 오늘의 운세 2개"""
    print(f"=== 테스트 모드: {count}개 생성 ===\n")

    # 총운 테스트: 甲子寅, 乙丑卯, 丙寅辰
    test_chongun = [('甲', '子', '寅'), ('乙', '丑', '卯'), ('丙', '寅', '辰')]
    for ilgan, ilji, wolji in test_chongun[:min(3, count)]:
        key = f"chongun/{ilgan}_{ilji}_{wolji}.json"
        print(f"생성 중: {key}")
        data = generate_chongun(ilgan, ilji, wolji)
        save_local(key, data)
        save_to_s3(key, data)
        print(f"  완료! NT: {len(data['NT'])}자, NF: {len(data['NF'])}자, ST: {len(data['ST'])}자, SF: {len(data['SF'])}자")

    # 오늘의 운세 테스트: 甲+甲子, 乙+乙丑
    test_today = [('甲', '甲子'), ('乙', '乙丑')]
    for ilgan, ganji in test_today[:max(0, count - 3)]:
        key = f"today/{ilgan}_{ganji}.json"
        print(f"생성 중: {key}")
        data = generate_today_fortune(ilgan, ganji)
        save_local(key, data)
        save_to_s3(key, data)
        print(f"  완료! NT: {len(data['NT'])}자, NF: {len(data['NF'])}자, ST: {len(data['ST'])}자, SF: {len(data['SF'])}자")

    print("\n=== 테스트 완료 ===")
    print(f"로컬 캐시: {LOCAL_CACHE_DIR}")
    print(f"S3: s3://{S3_BUCKET}/{S3_PREFIX}/")


def run_full():
    """전체 생성"""
    progress_file = LOCAL_CACHE_DIR / '_progress.txt'
    done = load_progress(progress_file)
    total_chongun = len(CG10) * len(JJ12) * len(JJ12)
    total_today = len(CG10) * len(GAPJA60)
    total = total_chongun + total_today
    current = len(done)

    print(f"=== 전체 생성: {total}개 (완료: {current}, 남은: {total - current}) ===\n")

    # 총운
    for ilgan in CG10:
        for ilji in JJ12:
            for wolji in JJ12:
                key = f"chongun/{ilgan}_{ilji}_{wolji}.json"
                if key in done:
                    continue
                try:
                    data = generate_chongun(ilgan, ilji, wolji)
                    save_local(key, data)
                    save_to_s3(key, data)
                    save_progress(progress_file, key)
                    current += 1
                    print(f"[{current}/{total}] {key}")
                except Exception as e:
                    print(f"[ERROR] {key}: {e}")
                    time.sleep(5)

    # 오늘의 운세
    for ilgan in CG10:
        for ganji in GAPJA60:
            key = f"today/{ilgan}_{ganji}.json"
            if key in done:
                continue
            try:
                data = generate_today_fortune(ilgan, ganji)
                save_local(key, data)
                save_to_s3(key, data)
                save_progress(progress_file, key)
                current += 1
                print(f"[{current}/{total}] {key}")
            except Exception as e:
                print(f"[ERROR] {key}: {e}")
                time.sleep(5)

    print(f"\n=== 전체 생성 완료: {current}/{total} ===")


def run_chongun_only():
    """총운만 생성 (1,440개)"""
    progress_file = LOCAL_CACHE_DIR / '_progress.txt'
    done = load_progress(progress_file)
    total = len(CG10) * len(JJ12) * len(JJ12)
    current = len([k for k in done if k.startswith('chongun/')])

    print(f"=== 총운 생성: {total}개 (완료: {current}, 남은: {total - current}) ===\n")

    for ilgan in CG10:
        for ilji in JJ12:
            for wolji in JJ12:
                key = f"chongun/{ilgan}_{ilji}_{wolji}.json"
                if key in done:
                    continue
                try:
                    data = generate_chongun(ilgan, ilji, wolji)
                    save_local(key, data)
                    save_to_s3(key, data)
                    save_progress(progress_file, key)
                    current += 1
                    print(f"[{current}/{total}] {key}", flush=True)
                except Exception as e:
                    print(f"[ERROR] {key}: {e}", flush=True)
                    time.sleep(5)

    print(f"\n=== 총운 생성 완료: {current}/{total} ===")


def run_today_only():
    """오늘의 운세만 생성 (600개)"""
    progress_file = LOCAL_CACHE_DIR / '_progress.txt'
    done = load_progress(progress_file)
    total = len(CG10) * len(GAPJA60)
    current = len([k for k in done if k.startswith('today/')])

    print(f"=== 오늘의 운세 생성: {total}개 (완료: {current}, 남은: {total - current}) ===\n")

    for ilgan in CG10:
        for ganji in GAPJA60:
            key = f"today/{ilgan}_{ganji}.json"
            if key in done:
                continue
            try:
                data = generate_today_fortune(ilgan, ganji)
                save_local(key, data)
                save_to_s3(key, data)
                save_progress(progress_file, key)
                current += 1
                print(f"[{current}/{total}] {key}", flush=True)
            except Exception as e:
                print(f"[ERROR] {key}: {e}", flush=True)
                time.sleep(5)

    print(f"\n=== 오늘의 운세 생성 완료: {current}/{total} ===")


if __name__ == '__main__':
    if '--chongun' in sys.argv:
        run_chongun_only()
    elif '--today' in sys.argv:
        run_today_only()
    elif '--full' in sys.argv:
        run_full()
    else:
        count = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 5
        run_test(count)
