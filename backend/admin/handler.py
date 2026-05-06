"""admin Lambda entry — HTTP API v2 형식 event 처리.

routing: HTTP API 의 routeKey (예: 'POST /admin/login') → HANDLERS dict.
auth: jwt_required=True route 는 verify_jwt 통과 후에만 dispatch.
error: 모든 unhandled exception 은 500 + log.exception (sensitive 정보 노출 금지).
"""

import base64
import json
import logging

import auth
from routes import admin_password, audit, cost, drivers, prompts
from shared import response

logger = logging.getLogger()
logger.setLevel(logging.INFO)


HANDLERS: dict[str, tuple] = {
    "POST /admin/login": (auth.handle_login, False),
    "POST /admin/password-change": (admin_password.handle_change, True),
    "GET /admin/drivers": (drivers.handle_list, True),
    "POST /admin/drivers/{id}": (drivers.handle_update, True),
    "POST /admin/drivers/feature-flag/{name}": (drivers.handle_feature_flag_update, True),
    "GET /admin/prompts": (prompts.handle_list, True),
    "GET /admin/prompts/{category}/{name}": (prompts.handle_get, True),
    "POST /admin/prompts/{category}/{name}": (prompts.handle_update, True),
    "GET /admin/cost": (cost.handle_summary, True),
    "GET /admin/audit": (audit.handle_list, True),
}


def _parse_event(event: dict) -> tuple[str, str, str, dict, dict, dict]:
    rc = event.get("requestContext", {}) or {}
    http_ctx = rc.get("http", {}) or {}
    method = http_ctx.get("method", "")
    path = http_ctx.get("path", "")
    route_key = rc.get("routeKey") or f"{method} {path}"
    path_params = event.get("pathParameters") or {}
    query_params = event.get("queryStringParameters") or {}

    body_raw = event.get("body") or ""
    if event.get("isBase64Encoded") and body_raw:
        try:
            body_raw = base64.b64decode(body_raw).decode("utf-8")
        except Exception as e:
            logger.warning(f"base64 decode failed: {e}")
            body_raw = ""

    body: dict = {}
    if body_raw:
        try:
            body = json.loads(body_raw)
        except json.JSONDecodeError:
            body = {}

    return method, path, route_key, path_params, query_params, body


def _get_authorization(event: dict) -> str | None:
    headers = event.get("headers") or {}
    return headers.get("authorization") or headers.get("Authorization")


def lambda_handler(event: dict, context) -> dict:
    try:
        method, path, route_key, path_params, query_params, body = _parse_event(event)
        logger.info(f"admin: {method} {path} (routeKey={route_key})")

        handler_info = HANDLERS.get(route_key)
        if not handler_info:
            return response.err("not found", 404)
        handler_fn, jwt_required = handler_info

        if jwt_required:
            try:
                auth.verify_jwt(_get_authorization(event))
            except auth.AuthError as e:
                return response.err(str(e), 401)

        return handler_fn(body, path_params, query_params)
    except Exception as e:
        logger.exception(f"admin handler error: {type(e).__name__}: {e}")
        return response.err("internal server error", 500)
