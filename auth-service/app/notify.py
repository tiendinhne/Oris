"""Tạm thời chỉ ghi log. Khi có Notification Service và RabbitMQ thì thay bằng phát sự kiện."""
import logging
import uuid

log = logging.getLogger("uvicorn.error")


def system_notification(user_id: uuid.UUID, message: str) -> None:
    log.info("[SYSTEM -> %s] %s", user_id, message)


def publish_event(name: str, **payload) -> None:
    log.info("[EVENT %s] %s", name, payload)
