# Danh sách API của Oris

Tài liệu này liệt kê **mọi endpoint hiện có** của 5 microservice, lấy trực tiếp từ code (không lấy từ README). Cách chạy demo từng bước nằm ở tài liệu riêng, ở đây chỉ là bảng tra cứu.

| Service | Ngôn ngữ | Cổng host | Qua proxy user-web (Vite) |
|---|---|---|---|
| auth-service | FastAPI (Python) | 8001 | `/api/auth/...` |
| post-service | FastAPI (Python) | 8002 | `/api/post/...` |
| notification-service | NestJS (TypeScript) | 8003 | `/api/notification/...` |
| feed-service | NestJS (TypeScript) | 8004 | `/api/feed/...` |
| search-service | FastAPI (Python) | 8005 | `/api/search/...` |

- Gọi trực tiếp: `http://localhost:<cổng>/<path>`, ví dụ `http://localhost:8001/auth/login`.
- Gọi qua user-web: `/api/<service>/<path>`; Vite **bỏ tiền tố** `/api/<service>` trước khi chuyển tiếp, nên `/api/auth/auth/login` tới service là `/auth/login`. Bảng bên dưới luôn ghi **path thật của service** (chưa có tiền tố proxy).
- Tham số trong đường dẫn viết dạng `{ten}`.
- Các service Python tự sinh Swagger tại `/docs` (ví dụ `http://localhost:8001/docs`).

## 1. Quy ước chung

### 1.1 Xác thực

- Cột **Quyền** trong các bảng dùng 4 giá trị:

| Giá trị | Ý nghĩa |
|---|---|
| `Công khai` | Không cần token. |
| `Đăng nhập` | Cần header `Authorization: Bearer <access_token>`. |
| `Admin` | Như `Đăng nhập` và token phải có `role = ADMIN`; không đủ quyền trả 403 `FORBIDDEN`. |
| `Nội bộ (X-Internal-Key)` | Chỉ để service gọi service, cần header `X-Internal-Key` đúng với `INTERNAL_API_KEY`; sai trả 403 `FORBIDDEN`. Người dùng không gọi các endpoint này. |

- **Access token** là JWT (HS256) hạn **15 phút**, do auth-service phát; mọi service dùng chung `JWT_SECRET` để tự kiểm tra, không hỏi lại auth-service.
- **Refresh token** hạn **7 ngày**, lưu băm trong DB, dùng với `POST /auth/refresh` (lấy access token mới) và `POST /auth/logout` (thu hồi phiên của thiết bị hiện tại).
- Lỗi xác thực: 401 `NOT_AUTHENTICATED` (thiếu token), `TOKEN_EXPIRED` (hết hạn), `INVALID_TOKEN` (sai token hoặc không phải access token).

### 1.2 Định dạng lỗi

Mọi lỗi (kể cả của service NestJS) có cùng dạng:

```json
{ "detail": { "code": "ALREADY_EXISTS", "message": "Thông tin đã được sử dụng", "...": "trường bổ sung tùy lỗi" } }
```

- `code` là chuỗi ổn định để frontend xử lý; `message` là tiếng Việt hiển thị được.
- **422 `VALIDATION_ERROR`**: `detail.fields` là **mảng** `[{ "field": "password", "message": "..." }]`.
- **409 `ALREADY_EXISTS`** (đăng ký, đổi username): `detail.fields` là **object** `{ "email": "...", "username": "..." }`. Hai dạng `fields` khác nhau, frontend cần phân biệt theo mã trạng thái.
- Một số lỗi mang thêm trường riêng: `LOGIN_LOCKED` có `locked_until`; `ACCOUNT_BANNED` có `reason`, `ends_at`; `USERNAME_COOLDOWN` có `available_at`.

### 1.3 Phân trang

Mỗi trang 20 mục (riêng `GET /notifications` mặc định 20, tối đa 100 qua `limit`). Có hai kiểu, **không trộn lẫn**:

