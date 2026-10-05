"""Model của Post Service – khớp ERD cơ bản (post_db)."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, SmallInteger, String, UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Visibility(str, enum.Enum):
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"


class ReplyPermission(str, enum.Enum):
    EVERYONE = "EVERYONE"
    OFF = "OFF"


class MediaType(str, enum.Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"


class ReportReason(str, enum.Enum):
    SPAM = "SPAM"
    HARASSMENT = "HARASSMENT"
    HATE = "HATE"
    VIOLENCE = "VIOLENCE"
    SENSITIVE = "SENSITIVE"
    OTHER = "OTHER"


class CaseStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DISMISSED = "DISMISSED"
    CLOSED = "CLOSED"


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (Index("ix_posts_author_created", "author_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))  # ref auth_db.users
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("posts.id"), index=True)  # null = bài gốc
    root_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("posts.id"), index=True)    # bài gốc của thread
    content: Mapped[str | None] = mapped_column(String(500))  # BR-PO1-01: tối đa 500 ký tự
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility, name="post_visibility"), default=Visibility.PUBLIC)
    reply_permission: Mapped[ReplyPermission] = mapped_column(  # BR-PO1-04: Mọi người / Tắt trả lời
        Enum(ReplyPermission, name="reply_permission"), default=ReplyPermission.EVERYONE,
        server_default=ReplyPermission.EVERYONE.value)
    # Số đếm lưu sẵn để không phải đếm lại mỗi lần hiển thị
    like_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    reply_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    repost_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # BR-PO1-05: sửa trong 15 phút
    removed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))  # ref admin, null nếu không bị admin xóa
    removal_reason: Mapped[ReportReason | None] = mapped_column(Enum(ReportReason, name="report_reason"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # xóa mềm

    media: Mapped[list["PostMedia"]] = relationship(back_populates="post", order_by="PostMedia.position")
    replies: Mapped[list["Post"]] = relationship(back_populates="parent", foreign_keys="Post.parent_id")
    parent: Mapped["Post | None"] = relationship(back_populates="replies", remote_side=[id], foreign_keys=[parent_id])
    report_cases: Mapped[list["ReportCase"]] = relationship(back_populates="post")


class PostMedia(Base):
    __tablename__ = "post_media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    type: Mapped[MediaType] = mapped_column(Enum(MediaType, name="media_type"))
    url: Mapped[str] = mapped_column(String(500))
    storage_key: Mapped[str] = mapped_column(String(255))  # mã file trong MinIO / dịch vụ ngoài
    position: Mapped[int] = mapped_column(SmallInteger, default=0)

    post: Mapped[Post] = relationship(back_populates="media")


class ReportCase(Base):
    __tablename__ = "report_cases"
    __table_args__ = (
        # BR-AD3-04: mỗi bài chỉ có một nhóm báo cáo đang chờ
        Index("uq_report_cases_one_pending", "post_id", unique=True, postgresql_where=text("status = 'PENDING'")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id"))
    status: Mapped[CaseStatus] = mapped_column(Enum(CaseStatus, name="case_status"), default=CaseStatus.PENDING, index=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))  # ref admin
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    post: Mapped[Post] = relationship(back_populates="report_cases")
    reports: Mapped[list["Report"]] = relationship(back_populates="case")


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        # BR-PO6-01: mỗi người báo cáo một nội dung tối đa 1 lần
        UniqueConstraint("reporter_id", "post_id", name="uq_reports_reporter_post"),
        # BR-PO6-02: chọn "Khác" thì bắt buộc mô tả
        CheckConstraint(
            "reason <> 'OTHER' OR (description IS NOT NULL AND length(trim(description)) > 0)",
            name="ck_report_other_has_description",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("report_cases.id"), index=True)
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id"))
    reporter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))  # ref auth_db.users
    reason: Mapped[ReportReason] = mapped_column(Enum(ReportReason, name="report_reason"))
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped[ReportCase] = relationship(back_populates="reports")


class Hashtag(Base):
    """Hashtag, lưu dạng chữ thường (BR-PO1-03)."""

    __tablename__ = "hashtags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True)


class PostHashtag(Base):
    """Bài nào chứa hashtag nào (bảng nối nhiều – nhiều)."""

    __tablename__ = "post_hashtags"
    __table_args__ = (Index("ix_post_hashtags_hashtag", "hashtag_id"),)

    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    hashtag_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hashtags.id", ondelete="CASCADE"), primary_key=True)


class Mention(Base):
    """Người được @nhắc tên trong bài (BR-PO1-03)."""

    __tablename__ = "mentions"

    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # ref auth_db.users


class Like(Base):
    """Lượt thích; khóa chính ghép nên mỗi người thích một nội dung một lần (BR-PO4-01)."""

    __tablename__ = "likes"
    __table_args__ = (Index("ix_likes_post_created", "post_id", "created_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # ref auth_db.users
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Repost(Base):
    """Lượt đăng lại; mỗi người đăng lại một bài một lần (BR-PO5-02)."""

    __tablename__ = "reposts"
    __table_args__ = (Index("ix_reposts_post", "post_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # ref auth_db.users
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
