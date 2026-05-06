"""Cost-3: apply Service=mbti to every sedaily-mbti AWS resource.

Adds the user-defined cost allocation tag `Service=mbti` (key/value) on top of
the existing 7-key tag set (Project / Component / Subsystem / Environment /
Phase / Owner / ManagedBy) that Cost-1a applied. The billing.on / external SaaS
tracking pivots on `user:Service=mbti`.

Usage:
    python3 scripts/apply_service_tag.py --dry-run
    python3 scripts/apply_service_tag.py --apply

dry-run: enumerate every resource, show WOULD ADD / SKIP per resource, no writes.
apply:   call each service's tag API. S3 uses replace-mode (read existing → append
         Service → put-bucket-tagging); the others use add-style APIs.

Scope (72 resources):
    Lambda 32 + DynamoDB 6 + S3 6 + CloudFront 2 + ACM 2 + SSM 3 +
    EventBridge 9 + IAM 7 + RDS 1 + OpenSearch 1 + API Gateway 1 + Cognito 1 +
    CloudWatch dashboard 1

Exclusions (per Cost-3 handoff):
    - Route53 hosted zone `sedaily.ai` — shared with non-mbti services
    - RDS `sedaily-rag-vectordb`     — dead resource, separate cleanup round

Resources are enumerated dynamically each run, so newly-created sedaily-mbti
resources are picked up automatically (no hardcoded list).
"""
from __future__ import annotations

import argparse
import sys
from typing import Callable

import boto3
from botocore.exceptions import ClientError

ACCOUNT = "887078546492"
REGION = "us-east-1"
TAG_KEY = "Service"
TAG_VALUE = "mbti"

# Resources excluded from this round (handoff decision).
EXCLUDED_RDS = {"sedaily-rag-vectordb"}


# ── Enumeration ─────────────────────────────────────────────────────────────

def enumerate_lambda(client) -> list[str]:
    names: list[str] = []
    paginator = client.get_paginator("list_functions")
    for page in paginator.paginate():
        for fn in page.get("Functions", []):
            name = fn["FunctionName"]
            if name.startswith("sedaily-mbti-"):
                names.append(name)
    return sorted(names)


def enumerate_dynamodb(client) -> list[str]:
    names: list[str] = []
    paginator = client.get_paginator("list_tables")
    for page in paginator.paginate():
        for t in page.get("TableNames", []):
            if t.startswith("sedaily-mbti-"):
                names.append(t)
    return sorted(names)


def enumerate_s3(client) -> list[str]:
    resp = client.list_buckets()
    return sorted(
        b["Name"] for b in resp.get("Buckets", [])
        if b["Name"].startswith("sedaily-mbti-")
    )


def enumerate_cloudfront(client) -> list[str]:
    """Filter distributions whose first alias is mbti.sedaily.ai or mbti-admin.sedaily.ai."""
    ids: list[str] = []
    paginator = client.get_paginator("list_distributions")
    for page in paginator.paginate():
        for d in (page.get("DistributionList") or {}).get("Items", []) or []:
            aliases = (d.get("Aliases") or {}).get("Items") or []
            if any(a in ("mbti.sedaily.ai", "mbti-admin.sedaily.ai") for a in aliases):
                ids.append(d["Id"])
    return sorted(ids)


def enumerate_acm(client) -> list[str]:
    arns: list[str] = []
    paginator = client.get_paginator("list_certificates")
    for page in paginator.paginate():
        for c in page.get("CertificateSummaryList", []):
            domain = c.get("DomainName", "")
            if domain in ("mbti.sedaily.ai", "mbti-admin.sedaily.ai"):
                arns.append(c["CertificateArn"])
    return sorted(arns)


def enumerate_ssm(client) -> list[str]:
    names: list[str] = []
    paginator = client.get_paginator("describe_parameters")
    for page in paginator.paginate(
        ParameterFilters=[{"Key": "Name", "Option": "BeginsWith", "Values": ["/sedaily-mbti"]}]
    ):
        for p in page.get("Parameters", []):
            names.append(p["Name"])
    return sorted(names)


