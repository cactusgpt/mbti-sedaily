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

Scope (109 resources):
    Lambda 32 + DynamoDB 6 + S3 6 + CloudFront 2 + ACM 2 + SSM 3 +
    EventBridge 9 + IAM 7 + RDS 1 + OpenSearch 1 + API Gateway 1 + Cognito 1 +
    CloudWatch dashboard 1 + Step Functions 1 + CloudWatch log group 31 +
    EC2 (NAT 1 + VPCE 3 + EIP 1, in mbti VPCs) 5

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


def enumerate_step_functions(client) -> list[str]:
    arns: list[str] = []
    paginator = client.get_paginator("list_state_machines")
    for page in paginator.paginate():
        for sm in page.get("stateMachines", []):
            if sm.get("name", "").startswith("sedaily-mbti-"):
                arns.append(sm["stateMachineArn"])
    return sorted(arns)


def enumerate_cw_log_groups(client) -> list[str]:
    """Lambda log groups for sedaily-mbti-* functions only — biggest ongoing log spend."""
    names: list[str] = []
    paginator = client.get_paginator("describe_log_groups")
    for page in paginator.paginate(logGroupNamePrefix="/aws/lambda/sedaily-mbti"):
        for lg in page.get("logGroups", []):
            names.append(lg["logGroupName"])
    return sorted(names)


def enumerate_ec2_vpc(client) -> list[str]:
    """NAT GW + VPC Endpoints + EIPs in sedaily-mbti VPCs.

    The mbti VPC itself currently has no tags, so we discover it via its
    NAT Gateway's Name tag (`sedaily-mbti-v2-nat`) — pragmatic but means a
    new mbti VPC without a tagged NAT would be missed. Once VPCs themselves
    grow Name tags, the second branch below will pick them up directly.
    EIPs are sourced from the NAT's network-interface; standalone EIPs on
    non-NAT resources are not enumerated.
    """
    mbti_vpc_ids: set[str] = set()

    nat_named_resp = client.describe_nat_gateways(
        Filters=[{"Name": "tag:Name", "Values": ["sedaily-mbti-*"]}],
    )
    for ng in nat_named_resp.get("NatGateways", []):
        if ng.get("State") not in ("deleted", "deleting", "failed") and ng.get("VpcId"):
            mbti_vpc_ids.add(ng["VpcId"])

    vpcs_resp = client.describe_vpcs(
        Filters=[{"Name": "tag:Name", "Values": ["sedaily-mbti-*"]}]
    )
    mbti_vpc_ids.update(v["VpcId"] for v in vpcs_resp.get("Vpcs", []))

    if not mbti_vpc_ids:
        return []

    vpc_id_list = sorted(mbti_vpc_ids)
    ids: list[str] = []

    nat_resp = client.describe_nat_gateways(
        Filters=[{"Name": "vpc-id", "Values": vpc_id_list}],
    )
    nats = [
        ng for ng in nat_resp.get("NatGateways", [])
        if ng.get("State") not in ("deleted", "deleting", "failed")
    ]
    ids.extend(ng["NatGatewayId"] for ng in nats)

    vpce_resp = client.describe_vpc_endpoints(
        Filters=[{"Name": "vpc-id", "Values": vpc_id_list}],
    )
    ids.extend(v["VpcEndpointId"] for v in vpce_resp.get("VpcEndpoints", []))

    nat_eni_ids = [
        addr["NetworkInterfaceId"]
        for ng in nats
        for addr in ng.get("NatGatewayAddresses", [])
        if addr.get("NetworkInterfaceId")
    ]
    if nat_eni_ids:
        eip_resp = client.describe_addresses(
            Filters=[{"Name": "network-interface-id", "Values": nat_eni_ids}]
        )
        ids.extend(
            a["AllocationId"] for a in eip_resp.get("Addresses", [])
            if a.get("AllocationId")
        )

    return sorted(ids)


# ── Existing-tag check ──────────────────────────────────────────────────────

def has_service_tag(tags: list | dict) -> bool:
    """Detect Service=mbti in list-of-dicts (Key/Value or key/value casing) or flat-dict formats.

    Step Functions returns lowercase `key`/`value`; the rest of AWS is uppercase.
    """
    if isinstance(tags, dict):
        return tags.get(TAG_KEY) == TAG_VALUE
    if isinstance(tags, list):
        return any(
            (t.get("Key") == TAG_KEY and t.get("Value") == TAG_VALUE)
            or (t.get("key") == TAG_KEY and t.get("value") == TAG_VALUE)
            for t in tags
        )
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


def handle_step_functions(client, arn: str, dry: bool) -> tuple[str, str]:
    """Step Functions uses lowercase key/value (the only AWS service in this script that does)."""
    existing = client.list_tags_for_resource(resourceArn=arn).get("tags", [])
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.tag_resource(resourceArn=arn, tags=[{"key": TAG_KEY, "value": TAG_VALUE}])
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_cw_log_group(client, name: str, dry: bool) -> tuple[str, str]:
    arn = f"arn:aws:logs:{REGION}:{ACCOUNT}:log-group:{name}"
    existing = client.list_tags_for_resource(resourceArn=arn).get("tags", {})
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.tag_resource(resourceArn=arn, tags={TAG_KEY: TAG_VALUE})
    return ("OK", f"({len(existing)} → {len(existing) + 1} tags)")


def handle_ec2_vpc(client, resource_id: str, dry: bool) -> tuple[str, str]:
    """Tag NAT GW / VPCE / EIP via shared ec2 create-tags API."""
    tags_resp = client.describe_tags(
        Filters=[{"Name": "resource-id", "Values": [resource_id]}]
    )
    existing = tags_resp.get("Tags", [])
    if has_service_tag(existing):
        return ("SKIP", f"({len(existing)} tags)")
    if dry:
        return ("WOULD ADD", f"(currently {len(existing)} tags)")
    client.create_tags(
        Resources=[resource_id],
        Tags=[{"Key": TAG_KEY, "Value": TAG_VALUE}],
    )
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
    ("step_functions",        "stepfunctions", REGION, enumerate_step_functions, handle_step_functions),
    ("cw_log_group",          "logs",          REGION, enumerate_cw_log_groups, handle_cw_log_group),
    ("ec2_vpc",               "ec2",           REGION, enumerate_ec2_vpc,      handle_ec2_vpc),
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
