"""Model của Auth Service – khớp ERD cơ bản (auth_db)."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class UserStatus(str, enum.Enum):
    UNVERIFIED = "UNVERIFIED"
    ACTIVE = "ACTIVE"
    DEACTIVATED = "DEACTIVATED"
    BANNED = "BANNED"


class BanType(str, enum.Enum):
    TEMPORARY = "TEMPORARY"
    PERMANENT = "PERMANENT"


class AuditAction(str, enum.Enum):
    BAN_USER = "BAN_USER"
    UNBAN_USER = "UNBAN_USER"
    DELETE_POST = "DELETE_POST"
    APPROVE_REPORT = "APPROVE_REPORT"
    DISMISS_REPORT = "DISMISS_REPORT"


class TargetType(str, enum.Enum):
    USER = "USER"
    POST = "POST"
    REPORT_CASE = "REPORT_CASE"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    username: Mapped[str] = mapped_column(String(30), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(50))
    bio: Mapped[str | None] = mapped_column(String(150))             # BR-AU4-01: tiểu sử tối đa 150 ký tự
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    link_url: Mapped[str | None] = mapped_column(String(500))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), default=UserRole.USER)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"), default=UserStatus.UNVERIFIED, index=True
    )
    # BR-AU2-03: sai mật khẩu 5 lần thì tạm khóa đăng nhập 15 phút
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    login_locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    username_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # BR-AU4-03: 30 ngày/lần
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))       # BR-AU5: xóa hẳn sau 30 ngày
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bans: Mapped[list["UserBan"]] = relationship(back_populates="user", foreign_keys="UserBan.user_id")
    violations: Mapped[list["Violation"]] = relationship(back_populates="user")


class UserBan(Base):
    __tablename__ = "user_bans"
    __table_args__ = (
        # BR-AD1-03: khóa tạm thời bắt buộc có thời hạn
        CheckConstraint("type <> 'TEMPORARY' OR ends_at IS NOT NULL", name="ck_temporary_ban_has_end"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    admin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    type: Mapped[BanType] = mapped_column(Enum(BanType, name="ban_type"))
    reason: Mapped[str] = mapped_column(String(500))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # null = vĩnh viễn
    lifted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lift_reason: Mapped[str | None] = mapped_column(String(500))

    user: Mapped[User] = relationship(back_populates="bans", foreign_keys=[user_id])


class Violation(Base):
    __tablename__ = "violations"
    __table_args__ = (Index("ix_violations_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))  # ref post_db, không có FK
    reason: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="violations")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction, name="audit_action"))
    target_type: Mapped[TargetType] = mapped_column(Enum(TargetType, name="audit_target_type"))
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    reason: Mapped[str] = mapped_column(String(500))  # BR-GEN-09: bắt buộc
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class RefreshToken(Base):
    """Mỗi dòng là một phiên đăng nhập trên một thiết bị (BR-AU2-04)."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)  # chỉ lưu SHA-256, không lưu token gốc
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EmailOtp(Base):
    """Mã OTP xác minh email khi đăng ký (BR-AU1-05). Chỉ lưu bản băm."""

    __tablename__ = "email_otps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # hiệu lực 10 phút
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PasswordResetToken(Base):
    """Liên kết đặt lại mật khẩu, dùng một lần, hiệu lực 15 phút (BR-AU3-02)."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Follow(Base):
    """Quan hệ theo dõi; khóa chính ghép nên không theo dõi trùng (BR-AU6-02)."""

    __tablename__ = "follows"
    __table_args__ = (
        CheckConstraint("follower_id <> following_id", name="ck_follows_not_self"),
        Index("ix_follows_following", "following_id", "created_at"),
    )

    follower_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    following_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Block(Base):
    """Quan hệ chặn, có hiệu lực hai chiều khi xét hiển thị (BR-GEN-05, BR-AU8)."""

    __tablename__ = "blocks"
    __table_args__ = (
        CheckConstraint("blocker_id <> blocked_id", name="ck_blocks_not_self"),
        Index("ix_blocks_blocked", "blocked_id"),
    )

    blocker_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    blocked_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
