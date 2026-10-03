"""Gọi sang Auth Service bằng HTTP, chuyển tiếp token của admin đang thao tác.

Tạm dùng HTTP đồng bộ cho đơn giản; khi dựng RabbitMQ thì phần báo vi phạm chuyển sang sự kiện.
"""
import uuid

import httpx

from app.config import settings
from app.errors import api_error
from app.security import CurrentUser


async def _call(method: str, path: str, admin: CurrentUser, json=None):
    try:
        async with httpx.AsyncClient(base_url=settings.auth_service_url, timeout=5) as client:
            resp = await client.request(method, path, json=json, headers={"Authorization": f"Bearer {admin.token}"})
    except httpx.HTTPError:
        raise api_error(502, "AUTH_SERVICE_UNAVAILABLE", "Không kết nối được Auth Service")
    if resp.status_code >= 400:
        raise api_error(502, "AUTH_SERVICE_ERROR", "Auth Service trả lỗi", upstream=resp.json() if resp.content else None)
    return resp.json()


async def lookup_users(admin: CurrentUser, ids=(), usernames=()) -> dict[uuid.UUID, dict]:
    """Trả về {user_id: {"id", "username", "display_name", "status"}}."""
    ids, usernames = list({str(i) for i in ids}), list(usernames)
    if not ids and not usernames:
        return {}
    data = await _call("POST", "/admin/users/lookup", admin, {"ids": ids, "usernames": usernames})
    return {uuid.UUID(u["id"]): u for u in data}


async def get_user(admin: CurrentUser, user_id: uuid.UUID) -> dict:
    return await _call("GET", f"/admin/users/{user_id}", admin)


async def moderation_event(admin: CurrentUser, **payload) -> dict:
    body = {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in payload.items()}
    return await _call("POST", "/admin/moderation-events", admin, body)
