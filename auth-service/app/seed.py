"""Tạo dữ liệu mẫu cho auth_db.  Chạy:  python -m app.seed

ID người dùng được sinh cố định từ username (uuid5) để post-service
dùng cùng hàm user_uuid() và tham chiếu đúng người, dù hai DB tách rời.
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy import select

from app.database import SessionLocal
from app.models import AuditAction, AuditLog, BanType, TargetType, User, UserBan, UserRole, UserStatus, Violation

NAMESPACE = uuid.UUID("6f1c2a5e-0000-4000-8000-000000000001")  # phải giống post-service/app/seed.py


def user_uuid(username: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, username)


def post_uuid(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, "post:" + key)


def hash_pw(raw: str) -> str:
    return bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()


NOW = datetime.now(timezone.utc)
DEMO_PASSWORD = "Demo@1234"

# username, tên hiển thị, email, trạng thái, tạo cách đây (ngày)
USERS = [
    ("minhanh.ng", "Nguyễn Minh Anh", "minhanh@example.com", UserStatus.ACTIVE, 200),
    ("baotran_99", "Trần Quốc Bảo", "bao.tq@example.com", UserStatus.BANNED, 240),
    ("thuha.le", "Lê Thu Hà", "ha.lethu@example.com", UserStatus.ACTIVE, 245),
    ("giahuy", "Phạm Gia Huy", "huypg@example.com", UserStatus.UNVERIFIED, 2),
    ("lan.vo", "Võ Ngọc Lan", "lanvo@example.com", UserStatus.DEACTIVATED, 320),
    ("kiet.dang", "Đặng Tuấn Kiệt", "kietdt@example.com", UserStatus.ACTIVE, 280),
    ("maihoang_", "Hoàng Mai", "maih@example.com", UserStatus.ACTIVE, 120),
    ("thinh.bd", "Bùi Đức Thịnh", "thinhbd@example.com", UserStatus.ACTIVE, 24),
] + [  # người dùng phụ, đóng vai người gửi báo cáo
    (f"user{i:02d}", f"Người dùng {i:02d}", f"user{i:02d}@example.com", UserStatus.ACTIVE, 100 + i)
    for i in range(1, 13)
]


async def main() -> None:
    async with SessionLocal() as db:
        if await db.scalar(select(User).limit(1)):
            print("auth_db đã có dữ liệu, bỏ qua seed.")
            return

        admin = User(
            id=user_uuid("admin"), email="admin@example.com", username="admin",
            password_hash=hash_pw("Admin@1234"), display_name="Quản trị viên",
            role=UserRole.ADMIN, status=UserStatus.ACTIVE, created_at=NOW - timedelta(days=365),
        )
        db.add(admin)
        demo_hash = hash_pw(DEMO_PASSWORD)  # băm một lần, dùng chung cho người dùng mẫu
        for username, name, email, status, days in USERS:
            db.add(User(
                id=user_uuid(username), email=email, username=username, password_hash=demo_hash,
                display_name=name, status=status, created_at=NOW - timedelta(days=days),
            ))
        await db.flush()

        # Lịch sử vi phạm (BR-AD2-03): baotran_99 đủ 3 lần nên đang bị khóa 7 ngày
        violations = [
            ("baotran_99", "spam-cu-1", 40), ("baotran_99", "spam-cu-2", 12), ("baotran_99", "spam-cu-3", 1),
            ("kiet.dang", "kiet-cu-1", 30), ("kiet.dang", "kiet-cu-2", 8),
            ("thuha.le", "thuha-cu-1", 60),
        ]
        for username, post_key, days in violations:
            db.add(Violation(user_id=user_uuid(username), post_id=post_uuid(post_key),
                             reason="SPAM", created_at=NOW - timedelta(days=days)))

        # baotran_99 bị tự động khóa 7 ngày ở lần vi phạm thứ 3 (BR-AD2-04)
        ban_start = NOW - timedelta(days=1)
        db.add(UserBan(user_id=user_uuid("baotran_99"), admin_id=admin.id, type=BanType.TEMPORARY,
                       reason="Tự động: 3 lần vi phạm trong 90 ngày",
                       starts_at=ban_start, ends_at=ban_start + timedelta(days=7)))
        # kiet.dang từng bị khóa rồi được mở khóa
        db.add(UserBan(user_id=user_uuid("kiet.dang"), admin_id=admin.id, type=BanType.TEMPORARY,
                       reason="Quấy rối người dùng khác", starts_at=NOW - timedelta(days=5),
                       ends_at=NOW + timedelta(days=25), lifted_at=NOW - timedelta(days=3),
                       lift_reason="Khiếu nại hợp lệ, đã xác minh"))

        logs = [
            (AuditAction.BAN_USER, TargetType.USER, user_uuid("kiet.dang"), "Quấy rối người dùng khác", 5),
            (AuditAction.UNBAN_USER, TargetType.USER, user_uuid("kiet.dang"), "Khiếu nại hợp lệ, đã xác minh", 3),
            (AuditAction.DELETE_POST, TargetType.POST, post_uuid("spam-cu-3"), "SPAM", 1),
            (AuditAction.BAN_USER, TargetType.USER, user_uuid("baotran_99"), "Tự động: 3 lần vi phạm trong 90 ngày", 1),
        ]
        for action, ttype, tid, reason, days in logs:
            db.add(AuditLog(admin_id=admin.id, action=action, target_type=ttype, target_id=tid,
                            reason=reason, created_at=NOW - timedelta(days=days)))

        await db.commit()
        print(f"Đã tạo {len(USERS) + 1} người dùng, {len(violations)} vi phạm, 2 lần khóa, {len(logs)} nhật ký.")
        print("Đăng nhập admin: admin@example.com / Admin@1234  |  người dùng mẫu: mật khẩu", DEMO_PASSWORD)


if __name__ == "__main__":
    asyncio.run(main())
