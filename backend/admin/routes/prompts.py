"""prompt CRUD + version history.

DDB schema:
  pk = 'PROMPT#<category>/<name>'
  sk = 'v#<int>' (version row)
     | 'LATEST' (active_version 포인터)

list: scan FilterExpression sk='LATEST' → 13 entries.
get: LATEST 의 active_version → v#N content + 최근 10 version metadata.
update: active_version=N → put v#{N+1} + update LATEST.

⚠️ 5분 TTL cache (기존 prompt_loader 수정) 는 Admin-3 라운드. 이번은 admin DDB write 만.
"""

import logging

from boto3.dynamodb.conditions import Attr, Key

import auth
from shared import ddb_client, response

logger = logging.getLogger(__name__)

_PROMPT_PREFIX = "PROMPT#"


def _strip_prefix(pk: str) -> str:
    if pk.startswith(_PROMPT_PREFIX):
        return pk[len(_PROMPT_PREFIX):]
    return pk


def handle_list(body: dict, path_params: dict, query_params: dict) -> dict:
    table = ddb_client.prompts_table()
    items: list[dict] = []
    last_key = None
    while True:
        kwargs = {"FilterExpression": Attr("sk").eq("LATEST")}
        if last_key:
            kwargs["ExclusiveStartKey"] = last_key
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break

    prompts = [
        {
            "id": _strip_prefix(item.get("pk", "")),
            "active_version": int(item.get("active_version", 0)),
            "updated_at": item.get("updated_at"),
        }
        for item in items
    ]
    prompts.sort(key=lambda p: p["id"])
    return response.ok({"prompts": prompts})


def handle_get(body: dict, path_params: dict, query_params: dict) -> dict:
    category = (path_params or {}).get("category", "")
    name = (path_params or {}).get("name", "")
    if not category or not name:
        return response.err("category and name required", 400)

    pk = f"{_PROMPT_PREFIX}{category}/{name}"
    table = ddb_client.prompts_table()

    latest_resp = table.get_item(Key={"pk": pk, "sk": "LATEST"})
    latest = latest_resp.get("Item")
    if not latest:
        return response.err(f"prompt not found: {category}/{name}", 404)
    active_version = int(latest.get("active_version", 0))

    version_resp = table.get_item(Key={"pk": pk, "sk": f"v#{active_version}"})
    version_item = version_resp.get("Item") or {}
    active_content = version_item.get("content", "")

    history_resp = table.query(
        KeyConditionExpression=Key("pk").eq(pk) & Key("sk").begins_with("v#"),
        ScanIndexForward=False,
        Limit=10,
    )
    history = [
        {
            "version": int(item.get("sk", "v#0").split("#")[1]),
            "created_at": item.get("created_at"),
            "actor": item.get("actor"),
        }
        for item in history_resp.get("Items", [])
    ]

    return response.ok({
        "id": f"{category}/{name}",
        "active_content": active_content,
        "active_version": active_version,
        "history": history,
    })


def handle_update(body: dict, path_params: dict, query_params: dict) -> dict:
    import datetime as dt

    category = (path_params or {}).get("category", "")
    name = (path_params or {}).get("name", "")
    if not category or not name:
        return response.err("category and name required", 400)

    new_content = body.get("content", "")
    if not new_content:
        return response.err("content required", 400)

    pk = f"{_PROMPT_PREFIX}{category}/{name}"
    table = ddb_client.prompts_table()

    latest_resp = table.get_item(Key={"pk": pk, "sk": "LATEST"})
    latest = latest_resp.get("Item")
    if not latest:
        return response.err(f"prompt not found: {category}/{name}", 404)
    prev_version = int(latest.get("active_version", 0))
    new_version = prev_version + 1

    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    table.put_item(Item={
        "pk": pk,
        "sk": f"v#{new_version}",
        "content": new_content,
        "created_at": now,
        "actor": "admin",
    })
    table.update_item(
        Key={"pk": pk, "sk": "LATEST"},
        UpdateExpression="SET active_version = :v, updated_at = :u",
        ExpressionAttributeValues={":v": new_version, ":u": now},
    )

    auth.audit_log("prompt-update", {
        "prompt": f"{category}/{name}",
        "new_version": new_version,
        "prev_version": prev_version,
    })
    return response.ok({"ok": True, "new_version": new_version})