| Kiểu | Tham số gửi lên | Trường trả về | Endpoint dùng |
|---|---|---|---|
| **Cursor** | `cursor` (chuỗi mờ, lấy nguyên từ lần trước, đừng tự dựng) | `next_cursor` (`null` khi hết) | `GET /posts/by-user/{username}`, `GET /hashtags/{name}/posts`, `GET /posts/{post_id}/replies`, `GET /posts/{post_id}/likes` (xem lưu ý), `GET /admin/posts` (post), `GET /admin/users`, `GET /admin/audit-logs` (auth), `GET /notifications`, `GET /feed` |
| **Offset** | `offset` (số nguyên >= 0) | `next_offset` (`null` khi hết) | `GET /users/{username}/followers`, `GET /users/{username}/following`, `GET /admin/reports` (post), `GET /feed/explore`, `GET /search/users`, `GET /search/posts` |

Lưu ý: `GET /posts/{post_id}/likes` dùng tên `cursor` / `next_cursor` nhưng giá trị thực chất là **offset dạng chuỗi** (ví dụ `"20"`). Cứ gửi lại `next_cursor` nhận được là đúng.

### 1.4 OTP giả (tạm thời)

Mã OTP xác minh email hiện **luôn là `1234`** (biến môi trường `MOCK_OTP`, mặc định `1234` trong `docker-compose.yml`) và email chỉ được ghi log nếu chưa cấu hình SMTP. Đây là cấu hình **tạm thời** để demo; đặt `MOCK_OTP=` (trống) trong `.env` để sinh mã 6 số thật. Mã hết hạn sau 10 phút, nhập sai 5 lần thì phải gửi lại.

### 1.5 Sai lệch đã biết giữa README và code

README nhắc `GET /users/me`, nhưng **không có route này**. Thông tin người đang đăng nhập lấy bằng `GET /auth/me` (auth-service). `/users/me` chỉ tồn tại với các method khác: `PATCH`, `DELETE`, `GET /users/me/blocks`, `GET /users/me/relations`, `POST /users/me/password`.

### 1.6 Tổng quan số lượng

| Service | Số endpoint |
|---|---|
| auth-service | 31 |
| post-service | 24 |
| notification-service | 9 |
| feed-service | 8 |
| search-service | 5 |
| **Tổng** | **77** |

`GET /health` có ở cả 5 service và `GET /admin/ping` có ở **cả auth-service và post-service** (hai route riêng, cùng trả `{service, admin}`).

---

## 2. auth-service (cổng 8001, `/api/auth`)

### 2.1 Hệ thống

| Method | Path | Quyền | Tham số | Mô tả | Rule |
|---|---|---|---|---|---|
| GET | `/health` | Công khai | không | Kiểm tra service chạy và kết nối được `auth_db`. | |

### 2.2 Đăng ký, đăng nhập, phiên

| Method | Path | Quyền | Tham số | Mô tả | Rule |
|---|---|---|---|---|---|
| POST | `/auth/register` | Công khai | body: `email`, `username` (3-30 ký tự: a-z, 0-9, `_`, `.`), `display_name` (1-50), `password` (>= 8 ký tự, có chữ và số) | Tạo tài khoản trạng thái chưa xác minh và gửi OTP. Trả 201 `{email, status}`. Trùng email/username: 409 `ALREADY_EXISTS`. | BR-AU1 |
| POST | `/auth/verify-email` | Công khai | body: `email`, `code` (4-6 ký tự) | Xác minh email bằng OTP, xong thì đăng nhập luôn (trả cặp token). Sai/hết hạn: 400 `INVALID_OTP`. | BR-AU1 |
| POST | `/auth/resend-otp` | Công khai | body: `email` | Gửi lại OTP (204). Cách nhau tối thiểu 60 giây, nếu không: 429 `OTP_TOO_SOON`. Không lộ email có tồn tại hay không. | BR-AU1 |
| POST | `/auth/login` | Công khai | body: `email`, `password` | Đăng nhập, trả `{access_token, refresh_token, expires_in}`. Lỗi: 401 `INVALID_CREDENTIALS`, 403 `EMAIL_NOT_VERIFIED`, 403 `ACCOUNT_BANNED`, 429 `LOGIN_LOCKED`. Tài khoản đã tắt thì đăng nhập lại để khôi phục. | BR-AU2-01, BR-AU2-02, BR-AU2-03 (sai 5 lần khóa 15 phút), BR-AU5-03 |
| POST | `/auth/refresh` | Công khai | body: `refresh_token` | Đổi refresh token lấy access token mới. Không hợp lệ: 401 `INVALID_REFRESH_TOKEN`. | BR-AU2-04 |
| POST | `/auth/logout` | Công khai | body: `refresh_token` | Thu hồi phiên của thiết bị hiện tại (204). | BR-AU2-04 |
| GET | `/auth/me` | Đăng nhập | không | Thông tin tài khoản đang đăng nhập: `id, email, username, display_name, role, status`. | |
| POST | `/auth/forgot-password` | Công khai | body: `email` | Gửi liên kết đặt lại mật khẩu (hạn 15 phút, dùng một lần). Luôn trả 204 để không lộ email. | BR-AU3-01 |
| POST | `/auth/reset-password` | Công khai | body: `token`, `new_password` | Đặt mật khẩu mới bằng token trong liên kết, đăng xuất mọi thiết bị (204). Sai/hết hạn: 400 `INVALID_RESET_TOKEN`. | BR-AU3 |

