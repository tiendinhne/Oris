"""Tạo dữ liệu mẫu cho post_db.  Chạy:  python -m app.seed

Dùng cùng hàm user_uuid() với auth-service để author_id / reporter_id
trỏ đúng người dùng mẫu bên auth_db.
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.models import CaseStatus, MediaType, Post, PostMedia, Report, ReportCase, ReportReason, Visibility

NAMESPACE = uuid.UUID("6f1c2a5e-0000-4000-8000-000000000001")  # phải giống auth-service/app/seed.py


def user_uuid(username: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, username)


def post_uuid(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, "post:" + key)


NOW = datetime.now(timezone.utc)
ago = lambda hours: NOW - timedelta(hours=hours)  # noqa: E731

# key, tác giả, nội dung, quyền, bài cha, đăng cách đây (giờ)
POSTS = [
    ("spam-1", "baotran_99", "Mua follow giá rẻ, inbox ngay để nhận ưu đãi 1000 follow chỉ 50k!!!", Visibility.PUBLIC, None, 36),
    ("spam-2", "baotran_99", "Click link này để nhận quà miễn phí, số lượng có hạn: bit.ly/qua-tang-xxx", Visibility.PUBLIC, None, 60),
    ("rain", "minhanh.ng", "Hôm nay Sài Gòn mưa to quá, mọi người đi đường cẩn thận nha", Visibility.PUBLIC, None, 12),
    ("kiet-reply", "kiet.dang", "[Nội dung quấy rối mẫu dùng để thử chức năng báo cáo]", Visibility.PUBLIC, "rain", 10),
    ("pho", "thuha.le", "Review quán phở mới mở ở Quận 3, nước dùng đậm, giá ổn", Visibility.PUBLIC, None, 30),
    ("agree", "thinh.bd", "Mình cũng thấy vậy, đồng ý với bạn", Visibility.PUBLIC, "pho", 28),
    ("note", "lan.vo", "Ghi chú cá nhân: lịch học tuần sau", Visibility.PRIVATE, None, 100),
    ("spam-cu-3", "baotran_99", "Bán tài khoản game giá rẻ, liên hệ ngay", Visibility.PUBLIC, None, 30),
]

MEDIA = [  # key bài, loại, tên file
    ("rain", MediaType.IMAGE, "rain-1.jpg"),
    ("rain", MediaType.IMAGE, "rain-2.jpg"),
    ("pho", MediaType.VIDEO, "pho-review.mp4"),
]

# key bài, trạng thái nhóm, [(lý do, số lượng, mô tả)]
CASES = [
    ("spam-1", CaseStatus.PENDING, [(ReportReason.SPAM, 9, None), (ReportReason.OTHER, 2, "Có dấu hiệu lừa đảo"),
                                   (ReportReason.HARASSMENT, 1, None)]),
    ("spam-2", CaseStatus.PENDING, [(ReportReason.SPAM, 8, None)]),
    ("kiet-reply", CaseStatus.PENDING, [(ReportReason.HARASSMENT, 5, None)]),
    ("pho", CaseStatus.DISMISSED, [(ReportReason.SPAM, 1, None)]),
    ("spam-cu-3", CaseStatus.APPROVED, [(ReportReason.SPAM, 4, None)]),
]

ADMIN = user_uuid("admin")


async def main() -> None:
    async with SessionLocal() as db:
        if await db.scalar(select(Post).limit(1)):
            print("post_db đã có dữ liệu, bỏ qua seed.")
            return

        for key, author, content, vis, parent, hours in POSTS:
            post = Post(id=post_uuid(key), author_id=user_uuid(author), content=content, visibility=vis,
                        parent_id=post_uuid(parent) if parent else None, created_at=ago(hours))
            if key == "spam-cu-3":  # bài đã bị admin xóa trước đó
                post.deleted_at, post.removed_by, post.removal_reason = ago(24), ADMIN, ReportReason.SPAM
            db.add(post)
            await db.flush()  # bài cha phải có trước bài trả lời

        for i, (key, mtype, filename) in enumerate(MEDIA):
            db.add(PostMedia(post_id=post_uuid(key), type=mtype, storage_key=f"demo/{filename}",
                             url=f"/media/demo/{filename}", position=i))

        n_reports = 0
        for key, status, groups in CASES:
            post_time = next(p[5] for p in POSTS if p[0] == key)
            case = ReportCase(post_id=post_uuid(key), status=status, created_at=ago(post_time - 1))
            if status != CaseStatus.PENDING:
                case.resolved_by, case.resolved_at = ADMIN, ago(20)
            db.add(case)
            await db.flush()
            reporter_no = 1
            for reason, count, desc in groups:
                for _ in range(count):
                    db.add(Report(case_id=case.id, post_id=post_uuid(key), reason=reason, description=desc,
                                  reporter_id=user_uuid(f"user{reporter_no:02d}"),
                                  created_at=ago(post_time - 1 - reporter_no * 0.1)))
                    reporter_no += 1
                    n_reports += 1

        await db.commit()
        print(f"Đã tạo {len(POSTS)} bài viết, {len(MEDIA)} tệp media, {len(CASES)} nhóm báo cáo, {n_reports} báo cáo.")


if __name__ == "__main__":
    asyncio.run(main())