def enumerate_events(client) -> list[str]:
    names: list[str] = []
    paginator = client.get_paginator("list_rules")
    for page in paginator.paginate(NamePrefix="sedaily-mbti-"):
        for r in page.get("Rules", []):
            names.append(r["Name"])
    return sorted(names)


def enumerate_iam(client) -> list[str]:
    names: list[str] = []
    paginator = client.get_paginator("list_roles")
    for page in paginator.paginate():
        for r in page.get("Roles", []):
            if "mbti" in r["RoleName"]:
                names.append(r["RoleName"])
    return sorted(names)


def enumerate_rds(client) -> list[str]:
    ids: list[str] = []
    paginator = client.get_paginator("describe_db_instances")
    for page in paginator.paginate():
        for db in page.get("DBInstances", []):
            db_id = db["DBInstanceIdentifier"]
            if "mbti" in db_id and db_id not in EXCLUDED_RDS:
                ids.append(db_id)
    return sorted(ids)


def enumerate_opensearch(client) -> list[str]:
    resp = client.list_domain_names()
    return sorted(
        d["DomainName"] for d in resp.get("DomainNames", [])
        if "mbti" in d["DomainName"]
    )


def enumerate_apigatewayv2(client) -> list[str]:
    """HTTP API only — REST API uses different service. mbti uses HTTP API (chzwwtjtgk)."""
    ids: list[str] = []
    paginator = client.get_paginator("get_apis")
    for page in paginator.paginate():
        for api in page.get("Items", []):
            if "mbti" in api.get("Name", ""):
                ids.append(api["ApiId"])
    return sorted(ids)


def enumerate_cognito(client) -> list[str]:
    pool_ids: list[str] = []
    next_token = None
    while True:
        kwargs = {"MaxResults": 60}
        if next_token:
            kwargs["NextToken"] = next_token
        resp = client.list_user_pools(**kwargs)
        for p in resp.get("UserPools", []):
            if "mbti" in p.get("Name", "").lower():
                pool_ids.append(p["Id"])
        next_token = resp.get("NextToken")
        if not next_token:
            break
    return sorted(pool_ids)


def enumerate_cloudwatch(client) -> list[str]:
    names: list[str] = []
    paginator = client.get_paginator("list_dashboards")
    for page in paginator.paginate(DashboardNamePrefix="sedaily-mbti"):
        for d in page.get("DashboardEntries", []):
            names.append(d["DashboardName"])
    return sorted(names)


# ── Existing-tag check ──────────────────────────────────────────────────────

def has_service_tag(tags: list | dict) -> bool:
    """Detect Service=mbti in either list-of-dicts or flat-dict tag formats."""
    if isinstance(tags, dict):
        return tags.get(TAG_KEY) == TAG_VALUE
    if isinstance(tags, list):
        return any(t.get("Key") == TAG_KEY and t.get("Value") == TAG_VALUE for t in tags)
    return False


# ── Per-service handlers ───────────────────────────────────────────────────
# Each handler returns a tuple (status, detail) where status ∈ {"OK", "SKIP",
# "WOULD ADD", "ERROR"}. For dry-run we map "OK" branch to "WOULD ADD".

