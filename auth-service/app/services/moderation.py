"""Nghiệp vụ khóa / mở khóa / vi phạm, dùng chung cho API admin."""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import api_error
from app.models import (
    AuditAction, AuditLog, BanType, RefreshToken, TargetType, User, UserBan, UserRole, UserStatus, Violation,
)
from app.notify import publish_event, system_notification

AUTO_BAN_THRESHOLD = 3            # BR-AD2-04
AUTO_BAN_WINDOW = timedelta(days=90)
AUTO_BAN_DAYS = 7


def now() -> datetime:
    return datetime.now(timezone.utc)


def audit(db: AsyncSession, admin_id: uuid.UUID, action: AuditAction, target_type: TargetType,
          target_id: uuid.UUID, reason: str) -> None:
    """BR-GEN-09: mọi thao tác admin đều ghi nhật ký."""
    db.add(AuditLog(admin_id=admin_id, action=action, target_type=target_type, target_id=target_id, reason=reason))


async def count_violations_90d(db: AsyncSession, user_id: uuid.UUID) -> int:
    return await db.scalar(select(func.count()).select_from(Violation).where(
        Violation.user_id == user_id, Violation.created_at >= now() - AUTO_BAN_WINDOW)) or 0


async def active_ban(db: AsyncSession, user_id: uuid.UUID) -> UserBan | None:
    return await db.scalar(select(UserBan).where(UserBan.user_id == user_id, UserBan.lifted_at.is_(None))
                           .order_by(UserBan.starts_at.desc()).limit(1))


async def ban_user(db: AsyncSession, user: User, admin_id: uuid.UUID, ban_type: BanType,
                   duration_days: int | None, reason: str) -> UserBan:
    if user.role == UserRole.ADMIN:
        raise api_error(409, "CANNOT_BAN_ADMIN", "Không được khóa tài khoản Quản trị viên")  # BR-AD1-03
    if user.status == UserStatus.BANNED:
        raise api_error(409, "ALREADY_BANNED", "Tài khoản đang bị khóa")
    start = now()
    ban = UserBan(user_id=user.id, admin_id=admin_id, type=ban_type, reason=reason, starts_at=start,
                  ends_at=start + timedelta(days=duration_days) if duration_days else None)
    db.add(ban)
    user.status = UserStatus.BANNED
    # BR-AD1-04: thu hồi mọi phiên đăng nhập
    await db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
                     .values(revoked_at=start))
    audit(db, admin_id, AuditAction.BAN_USER, TargetType.USER, user.id, reason)
    until = ban.ends_at.strftime("%d/%m/%Y %H:%M") if ban.ends_at else "vĩnh viễn"
    system_notification(user.id, f"[email] Tài khoản bị khóa ({until}). Lý do: {reason}")
    publish_event("UserBanned", user_id=str(user.id))
    return ban


async def unban_user(db: AsyncSession, user: User, admin_id: uuid.UUID, reason: str) -> None:
    if user.status != UserStatus.BANNED:
        raise api_error(409, "NOT_BANNED", "Tài khoản không ở trạng thái bị khóa")
    ban = await active_ban(db, user.id)
    if ban:
        ban.lifted_at, ban.lift_reason = now(), reason
    user.status = UserStatus.ACTIVE
    audit(db, admin_id, AuditAction.UNBAN_USER, TargetType.USER, user.id, reason)
    publish_event("UserUnbanned", user_id=str(user.id))


async def record_violation(db: AsyncSession, user: User, post_id: uuid.UUID | None, reason: str,
                           admin_id: uuid.UUID) -> tuple[int, bool]:
    """BR-AD2-03/04: ghi 1 lần vi phạm; đủ 3 lần trong 90 ngày thì tự khóa 7 ngày."""
    if post_id is None:
        raise api_error(400, "POST_ID_REQUIRED", "Thiếu post_id khi ghi vi phạm")
    db.add(Violation(user_id=user.id, post_id=post_id, reason=reason))
    await db.flush()
    count = await count_violations_90d(db, user.id)
    if count >= AUTO_BAN_THRESHOLD and user.status != UserStatus.BANNED and user.role != UserRole.ADMIN:
        await ban_user(db, user, admin_id, BanType.TEMPORARY, AUTO_BAN_DAYS,
                       f"Tự động: {count} lần vi phạm trong 90 ngày")
        return count, True
    return count, False
