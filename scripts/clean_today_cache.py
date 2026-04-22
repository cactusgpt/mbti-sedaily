"""
today-parts.json / chongun.json 내 반복 문구 정제:
- '확인된 바에 따르면' → 제거 (자연스럽게 '오늘은' 이나 문장 시작으로 연결)
- '한 박자 늦춰서' → 위치별로 다양한 동의구로 교체
"""
import json
import re
import hashlib
from pathlib import Path

ROOT = Path(__file__).parent.parent
TARGETS = [
    ROOT / 'frontend-next' / 'public' / 'saju-cache' / 'today-parts.json',
    ROOT / 'frontend-next' / 'public' / 'saju-cache' / 'chongun.json',
    ROOT / 'frontend-next' / 'public' / 'saju-cache' / 'today.json',
]

HANPAKJA_VARIANTS = [
    '한 템포 늦춰서',
    '한 걸음 물러서서',
    '조금 시간을 두고',
    '잠시 멈춰 서서',
    '차분히 살펴보며',
    '신중히 검토하면서',
    '천천히 호흡을 고르며',
]


def pick_variant(context: str) -> str:
    """같은 맥락엔 같은 대체어 (결정론적)."""
    h = int(hashlib.md5(context.encode('utf-8')).hexdigest(), 16)
    return HANPAKJA_VARIANTS[h % len(HANPAKJA_VARIANTS)]


def clean_text(s: str) -> str:
    if not isinstance(s, str):
        return s
    original = s

    # 1) '확인된 바에 따르면' 제거 (쉼표 변형 포함)
    s = re.sub(r'실용적 관점에서\s+확인된 바에 따르면,?\s+', '', s)
    s = re.sub(r'확인된 바에 따르면,?\s+오늘은', '오늘은', s)
    s = re.sub(r'확인된 바에 따르면,?\s+다음과 같습니다\.?\s*', '', s)
    s = re.sub(r'확인된 바에 따르면,?\s+', '', s)
    s = re.sub(r'확인된 바에 의하면,?\s+', '', s)

    # 문장 시작이 비정상적으로 되지 않게 (쉼표/줄바꿈 뒤 공백 정리)
    s = re.sub(r'^\s+', '', s)

    # 2) '한 박자 늦춰서' / '한 박자 정도 여유를 두고' → 다양화
    def replace_hanpakja(match: re.Match) -> str:
        idx = match.start()
        ctx = original[max(0, idx - 30):idx + 30]  # 앞뒤 30자 맥락
        return pick_variant(ctx)

    s = re.sub(r'평소보다\s*한 박자\s*(?:정도\s*)?(?:늦춰서|쉬고|여유를 두고)', replace_hanpakja, s)
    s = re.sub(r'한 박자\s*(?:정도\s*)?(?:늦춰서|쉬고|여유를 두고)', replace_hanpakja, s)

    return s


def walk(obj):
    if isinstance(obj, dict):
        return {k: walk(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [walk(v) for v in obj]
    if isinstance(obj, str):
        return clean_text(obj)
    return obj


def main():
    for path in TARGETS:
        if not path.exists():
            print(f'skip (missing): {path}')
            continue
        data = json.loads(path.read_text(encoding='utf-8'))
        cleaned = walk(data)
        path.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding='utf-8')

        # 잔여 카운트 확인
        after = path.read_text(encoding='utf-8')
        remaining_hp = after.count('한 박자 늦춰서')
        remaining_cb = after.count('확인된 바에 따르면')
        print(f'{path.name}: 확인된 바 remaining={remaining_cb}, 한 박자 늦춰서 remaining={remaining_hp}')


if __name__ == '__main__':
    main()
