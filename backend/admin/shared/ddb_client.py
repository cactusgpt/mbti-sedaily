"""DynamoDB resource singleton + admin 테이블 2개 accessor."""

import os

import boto3

REGION = os.environ.get("AWS_REGION", "us-east-1")
CONFIG_TABLE = os.environ.get("ADMIN_CONFIG_TABLE", "sedaily-mbti-admin-config-dev")
PROMPTS_TABLE = os.environ.get("ADMIN_PROMPTS_TABLE", "sedaily-mbti-admin-prompts-dev")

_resource = boto3.resource("dynamodb", region_name=REGION)


def config_table():
    return _resource.Table(CONFIG_TABLE)


def prompts_table():
    return _resource.Table(PROMPTS_TABLE)
