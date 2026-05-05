"""드라이버 (EventBridge rule + feature flag) 관리.

list: list_rules(NamePrefix='sedaily-mbti-') + DDB CONFIG/feature-flag/* (Admin-2 까지 빈 dict).
update: action ∈ {enable, disable, set-cron}. cron 은 preset 만 허용 (자유 입력 거부).
"""

import logging

from boto3.dynamodb.conditions import Attr, Key

import auth
from shared import ddb_client, eb_client, response

logger = logging.getLogger(__name__)


def _load_feature_flags() -> dict:
    table = ddb_client.config_table()
    resp = table.query(
        KeyConditionExpression=Key("pk").eq("CONFIG") & Key("sk").begins_with("feature-flag/"),
    )
    flags = {}
    for item in resp.get("Items", []):
        sk = item.get("sk", "")
        flag_name = sk.replace("feature-flag/", "", 1)
        flags[flag_name] = item.get("value")
    return flags


def handle_list(body: dict, path_params: dict, query_params: dict) -> dict:
    rules = eb_client.list_rules()
    flags = _load_feature_flags()
    return response.ok({"rules": rules, "feature_flags": flags})


def handle_update(body: dict, path_params: dict, query_params: dict) -> dict:
    driver_id = (path_params or {}).get("id", "")
    if not driver_id:
        return response.err("driver id required", 400)
    if not driver_id.startswith("sedaily-mbti-"):
        return response.err("driver id must start with 'sedaily-mbti-'", 400)

    action = body.get("action", "")
    if action not in {"enable", "disable", "set-cron"}:
        return response.err("action must be one of: enable, disable, set-cron", 400)

    detail: dict = {"driver": driver_id, "action": action}

    try:
        if action == "enable":
            eb_client.enable_rule(driver_id)
        elif action == "disable":
            eb_client.disable_rule(driver_id)
        elif action == "set-cron":
            preset = body.get("cron_preset", "")
            if preset not in eb_client.PRESET_TO_SCHEDULE:
                return response.err(
                    f"cron_preset must be one of: {sorted(eb_client.PRESET_TO_SCHEDULE.keys())}",
                    400,
                )
            schedule = eb_client.set_schedule(driver_id, preset)
            detail["preset"] = preset
            detail["schedule"] = schedule
    except Exception as e:
        logger.exception(f"driver-update failed: {driver_id} {action}")
        return response.err(f"driver update failed: {type(e).__name__}", 500)

    auth.audit_log("driver-update", detail)
    return response.ok({"ok": True, "rule": eb_client.describe_rule(driver_id)})
