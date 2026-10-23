"""API quản trị của Auth Service: người dùng, khóa / mở khóa, nhật ký (UC Quản trị 1 + BR-GEN-09)."""
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.errors import api_error
from app.models import AuditAction, AuditLog, TargetType, User, UserBan, UserStatus, Violation
from app.pagination import keyset_filter, page
from app.schemas import (
    AdminUserItem, AuditLogItem, AuditLogPage, BanInfo, BanRequest, ModerationEvent, ModerationResult, UnbanRequest,
    UserBrief, UserLookupRequest, UserPage,
)
from app.security import CurrentUser, require_admin
from app.services import moderation as mod

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/ping")
async def ping(admin: CurrentUser = Depends(require_admin)):
    return {"service": settings.service_name, "admin": admin.username}


# ---------- Người dùng ----------

async def _to_items(db: AsyncSession, users: list[User]) -> list[AdminUserItem]:
    ids = [u.id for u in users]
    counts = dict((await db.execute(
        select(Violation.user_id, func.count()).where(Violation.user_id.in_(ids),
                                                      Violation.created_at >= mod.now() - timedelta(days=90))
        .group_by(Violation.user_id))).all()) if ids else {}
    bans = {b.user_id: b for b in (await db.scalars(
        select(UserBan).where(UserBan.user_id.in_(ids), UserBan.lifted_at.is_(None)))).all()} if ids else {}
    items = []
    for u in users:
        ban = bans.get(u.id) if u.status == UserStatus.BANNED else None
        items.append(AdminUserItem(
            id=u.id, email=u.email, username=u.username, display_name=u.display_name, role=u.role.value,
            status=u.status.value, created_at=u.created_at, violations_90d=counts.get(u.id, 0),
            active_ban=BanInfo(type=ban.type, reason=ban.reason, starts_at=ban.starts_at, ends_at=ban.ends_at) if ban else None,
        ))
    return items


@router.get("/users", response_model=UserPage)
async def list_users(status: UserStatus | None = None,
                     q: str | None = Query(None, description="Tìm theo email hoặc username"),
                     cursor: str | None = None, db: AsyncSession = Depends(get_db)):
    """BR-AD1-02: lọc theo trạng thái, tìm theo email / username, mới tạo trước."""
    stmt = select(User)
    if status:
        stmt = stmt.where(User.status == status)
    if q and q.strip():
        term = f"%{q.strip().lstrip('@').lower()}%"
        stmt = stmt.where(or_(User.email.ilike(term), User.username.ilike(term)))
    rows = (await db.scalars(keyset_filter(stmt, User.created_at, User.id, cursor))).all()
    rows, next_cursor = page(list(rows))
    return UserPage(items=await _to_items(db, rows), next_cursor=next_cursor)


async def _get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise api_error(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản")
    return user


@router.get("/users/{user_id}", response_model=AdminUserItem)
async def get_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return (await _to_items(db, [await _get_user(db, user_id)]))[0]


@router.post("/users/lookup", response_model=list[UserBrief])
async def lookup_users(body: UserLookupRequest, db: AsyncSession = Depends(get_db)):
    """Cho Post Service đổi author_id ↔ username (hai DB tách rời nên phải hỏi qua API)."""
    if not body.ids and not body.usernames:
        return []
    users = (await db.scalars(select(User).where(or_(
        User.id.in_(body.ids), User.username.in_([u.lstrip("@").lower() for u in body.usernames]))))).all()
    return [UserBrief(id=u.id, username=u.username, display_name=u.display_name, status=u.status.value) for u in users]


@router.post("/users/{user_id}/ban", response_model=AdminUserItem)
async def ban(user_id: uuid.UUID, body: BanRequest, admin: CurrentUser = Depends(require_admin),
              db: AsyncSession = Depends(get_db)):
    user = await _get_user(db, user_id)
    await mod.ban_user(db, user, admin.id, body.type, body.duration_days, body.reason)
    await db.commit()
    return (await _to_items(db, [user]))[0]


@router.post("/users/{user_id}/unban", response_model=AdminUserItem)
async def unban(user_id: uuid.UUID, body: UnbanRequest, admin: CurrentUser = Depends(require_admin),
                db: AsyncSession = Depends(get_db)):
    """BR-AD1-05: mở khóa thủ công bắt buộc ghi lý do."""
    user = await _get_user(db, user_id)
    await mod.unban_user(db, user, admin.id, body.reason)
    await db.commit()
    return (await _to_items(db, [user]))[0]


# ---------- Nhật ký thao tác ----------

@router.get("/audit-logs", response_model=AuditLogPage)
async def list_audit_logs(action: AuditAction | None = None,
                          days: int | None = Query(None, ge=1, description="Chỉ lấy N ngày gần nhất"),
                          cursor: str | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if days:
        stmt = stmt.where(AuditLog.created_at >= mod.now() - timedelta(days=days))
    rows = (await db.scalars(keyset_filter(stmt, AuditLog.created_at, AuditLog.id, cursor))).all()
    rows, next_cursor = page(list(rows))
    user_ids = {r.admin_id for r in rows} | {r.target_id for r in rows if r.target_type == TargetType.USER}
    names = dict((await db.execute(select(User.id, User.username).where(User.id.in_(user_ids)))).all()) if user_ids else {}
    return AuditLogPage(next_cursor=next_cursor, items=[AuditLogItem(
        id=r.id, created_at=r.created_at, admin_username=names.get(r.admin_id, "?"), action=r.action,
        target_type=r.target_type, target_id=r.target_id, reason=r.reason,
        target_label=f"@{names[r.target_id]}" if r.target_type == TargetType.USER and r.target_id in names else None,
    ) for r in rows])


# ---------- Post Service báo về ----------

@router.post("/moderation-events", response_model=ModerationResult)
async def moderation_event(body: ModerationEvent, admin: CurrentUser = Depends(require_admin),
                           db: AsyncSession = Depends(get_db)):
    """Ghi nhật ký cho thao tác admin bên Post; nếu nội dung bị xóa thì tính vi phạm cho tác giả."""
    mod.audit(db, admin.id, body.action, body.target_type, body.target_id, body.reason)
    result = ModerationResult()
    if body.author_id and body.action in (AuditAction.DELETE_POST, AuditAction.APPROVE_REPORT):
        author = await db.get(User, body.author_id)
        if author:
            result.violations_90d, result.auto_banned = await mod.record_violation(
                db, author, body.post_id, body.reason, admin.id)
    await db.commit()
    return result
