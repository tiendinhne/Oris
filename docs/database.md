# Thiết kế cơ sở dữ liệu Oris

Mỗi service sở hữu một database PostgreSQL riêng (cùng một máy chủ, khác tài khoản, bị chặn truy cập chéo).
Tổng cộng **5 database, 31 bảng**. Sơ đồ ERD nằm trong `docs/erd/`.

| Database | Service | Ngôn ngữ | Model nằm ở | Tạo bảng bằng |
|---|---|---|---|---|
| `auth_db` (9 bảng) | auth-service | Python | `auth-service/app/models.py` | Alembic (`migrations/`) |
| `post_db` (9 bảng) | post-service | Python | `post-service/app/models.py` | Alembic |
| `notification_db` (3 bảng) | notification-service | TypeScript | `notification-service/src/notification.entity.ts` | TypeORM `synchronize` |
| `feed_db` (5 bảng) | feed-service | TypeScript | `feed-service/src/entities.ts` | TypeORM `synchronize` |
| `search_db` (5 bảng) | search-service | Python | `search-service/app/models.py` | Alembic |

**Quy ước tham chiếu:** cột trỏ sang bảng của service khác (ví dụ `posts.author_id` → `auth_db.users`) chỉ là UUID,
**không có khóa ngoại**, ghi chú `ref ...` trong model. Trên ERD được vẽ bằng nét đứt.
Các bảng `*_refs` và `*_index` là bản sao dữ liệu, sẽ được cập nhật qua sự kiện khi có message broker.

## auth_db

| Bảng | Nội dung | Ràng buộc / ghi chú |
|---|---|---|
| `users` | tài khoản, hồ sơ (tên hiển thị, tiểu sử, avatar, liên kết), vai trò, trạng thái, bộ đếm sai mật khẩu | email, username UNIQUE; status ∈ UNVERIFIED, ACTIVE, DEACTIVATED, BANNED |
| `email_otps` | mã OTP xác minh email (lưu băm), hạn 10 phút | BR-AU1-05 |
| `password_reset_tokens` | liên kết đặt lại mật khẩu (lưu băm), dùng một lần, hạn 15 phút | token_hash UNIQUE |
| `refresh_tokens` | phiên đăng nhập theo thiết bị (lưu băm) | token_hash UNIQUE |
| `follows` | ai theo dõi ai | PK (follower_id, following_id); CHECK không tự theo dõi |
| `blocks` | ai chặn ai | PK (blocker_id, blocked_id); CHECK không tự chặn |
| `user_bans` | lịch sử khóa / mở khóa | CHECK khóa tạm phải có ends_at |
| `violations` | số lần vi phạm (luật 3 lần / 90 ngày) | post_id: ref post_db |
| `audit_logs` | nhật ký thao tác admin | reason NOT NULL |

## post_db

| Bảng | Nội dung | Ràng buộc / ghi chú |
|---|---|---|
| `posts` | bài viết và trả lời (`parent_id`, `root_id`), quyền xem, quyền trả lời, số đếm, sửa, xóa mềm | content ≤ 500; author_id: ref auth_db |
| `post_media` | ảnh / video đính kèm | khung hiển thị 3:4 |
| `hashtags` | hashtag (chữ thường) | name UNIQUE |
| `post_hashtags` | bài ↔ hashtag | PK (post_id, hashtag_id) |
| `mentions` | người được @nhắc tên | PK (post_id, user_id) |
| `likes` | lượt thích | PK (user_id, post_id) – thích một lần |
| `reposts` | lượt đăng lại | PK (user_id, post_id) – đăng lại một lần |
| `report_cases` | nhóm báo cáo theo bài | UNIQUE(post_id) khi status = PENDING |
| `reports` | từng báo cáo | UNIQUE(reporter_id, post_id); CHECK "Khác" phải có mô tả |

## notification_db

| Bảng | Nội dung |
|---|---|
| `notifications` | thông báo của người nhận: loại (`kind`), nội dung, bài liên quan, khóa gộp, số người tác động, trạng thái đọc |
| `notification_actors` | từng người gây ra một thông báo gộp ("A và N người khác") – PK (notification_id, actor_id) |
| `notification_settings` | bật/tắt và phạm vi từng loại – PK (user_id, type); không có dòng nghĩa là bật |

## feed_db

| Bảng | Nội dung |
|---|---|
| `feed_items` | bảng tin dựng sẵn cho từng người – UNIQUE(owner_id, post_id) |
| `post_scores` | điểm phổ biến cho bảng tin khám phá |
| `hidden_posts` | bài người dùng đã ẩn |
| `muted_users` | người đã bị "ẩn mọi bài" |
| `follow_refs` | bản sao quan hệ theo dõi từ Auth |

## search_db

| Bảng | Nội dung |
|---|---|
| `user_index` | chỉ mục tìm người dùng theo username |
| `post_index` | chỉ mục tìm bài viết toàn văn (`tsvector`, chỉ mục GIN, extension `unaccent` để tìm không dấu) |
| `hashtag_usages` | hashtag được dùng khi nào – nguồn tính thịnh hành |
| `trending_hashtags` | top 10 hashtag trong 24 giờ |
| `block_refs` | bản sao quan hệ chặn từ Auth |

## Thay đổi model thì làm gì

- **Python (auth, post, search):** sửa `app/models.py` →
  `docker compose exec <service> alembic revision --autogenerate -m "mo ta"` → kiểm tra file sinh ra
  (kiểu enum mới phải tự thêm lệnh tạo kiểu; khóa ngoại nên đặt tên) → `alembic upgrade head`.
- **NestJS (notification, feed):** sửa entity, khởi động lại service; TypeORM tự đồng bộ bảng (`synchronize: true`).