### 2.3 Hồ sơ, theo dõi, chặn

Tất cả đều yêu cầu **Đăng nhập**. Các route `/users/me...` được khai báo trước `/users/{username}` nên không bị nhầm với username.

| Method | Path | Quyền | Tham số | Mô tả | Rule |
|---|---|---|---|---|---|
| PATCH | `/users/me` | Đăng nhập | body (chỉ gửi trường đổi): `display_name` (1-50), `username`, `bio` (<= 150), `avatar_url`, `link_url` (<= 500) | Sửa hồ sơ; chuỗi rỗng = xóa trường (trừ `display_name`). Trả `{id, username, display_name, avatar_url, bio}`. Lỗi: 400 `USERNAME_COOLDOWN`, 409 `ALREADY_EXISTS`. | BR-AU4-03 (đổi username 30 ngày một lần) |
| POST | `/users/me/password` | Đăng nhập | body: `old_password`, `new_password` | Đổi mật khẩu (204). Sai mật khẩu cũ: 400 `WRONG_PASSWORD`. | |
| DELETE | `/users/me` | Đăng nhập | body: `password` | Tắt tài khoản, thu hồi mọi phiên (204). Đăng nhập lại trong 30 ngày thì khôi phục. | BR-AU5-03 |
| GET | `/users/me/blocks` | Đăng nhập | không | Danh sách người mình đã chặn (mảng thẻ người dùng). | |
| GET | `/users/me/relations` | Đăng nhập | không | Id người mình chặn, người chặn mình, người mình theo dõi: `{blocked, blocked_by, following}`. | BR-GEN-05 |
| POST | `/users/lookup` | Đăng nhập | body: `ids` (<= 200 UUID), `usernames` (<= 200) | Đổi id <-> username hàng loạt, trả mảng thẻ người dùng. Bỏ qua tài khoản chưa xác minh hoặc đã tắt. Post/Feed/Search gọi bằng token của người dùng. | |
| GET | `/users/{username}` | Đăng nhập | path: `username` | Hồ sơ công khai kèm `followers_count`, `following_count`, `is_me`, `is_following`, `follows_me`. Không thấy hoặc bị chặn hai chiều: 404 `USER_NOT_FOUND`. | BR-GEN-05 |
| POST | `/users/{username}/follow` | Đăng nhập | path: `username` | Theo dõi (204, gọi lặp không lỗi). Tự theo dõi: 400 `CANNOT_FOLLOW_SELF`. | |
| DELETE | `/users/{username}/follow` | Đăng nhập | path: `username` | Bỏ theo dõi (204). | |
| GET | `/users/{username}/followers` | Đăng nhập | path: `username`; query: `offset` | Danh sách người theo dõi, `{items, next_offset}`; ẩn người có quan hệ chặn với người xem. | BR-GEN-05 |
| GET | `/users/{username}/following` | Đăng nhập | path: `username`; query: `offset` | Danh sách người đang theo dõi, `{items, next_offset}`. | BR-GEN-05 |
| POST | `/users/{username}/block` | Đăng nhập | path: `username` | Chặn (204), đồng thời gỡ theo dõi hai chiều. Tự chặn: 400 `CANNOT_BLOCK_SELF`. | BR-AU8, BR-GEN-05 |
| DELETE | `/users/{username}/block` | Đăng nhập | path: `username` | Bỏ chặn (204). | BR-AU8 |

### 2.4 Quản trị (tiền tố `/admin`, cả router yêu cầu Admin)