def handle_lambda(client, name: str, dry: bool) -> tuple[str, str]:
    arn = f"arn:aws:lambda:{REGION}:{ACCOUNT}:function:{name}"
    existing = client.list_tags(Resource=arn).get("Tags", {})
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags, already has Service=mbti)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.tag_resource(Resource=arn, Tags={TAG_KEY: TAG_VALUE})
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_dynamodb(client, name: str, dry: bool) -> tuple[str, str]:
    arn = f"arn:aws:dynamodb:{REGION}:{ACCOUNT}:table/{name}"
    existing = client.list_tags_of_resource(ResourceArn=arn).get("Tags", [])
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.tag_resource(ResourceArn=arn, Tags=[{"Key": TAG_KEY, "Value": TAG_VALUE}])
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_s3(client, name: str, dry: bool) -> tuple[str, str]:
    """Replace-mode tagging: read existing TagSet, append Service, put back."""
    try:
        existing = client.get_bucket_tagging(Bucket=name).get("TagSet", [])
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "NoSuchTagSet":
            existing = []
        else:
            raise
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    new_tags = list(existing) + [{"Key": TAG_KEY, "Value": TAG_VALUE}]
    if dry:
        return ("WOULD ADD", f"({len(existing)} → {len(new_tags)} tags, replace-mode)")
    client.put_bucket_tagging(Bucket=name, Tagging={"TagSet": new_tags})
    return ("OK", f"({len(existing)} → {len(new_tags)} tags)")


def handle_cloudfront(client, dist_id: str, dry: bool) -> tuple[str, str]:
    arn = f"arn:aws:cloudfront::{ACCOUNT}:distribution/{dist_id}"
    existing_items = (
        client.list_tags_for_resource(Resource=arn).get("Tags", {}).get("Items", [])
    )
    if has_service_tag(existing_items):
        return ("SKIP", f"({len(existing_items)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing_items)} tags)")
    client.tag_resource(
        Resource=arn,
        Tags={"Items": [{"Key": TAG_KEY, "Value": TAG_VALUE}]},
    )
    return ("OK", f"({len(existing_items)} → {len(existing_items) + 1} tags)")


def handle_acm(client, cert_arn: str, dry: bool) -> tuple[str, str]:
    existing = client.list_tags_for_certificate(CertificateArn=cert_arn).get("Tags", [])
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.add_tags_to_certificate(
        CertificateArn=cert_arn,
        Tags=[{"Key": TAG_KEY, "Value": TAG_VALUE}],
    )
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_ssm(client, param_name: str, dry: bool) -> tuple[str, str]:
    existing = client.list_tags_for_resource(
        ResourceType="Parameter", ResourceId=param_name
    ).get("TagList", [])
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.add_tags_to_resource(
        ResourceType="Parameter",
        ResourceId=param_name,
        Tags=[{"Key": TAG_KEY, "Value": TAG_VALUE}],
    )
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_events(client, rule_name: str, dry: bool) -> tuple[str, str]:
    arn = f"arn:aws:events:{REGION}:{ACCOUNT}:rule/{rule_name}"
    existing = client.list_tags_for_resource(ResourceARN=arn).get("Tags", [])
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.tag_resource(ResourceARN=arn, Tags=[{"Key": TAG_KEY, "Value": TAG_VALUE}])
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_iam(client, role_name: str, dry: bool) -> tuple[str, str]:
    existing = client.list_role_tags(RoleName=role_name).get("Tags", [])
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.tag_role(RoleName=role_name, Tags=[{"Key": TAG_KEY, "Value": TAG_VALUE}])
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_rds(client, db_id: str, dry: bool) -> tuple[str, str]:
    arn = f"arn:aws:rds:{REGION}:{ACCOUNT}:db:{db_id}"
    existing = client.list_tags_for_resource(ResourceName=arn).get("TagList", [])
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.add_tags_to_resource(
        ResourceName=arn, Tags=[{"Key": TAG_KEY, "Value": TAG_VALUE}]
    )
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_opensearch(client, domain: str, dry: bool) -> tuple[str, str]:
    arn = f"arn:aws:es:{REGION}:{ACCOUNT}:domain/{domain}"
    existing = client.list_tags(ARN=arn).get("TagList", [])
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.add_tags(ARN=arn, TagList=[{"Key": TAG_KEY, "Value": TAG_VALUE}])
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_apigatewayv2(client, api_id: str, dry: bool) -> tuple[str, str]:
    arn = f"arn:aws:apigateway:{REGION}::/apis/{api_id}"
    existing = client.get_tags(ResourceArn=arn).get("Tags", {})
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.tag_resource(ResourceArn=arn, Tags={TAG_KEY: TAG_VALUE})
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_cognito(client, pool_id: str, dry: bool) -> tuple[str, str]:
    arn = f"arn:aws:cognito-idp:{REGION}:{ACCOUNT}:userpool/{pool_id}"
    existing = client.list_tags_for_resource(ResourceArn=arn).get("Tags", {})
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.tag_resource(ResourceArn=arn, Tags={TAG_KEY: TAG_VALUE})
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_cloudwatch(client, dashboard_name: str, dry: bool) -> tuple[str, str]:
    arn = f"arn:aws:cloudwatch::{ACCOUNT}:dashboard/{dashboard_name}"
    existing = client.list_tags_for_resource(ResourceARN=arn).get("Tags", [])
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.tag_resource(ResourceARN=arn, Tags=[{"Key": TAG_KEY, "Value": TAG_VALUE}])
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


