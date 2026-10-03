"""Xác thực JWT và phân quyền. Post Service chỉ KIỂM TRA token (dùng chung JWT_SECRET), không phát token."""
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
