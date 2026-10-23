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
