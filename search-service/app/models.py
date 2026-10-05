"""Model của Search & Trending Service – khớp ERD search_db.

Mọi bảng ở đây là bản sao / chỉ mục dựng từ sự kiện của Auth và Post (không có khóa ngoại sang service khác).
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserIndex(Base):
    """Chỉ mục tìm người dùng theo username, khớp tiền tố (BR-SE2-01)."""

    __tablename__ = "user_index"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # bản sao từ Auth
    username: Mapped[str] = mapped_column(String(30), unique=True)
    display_name: Mapped[str] = mapped_column(String(50))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    follower_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # dùng để xếp thứ tự
    status: Mapped[str] = mapped_column(String(20))  # chỉ trả về tài khoản ACTIVE (BR-GEN-04)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PostIndex(Base):
    """Chỉ mục tìm bài viết toàn văn, không dấu tiếng Việt (BR-SE1)."""

    __tablename__ = "post_index"
    __table_args__ = (
        Index("ix_post_index_search", "search_vector", postgresql_using="gin"),
        Index("ix_post_index_created", "created_at"),
    )

    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # bản sao từ Post
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    content: Mapped[str | None] = mapped_column(Text)
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR)  # unaccent(lower(content))
    popularity: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # thích + trả lời + đăng lại
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")  # Công khai, chưa xóa
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class HashtagUsage(Base):
    """Hashtag được dùng trong bài nào, khi nào – nguồn để tính thịnh hành (BR-SE3-01)."""

    __tablename__ = "hashtag_usages"
    __table_args__ = (Index("ix_hashtag_usages_tag_created", "hashtag", "created_at"),)

    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    hashtag: Mapped[str] = mapped_column(String(50), primary_key=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TrendingHashtag(Base):
    """Top 10 hashtag trong 24 giờ, tính lại mỗi 15 phút (BR-SE3-02)."""

    __tablename__ = "trending_hashtags"

    rank: Mapped[int] = mapped_column(Integer, primary_key=True)
    hashtag: Mapped[str] = mapped_column(String(50))
    post_count: Mapped[int] = mapped_column(Integer)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BlockRef(Base):
    """Bản sao quan hệ chặn từ Auth, để ẩn kết quả theo cả hai chiều (BR-SE2-02)."""

    __tablename__ = "block_refs"

    blocker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    blocked_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
