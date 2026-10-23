"""Đăng nhập, làm mới token, đăng xuất (UC Đăng nhập – BR-AU2)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.errors import api_error
from app.models import RefreshToken, User, UserBan, UserStatus
from app.schemas import LoginRequest, MeResponse, RefreshRequest, TokenResponse
from app.security import (
    CurrentUser, create_access_token, get_current_user, hash_refresh_token, new_refresh_token, verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILED = 5                    # BR-AU2-03
LOCK_DURATION = timedelta(minutes=15)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _active_ban(db: AsyncSession, user: User) -> UserBan | None:
    """Lần khóa đang còn hiệu lực. Khóa tạm đã hết hạn thì tự mở khóa (BR-AD1-05)."""
    ban = await db.scalar(
        select(UserBan).where(UserBan.user_id == user.id, UserBan.lifted_at.is_(None))
        .order_by(UserBan.starts_at.desc()).limit(1)
    )
    if ban and ban.ends_at is not None and ban.ends_at <= _now():
        ban.lifted_at, ban.lift_reason = ban.ends_at, "Tự động mở khóa khi hết hạn"
        user.status = UserStatus.ACTIVE
        return None
    return ban


async def _issue_tokens(db: AsyncSession, user: User) -> TokenResponse:
    raw, hashed = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=hashed,
                        expires_at=_now() + timedelta(days=settings.refresh_token_days)))
    return TokenResponse(
        access_token=create_access_token(user.id, user.username, user.role.value),
        refresh_token=raw, expires_in=settings.access_token_minutes * 60,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.strip().lower()))

    if user and user.login_locked_until and user.login_locked_until > _now():
        raise api_error(429, "LOGIN_LOCKED", "Đăng nhập sai quá nhiều lần, vui lòng thử lại sau",
                        locked_until=user.login_locked_until.isoformat())

    # Luôn chạy bcrypt kể cả khi email không tồn tại, để không lộ email qua thời gian phản hồi
    if not verify_password(body.password, user.password_hash if user else None) or user is None:
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= MAX_FAILED:
                user.failed_login_count, user.login_locked_until = 0, _now() + LOCK_DURATION
            await db.commit()
        raise api_error(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng")  # BR-AU2-01

    user.failed_login_count, user.login_locked_until = 0, None

    # BR-AU2-02: xử lý theo trạng thái tài khoản
    if user.status == UserStatus.UNVERIFIED:
        await db.commit()
        raise api_error(403, "EMAIL_NOT_VERIFIED", "Tài khoản chưa xác minh email")
    if user.status == UserStatus.BANNED:
        ban = await _active_ban(db, user)
        if ban:
            await db.commit()
            raise api_error(403, "ACCOUNT_BANNED", "Tài khoản đang bị khóa", reason=ban.reason,
                            ends_at=ban.ends_at.isoformat() if ban.ends_at else None)
    if user.status == UserStatus.DEACTIVATED:
        user.status = UserStatus.ACTIVE  # BR-AU5-03: đăng nhập lại trong 30 ngày thì khôi phục

    tokens = await _issue_tokens(db, user)
    await db.commit()
    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(body.refresh_token)))
    if not token or token.revoked_at or token.expires_at <= _now():
        raise api_error(401, "INVALID_REFRESH_TOKEN", "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại")
    user = await db.get(User, token.user_id)
    if user is None or user.status != UserStatus.ACTIVE:  # bị khóa hoặc xóa thì không cấp tiếp
        token.revoked_at = _now()
        await db.commit()
        raise api_error(401, "INVALID_REFRESH_TOKEN", "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại")
    return TokenResponse(access_token=create_access_token(user.id, user.username, user.role.value),
                         expires_in=settings.access_token_minutes * 60)


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Chỉ thu hồi phiên của thiết bị hiện tại (BR-AU2-04)."""
    token = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(body.refresh_token)))
    if token and not token.revoked_at:
        token.revoked_at = _now()
        await db.commit()


@router.get("/me", response_model=MeResponse)
async def me(current: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, current.id)
    if user is None:
        raise api_error(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản")
    return MeResponse(id=user.id, email=user.email, username=user.username, display_name=user.display_name,
                      role=user.role.value, status=user.status.value)
