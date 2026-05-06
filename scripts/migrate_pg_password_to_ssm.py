"""
1회성: 기존 v2 Lambda 의 PG_V2_PASSWORD env var → SSM SecureString 으로 transfer.

usage:
  python3 scripts/migrate_pg_password_to_ssm.py --dry-run
  python3 scripts/migrate_pg_password_to_ssm.py --apply

dry-run: SSM put 안 함, env var read 시도만 + password length 출력 (값 노출 안 함)
apply:   SSM put 실행 + 검증 (재 read 후 일치 확인)
"""
import argparse

import boto3

LAMBDA_FN = "sedaily-mbti-v2-collector-dev"  # 4개 v2 Lambda 모두 동일 password 가정
SSM_PARAM = "/sedaily-mbti/v2/pg-password"
REGION = "us-east-1"

TAGS = [
    {"Key": "Project", "Value": "sedaily-mbti"},
    {"Key": "Component", "Value": "backend-v2"},
    {"Key": "Subsystem", "Value": "pg-password"},
    {"Key": "Environment", "Value": "dev"},
    {"Key": "Phase", "Value": "admin-2c"},
    {"Key": "Owner", "Value": "one"},
    {"Key": "ManagedBy", "Value": "claude-code"},
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not (args.dry_run or args.apply):
        parser.error("--dry-run or --apply 필수")

    lambda_client = boto3.client("lambda", region_name=REGION)
    ssm_client = boto3.client("ssm", region_name=REGION)

    resp = lambda_client.get_function_configuration(FunctionName=LAMBDA_FN)
    env_vars = (resp.get("Environment") or {}).get("Variables") or {}
    password = env_vars.get("PG_V2_PASSWORD")

    if not password:
        print(f"❌ {LAMBDA_FN} 의 PG_V2_PASSWORD env var 없음")
        return 1

    print(f"  source: Lambda {LAMBDA_FN} env var PG_V2_PASSWORD")
    print(f"  length: {len(password)} chars")
    print(f"  prefix: {password[:2]}*** (validation only, 값 노출 회피)")

    if args.dry_run:
        print(f"  → would put SSM {SSM_PARAM} (SecureString, Standard tier, KMS=alias/aws/ssm)")
        print(f"  → would tag with {len(TAGS)} keys: {[t['Key'] for t in TAGS]}")
        return 0

    # apply: SSM put + 검증
    ssm_client.put_parameter(
        Name=SSM_PARAM,
        Value=password,
        Type="SecureString",
        Tier="Standard",
        Tags=TAGS,
        Description="v2 RDS pgvector master password — migrated from Lambda env vars (Admin-2c).",
    )
    print(f"  ✓ SSM put_parameter {SSM_PARAM}")

    # 검증: SSM 에서 다시 read → 일치 확인 (값 출력 안 함, length 만)
    resp = ssm_client.get_parameter(Name=SSM_PARAM, WithDecryption=True)
    stored = resp["Parameter"]["Value"]
    if stored != password:
        print(f"  ❌ verify: SSM 저장 값 ≠ source (len={len(stored)} vs {len(password)})")
        return 1
    print(f"  ✓ verify: SSM 저장 값 length {len(stored)} 일치, version={resp['Parameter']['Version']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main() or 0)
