"""Tạo tài khoản admin nếu chưa có (chạy lại không sao). Tự chạy khi Auth khởi động.

Đổi thông tin bằng biến môi trường ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME.
"""
import asyncio
import os

import bcrypt
from sqlalchemy import select

from app.database import SessionLocal
from app.models import User, UserRole, UserStatus

EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com").lower()
USERNAME = os.getenv("ADMIN_USERNAME", "admin")
PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@1234")


async def main() -> None:
    async with SessionLocal() as db:
        if await db.scalar(select(User.id).where(User.role == UserRole.ADMIN).limit(1)):
            print("Đã có tài khoản admin, bỏ qua.")
            return
        db.add(User(email=EMAIL, username=USERNAME, display_name="Quản trị viên", role=UserRole.ADMIN,
                    status=UserStatus.ACTIVE, password_hash=bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()))
        await db.commit()
        print(f"Đã tạo admin: {EMAIL}")


if __name__ == "__main__":
    asyncio.run(main())
