"""Tạm thời chỉ ghi log. Khi có Notification Service và RabbitMQ thì thay bằng phát sự kiện."""
import asyncio
import logging
import smtplib
from email.message import EmailMessage
import uuid

import httpx

from app.config import settings

log = logging.getLogger("uvicorn.error")


def system_notification(user_id: uuid.UUID, message: str) -> None:
    log.info("[SYSTEM -> %s] %s", user_id, message)


def _smtp_send(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.smtp_from or settings.smtp_user, to, subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as s:
            s.starttls()
            s.login(settings.smtp_user, settings.smtp_password.replace(" ", ""))  # Google hiện mật khẩu ứng dụng kèm dấu cách
            s.send_message(msg)
    except (OSError, smtplib.SMTPException):
        log.exception("Không gửi được email tới %s", to)  # mail hỏng không làm hỏng đăng ký / đặt lại mật khẩu


def send_email(to: str, subject: str, body: str) -> None:
    """Có cấu hình SMTP thì gửi thật (chạy nền, không chặn request); không thì chỉ ghi log để lấy mã khi phát triển."""
    if not settings.smtp_host:
        log.info("[EMAIL -> %s] %s | %s", to, subject, body)
        return
    log.info("[EMAIL -> %s] %s (đã gửi qua SMTP)", to, subject)
    asyncio.get_running_loop().run_in_executor(None, _smtp_send, to, subject, body)


_TYPES = {"PostLiked": ("LIKE", False), "PostUnliked": ("LIKE", True), "PostReposted": ("REPOST", False),
          "PostUnreposted": ("REPOST", True), "PostReplied": ("REPLY", False), "UserMentioned": ("MENTION", False),
          "UserFollowed": ("FOLLOW", False), "UserUnfollowed": ("FOLLOW", True)}
_FEED_EVENTS = {"PostCreated", "PostDeleted", "PostLiked", "PostUnliked", "PostReposted", "PostUnreposted",
                "PostReplied", "UserFollowed", "UserUnfollowed"}
_SEARCH_EVENTS = {"UserIndexed", "UserBanned", "UserUnbanned", "UserDeactivated", "UserFollowed", "UserUnfollowed",
                  "UserBlocked", "UserUnblocked", "PostCreated", "PostEdited", "PostDeleted", "PostLiked", "PostUnliked",
                  "PostReposted", "PostUnreposted", "PostReplied"}
_tasks: set = set()  # giữ tham chiếu để tác vụ nền không bị thu hồi giữa chừng


async def _forward(base_url: str, body: dict) -> None:
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=3) as c:
            await c.post("/internal/events", json=body, headers={"X-Internal-Key": settings.internal_api_key})
    except httpx.HTTPError:
        log.warning("Không gửi được sự kiện sang %s: %s", base_url, body)  # sự kiện hỏng không làm hỏng thao tác chính


def _spawn(base_url: str, body: dict) -> None:
    task = asyncio.create_task(_forward(base_url, body))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


def publish_event(name: str, **payload) -> None:
    """Chuyển sự kiện sang Notification và Feed (không chờ kết quả); sự kiện khác chỉ ghi log."""
    log.info("[EVENT %s] %s", name, payload)
    if not settings.internal_api_key:
        return
    payload = {k: v for k, v in payload.items() if v is not None}
    if name in _TYPES:
        type_, remove = _TYPES[name]
        _spawn(settings.notification_service_url, {"type": type_, "remove": remove, **payload})
    if name in _FEED_EVENTS:
        _spawn(settings.feed_service_url, {"name": name, **payload})
    if name in _SEARCH_EVENTS:
        _spawn(settings.search_service_url, {"name": name, **payload})