| Method | Path | Quyền | Tham số | Mô tả | Rule |
|---|---|---|---|---|---|
| GET | `/admin/ping` | Admin | không | Kiểm tra quyền admin, trả `{service, admin}`. (post-service cũng có route cùng tên.) | BR-AD1-01 |
| GET | `/admin/users` | Admin | query: `status`, `q` (email hoặc username), `cursor` | Danh sách tài khoản, mới tạo trước, kèm số vi phạm 90 ngày và lệnh khóa đang hiệu lực. | BR-AD1-02 |
| GET | `/admin/users/{user_id}` | Admin | path: `user_id` (UUID) | Chi tiết một tài khoản (cùng dạng một dòng của danh sách). 404 `USER_NOT_FOUND`. | |
| POST | `/admin/users/lookup` | Admin | body: `ids`, `usernames` | Đổi id <-> username kèm `status`; post-service dùng để dựng thông tin tác giả. | |
| POST | `/admin/users/{user_id}/ban` | Admin | path: `user_id`; body: `type` (TEMPORARY|PERMANENT), `duration_days` (1, 3, 7, 30; bắt buộc nếu TEMPORARY), `reason` | Khóa tài khoản, ghi nhật ký. | BR-AD1-03 |
| POST | `/admin/users/{user_id}/unban` | Admin | path: `user_id`; body: `reason` | Mở khóa thủ công, bắt buộc ghi lý do. | BR-AD1-05 |
| GET | `/admin/audit-logs` | Admin | query: `action`, `days` (>= 1), `cursor` | Nhật ký thao tác của admin, mới nhất trước. | BR-GEN-09 |
| POST | `/admin/moderation-events` | Admin | body: `action` (DELETE_POST / APPROVE_REPORT / DISMISS_REPORT), `target_type`, `target_id`, `reason`, `author_id?`, `post_id?` | post-service báo về sau khi admin xử lý nội dung (dùng token admin được chuyển tiếp): ghi nhật ký và, nếu nội dung bị xóa, tính vi phạm cho tác giả (có thể tự khóa). | BR-GEN-09 |

---

## 3. post-service (cổng 8002, `/api/post`)

### 3.1 Hệ thống

| Method | Path | Quyền | Tham số | Mô tả | Rule |
|---|---|---|---|---|---|
| GET | `/health` | Công khai | không | Kiểm tra service chạy và kết nối được `post_db`. | |

### 3.2 Bài viết, trả lời, tương tác

Tất cả yêu cầu **Đăng nhập**. Bài đã xóa, bài Riêng tư của người khác và bài của người có quan hệ chặn đều trả 404 `POST_NOT_FOUND`. Các route trả bài đều trả dạng `PostOut` (tác giả, nội dung, media, hashtag, số đếm, `liked_by_me`, `reposted_by_me`, `is_mine`...).

