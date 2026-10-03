# Admin project – Bước 2 → 6: backend quản trị và giao diện React

Gồm PostgreSQL (2 database riêng: `auth_db`, `post_db`), 2 service FastAPI: Auth (cổng 8001), Post (cổng 8002),
và giao diện quản trị React (cổng 5173).

**Mở trang quản trị:** http://localhost:5173 → đăng nhập `admin@example.com` / `Admin@1234` (nhớ chạy seed trước).

## Chạy

```bash
cp .env.example .env          # rồi đổi mật khẩu trong .env
docker compose up --build
```

## Tạo dữ liệu mẫu (bước 3)

Bảng được tạo tự động khi service khởi động (`alembic upgrade head`). Sau đó chạy:

```bash
docker compose exec auth-service python -m app.seed
docker compose exec post-service python -m app.seed
```

- Admin: `admin@example.com` / `Admin@1234`
- Người dùng mẫu: mật khẩu `Demo@1234` (ví dụ `minhanh@example.com`)
- Chạy lại seed khi đã có dữ liệu sẽ tự bỏ qua. Muốn làm lại từ đầu: `docker compose down -v`.

Dữ liệu mẫu khớp với bản thiết kế giao diện admin: 3 nhóm báo cáo đang chờ (12, 8, 5 báo cáo),
`baotran_99` đã vi phạm 3 lần và đang bị khóa 7 ngày, `kiet.dang` có 2 lần vi phạm, v.v.

## Đăng nhập và phân quyền admin (bước 4)

| API | Service | Mô tả |
|---|---|---|
| `POST /auth/login` | Auth | Đăng nhập bằng email + mật khẩu, trả access token (15 phút) và refresh token (7 ngày) |
| `POST /auth/refresh` | Auth | Đổi refresh token lấy access token mới |
| `POST /auth/logout` | Auth | Thu hồi phiên của thiết bị hiện tại |
| `GET /auth/me` | Auth | Thông tin người đang đăng nhập |
| `GET /admin/ping` | Auth, Post | Kiểm tra quyền admin |

Thử trên Swagger:
1. Mở http://localhost:8001/docs → `POST /auth/login` → *Try it out* với `admin@example.com` / `Admin@1234`.
2. Chép `access_token`, bấm nút **Authorize** ở góc trên, dán token vào.
3. Gọi `GET /admin/ping`. Dán cùng token vào http://localhost:8002/docs để thử bên Post.

Các tình huống nên thử khi demo: đăng nhập `minhanh@example.com` rồi gọi `/admin/ping` (403),
đăng nhập `bao.tq@example.com` (bị khóa, trả lý do và thời hạn), sai mật khẩu 5 lần (tạm khóa 15 phút).

Lỗi luôn có dạng `{"detail": {"code": "...", "message": "..."}}`, frontend dựa vào `code` để xử lý.

`JWT_SECRET` phải giống nhau ở mọi service và nên dài từ 32 ký tự trở lên.

## API quản trị (bước 5)

Tất cả cần token admin. Lỗi luôn có dạng `{"detail": {"code", "message"}}`; lỗi dữ liệu (422) có thêm `fields`.

**Auth Service (cổng 8001)** – trang Quản lý người dùng và Nhật ký thao tác

| API | Mô tả | Rule |
|---|---|---|
| `GET /admin/users?status=&q=&cursor=` | Danh sách, lọc trạng thái, tìm email/username, kèm số vi phạm 90 ngày và lần khóa hiện tại | BR-AD1-02 |
| `GET /admin/users/{id}` | Chi tiết một tài khoản | |
| `POST /admin/users/{id}/ban` | `{"type": "TEMPORARY", "duration_days": 7, "reason": "..."}` hoặc `{"type": "PERMANENT", "reason": "..."}` | BR-AD1-03, 04 |
| `POST /admin/users/{id}/unban` | `{"reason": "..."}` | BR-AD1-05 |
| `GET /admin/audit-logs?action=&days=&cursor=` | Nhật ký thao tác, chỉ xem | BR-GEN-09 |
| `POST /admin/users/lookup` | Nội bộ: Post đổi id ↔ username | |
| `POST /admin/moderation-events` | Nội bộ: Post báo thao tác để ghi nhật ký và tính vi phạm | BR-AD2-03, 04 |

**Post Service (cổng 8002)** – trang Quản lý bài viết và Báo cáo vi phạm

| API | Mô tả | Rule |
|---|---|---|
| `GET /admin/posts?q=&type=&days=&reported_only=&cursor=` | Mọi bài và trả lời chưa xóa, kể cả Riêng tư. `q` bắt đầu bằng `@` thì tìm theo username tác giả | BR-AD2-01 |
| `GET /admin/posts/{id}` | Chi tiết bài | |
| `DELETE /admin/posts/{id}` | `{"reason": "SPAM"}` – xóa không khôi phục, tính 1 vi phạm, đủ 3 lần thì tự khóa 7 ngày | BR-AD2-02 → 04 |
| `GET /admin/reports?status=PENDING&offset=` | Nhóm báo cáo, đang chờ xếp theo số báo cáo giảm dần | BR-AD3-01 |
| `GET /admin/reports/{case_id}` | Chi tiết: lý do kèm số lượng, mô tả "Khác", số vi phạm của tác giả | BR-AD3-02 |
| `POST /admin/reports/{case_id}/approve` | `{"reason": "SPAM"}` – xóa nội dung như trên | BR-AD3-03 |
| `POST /admin/reports/{case_id}/dismiss` | `{"reason": "..."}` (không bắt buộc) | BR-AD3-04 |

