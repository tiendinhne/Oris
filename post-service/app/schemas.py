import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models import CaseStatus, ReportReason


class Author(BaseModel):
    id: uuid.UUID
    username: str | None  # None nếu tài khoản không còn
    display_name: str | None
    status: str | None = None


class MediaSummary(BaseModel):
    images: int = 0
    videos: int = 0


class AdminPostItem(BaseModel):
    id: uuid.UUID
    author: Author
    type: Literal["POST", "REPLY"]
    content: str | None
    visibility: str
    media: MediaSummary
    pending_reports: int
    created_at: datetime


class PostPage(BaseModel):
    items: list[AdminPostItem]
    next_cursor: str | None


class DeletePostRequest(BaseModel):
    reason: ReportReason  # BR-AD2-02: bắt buộc chọn lý do


class ModerationResponse(BaseModel):
    post_id: uuid.UUID
    author_violations_90d: int | None
    author_auto_banned: bool


class ReasonCount(BaseModel):
    reason: ReportReason
    count: int


class ReportCaseItem(BaseModel):
    id: uuid.UUID
    status: CaseStatus
    post: AdminPostItem
    report_count: int
    top_reason: ReportReason
    first_reported_at: datetime
    resolved_at: datetime | None


class ReportCasePage(BaseModel):
    items: list[ReportCaseItem]
    next_offset: int | None


class ReportCaseDetail(ReportCaseItem):
    reasons: list[ReasonCount]
    other_descriptions: list[str]
    author_violations_90d: int | None


class ApproveRequest(BaseModel):
    reason: ReportReason


class DismissRequest(BaseModel):
    reason: str = Field("Không vi phạm tiêu chuẩn cộng đồng", max_length=500)

    @field_validator("reason")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Bắt buộc nhập lý do")
        return v


# ---------- API người dùng thường ----------
from app.models import MediaType, ReplyPermission, Visibility  # noqa: E402


class MediaIn(BaseModel):
    type: MediaType
    url: str = Field(max_length=500)


class CreatePostRequest(BaseModel):
    content: str | None = Field(None, max_length=500)  # BR-PO1-01
    media: list[MediaIn] = Field(default_factory=list, max_length=4)
    visibility: Visibility = Visibility.PUBLIC
    reply_permission: ReplyPermission = ReplyPermission.EVERYONE

    @field_validator("content")
    @classmethod
    def _strip(cls, v):
        return (v or "").strip() or None


class UpdatePostRequest(BaseModel):
    content: str | None = Field(None, max_length=500)
    visibility: Visibility | None = None
    reply_permission: ReplyPermission | None = None


class ReportRequest(BaseModel):
    reason: ReportReason
    description: str | None = Field(None, max_length=500)


class UserCard(BaseModel):
    id: uuid.UUID
    username: str | None
    display_name: str | None
    avatar_url: str | None = None


class MediaOut(BaseModel):
    type: str
    url: str


class PostOut(BaseModel):
    id: uuid.UUID
    author: UserCard
    parent_id: uuid.UUID | None
    root_id: uuid.UUID | None
    content: str | None
    visibility: str
    reply_permission: str
    media: list[MediaOut]
    hashtags: list[str]
    like_count: int
    reply_count: int
    repost_count: int
    liked_by_me: bool
    reposted_by_me: bool
    is_mine: bool
    created_at: datetime
    edited_at: datetime | None


class PostListPage(BaseModel):
    items: list[PostOut]
    next_cursor: str | None


class UserListPage(BaseModel):
    items: list[UserCard]
    next_cursor: str | None