| Method | Path | Quyền | Tham số | Mô tả | Rule |
|---|---|---|---|---|---|
| POST | `/posts` | Đăng nhập | body: `content` (<= 500), `media[]` (<= 4, `{type: IMAGE\|VIDEO, url}`), `visibility` (PUBLIC\|PRIVATE), `reply_permission` (EVERYONE\|OFF) | Đăng bài (201). Cần có nội dung hoặc media: nếu không 422 `EMPTY_POST`. Tự lấy hashtag và mention từ nội dung. | BR-PO1-01, BR-PO1-03 |
| GET | `/posts/by-user/{username}` | Đăng nhập | path: `username`; query: `replies` (true/false, mặc định false), `cursor` | Bài (hoặc trả lời nếu `replies=true`) của một người cho trang cá nhân. Bài Riêng tư chỉ chủ bài thấy. | |
| GET | `/hashtags/{name}/posts` | Đăng nhập | path: `name` (có hoặc không `#`); query: `cursor` | Bài theo hashtag, mới nhất trước. | |
| POST | `/posts/batch` | Đăng nhập | body: `ids` (<= 50 UUID) | Lấy nội dung nhiều bài một lúc cho Feed/Search; bài xóa, riêng tư, bị chặn thì không có trong kết quả. | |
| GET | `/posts/{post_id}` | Đăng nhập | path: `post_id` | Xem một bài. | |
| PATCH | `/posts/{post_id}` | Đăng nhập | path: `post_id`; body (tùy chọn): `content`, `visibility`, `reply_permission` | Sửa bài, chỉ tác giả (403 `FORBIDDEN`). Sửa nội dung trong 15 phút đầu, quá hạn: 400 `EDIT_WINDOW_EXPIRED`. | BR-PO1-05 |
| DELETE | `/posts/{post_id}` | Đăng nhập | path: `post_id` | Xóa mềm, chỉ tác giả (204); đóng báo cáo đang chờ của bài. | |
| POST | `/posts/{post_id}/replies` | Đăng nhập | path: `post_id`; body như `POST /posts` | Trả lời bài (201). Tác giả tắt trả lời: 403 `REPLIES_OFF`. | BR-PO1-04 |
| GET | `/posts/{post_id}/replies` | Đăng nhập | path: `post_id`; query: `cursor` | Danh sách trả lời của bài. | |
| POST | `/posts/{post_id}/like` | Đăng nhập | path: `post_id` | Thích bài, gọi lặp không lệch số đếm. Trả bài sau khi cập nhật. | |
| DELETE | `/posts/{post_id}/like` | Đăng nhập | path: `post_id` | Bỏ thích. Trả bài sau khi cập nhật. | |
| POST | `/posts/{post_id}/repost` | Đăng nhập | path: `post_id` | Đăng lại bài. Trả bài sau khi cập nhật. | |
| DELETE | `/posts/{post_id}/repost` | Đăng nhập | path: `post_id` | Bỏ đăng lại. Trả bài sau khi cập nhật. | |
| GET | `/posts/{post_id}/likes` | Đăng nhập | path: `post_id`; query: `cursor` (thực chất là offset dạng chuỗi) | Danh sách người đã thích, `{items, next_cursor}`. | |
| POST | `/posts/{post_id}/report` | Đăng nhập | path: `post_id`; body: `reason` (SPAM, HARASSMENT, HATE, VIOLENCE, SENSITIVE, OTHER), `description?` (<= 500) | Báo cáo bài (201, trả `{case_id}`). Lỗi: 400 `CANNOT_REPORT_OWN_POST`, 409 `ALREADY_REPORTED`, 422 `DESCRIPTION_REQUIRED` (chọn OTHER mà không mô tả). | BR-PO6-01, BR-PO6-02 |

### 3.3 Quản trị (tiền tố `/admin`, cả router yêu cầu Admin)

| Method | Path | Quyền | Tham số | Mô tả | Rule |
|---|---|---|---|---|---|
| GET | `/admin/ping` | Admin | không | Kiểm tra quyền admin, trả `{service, admin}`. (auth-service cũng có route cùng tên.) | BR-AD1-01 |
| GET | `/admin/posts` | Admin | query: `q` (nội dung; bắt đầu bằng `@` để tìm theo username tác giả), `type` (POST\|REPLY), `days` (1, 7, 30), `reported_only`, `cursor` | Mọi bài và trả lời chưa xóa, kể cả bài Riêng tư. | BR-AD2-01 |
| GET | `/admin/posts/{post_id}` | Admin | path: `post_id` | Chi tiết một bài cho admin. | |
| DELETE | `/admin/posts/{post_id}` | Admin | path: `post_id`; body: `reason` (cùng danh sách lý do báo cáo) | Admin xóa bài; báo auth-service ghi nhật ký và tính vi phạm cho tác giả. | BR-AD2-02 |
| GET | `/admin/reports` | Admin | query: `status` (mặc định PENDING), `offset` | Nhóm báo cáo; nhóm đang chờ xếp theo số báo cáo giảm dần. | BR-AD3-01 |
| GET | `/admin/reports/{case_id}` | Admin | path: `case_id` | Chi tiết nhóm: nội dung, tác giả, lý do kèm số lượng, lịch sử vi phạm của tác giả. 404 `REPORT_CASE_NOT_FOUND`. | BR-AD3-02 |
| POST | `/admin/reports/{case_id}/approve` | Admin | path: `case_id`; body: `reason` | Duyệt báo cáo = xóa nội dung như `DELETE /admin/posts/{post_id}`. Đã xử lý: 409 `REPORT_CASE_RESOLVED`. | BR-AD3-03 |
| POST | `/admin/reports/{case_id}/dismiss` | Admin | path: `case_id`; body: `reason?` (mặc định "Không vi phạm tiêu chuẩn cộng đồng") | Bỏ qua báo cáo, giữ nguyên nội dung. | BR-AD3-04 |

---

## 4. notification-service (cổng 8003, `/api/notification`)

