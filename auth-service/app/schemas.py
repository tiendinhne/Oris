import uuid

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(examples=["admin@example.com"])
    password: str = Field(examples=["Admin@1234"])


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int  # giây


class MeResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    display_name: str
    role: str
    status: str


# ---------- Quản trị (bước 5) ----------
from datetime import datetime  # noqa: E402
from typing import Literal  # noqa: E402

from pydantic import field_validator, model_validator  # noqa: E402

from app.models import AuditAction, BanType, TargetType  # noqa: E402


def _required_text(v: str) -> str:
    v = (v or "").strip()
    if not v:
        raise ValueError("Bắt buộc nhập lý do")
    return v


class BanInfo(BaseModel):
    type: BanType
    reason: str
    starts_at: datetime
    ends_at: datetime | None


class AdminUserItem(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    display_name: str
    role: str
    status: str
    created_at: datetime
    violations_90d: int
    active_ban: BanInfo | None = None


class UserPage(BaseModel):
    items: list[AdminUserItem]
    next_cursor: str | None


class BanRequest(BaseModel):
    type: BanType
    duration_days: Literal[1, 3, 7, 30] | None = None  # BR-AD1-03
    reason: str = Field(max_length=500)

    _reason = field_validator("reason")(_required_text)

    @model_validator(mode="after")
    def check_duration(self):
        if self.type == BanType.TEMPORARY and self.duration_days is None:
            raise ValueError("Khóa tạm thời phải chọn thời hạn 1, 3, 7 hoặc 30 ngày")
        if self.type == BanType.PERMANENT and self.duration_days is not None:
            raise ValueError("Khóa vĩnh viễn không có thời hạn")
        return self


class UnbanRequest(BaseModel):
    reason: str = Field(max_length=500)
    _reason = field_validator("reason")(_required_text)


class UserLookupRequest(BaseModel):
    ids: list[uuid.UUID] = []
    usernames: list[str] = []


class UserBrief(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    status: str


class AuditLogItem(BaseModel):
    id: uuid.UUID
    created_at: datetime
    admin_username: str
    action: AuditAction
    target_type: TargetType
    target_id: uuid.UUID
    target_label: str | None  # @username nếu đối tượng là tài khoản
    reason: str


class AuditLogPage(BaseModel):
    items: list[AuditLogItem]
    next_cursor: str | None


class ModerationEvent(BaseModel):
    """Post Service báo về sau khi admin xử lý nội dung. admin_id lấy từ token, không nhận từ body."""

    action: Literal[AuditAction.DELETE_POST, AuditAction.APPROVE_REPORT, AuditAction.DISMISS_REPORT]
    target_type: Literal[TargetType.POST, TargetType.REPORT_CASE]
    target_id: uuid.UUID
    reason: str = Field(max_length=500)
    author_id: uuid.UUID | None = None  # có khi nội dung bị xóa → tính 1 lần vi phạm
    post_id: uuid.UUID | None = None

    _reason = field_validator("reason")(_required_text)


class ModerationResult(BaseModel):
    violations_90d: int | None = None
    auto_banned: bool = False