**Cách hai service phối hợp:** khi admin xóa bài hoặc duyệt báo cáo, Post Service cập nhật `post_db`,
rồi gọi `POST /admin/moderation-events` bên Auth (chuyển tiếp token của admin) **trước khi commit**.
Auth lỗi hoặc không chạy thì toàn bộ thay đổi bên Post bị hủy, trả lỗi 502, dữ liệu hai bên không lệch nhau.
Thông báo SYSTEM, email và sự kiện hiện chỉ ghi ra log (`app/notify.py`), sẽ thay khi có Notification Service và RabbitMQ.

**Kịch bản demo gợi ý:** xóa một bài của `kiet.dang` (đang có 2 vi phạm) → API trả `author_auto_banned: true`
→ trang người dùng thấy `kiet.dang` bị khóa 7 ngày → nhật ký có đủ `DELETE_POST` và `BAN_USER`.

## Giao diện quản trị (bước 6)

React + Vite, thư mục `admin-web/`. Gồm trang Đăng nhập, Người dùng, Bài viết, Báo cáo vi phạm, Nhật ký thao tác
và các hộp thoại Khóa, Mở khóa, Xóa bài – bám theo bản thiết kế.

- Trình duyệt chỉ gọi `/api/auth/...` và `/api/post/...`; Vite chuyển tiếp sang từng service (`vite.config.js`),
  nên không cần cấu hình CORS. Khi có API Gateway thì trỏ cả hai về Gateway.
- Token lưu ở `localStorage`; access token hết hạn thì tự gọi `/auth/refresh` rồi thử lại (`src/api.js`).
- Tài khoản không phải admin đăng nhập sẽ bị từ chối ngay ở màn hình đăng nhập.

Chạy riêng giao diện không cần Docker (backend vẫn chạy ở 8001, 8002):

```bash
cd admin-web
npm install
npm run dev        # mở http://localhost:5173
```

```
admin-web/src/
  api.js            # gọi API, tự làm mới token, gom lỗi
  auth.jsx          # đăng nhập / đăng xuất, chỉ cho admin
  labels.js         # nhãn tiếng Việt cho enum, định dạng ngày giờ Việt Nam
  components/       # Layout (thanh bên), Modal, Badge, Toast, useCursorList (phân trang "Xem thêm")
  pages/            # Users, Posts, Reports, AuditLogs, Login
  dialogs/          # BanDialog, UnbanDialog, DeletePostDialog
  styles.css
```

## Đổi model thì làm gì

Sửa `app/models.py`, rồi sinh migration mới và áp dụng:

```bash
docker compose exec auth-service alembic revision --autogenerate -m "mo ta thay doi"
docker compose exec auth-service alembic upgrade head
```

Mở file migration vừa sinh trong `migrations/versions/` để kiểm tra trước khi áp dụng.

## Kiểm tra

- http://localhost:8001/health → `{"service":"auth-service","database":"ok"}`
- http://localhost:8002/health → `{"service":"post-service","database":"ok"}`
- Tài liệu API tự sinh: http://localhost:8001/docs và http://localhost:8002/docs

Chứng minh mỗi service chỉ vào được database của mình:

```bash
docker compose exec postgres psql -U auth_user -d post_db
# → FATAL: permission denied for database "post_db"
```

## Lưu ý

- Script `db/init/01-create-databases.sh` chỉ chạy **lần đầu**, khi volume còn trống.
  Đổi mật khẩu trong `.env` hoặc sửa script thì phải xóa volume rồi chạy lại:
  `docker compose down -v && docker compose up --build`
- Thư mục của mỗi service được gắn vào container, sửa code là service tự nạp lại.

## Cấu trúc

```
docker-compose.yml
.env.example
db/init/01-create-databases.sh   # tạo auth_db, post_db và tài khoản riêng
auth-service/
  Dockerfile, requirements.txt
  app/config.py     # đọc biến môi trường
  app/database.py   # kết nối DB, lớp Base cho model, dependency get_db
  app/main.py       # app FastAPI + /health
  app/models.py     # model SQLAlchemy theo ERD (bước 3)
  app/seed.py       # dữ liệu mẫu (bước 3)
  app/security.py   # đọc JWT, get_current_user, require_admin (bước 4)
  app/errors.py     # định dạng lỗi chung
  app/routers/      # auth.py (chỉ Auth), admin.py (bước 5)
  app/services/     # chỉ Auth: moderation.py – khóa, mở khóa, vi phạm, tự khóa
  app/clients/      # chỉ Post: auth_client.py – gọi sang Auth
  app/pagination.py # phân trang cursor
  app/notify.py     # tạm ghi log thay cho thông báo / sự kiện
  migrations/       # Alembic: lịch sử thay đổi bảng
  alembic.ini
post-service/       # cấu trúc giống auth-service
```