# ── Dispatch table ─────────────────────────────────────────────────────────

# (label, boto3_service_name, region (None = global), enumerate_fn, handle_fn)
SERVICES: list[tuple[str, str, str | None, Callable, Callable]] = [
    ("lambda",                "lambda",        REGION, enumerate_lambda,       handle_lambda),
    ("dynamodb",              "dynamodb",      REGION, enumerate_dynamodb,     handle_dynamodb),
    ("s3",                    "s3",            None,   enumerate_s3,           handle_s3),
    ("cloudfront",            "cloudfront",    None,   enumerate_cloudfront,   handle_cloudfront),
    ("acm",                   "acm",           REGION, enumerate_acm,          handle_acm),
    ("ssm",                   "ssm",           REGION, enumerate_ssm,          handle_ssm),
    ("events_rule",           "events",        REGION, enumerate_events,       handle_events),
    ("iam_role",              "iam",           None,   enumerate_iam,          handle_iam),
    ("rds",                   "rds",           REGION, enumerate_rds,          handle_rds),
    ("opensearch",            "opensearch",    REGION, enumerate_opensearch,   handle_opensearch),
    ("apigatewayv2",          "apigatewayv2",  REGION, enumerate_apigatewayv2, handle_apigatewayv2),
    ("cognito_user_pool",     "cognito-idp",   REGION, enumerate_cognito,      handle_cognito),
    ("cloudwatch_dashboard",  "cloudwatch",    REGION, enumerate_cloudwatch,   handle_cloudwatch),
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.dry_run == args.apply:
        parser.error("--dry-run xor --apply")

    dry = args.dry_run

    summary = {"OK": 0, "WOULD ADD": 0, "SKIP": 0, "ERROR": 0}
    total_resources = 0

    for label, boto3_name, region, enumerate_fn, handle_fn in SERVICES:
        client = boto3.client(boto3_name, region_name=region) if region else boto3.client(boto3_name)
        try:
            resources = enumerate_fn(client)
        except Exception as e:
            print(f"\n=== {label}: ENUMERATION ERROR {type(e).__name__}: {e}")
            summary["ERROR"] += 1
            continue

        print(f"\n=== {label} ({len(resources)}) ===")
        for r in resources:
            total_resources += 1
            try:
                status, detail = handle_fn(client, r, dry)
            except ClientError as e:
                code = e.response.get("Error", {}).get("Code", "ClientError")
                print(f"  {r}: ERROR {code}")
                summary["ERROR"] += 1
                continue
            except Exception as e:
                print(f"  {r}: ERROR {type(e).__name__}: {e}")
                summary["ERROR"] += 1
                continue
            summary[status] = summary.get(status, 0) + 1
            print(f"  {r}: {status} {detail}")

    mode = "DRY-RUN" if dry else "APPLY"
    print(f"\n=== Summary ({mode}) ===")
    print(f"  total resources enumerated: {total_resources}")
    for k in ("OK", "WOULD ADD", "SKIP", "ERROR"):
        print(f"  {k:10s} {summary.get(k, 0)}")

    return 1 if summary["ERROR"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