| Method | Path | Quyền | Tham số | Mô tả | Rule |
|---|---|---|---|---|---|
| GET | `/health` | Công khai | không | Kiểm tra service chạy và kết nối được `notification_db`. | |
| POST | `/internal/notifications` | Nội bộ (X-Internal-Key) | body: `user_id` (UUID), `message` (1-1000), `kind?` (SYSTEM\|EMAIL) | Tạo thông báo hệ thống cho một người dùng. | |
| POST | `/internal/events` | Nội bộ (X-Internal-Key) | body: `type` (LIKE\|REPLY\|REPOST\|FOLLOW\|MENTION), `recipient_id`, `actor_id`, `actor_name`, `post_id?`, `remove?` | Nhận sự kiện từ auth/post để tạo, gộp hoặc gỡ thông báo. Trả 200 `{status}` (`created`, `grouped`, `removed`, `ignored`, `disabled`). Tự tương tác với chính mình thì bỏ qua. | BR-NO1-02 (gộp LIKE, REPOST, FOLLOW), BR-NO1-05 (hoàn tác) |
| GET | `/notifications` | Đăng nhập | query: `unread` (`true`), `limit` (1-100, mặc định 20), `cursor` | Thông báo của mình, mới nhất trước, `{items, next_cursor}`. | |
| GET | `/notifications/unread-count` | Đăng nhập | không | Số thông báo chưa đọc: `{count}`. | |
| POST | `/notifications/read-all` | Đăng nhập | không | Đánh dấu đã đọc tất cả, trả 200 `{updated}`. | |
| POST | `/notifications/{id}/read` | Đăng nhập | path: `id` (UUID) | Đánh dấu một thông báo đã đọc, trả 200 thông báo đó. Không phải của mình: 404 `NOTIFICATION_NOT_FOUND`. | |
| GET | `/notifications/settings` | Đăng nhập | không | Cài đặt từng loại thông báo (LIKE, REPLY, REPOST, FOLLOW, MENTION): `[{type, enabled, scope}]`; chưa có dòng nghĩa là bật. | |
| PUT | `/notifications/settings/{type}` | Đăng nhập | path: `type` (LIKE\|REPLY\|REPOST\|FOLLOW\|MENTION); body: `enabled?` (bool), `scope?` (EVERYONE\|FOLLOWING) | Bật/tắt hoặc đổi phạm vi một loại. Loại khác (ví dụ SYSTEM, luôn bật): 404 `UNKNOWN_NOTIFICATION_TYPE`. Hiện mới xét `enabled`; `scope` được lưu nhưng chưa dùng để lọc. | |

---

## 5. feed-service (cổng 8004, `/api/feed`)

Nội dung bài lấy từ post-service (`POST /posts/batch`, chuyển tiếp token người dùng) khi trả về; lỗi kết nối: 502 `POST_SERVICE_UNAVAILABLE` / `POST_SERVICE_ERROR`. Các mục trong `items` có dạng `{post, reposted_by}`.

| Method | Path | Quyền | Tham số | Mô tả | Rule |
|---|---|---|---|---|---|
| GET | `/health` | Công khai | không | Kiểm tra service chạy và kết nối được `feed_db`. | |
| GET | `/feed` | Đăng nhập | query: `cursor` | Bảng tin của những người mình theo dõi, mới nhất trước, `{items, next_cursor}`. Cursor sai: 400 `INVALID_CURSOR`. | BR-FE3 (bỏ bài/người đã ẩn) |
| GET | `/feed/explore` | Đăng nhập | query: `offset` | Khám phá: bài nhiều tương tác nhất 7 ngày qua, `{items, next_offset}`. | BR-FE2 |
| POST | `/feed/hide/{postId}` | Đăng nhập | path: `postId` (UUID) | Ẩn một bài khỏi bảng tin (204). | BR-FE3 |
| DELETE | `/feed/hide/{postId}` | Đăng nhập | path: `postId` (UUID) | Bỏ ẩn bài (204). | BR-FE3 |
| POST | `/feed/mute/{userId}` | Đăng nhập | path: `userId` (UUID) | Ẩn mọi bài của một người (204). Tự ẩn mình: 400 `CANNOT_MUTE_SELF`. | BR-FE3 |
| DELETE | `/feed/mute/{userId}` | Đăng nhập | path: `userId` (UUID) | Bỏ ẩn người đó (204). | BR-FE3 |
| POST | `/internal/events` | Nội bộ (X-Internal-Key) | body: `name` cùng các trường theo sự kiện | Nhận sự kiện từ auth/post để dựng bảng tin và điểm bài (xem mục 7). Sự kiện không liên quan bị bỏ qua. Trả 200 `{status: "ok"}`. | |

