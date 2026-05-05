"""audit log 조회 — DDB CONFIG/AUDIT/<ISO ts> 의 sk descending."""

import logging

from boto3.dynamodb.conditions import Key

from shared import ddb_client, response

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


def handle_list(body: dict, path_params: dict, query_params: dict) -> dict:
    raw_limit = (query_params or {}).get("limit", str(DEFAULT_LIMIT))
    try:
        limit = int(raw_limit)
    except ValueError:
        return response.err("limit must be integer", 400)
    limit = max(1, min(limit, MAX_LIMIT))

    table = ddb_client.config_table()
    resp = table.query(
        KeyConditionExpression=Key("pk").eq("AUDIT"),
        Limit=limit,
        ScanIndexForward=False,
    )
    audits = [
        {
            "ts": item.get("sk"),
            "action": item.get("action"),
            "detail": item.get("detail"),
            "actor": item.get("actor"),
        }
        for item in resp.get("Items", [])
    ]
    return response.ok({"audits": audits, "count": len(audits)})
