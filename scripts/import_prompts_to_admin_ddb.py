"""
1회성: filesystem 의 prompt 13개를 admin-prompts DDB 에 v#1 + LATEST 로 import.
root MBTI_TRANSFORM_PROMPT.md 는 제외 (legacy fallback, Admin-3 라운드에서 정리).

usage:
    python3 scripts/import_prompts_to_admin_ddb.py --dry-run
    python3 scripts/import_prompts_to_admin_ddb.py --apply
"""

import argparse
import datetime
import pathlib
import sys

PROMPT_FILES = [
    ("transform", "nt", "backend/prompts/transform/nt.md"),
    ("transform", "nf", "backend/prompts/transform/nf.md"),
    ("transform", "st", "backend/prompts/transform/st.md"),
    ("transform", "sf", "backend/prompts/transform/sf.md"),
    ("chatbot", "nt", "backend/prompts/chatbot/nt.md"),
    ("chatbot", "nf", "backend/prompts/chatbot/nf.md"),
    ("chatbot", "st", "backend/prompts/chatbot/st.md"),
    ("chatbot", "sf", "backend/prompts/chatbot/sf.md"),
    ("selection", "article_scorer", "backend/prompts/selection/article_scorer.md"),
    ("validation", "validator", "backend/prompts/validation/validator.md"),
    ("supervisor", "supervisor_review", "backend/prompts/supervisor/supervisor_review.md"),
    ("podcast", "podcast_script", "backend/prompts/podcast/podcast_script.md"),
    ("question", "daily_question", "backend/prompts/question/daily_question.md"),
]

TABLE = "sedaily-mbti-admin-prompts-dev"
REGION = "us-east-1"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not (args.dry_run or args.apply):
        parser.error("--dry-run 또는 --apply 필수")

    ddb = None
    if args.apply:
        import boto3
        ddb = boto3.client("dynamodb", region_name=REGION)

    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    repo_root = pathlib.Path(__file__).parent.parent.resolve()

    missing = []
    written = 0

    for category, name, rel_path in PROMPT_FILES:
        path = repo_root / rel_path
        if not path.exists():
            print(f"  [MISSING] {rel_path}")
            missing.append(rel_path)
            continue

        content = path.read_text(encoding="utf-8")
        pk = f"PROMPT#{category}/{name}"
        size_kb = len(content.encode("utf-8")) / 1024
        line_count = len(content.splitlines())
        print(f"  {pk}  ({size_kb:.1f} KB, {line_count} lines)")

        if args.apply:
            ddb.put_item(
                TableName=TABLE,
                Item={
                    "pk": {"S": pk},
                    "sk": {"S": "v#1"},
                    "content": {"S": content},
                    "created_at": {"S": now},
                    "actor": {"S": "import-script"},
                },
            )
            ddb.put_item(
                TableName=TABLE,
                Item={
                    "pk": {"S": pk},
                    "sk": {"S": "LATEST"},
                    "active_version": {"N": "1"},
                    "updated_at": {"S": now},
                },
            )
            written += 1

    total = len(PROMPT_FILES)
    expected_rows = total * 2
    print()
    print(f"총 {total}개 prompt × 2 row (v#1 + LATEST) = {expected_rows} rows")

    if missing:
        print(f"\nERROR: {len(missing)} missing files:")
        for m in missing:
            print(f"  - {m}")
        return 1

    if args.apply:
        print(f"Wrote {written * 2} rows to {TABLE}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
