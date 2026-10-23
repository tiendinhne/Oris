"""Xác thực JWT và phân quyền, cùng các hàm phát token (chỉ Auth Service phát token)."""
from dataclasses import dataclass
import uuid

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.errors import api_error

bearer = HTTPBearer(auto_error=False)  # Swagger hiện nút "Authorize" để dán token


@dataclass
class CurrentUser:
    id: uuid.UUID
    username: str
    role: str
    token: str = ""  # token gốc, để chuyển tiếp khi gọi service khác

    @property
    def is_admin(self) -> bool:
        return self.role == "ADMIN"


def decode_access_token(token: str) -> CurrentUser:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise api_error(401, "TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn")
    except jwt.InvalidTokenError:
        raise api_error(401, "INVALID_TOKEN", "Token không hợp lệ")
    if claims.get("type") != "access":
        raise api_error(401, "INVALID_TOKEN", "Token không hợp lệ")
    return CurrentUser(id=uuid.UUID(claims["sub"]), username=claims["username"], role=claims["role"])


async def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> CurrentUser:
    if creds is None:
        raise api_error(401, "NOT_AUTHENTICATED", "Chưa đăng nhập")
    user = decode_access_token(creds.credentials)
    user.token = creds.credentials
    return user


async def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Gắn vào mọi API /admin/... (BR-AD1-01)."""
    if not user.is_admin:
        raise api_error(403, "FORBIDDEN", "Chỉ Quản trị viên được thực hiện thao tác này")
    return user


# ---------- Phần chỉ có ở Auth Service ----------
import hashlib  # noqa: E402
import secrets  # noqa: E402
from datetime import datetime, timedelta, timezone  # noqa: E402

import bcrypt  # noqa: E402

# Hash giả để so sánh khi email không tồn tại, tránh lộ email qua thời gian phản hồi (BR-AU2-01)
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode()


def verify_password(raw: str, hashed: str | None) -> bool:
    return bcrypt.checkpw(raw.encode(), (hashed or _DUMMY_HASH).encode())


def create_access_token(user_id: uuid.UUID, username: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user_id), "username": username, "role": role, "type": "access",
        "iat": now, "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def new_refresh_token() -> tuple[str, str]:
    """Trả về (token gửi cho client, hash để lưu DB)."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
