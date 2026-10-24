"""Đăng ký, xác minh email, quên / đặt lại mật khẩu (BR-AU1, BR-AU3)."""
import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.errors import api_error
from app.models import EmailOtp, PasswordResetToken, RefreshToken, User, UserStatus
from app.notify import publish_event, send_email
from app.routers.auth import _issue_tokens
from app.schemas import TokenResponse

router = APIRouter(prefix="/auth", tags=["account"])

OTP_TTL, RESET_TTL, OTP_RESEND_GAP, OTP_MAX_TRIES = timedelta(minutes=10), timedelta(minutes=15), timedelta(seconds=60), 5
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[a-z0-9_.]{3,30}$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sha(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _password(v: str) -> str:
    if len(v) < 8 or not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("Mật khẩu tối thiểu 8 ký tự, gồm chữ và số")
    return v


class RegisterRequest(BaseModel):
    email: str
    username: str
    display_name: str = Field(min_length=1, max_length=50)
    password: str

    _pw = field_validator("password")(_password)

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        v = v.strip().lower()
        if not EMAIL_RE.match(v) or len(v) > 255:
            raise ValueError("Email không hợp lệ")
        return v

    @field_validator("username")
    @classmethod
    def _username(cls, v):
        v = v.strip().lower()
        if not USERNAME_RE.match(v):
            raise ValueError("Tên người dùng 3–30 ký tự: chữ thường, số, _ hoặc .")
        return v


class EmailRequest(BaseModel):
    email: str


class VerifyEmailRequest(BaseModel):
    email: str
    code: str = Field(min_length=4, max_length=6)  # 4 số khi dùng MOCK_OTP=1234, mã thật 6 số


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    _pw = field_validator("new_password")(_password)


async def _send_otp(db: AsyncSession, user: User) -> None:
    code = settings.mock_otp or f"{secrets.randbelow(10**6):06d}"  # TODO: bỏ MOCK_OTP trước khi chạy thật
    db.add(EmailOtp(user_id=user.id, code_hash=_sha(code), expires_at=_now() + OTP_TTL))
    send_email(user.email, "Mã xác minh Oris", f"Mã của bạn là {code}, hiệu lực 10 phút.")


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    fields = {}
    if await db.scalar(select(User.id).where(User.email == body.email)):
        fields["email"] = "Email đã được sử dụng"
    if await db.scalar(select(User.id).where(User.username == body.username)):
        fields["username"] = "Tên người dùng đã được sử dụng"
    if fields:
        raise api_error(409, "ALREADY_EXISTS", "Thông tin đã được sử dụng", fields=fields)
    user = User(email=body.email, username=body.username, display_name=body.display_name.strip(),
                password_hash=bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode())
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:  # hai yêu cầu trùng nhau cùng lúc
        raise api_error(409, "ALREADY_EXISTS", "Email hoặc tên người dùng đã được sử dụng")
    await _send_otp(db, user)
    await db.commit()
    return {"email": user.email, "status": user.status.value}


@router.post("/verify-email", response_model=TokenResponse)
async def verify_email(body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    """Xác minh xong thì đăng nhập luôn."""
    bad = api_error(400, "INVALID_OTP", "Mã không đúng hoặc đã hết hạn")
    user = await db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None or user.status != UserStatus.UNVERIFIED:
        raise bad
    otp = await db.scalar(select(EmailOtp).where(EmailOtp.user_id == user.id, EmailOtp.used_at.is_(None))
                          .order_by(EmailOtp.created_at.desc()).limit(1))
    if otp is None or otp.expires_at <= _now():
        raise bad
    if not secrets.compare_digest(otp.code_hash, _sha(body.code)):
        # đoán sai quá số lần cho phép thì hủy mã, buộc gửi lại
        otp.attempts += 1
        if otp.attempts >= OTP_MAX_TRIES:
            otp.used_at = _now()
        await db.commit()
        raise bad
    otp.used_at, user.status = _now(), UserStatus.ACTIVE
    tokens = await _issue_tokens(db, user)
    await db.commit()
    publish_event("UserIndexed", user_id=str(user.id), username=user.username, display_name=user.display_name,
                  avatar_url=user.avatar_url, status="ACTIVE")
    return tokens


@router.post("/resend-otp", status_code=204)
async def resend_otp(body: EmailRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None or user.status != UserStatus.UNVERIFIED:
        return  # không lộ email có tồn tại hay không
    last = await db.scalar(select(EmailOtp.created_at).where(EmailOtp.user_id == user.id)
                           .order_by(EmailOtp.created_at.desc()).limit(1))
    if last and _now() - last < OTP_RESEND_GAP:
        raise api_error(429, "OTP_TOO_SOON", "Vui lòng chờ 60 giây trước khi gửi lại mã")
    await db.execute(update(EmailOtp).where(EmailOtp.user_id == user.id, EmailOtp.used_at.is_(None))
                     .values(used_at=_now()))
    await _send_otp(db, user)
    await db.commit()


@router.post("/forgot-password", status_code=204)
async def forgot_password(body: EmailRequest, db: AsyncSession = Depends(get_db)):
    """Luôn trả 204 để không lộ email có tồn tại hay không (BR-AU3-01)."""
    user = await db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None or user.status in (UserStatus.UNVERIFIED, UserStatus.BANNED):
        return
    raw = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(user_id=user.id, token_hash=_sha(raw), expires_at=_now() + RESET_TTL))
    send_email(user.email, "Đặt lại mật khẩu Oris",
               f"Mở liên kết /reset-password?token={raw} (hiệu lực 15 phút, dùng một lần).")
    await db.commit()


@router.post("/reset-password", status_code=204)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    tok = await db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == _sha(body.token)))
    if tok is None or tok.used_at or tok.expires_at <= _now():
        raise api_error(400, "INVALID_RESET_TOKEN", "Liên kết không hợp lệ hoặc đã hết hạn")
    user = await db.get(User, tok.user_id)
    user.password_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    user.failed_login_count, user.login_locked_until = 0, None
    tok.used_at = _now()
    # đổi mật khẩu thì đăng xuất mọi thiết bị
    await db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
                     .values(revoked_at=_now()))
    await db.commit()
