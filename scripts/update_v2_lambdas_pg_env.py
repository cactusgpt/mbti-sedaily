"""
1회성: v2 Lambda 4개 env vars 변경.
- 제거: PG_V2_PASSWORD
- 추가: PG_PASSWORD_SSM_PARAM=/sedaily-mbti/v2/pg-password

Step 5b (deploy-v2.sh) 의 새 코드 (common.secrets.get_pg_password 사용) 가 이미
4 Lambda 에 들어간 상태에서 실행. update_function_configuration 이 자동 cold start
강제 → 다음 invoke 부터 SSM 사용.

usage:
  python3 scripts/update_v2_lambdas_pg_env.py --dry-run
  python3 scripts/update_v2_lambdas_pg_env.py --apply
"""
import argparse

import boto3

LAMBDAS = [
    "sedaily-mbti-v2-collector-dev",
    "sedaily-mbti-v2-selector-dev",
    "sedaily-mbti-v2-transform-dev",
    "sedaily-mbti-v2-consolidate-dev",
]
SSM_PARAM_PATH = "/sedaily-mbti/v2/pg-password"
REGION = "us-east-1"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not (args.dry_run or args.apply):
        parser.error("--dry-run or --apply 필수")

    client = boto3.client("lambda", region_name=REGION)

    for fn in LAMBDAS:
        resp = client.get_function_configuration(FunctionName=fn)
        env = (resp.get("Environment") or {}).get("Variables") or {}

        had_pwd = "PG_V2_PASSWORD" in env
        had_ssm = "PG_PASSWORD_SSM_PARAM" in env
        new_env = {k: v for k, v in env.items() if k != "PG_V2_PASSWORD"}
        new_env["PG_PASSWORD_SSM_PARAM"] = SSM_PARAM_PATH

        action = "UPDATE" if (had_pwd or not had_ssm or env.get("PG_PASSWORD_SSM_PARAM") != SSM_PARAM_PATH) else "NO-OP"
        print(f"  {fn}: {action} (had_PG_V2_PASSWORD={had_pwd}, had_SSM_PARAM={had_ssm})")

        if args.dry_run:
            continue
        if action == "NO-OP":
            continue

        client.update_function_configuration(
            FunctionName=fn,
            Environment={"Variables": new_env},
        )
        # 검증: 다시 read → 변경 반영 확인
        resp2 = client.get_function_configuration(FunctionName=fn)
        env2 = (resp2.get("Environment") or {}).get("Variables") or {}
        assert "PG_V2_PASSWORD" not in env2, f"{fn}: PG_V2_PASSWORD still present"
        assert env2.get("PG_PASSWORD_SSM_PARAM") == SSM_PARAM_PATH, f"{fn}: PG_PASSWORD_SSM_PARAM mismatch"
        print(f"    ✓ verified")


if __name__ == "__main__":
    main()