Lưu ý: path của feed-service dùng `postId` / `userId` (camelCase), khác kiểu `post_id` của post-service.

---

## 6. search-service (cổng 8005, `/api/search`)

| Method | Path | Quyền | Tham số | Mô tả | Rule |
|---|---|---|---|---|---|
| GET | `/health` | Công khai | không | Kiểm tra service chạy và kết nối được `search_db`. | |
| GET | `/search/users` | Đăng nhập | query: `q` (bắt buộc, <= 50), `offset` | Tìm người dùng theo tiền tố username, không dấu, không phân biệt hoa thường; nhiều người theo dõi lên trước. `{items, next_offset}`. Từ khóa rỗng: 422 `EMPTY_QUERY`. | BR-SE2-02 (ẩn người có quan hệ chặn) |
| GET | `/search/posts` | Đăng nhập | query: `q` (bắt buộc, <= 100), `offset` | Tìm bài toàn văn, không dấu; xếp theo độ khớp rồi độ phổ biến. Nội dung lấy từ post-service. `{items, next_offset}`. | BR-SE1-01 |
| GET | `/trending/hashtags` | Đăng nhập | không | Top 10 hashtag trong 24 giờ, tính lại khi dữ liệu cũ hơn 15 phút: `[{rank, hashtag, post_count}]`. | BR-SE3-02 |
| POST | `/internal/events` | Nội bộ (X-Internal-Key) | body: `name` cùng các trường theo sự kiện | Nhận sự kiện từ auth/post để dựng chỉ mục người dùng, bài viết, hashtag (xem mục 7). Trả 200 `{status: "ok"}`. | |

---

## 7. Sự kiện nội bộ (`publish_event`)

auth-service và post-service gọi `publish_event(tên, ...)` sau mỗi thao tác chính. Hàm này gửi `POST /internal/events` (kèm `X-Internal-Key`) sang các service nhận, **không chờ kết quả**: lỗi chỉ ghi log, không làm hỏng thao tác chính. Nếu chưa đặt `INTERNAL_API_KEY` thì chỉ ghi log. Bảng lấy từ `_TYPES`, `_FEED_EVENTS`, `_SEARCH_EVENTS` trong `auth-service/app/notify.py` (post-service có bản giống hệt).

Dấu `x` là service có nhận sự kiện đó. Với Notification, cột ghi `type` gửi đi (`remove: true` nghĩa là hoàn tác).

| Sự kiện | Notification | Feed | Search | Do service nào phát |
|---|---|---|---|---|
| `PostLiked` | `LIKE` | x | x | post |
| `PostUnliked` | `LIKE`, `remove` | x | x | post |
| `PostReposted` | `REPOST` | x | x | post |
| `PostUnreposted` | `REPOST`, `remove` | x | x | post |
| `PostReplied` | `REPLY` | x | x | post |
| `UserMentioned` | `MENTION` | | | post |
| `UserFollowed` | `FOLLOW` | x | x | auth |
| `UserUnfollowed` | `FOLLOW`, `remove` | x | x | auth |
| `PostCreated` | | x | x | post |
| `PostDeleted` | | x | x | post (người dùng hoặc admin xóa) |
| `PostEdited` | | | x | post |
| `UserIndexed` | | | x | auth (xác minh email, sửa hồ sơ, khôi phục tài khoản) |
| `UserBanned` | | | x | auth (admin khóa) |
| `UserUnbanned` | | | x | auth (mở khóa) |
| `UserDeactivated` | | | x | auth (tắt tài khoản) |
| `UserBlocked` | | | x | auth |
| `UserUnblocked` | | | x | auth |

Ghi chú:
- Notification chỉ nhận sự kiện nằm trong `_TYPES`; Feed trong `_FEED_EVENTS`; Search trong `_SEARCH_EVENTS`.
- Body gửi sang Notification là `{type, remove, ...}` (khác Feed/Search là `{name, ...}`).
- `system_notification` (thông báo hệ thống như "bài của bạn đã bị xóa") hiện **chỉ ghi log**, chưa gọi `POST /internal/notifications`.
