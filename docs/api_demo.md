# Kịch bản test API Oris trên Thunder Client

Tài liệu này là **kịch bản gọi API từng bước** để demo hệ thống Oris (5 microservice) bằng extension **Thunder Client** trong VS Code. Danh sách đầy đủ 77 endpoint nằm ở [`api_endpoint.md`](api_endpoint.md); ở đây chỉ chọn những endpoint cần để chạy một mạch.

Mọi response mẫu trong tài liệu lấy từ **lần gọi thật** vào stack đang chạy (`docker compose up`). Sau đó chỉ rút gọn token (`eyJhbGciOi…`) và lược bớt vài trường ít quan trọng của bài viết (`media`, `parent_id`, `root_id`, `reply_permission`, `visibility`, `edited_at`, `avatar_url` khi `null`) cho dễ đọc; các danh sách dài được cắt còn vài mục (có ghi chú). Lần đầu một bài viết xuất hiện (bước 1.7) response được giữ đầy đủ.

## 0. Chuẩn bị Thunder Client

### 0.1 Tạo Environment

1. Mở Thunder Client (biểu tượng tia chớp ở thanh bên) → tab **Env** → **New Environment** → đặt tên `Oris`, bấm **Set Active** để dùng nó.
2. Thêm các biến sau (cột *Giá trị* để trống nghĩa là sẽ được điền ở các bước demo):

| Biến | Giá trị | Dùng cho |
|---|---|---|
| `auth` | `http://localhost:8001` | auth-service |
| `post` | `http://localhost:8002` | post-service |
| `noti` | `http://localhost:8003` | notification-service |
| `feed` | `http://localhost:8004` | feed-service |
| `search` | `http://localhost:8005` | search-service |
| `n` | `1001` (ví dụ) | hậu tố cho email/username demo; **đổi mỗi lần chạy lại** vì username và email phải duy nhất |
| `username` | `apidemo_1001` | username tài khoản A (luôn là `apidemo_` + `n`) |
| `username2` | `apidemo_1001b` | username tài khoản B (`apidemo_` + `n` + `b`) |
| `token` | | access token của A |
| `token2` | | access token của B |
| `adminToken` | | access token của admin |
| `refreshToken` | | refresh token của A |
| `userId`, `userId2` | | id của A, của B |
| `postId`, `postId2`, `postId3`, `postIdB` | | id các bài viết |
| `replyId` | | id bài trả lời |
| `caseId`, `caseId2` | | id nhóm báo cáo (Phần 2) |
| `tokenC`, `notificationId` | | token của tài khoản C, id một thông báo (Phần 2) |
| `tokenD`, `postIdD` | | token của tài khoản D, id bài D vừa đăng (Phần 2, bước 2.15; `postIdD` đổi sang bài kế tiếp sau mỗi lần xóa) |

> Đổi `n` mỗi lần chạy (và sửa `username`, `username2` theo); **không dùng `830368`** — lần chạy lấy response mẫu đã tạo các tài khoản đó trong DB, dùng lại sẽ nhận `409 ALREADY_EXISTS` ngay ở bước 1.1.

Cả 5 service cũng gọi được qua cổng của `user-web` (`http://localhost:5174/api/<service>/...`), nhưng kịch bản này gọi **thẳng vào từng cổng** cho đơn giản.

### 0.2 Gắn token vào request

Với mọi request cần đăng nhập: tab **Auth** → chọn **Bearer** → ô Token nhập `{{token}}` (hoặc `{{token2}}`, `{{adminToken}}` tùy bước). Mỗi bước bên dưới ghi sẵn dùng token nào. Nếu dùng Collection, có thể đặt Bearer ở cấp Collection/Folder một lần rồi để request kế thừa.

Với request có body: tab **Body** → **JSON**, Thunder Client tự thêm `Content-Type: application/json`.

### 0.3 Tự động lưu token từ response

Cách nhanh: ở request **đăng nhập**, mở tab **Tests** → **Add** → chọn **Set Env Variable** → điền nguồn `json.access_token` và tên biến `token` (hiện ra dạng `{{token}}`). Lặp lại cho `json.refresh_token` → `refreshToken`. Sau khi bấm **Send**, biến được ghi vào Environment đang chọn. Cách này dùng được cho mọi giá trị khác (ví dụ `json.id` → `postId`).

Cách dự phòng nếu Tests tab không chạy: gửi request, copy giá trị trong response, vào tab **Env** dán vào biến tương ứng.

> Access token chỉ sống **15 phút**. Nếu gặp `401 TOKEN_EXPIRED`, đăng nhập lại (bước 1.3) hoặc dùng refresh token (bước 2.1).

### 0.4 Tài khoản và dữ liệu dùng trong kịch bản

- Tài khoản demo tự tạo: email `apidemo.{{n}}@example.com`, username `apidemo_{{n}}` (A); thêm hậu tố `b` cho B, `c`, `d` cho Phần 2. Mật khẩu `Demo1234`. Các response mẫu bên dưới là **kết quả của một lần chạy thật với `n` = `830368`** (chỉ để tham khảo, đừng gõ lại số này); khi bạn chạy, tên và id trong response sẽ khác.
- **OTP xác minh email luôn là `1234`** (mã giả, cấu hình tạm thời để demo).
- Admin: `admin@example.com` / `Admin@1234`.
- Các tài khoản có sẵn `minhanh.ng`, `thuha.le` chỉ dùng để **đọc** (tìm kiếm, hashtag); đừng khóa hay tắt chúng.
- Lỗi luôn có dạng `{ "detail": { "code": "...", "message": "..." } }`; `code` là chuỗi ổn định, `message` tiếng Việt.

## Mục lục

- **[Phần 1 — API cơ bản (CRUD, demo với thầy)](#phần-1--api-cơ-bản-crud-demo-với-thầy)**: đăng ký, OTP, đăng nhập, hồ sơ, bài viết, trả lời, thích, theo dõi, xóa bài, đăng xuất; rồi các thao tác admin (người dùng, khóa/mở khóa, bài viết). 27 bước, khoảng 10–15 phút.
- **[Phần 2 — API nâng cao (chưa cần demo vì thời lượng)](#phần-2--api-nâng-cao-chưa-cần-demo-vì-thời-lượng)**: refresh token, quên/đặt lại/đổi mật khẩu, gửi lại OTP, tắt tài khoản, chặn, đăng lại, danh sách người thích, báo cáo và duyệt báo cáo, nhật ký admin, luật 3 vi phạm, bảng tin, thông báo, tìm kiếm, hashtag, health.
- [Phụ lục — Lỗi thường gặp](#phụ-lục--lỗi-thường-gặp)

---

# Phần 1 — API cơ bản (CRUD, demo với thầy)

Luồng chạy từ trên xuống: tài khoản **A** làm gần hết, tài khoản **B** thỉnh thoảng đóng vai người thứ hai (trả lời, thích). Cuối cùng là các bước của **admin**.

## 1A. Người dùng thường

### 1.1. Đăng ký tài khoản A

```http
POST {{auth}}/auth/register
```

- **Auth:** không cần token

**Body** (JSON):

```json
{
  "email": "apidemo.{{n}}@example.com",
  "username": "apidemo_{{n}}",
  "display_name": "Demo A {{n}}",
  "password": "Demo1234"
}
```

**Response 201 Created**

```json
{
  "email": "apidemo.830368@example.com",
  "status": "UNVERIFIED"
}
```

> Trùng email hoặc username: `409 ALREADY_EXISTS` (kèm `detail.fields` dạng object). Sai định dạng (username 3–30 ký tự a-z 0-9 `_` `.`, mật khẩu >= 8 ký tự có chữ và số): `422 VALIDATION_ERROR` (`detail.fields` dạng mảng).


### 1.2. Xác minh email bằng OTP

```http
POST {{auth}}/auth/verify-email
```

- **Auth:** không cần token

**Body** (JSON):

```json
{
  "email": "apidemo.{{n}}@example.com",
  "code": "1234"
}
```

**Response 200 OK**

```json
{
  "access_token": "eyJhbGciOi…",
  "refresh_token": "yEdBQ9cu…",
  "token_type": "bearer",
  "expires_in": 900
}
```

> Xác minh xong là **đăng nhập luôn** (trả cặp token). OTP sai hoặc hết hạn: `400 INVALID_OTP`.


### 1.3. Đăng nhập

```http
POST {{auth}}/auth/login
```

- **Auth:** không cần token
- **Lưu:** `json.access_token` → `token`, `json.refresh_token` → `refreshToken` (tab Tests, xem 0.3)

**Body** (JSON):

```json
{
  "email": "apidemo.{{n}}@example.com",
  "password": "Demo1234"
}
```

**Response 200 OK**

```json
{
  "access_token": "eyJhbGciOi…",
  "refresh_token": "ZDTmAPaE…",
  "token_type": "bearer",
  "expires_in": 900
}
```

> Sai email/mật khẩu: `401 INVALID_CREDENTIALS`. Chưa xác minh email: `403 EMAIL_NOT_VERIFIED`. Sai 5 lần liên tiếp: `429 LOGIN_LOCKED` (khóa 15 phút).


### 1.4. Thông tin tài khoản đang đăng nhập

```http
GET {{auth}}/auth/me
```

- **Auth:** Bearer `{{token}}`
- **Lưu:** `json.id` → `userId`

**Response 200 OK**

```json
{
  "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
  "email": "apidemo.830368@example.com",
  "username": "apidemo_830368",
  "display_name": "Demo A 830368",
  "role": "USER",
  "status": "ACTIVE"
}
```

> Dùng để kiểm tra token hợp lệ. Thiếu token: `401 NOT_AUTHENTICATED`; hết hạn: `401 TOKEN_EXPIRED`.


### 1.5. Xem hồ sơ

```http
GET {{auth}}/users/{{username}}
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
  "username": "apidemo_830368",
  "display_name": "Demo A 830368",
  "bio": null,
  "link_url": null,
  "created_at": "2026-10-24T08:26:08.353263Z",
  "followers_count": 0,
  "following_count": 0,
  "is_me": true,
  "is_following": false,
  "follows_me": false
}
```

> `is_me`, `is_following`, `follows_me` cho biết quan hệ giữa người xem và hồ sơ. Không có người này hoặc bị chặn hai chiều: `404 USER_NOT_FOUND`.


### 1.6. Sửa hồ sơ

```http
PATCH {{auth}}/users/me
```

- **Auth:** Bearer `{{token}}`

**Body** (JSON):

```json
{
  "display_name": "Demo An",
  "bio": "Sinh viên SOA, đang demo API Oris"
}
```

**Response 200 OK**

```json
{
  "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
  "username": "apidemo_830368",
  "display_name": "Demo An",
  "bio": "Sinh viên SOA, đang demo API Oris"
}
```

> Chỉ gửi trường muốn đổi (`display_name`, `username`, `bio`, `link_url`); chuỗi rỗng = xóa trường. Đổi `username` chỉ được 30 ngày một lần (`400 USERNAME_COOLDOWN`), trùng thì `409 ALREADY_EXISTS`.


### 1.7. Tạo bài viết

```http
POST {{post}}/posts
```

- **Auth:** Bearer `{{token}}`
- **Lưu:** `json.id` → `postId`

**Body** (JSON):

```json
{
  "content": "Xin chào Oris! Bài đầu tiên của mình #apidemo #saigon",
  "visibility": "PUBLIC",
  "reply_permission": "EVERYONE"
}
```

**Response 201 Created**

```json
{
  "id": "e4cc9188-7ee6-49bc-ba12-f928e67875fe",
  "author": {
    "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
    "username": "apidemo_830368",
    "display_name": "Demo An",
    "avatar_url": null
  },
  "parent_id": null,
  "root_id": null,
  "content": "Xin chào Oris! Bài đầu tiên của mình #apidemo #saigon",
  "visibility": "PUBLIC",
  "reply_permission": "EVERYONE",
  "media": [],
  "hashtags": [
    "saigon",
    "apidemo"
  ],
  "like_count": 0,
  "reply_count": 0,
  "repost_count": 0,
  "liked_by_me": false,
  "reposted_by_me": false,
  "is_mine": true,
  "created_at": "2026-10-24T08:26:09.800627Z",
  "edited_at": null
}
```

> Hashtag được tự tách từ nội dung. `content` tối đa 500 ký tự; không có nội dung lẫn media: `422 EMPTY_POST`. `visibility`: `PUBLIC` | `PRIVATE`; `reply_permission`: `EVERYONE` | `OFF`.


### 1.8. Xem một bài viết

```http
GET {{post}}/posts/{{postId}}
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "id": "e4cc9188-7ee6-49bc-ba12-f928e67875fe",
  "author": {
    "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
    "username": "apidemo_830368",
    "display_name": "Demo An"
  },
  "content": "Xin chào Oris! Bài đầu tiên của mình #apidemo #saigon",
  "hashtags": [
    "saigon",
    "apidemo"
  ],
  "like_count": 0,
  "reply_count": 0,
  "repost_count": 0,
  "liked_by_me": false,
  "reposted_by_me": false,
  "is_mine": true,
  "created_at": "2026-10-24T08:26:09.800627Z"
}
```

> Bài đã xóa, bài riêng tư của người khác hoặc bài của người có quan hệ chặn đều trả `404 POST_NOT_FOUND`.


### 1.9. Sửa bài viết

```http
PATCH {{post}}/posts/{{postId}}
```

- **Auth:** Bearer `{{token}}`

**Body** (JSON):

```json
{
  "content": "Xin chào Oris! (đã sửa) #apidemo #saigon"
}
```

**Response 200 OK**

```json
{
  "id": "e4cc9188-7ee6-49bc-ba12-f928e67875fe",
  "author": {
    "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
    "username": "apidemo_830368",
    "display_name": "Demo An"
  },
  "content": "Xin chào Oris! (đã sửa) #apidemo #saigon",
  "hashtags": [
    "saigon",
    "apidemo"
  ],
  "like_count": 0,
  "reply_count": 0,
  "repost_count": 0,
  "liked_by_me": false,
  "reposted_by_me": false,
  "is_mine": true,
  "created_at": "2026-10-24T08:26:09.800627Z"
}
```

> Chỉ tác giả sửa được (`403 FORBIDDEN`) và chỉ trong **15 phút** đầu (`400 EDIT_WINDOW_EXPIRED`). `edited_at` được điền sau khi sửa (trường này đã bị lược trong mẫu).


### 1.10. Danh sách bài của một người

```http
GET {{post}}/posts/by-user/{{username}}
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "e4cc9188-7ee6-49bc-ba12-f928e67875fe",
      "author": {
        "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
        "username": "apidemo_830368",
        "display_name": "Demo An"
      },
      "content": "Xin chào Oris! (đã sửa) #apidemo #saigon",
      "hashtags": [
        "saigon",
        "apidemo"
      ],
      "like_count": 0,
      "reply_count": 0,
      "repost_count": 0,
      "liked_by_me": false,
      "reposted_by_me": false,
      "is_mine": true,
      "created_at": "2026-10-24T08:26:09.800627Z"
    }
  ],
  "next_cursor": null
}
```

> Phân trang kiểu cursor: lấy `next_cursor` gắn vào `?cursor=...` cho trang kế (`null` = hết). Thêm `?replies=true` để xem các bài trả lời thay vì bài gốc.


### 1.11. Tạo tài khoản B

Lặp lại bước **1.1 và 1.2** với `email` = `apidemo.{{n}}b@example.com`, `username` = `apidemo_{{n}}b`, `display_name` = `Demo B {{n}}`. Ở bước 1.2, lưu `json.access_token` vào **`token2`**. Sau đó gọi:

```http
GET {{auth}}/auth/me
```

- **Auth:** Bearer `{{token2}}`
- **Lưu:** `json.id` → `userId2`

**Response 200 OK**

```json
{
  "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
  "email": "apidemo.830368b@example.com",
  "username": "apidemo_830368b",
  "display_name": "Demo B 830368",
  "role": "USER",
  "status": "ACTIVE"
}
```


### 1.12. Trả lời bài viết (dùng tài khoản B)

```http
POST {{post}}/posts/{{postId}}/replies
```

- **Auth:** Bearer `{{token2}}`
- **Lưu:** `json.id` → `replyId`

**Body** (JSON):

```json
{
  "content": "Chào bạn, mình là người thứ hai!"
}
```

**Response 201 Created**

```json
{
  "id": "09ed476d-723c-42f7-9655-f5a3af899590",
  "author": {
    "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
    "username": "apidemo_830368b",
    "display_name": "Demo B 830368"
  },
  "content": "Chào bạn, mình là người thứ hai!",
  "hashtags": [],
  "like_count": 0,
  "reply_count": 0,
  "repost_count": 0,
  "liked_by_me": false,
  "reposted_by_me": false,
  "is_mine": true,
  "created_at": "2026-10-24T08:26:11.419573Z"
}
```

> Trả lời cũng là một bài (`parent_id`/`root_id` trỏ về bài gốc, hai trường này đã bị lược trong mẫu). Tác giả tắt trả lời: `403 REPLIES_OFF`.


### 1.13. Danh sách trả lời của một bài

```http
GET {{post}}/posts/{{postId}}/replies
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "09ed476d-723c-42f7-9655-f5a3af899590",
      "author": {
        "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
        "username": "apidemo_830368b",
        "display_name": "Demo B 830368"
      },
      "content": "Chào bạn, mình là người thứ hai!",
      "hashtags": [],
      "like_count": 0,
      "reply_count": 0,
      "repost_count": 0,
      "liked_by_me": false,
      "reposted_by_me": false,
      "is_mine": false,
      "created_at": "2026-10-24T08:26:11.419573Z"
    }
  ],
  "next_cursor": null
}
```


### 1.14. Thích bài viết (B thích bài của A)

```http
POST {{post}}/posts/{{postId}}/like
```

- **Auth:** Bearer `{{token2}}`

**Response 200 OK**

```json
{
  "id": "e4cc9188-7ee6-49bc-ba12-f928e67875fe",
  "author": {
    "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
    "username": "apidemo_830368",
    "display_name": "Demo An"
  },
  "content": "Xin chào Oris! (đã sửa) #apidemo #saigon",
  "hashtags": [
    "saigon",
    "apidemo"
  ],
  "like_count": 1,
  "reply_count": 1,
  "repost_count": 0,
  "liked_by_me": true,
  "reposted_by_me": false,
  "is_mine": false,
  "created_at": "2026-10-24T08:26:09.800627Z"
}
```

> Trả về bài sau khi cập nhật: `like_count` = 1, `liked_by_me` = `true`. Gọi lặp lại không làm lệch số đếm.


### 1.15. Bỏ thích

```http
DELETE {{post}}/posts/{{postId}}/like
```

- **Auth:** Bearer `{{token2}}`

**Response 200 OK**

```json
{
  "id": "e4cc9188-7ee6-49bc-ba12-f928e67875fe",
  "author": {
    "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
    "username": "apidemo_830368",
    "display_name": "Demo An"
  },
  "content": "Xin chào Oris! (đã sửa) #apidemo #saigon",
  "hashtags": [
    "saigon",
    "apidemo"
  ],
  "like_count": 0,
  "reply_count": 1,
  "repost_count": 0,
  "liked_by_me": false,
  "reposted_by_me": false,
  "is_mine": false,
  "created_at": "2026-10-24T08:26:09.800627Z"
}
```


### 1.16. Theo dõi (A theo dõi B)

```http
POST {{auth}}/users/{{username2}}/follow
```

- **Auth:** Bearer `{{token}}`

**Response 204 No Content** (không có body)

> Gọi lặp lại không lỗi. Tự theo dõi mình: `400 CANNOT_FOLLOW_SELF`.

**Response 400 Bad Request**

```json
{
  "detail": {
    "code": "CANNOT_FOLLOW_SELF",
    "message": "Không thể tự theo dõi chính mình"
  }
}
```


### 1.17. Danh sách người theo dõi / đang theo dõi

```http
GET {{auth}}/users/{{username2}}/followers
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK** — `GET {{auth}}/users/{{username2}}/followers`

```json
{
  "items": [
    {
      "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
      "username": "apidemo_830368",
      "display_name": "Demo An",
      "bio": "Sinh viên SOA, đang demo API Oris"
    }
  ],
  "next_offset": null
}
```

> Danh sách ngược lại: `GET {{auth}}/users/{{username}}/following`. Phân trang kiểu offset: gửi `?offset=<next_offset>`.

**Response 200 OK** — `GET {{auth}}/users/{{username}}/following`

```json
{
  "items": [
    {
      "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
      "username": "apidemo_830368b",
      "display_name": "Demo B 830368",
      "bio": null
    }
  ],
  "next_offset": null
}
```


### 1.18. Bỏ theo dõi

```http
DELETE {{auth}}/users/{{username2}}/follow
```

- **Auth:** Bearer `{{token}}`

**Response 204 No Content** (không có body)


### 1.19. Xóa bài viết

```http
DELETE {{post}}/posts/{{postId}}
```

- **Auth:** Bearer `{{token}}`

**Response 204 No Content** (không có body)

> Xóa mềm, chỉ tác giả được xóa (`403 FORBIDDEN` nếu người khác). Gọi lại `GET {{post}}/posts/{{postId}}` sẽ thấy:

**Response 404 Not Found**

```json
{
  "detail": {
    "code": "POST_NOT_FOUND",
    "message": "Không tìm thấy bài viết hoặc bài đã bị xóa"
  }
}
```


### 1.20. Đăng xuất

```http
POST {{auth}}/auth/logout
```

- **Auth:** không cần token

**Body** (JSON):

```json
{
  "refresh_token": "{{refreshToken}}"
}
```

**Response 204 No Content** (không có body)

> Thu hồi refresh token của thiết bị này; dùng lại token đó sẽ bị `401 INVALID_REFRESH_TOKEN`. Access token đã cấp vẫn dùng được cho đến khi hết 15 phút.


## 1B. Quản trị viên (admin)

### 1.21. Đăng nhập admin

```http
POST {{auth}}/auth/login
```

- **Auth:** không cần token
- **Lưu:** `json.access_token` → `adminToken`

**Body** (JSON):

```json
{
  "email": "admin@example.com",
  "password": "Admin@1234"
}
```

**Response 200 OK**

```json
{
  "access_token": "eyJhbGciOi…",
  "refresh_token": "ck8KvDoN…",
  "token_type": "bearer",
  "expires_in": 900
}
```

> Các API `/admin/...` đòi token có `role = ADMIN`; token người thường nhận `403 FORBIDDEN`.


### 1.22. Danh sách người dùng

```http
GET {{auth}}/admin/users?q=apidemo_{{n}}
```

- **Auth:** Bearer `{{adminToken}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
      "email": "apidemo.830368b@example.com",
      "username": "apidemo_830368b",
      "display_name": "Demo B 830368",
      "role": "USER",
      "status": "ACTIVE",
      "created_at": "2026-10-24T08:26:10.746794Z",
      "violations_90d": 0,
      "active_ban": null
    },
    {
      "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
      "email": "apidemo.830368@example.com",
      "username": "apidemo_830368",
      "display_name": "Demo An",
      "role": "USER",
      "status": "ACTIVE",
      "created_at": "2026-10-24T08:26:08.353263Z",
      "violations_90d": 0,
      "active_ban": null
    }
  ],
  "next_cursor": null
}
```

> Lọc: `q` (email hoặc username), `status`, `cursor`. Mỗi dòng có `violations_90d` và `active_ban`.


### 1.23. Khóa tài khoản

```http
POST {{auth}}/admin/users/{{userId2}}/ban
```

- **Auth:** Bearer `{{adminToken}}`

**Body** (JSON):

```json
{
  "type": "TEMPORARY",
  "duration_days": 1,
  "reason": "Demo khóa tài khoản"
}
```

**Response 200 OK**

```json
{
  "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
  "email": "apidemo.830368b@example.com",
  "username": "apidemo_830368b",
  "display_name": "Demo B 830368",
  "role": "USER",
  "status": "BANNED",
  "created_at": "2026-10-24T08:26:10.746794Z",
  "violations_90d": 0,
  "active_ban": {
    "type": "TEMPORARY",
    "reason": "Demo khóa tài khoản",
    "starts_at": "2026-10-24T08:26:37.269481Z",
    "ends_at": "2026-10-25T08:26:37.269481Z"
  }
}
```

> `type`: `TEMPORARY` (bắt buộc `duration_days` ∈ 1, 3, 7, 30) hoặc `PERMANENT`. Lý do là bắt buộc. Người bị khóa thử đăng nhập sẽ nhận:

**Response 403 Forbidden**

```json
{
  "detail": {
    "code": "ACCOUNT_BANNED",
    "message": "Tài khoản đang bị khóa",
    "reason": "Demo khóa tài khoản",
    "ends_at": "2026-10-25T08:26:37.269481+00:00"
  }
}
```


### 1.24. Mở khóa tài khoản

```http
POST {{auth}}/admin/users/{{userId2}}/unban
```

- **Auth:** Bearer `{{adminToken}}`

**Body** (JSON):

```json
{
  "reason": "Demo mở khóa"
}
```

**Response 200 OK**

```json
{
  "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
  "email": "apidemo.830368b@example.com",
  "username": "apidemo_830368b",
  "display_name": "Demo B 830368",
  "role": "USER",
  "status": "ACTIVE",
  "created_at": "2026-10-24T08:26:10.746794Z",
  "violations_90d": 0,
  "active_ban": null
}
```

> Mở khóa thủ công cũng bắt buộc có `reason`; cả khóa và mở khóa đều được ghi vào nhật ký admin.


### 1.25. Danh sách bài viết (admin)

```http
GET {{post}}/admin/posts?q=%40{{username2}}
```

- **Auth:** Bearer `{{adminToken}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "09ed476d-723c-42f7-9655-f5a3af899590",
      "author": {
        "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
        "username": "apidemo_830368b",
        "display_name": "Demo B 830368",
        "status": "ACTIVE"
      },
      "type": "REPLY",
      "content": "Chào bạn, mình là người thứ hai!",
      "visibility": "PUBLIC",
      "media": {
        "images": 0,
        "videos": 0
      },
      "pending_reports": 0,
      "created_at": "2026-10-24T08:26:11.419573Z"
    }
  ],
  "next_cursor": null
}
```

> `q` bắt đầu bằng `@` thì tìm theo username tác giả (`%40` là `@` đã mã hóa). Lọc thêm: `type` (`POST`|`REPLY`), `days` (1, 7, 30), `reported_only`. Admin thấy cả bài riêng tư và bài trả lời. Lấy `id` của bài cần xóa gán vào `replyId` nếu chưa có.


### 1.26. Xóa bài viết (admin)

```http
DELETE {{post}}/admin/posts/{{replyId}}
```

- **Auth:** Bearer `{{adminToken}}`

**Body** (JSON):

```json
{
  "reason": "SPAM"
}
```

**Response 200 OK**

```json
{
  "post_id": "09ed476d-723c-42f7-9655-f5a3af899590",
  "author_violations_90d": 1,
  "author_auto_banned": false
}
```

> `reason` là một trong `SPAM`, `HARASSMENT`, `HATE`, `VIOLENCE`, `SENSITIVE`, `OTHER`. Admin xóa bài tính **1 lần vi phạm** cho tác giả (`author_violations_90d`).


### 1.27. Tổng kết Phần 1

Đã đi qua: đăng ký → OTP → đăng nhập → hồ sơ → bài viết (tạo, xem, sửa, xóa) → trả lời → thích → theo dõi → đăng xuất → admin (người dùng, khóa/mở khóa, xóa bài). Các bước admin (1.21 trở đi) chỉ cần `adminToken` nên có thể chạy riêng bất cứ lúc nào.

---

# Phần 2 — API nâng cao (chưa cần demo vì thời lượng)

Phần này **không cần trình bày với thầy**; để dành khi cần kiểm tra thêm hoặc trả lời câu hỏi. Các bước độc lập với Phần 1 (dùng bài viết mới), nhưng vẫn cần Environment ở mục 0 và các tài khoản A, B, admin.

Một số thao tác ở đây **khó hoàn tác** (tắt tài khoản, khóa tài khoản, luật 3 vi phạm, chặn). Chỉ chạy chúng trên tài khoản `apidemo_*` do bạn tạo, **không** chạy lên admin hay `minhanh.ng` / `thuha.le`.

## 2.0 Chuẩn bị

Phần 1 đã đăng xuất A và token có thể đã hết hạn. Đăng nhập lại (bước 1.3 với email A, B và bước 1.21 cho admin), lưu `token`, `refreshToken`, `token2`, `adminToken`. Nếu A, B chưa tồn tại thì tạo như bước 1.1–1.2 (và 1.11).

## 2A. Phiên, mật khẩu, tài khoản

### 2.1. Làm mới access token (refresh)

```http
POST {{auth}}/auth/refresh
```

- **Auth:** không cần token
- **Lưu:** `json.access_token` → `token`

**Body** (JSON):

```json
{
  "refresh_token": "{{refreshToken}}"
}
```

**Response 200 OK**

```json
{
  "access_token": "eyJhbGciOi…",
  "refresh_token": null,
  "token_type": "bearer",
  "expires_in": 900
}
```

> Refresh token **không đổi** (trường `refresh_token` trả về `null`), cứ dùng tiếp cái cũ cho đến khi đăng xuất hoặc hết 7 ngày. Token sai, hết hạn hoặc đã đăng xuất: `401 INVALID_REFRESH_TOKEN`.


### 2.2. Gửi lại OTP (tài khoản chưa xác minh)

Tạo tài khoản C để thử: gọi bước 1.1 với `email` = `apidemo.{{n}}c@example.com`, `username` = `apidemo_{{n}}c`, `display_name` = `Demo C`. **Chưa** xác minh, gọi ngay:

```http
POST {{auth}}/auth/resend-otp
```

- **Auth:** không cần token

**Body** (JSON):

```json
{ "email": "apidemo.{{n}}c@example.com" }
```

**Response 429 Too Many Requests**

```json
{
  "detail": {
    "code": "OTP_TOO_SOON",
    "message": "Vui lòng chờ 60 giây trước khi gửi lại mã"
  }
}
```

Chờ đủ 60 giây rồi gọi lại:

**Response 204 No Content** (không có body)

> Mỗi lần gửi cách nhau tối thiểu 60 giây, nếu không nhận `429 OTP_TOO_SOON`. API luôn trả thành công kể cả khi email không tồn tại (để không lộ thông tin). Sau đó xác minh bằng bước 1.2 (OTP `1234`) và đăng nhập C để lấy `tokenC` cho các bước 2.4, 2.5.


### 2.3. Quên mật khẩu và đặt lại mật khẩu

**Bước 1 — yêu cầu liên kết đặt lại:**

```http
POST {{auth}}/auth/forgot-password
```

- **Auth:** không cần token

**Body** (JSON):

```json
{ "email": "apidemo.{{n}}@example.com" }
```

**Response 204 No Content** (không có body)

**Bước 2 — lấy token đặt lại.** Hệ thống chưa cấu hình SMTP nên email chỉ được ghi vào log của auth-service. Lấy token bằng lệnh (chạy ở thư mục gốc repo):

```bash
docker compose logs --tail 50 auth-service | grep reset-password
```

Dòng log có dạng `Mở liên kết /reset-password?token=oST2G-Gh9kAgH_F1V3vTuqjeD-LmeeESonSfdzX6LZQ (hiệu lực 15 phút, dùng một lần)`; phần sau `token=` là giá trị cần dùng.

**Bước 3 — đặt mật khẩu mới:**

```http
POST {{auth}}/auth/reset-password
```

- **Auth:** không cần token

**Body** (JSON):

```json
{ "token": "<token lấy từ log>", "new_password": "Demo1234" }
```

**Response 204 No Content** (không có body)

> Đặt lại xong thì **đăng xuất mọi thiết bị**: refresh token cũ sẽ nhận `401 INVALID_REFRESH_TOKEN`, phải đăng nhập lại (bước 1.3). Token sai hoặc hết hạn: `400 INVALID_RESET_TOKEN`:

**Response 400 Bad Request**

```json
{
  "detail": {
    "code": "INVALID_RESET_TOKEN",
    "message": "Liên kết không hợp lệ hoặc đã hết hạn"
  }
}
```


### 2.4. Đổi mật khẩu (tài khoản C)

```http
POST {{auth}}/users/me/password
```

- **Auth:** Bearer `{{tokenC}}`

**Body** (JSON):

```json
{
  "old_password": "Demo1234",
  "new_password": "Demo12345"
}
```

**Response 204 No Content** (không có body)

> Sai mật khẩu cũ: `400 WRONG_PASSWORD`.

**Response 400 Bad Request**

```json
{
  "detail": {
    "code": "WRONG_PASSWORD",
    "message": "Mật khẩu hiện tại không đúng"
  }
}
```


### 2.5. Tắt tài khoản rồi khôi phục (tài khoản C)

```http
DELETE {{auth}}/users/me
```

- **Auth:** Bearer `{{tokenC}}`

**Body** (JSON):

```json
{
  "password": "Demo12345"
}
```

**Response 204 No Content** (không có body)

> Tắt tài khoản thu hồi mọi phiên. Access token cũ vẫn còn hạn nên `GET /auth/me` thấy `status = DEACTIVATED`:

**Response 200 OK**

```json
{
  "id": "4361df7c-49b9-4ddb-9020-a0e8e3c3c88e",
  "email": "apidemo.830368c@example.com",
  "username": "apidemo_830368c",
  "display_name": "Demo C",
  "role": "USER",
  "status": "DEACTIVATED"
}
```

> **Khôi phục:** chỉ cần đăng nhập lại trong vòng 30 ngày (`POST {{auth}}/auth/login`); trả `200` và tài khoản trở lại `ACTIVE`.


## 2B. Chặn người dùng

### 2.6. Chặn, xem danh sách chặn, bỏ chặn (A chặn B)

```http
POST {{auth}}/users/{{username2}}/block
```

- **Auth:** Bearer `{{token}}`

**Response 204 No Content** (không có body)

> Chặn **gỡ theo dõi hai chiều**, và hai bên không còn thấy hồ sơ/bài của nhau. Tự chặn mình: `400 CANNOT_BLOCK_SELF`.

> Xem danh sách mình đã chặn: `GET {{auth}}/users/me/blocks` (Bearer `{{token}}`).

**Response 200 OK**

```json
[
  {
    "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
    "username": "apidemo_830368b",
    "display_name": "Demo B 830368",
    "bio": null
  }
]
```

> Xem các id liên quan: `GET {{auth}}/users/me/relations`.

**Response 200 OK**

```json
{
  "blocked": [
    "adba670c-14b9-40fa-b9d6-8d61e34a90f7"
  ],
  "blocked_by": [],
  "following": []
}
```

> Lúc này B xem hồ sơ A (`GET {{auth}}/users/{{username}}` với `{{token2}}`) sẽ bị `404 USER_NOT_FOUND`:

**Response 404 Not Found**

```json
{
  "detail": {
    "code": "USER_NOT_FOUND",
    "message": "Không tìm thấy người dùng"
  }
}
```

> Bỏ chặn: `DELETE {{auth}}/users/{{username2}}/block` (Bearer `{{token}}`) trả `204`. Sau khi bỏ chặn **theo dõi không tự khôi phục**, cần theo dõi lại (bước 2.7).


## 2C. Bài viết nâng cao

### 2.7. Chuẩn bị dữ liệu: theo dõi hai chiều và tạo bài

Các bước sau cần dữ liệu này. Chạy theo thứ tự:

1. A theo dõi B: `POST {{auth}}/users/{{username2}}/follow` (Bearer `{{token}}`) → `204`.
2. B theo dõi A: `POST {{auth}}/users/{{username}}/follow` (Bearer `{{token2}}`) → `204`.
3. A tạo 3 bài bằng `POST {{post}}/posts` (Bearer `{{token}}`), lưu `json.id` lần lượt vào `postId`, `postId2`, `postId3`:
   - `{ "content": "Buổi sáng uống cà phê ở Sài Gòn #caphe #apidemo" }` → `postId`
   - `{ "content": "Bài quảng cáo spam số 1 #apidemo" }` → `postId2`
   - `{ "content": "Bài quảng cáo spam số 2 #apidemo" }` → `postId3`
4. B tạo 1 bài (Bearer `{{token2}}`), lưu `postIdB`: `{ "content": "Chiều nay B đi uống trà đá #apidemo" }`.

> Bài của B chỉ vào bảng tin của A nếu B đăng **sau khi** A đã theo dõi B (xem bước 2.16).


### 2.8. Đăng lại và bỏ đăng lại (B đăng lại bài của A)

```http
POST {{post}}/posts/{{postId}}/repost
```

- **Auth:** Bearer `{{token2}}`

**Response 200 OK**

```json
{
  "id": "1acf4685-c471-42a3-9471-d42ad01bbdf7",
  "author": {
    "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
    "username": "apidemo_830368",
    "display_name": "Demo An"
  },
  "content": "Buổi sáng uống cà phê ở Sài Gòn #caphe #apidemo",
  "hashtags": [
    "caphe",
    "apidemo"
  ],
  "like_count": 1,
  "reply_count": 0,
  "repost_count": 1,
  "liked_by_me": true,
  "reposted_by_me": true,
  "is_mine": false,
  "created_at": "2026-10-24T08:27:15.587360Z"
}
```

> Bỏ đăng lại: `DELETE {{post}}/posts/{{postId}}/repost` (Bearer `{{token2}}`), cũng trả bài đã cập nhật (`repost_count` giảm, `reposted_by_me = false`).


### 2.9. Danh sách người đã thích

```http
GET {{post}}/posts/{{postId}}/likes
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
      "username": "apidemo_830368b",
      "display_name": "Demo B 830368"
    }
  ],
  "next_cursor": null
}
```

> Cần có người thích trước (bước 1.14 với `postId` hiện tại, dùng `{{token2}}`). `next_cursor` ở đây thực chất là offset dạng chuỗi, cứ gửi lại nguyên giá trị.


## 2D. Báo cáo và kiểm duyệt (admin)

### 2.10. Báo cáo bài viết (B báo cáo bài của A)

```http
POST {{post}}/posts/{{postId2}}/report
```

- **Auth:** Bearer `{{token2}}`
- **Lưu:** `json.case_id` → `caseId`

**Body** (JSON):

```json
{
  "reason": "SPAM"
}
```

**Response 201 Created**

```json
{
  "case_id": "5adca963-7846-4324-b92d-3cb6a225594a"
}
```

> `reason`: `SPAM`, `HARASSMENT`, `HATE`, `VIOLENCE`, `SENSITIVE`, `OTHER` (chọn `OTHER` phải kèm `description`). Báo cáo bài `postId3` với `{ "reason": "HARASSMENT", "description": "Nội dung quấy rối" }` và lưu `case_id` vào `caseId2`. Các lỗi thường gặp:

> - Báo cáo lần hai cùng bài: `409 ALREADY_REPORTED`.

**Response 409 Conflict**

```json
{
  "detail": {
    "code": "ALREADY_REPORTED",
    "message": "Bạn đã báo cáo nội dung này"
  }
}
```

> - `OTHER` không mô tả: `422 DESCRIPTION_REQUIRED`.

**Response 422 Unprocessable Entity**

```json
{
  "detail": {
    "code": "DESCRIPTION_REQUIRED",
    "message": "Chọn \"Khác\" thì cần mô tả lý do",
    "fields": {
      "description": "Bắt buộc"
    }
  }
}
```

> - Báo cáo bài của chính mình: `400 CANNOT_REPORT_OWN_POST`.

**Response 400 Bad Request**

```json
{
  "detail": {
    "code": "CANNOT_REPORT_OWN_POST",
    "message": "Không thể báo cáo bài của chính mình"
  }
}
```


### 2.11. Admin xem danh sách và chi tiết báo cáo

```http
GET {{post}}/admin/reports
```

- **Auth:** Bearer `{{adminToken}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "5adca963-7846-4324-b92d-3cb6a225594a",
      "status": "PENDING",
      "post": {
        "id": "3455edf6-3ea7-4041-84f8-e9ff734a249f",
        "author": {
          "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
          "username": "apidemo_830368",
          "display_name": "Demo An",
          "status": "ACTIVE"
        },
        "type": "POST",
        "content": "Bài quảng cáo spam số 1 #apidemo",
        "visibility": "PUBLIC",
        "media": {
          "images": 0,
          "videos": 0
        },
        "pending_reports": 1,
        "created_at": "2026-10-24T08:27:15.759394Z"
      },
      "report_count": 1,
      "top_reason": "SPAM",
      "first_reported_at": "2026-10-24T08:27:18.062975Z",
      "resolved_at": null
    },
    {
      "id": "a6d9d957-a938-42e8-a42f-7d59e8c75264",
      "status": "PENDING",
      "post": {
        "id": "3d388bb6-5d18-4d52-9cf6-d05866468051",
        "author": {
          "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
          "username": "apidemo_830368",
          "display_name": "Demo An",
          "status": "ACTIVE"
        },
        "type": "POST",
        "content": "Bài quảng cáo spam số 2 #apidemo",
        "visibility": "PUBLIC",
        "media": {
          "images": 0,
          "videos": 0
        },
        "pending_reports": 1,
        "created_at": "2026-10-24T08:27:15.862647Z"
      },
      "report_count": 1,
      "top_reason": "HARASSMENT",
      "first_reported_at": "2026-10-24T08:27:18.273561Z",
      "resolved_at": null
    }
  ],
  "next_offset": null
}
```

> Lọc theo `status` = `PENDING` (mặc định) | `APPROVED` | `DISMISSED` | `CLOSED`; phân trang `offset`. Cùng một bài bị báo nhiều lần gộp thành **một nhóm** (`report_count`). Chi tiết một nhóm: `GET {{post}}/admin/reports/{{caseId}}`:

**Response 200 OK**

```json
{
  "id": "5adca963-7846-4324-b92d-3cb6a225594a",
  "status": "PENDING",
  "post": {
    "id": "3455edf6-3ea7-4041-84f8-e9ff734a249f",
    "author": {
      "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
      "username": "apidemo_830368",
      "display_name": "Demo An",
      "status": "ACTIVE"
    },
    "type": "POST",
    "content": "Bài quảng cáo spam số 1 #apidemo",
    "visibility": "PUBLIC",
    "media": {
      "images": 0,
      "videos": 0
    },
    "pending_reports": 1,
    "created_at": "2026-10-24T08:27:15.759394Z"
  },
  "report_count": 1,
  "top_reason": "SPAM",
  "first_reported_at": "2026-10-24T08:27:18.062975Z",
  "resolved_at": null,
  "reasons": [
    {
      "reason": "SPAM",
      "count": 1
    }
  ],
  "other_descriptions": [],
  "author_violations_90d": 0
}
```

> Nhóm không tồn tại: `404 REPORT_CASE_NOT_FOUND`.


### 2.12. Bỏ qua báo cáo (dismiss)

```http
POST {{post}}/admin/reports/{{caseId}}/dismiss
```

- **Auth:** Bearer `{{adminToken}}`

**Body** (JSON):

```json
{
  "reason": "Không vi phạm tiêu chuẩn cộng đồng"
}
```

**Response 200 OK**

```json
{
  "id": "5adca963-7846-4324-b92d-3cb6a225594a",
  "status": "DISMISSED",
  "post": {
    "id": "3455edf6-3ea7-4041-84f8-e9ff734a249f",
    "author": {
      "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
      "username": "apidemo_830368",
      "display_name": "Demo An",
      "status": "ACTIVE"
    },
    "type": "POST",
    "content": "Bài quảng cáo spam số 1 #apidemo",
    "visibility": "PUBLIC",
    "media": {
      "images": 0,
      "videos": 0
    },
    "pending_reports": 0,
    "created_at": "2026-10-24T08:27:15.759394Z"
  },
  "report_count": 1,
  "top_reason": "SPAM",
  "first_reported_at": "2026-10-24T08:27:18.062975Z",
  "resolved_at": "2026-10-24T08:27:18.628625Z"
}
```

> Giữ nguyên nội dung, không tính vi phạm cho tác giả. `reason` có thể bỏ trống (lấy mặc định như trên).


### 2.13. Duyệt báo cáo (approve = xóa nội dung)

```http
POST {{post}}/admin/reports/{{caseId2}}/approve
```

- **Auth:** Bearer `{{adminToken}}`

**Body** (JSON):

```json
{
  "reason": "HARASSMENT"
}
```

**Response 200 OK**

```json
{
  "post_id": "3d388bb6-5d18-4d52-9cf6-d05866468051",
  "author_violations_90d": 1,
  "author_auto_banned": false
}
```

> Xóa bài và tính 1 vi phạm cho tác giả. Duyệt lại nhóm đã xử lý: `409 REPORT_CASE_RESOLVED`.

**Response 409 Conflict**

```json
{
  "detail": {
    "code": "REPORT_CASE_RESOLVED",
    "message": "Nhóm báo cáo này đã được xử lý"
  }
}
```


### 2.14. Nhật ký thao tác admin

```http
GET {{auth}}/admin/audit-logs?days=1
```

- **Auth:** Bearer `{{adminToken}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "ad1c1c1c-c44b-4a37-ba5b-bf55b94b37fc",
      "created_at": "2026-10-24T08:29:48.491832Z",
      "admin_username": "admin",
      "action": "DELETE_POST",
      "target_type": "POST",
      "target_id": "ff836730-1e10-48af-a06c-5c3711c2307b",
      "target_label": null,
      "reason": "HARASSMENT"
    },
    {
      "id": "466f133a-19e8-49a7-88bf-82053023a0cc",
      "created_at": "2026-10-24T08:29:48.491832Z",
      "admin_username": "admin",
      "action": "BAN_USER",
      "target_type": "USER",
      "target_id": "0a58940d-7160-46c3-90ec-097c67201c81",
      "target_label": "@apidemo_830368d",
      "reason": "Tự động: 3 lần vi phạm trong 90 ngày"
    },
    {
      "id": "a7a55da3-b8e4-4b7e-8958-b9b6c0b86e36",
      "created_at": "2026-10-24T08:29:48.387823Z",
      "admin_username": "admin",
      "action": "DELETE_POST",
      "target_type": "POST",
      "target_id": "8a21fec8-2cd9-4c3a-9ca7-99071d965c1a",
      "target_label": null,
      "reason": "HARASSMENT"
    },
    {
      "id": "b69b849e-859a-4661-af29-eebbd013ab0d",
      "created_at": "2026-10-24T08:29:48.284883Z",
      "admin_username": "admin",
      "action": "DELETE_POST",
      "target_type": "POST",
      "target_id": "d91a8885-3383-4c2c-a681-98c398701c14",
      "target_label": null,
      "reason": "HARASSMENT"
    }
  ],
  "next_cursor": null
}
```

> Rút gọn còn 4 mục đầu. Lọc: `action` (một trong `BAN_USER`, `UNBAN_USER`, `DELETE_POST`, `APPROVE_REPORT`, `DISMISS_REPORT`; giá trị khác nhận `422 VALIDATION_ERROR`), `days`, `cursor`. Mọi lần khóa, mở khóa, xóa bài, duyệt hoặc bỏ qua báo cáo đều để lại một dòng ở đây.


### 2.15. Luật 3 vi phạm: tự động khóa

Dùng một tài khoản riêng D: tạo như bước 1.1–1.2 (`email` = `apidemo.{{n}}d@example.com`, `username` = `apidemo_{{n}}d`), đăng nhập lấy `tokenD`. D đăng 3 bài bằng `POST {{post}}/posts` (ví dụ `{ "content": "Bài vi phạm số 1" }`, số 2, số 3) và lưu id từng bài vào `postIdD` (mỗi lần đặt id của bài cần xóa). Sau đó admin xóa lần lượt từng bài:

```http
DELETE {{post}}/admin/posts/{{postIdD}}
```

- **Auth:** Bearer `{{adminToken}}`

**Body** (JSON):

```json
{ "reason": "HARASSMENT" }
```

Lần xóa thứ nhất:

**Response 200 OK**

```json
{
  "post_id": "d91a8885-3383-4c2c-a681-98c398701c14",
  "author_violations_90d": 1,
  "author_auto_banned": false
}
```

Lần xóa thứ ba (đủ 3 vi phạm trong 90 ngày, tài khoản tự bị khóa 7 ngày):

**Response 200 OK**

```json
{
  "post_id": "ff836730-1e10-48af-a06c-5c3711c2307b",
  "author_violations_90d": 3,
  "author_auto_banned": true
}
```

D đăng nhập lại sẽ nhận:

**Response 403 Forbidden**

```json
{
  "detail": {
    "code": "ACCOUNT_BANNED",
    "message": "Tài khoản đang bị khóa",
    "reason": "Tự động: 3 lần vi phạm trong 90 ngày",
    "ends_at": "2026-10-31T08:29:48.499732+00:00"
  }
}
```

Admin xem lại tài khoản này (`GET {{auth}}/admin/users?q=apidemo_{{n}}d`, Bearer `{{adminToken}}`):

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "0a58940d-7160-46c3-90ec-097c67201c81",
      "email": "apidemo.830368d@example.com",
      "username": "apidemo_830368d",
      "display_name": "Demo D",
      "role": "USER",
      "status": "BANNED",
      "created_at": "2026-10-24T08:29:47.272102Z",
      "violations_90d": 3,
      "active_ban": {
        "type": "TEMPORARY",
        "reason": "Tự động: 3 lần vi phạm trong 90 ngày",
        "starts_at": "2026-10-24T08:29:48.499732Z",
        "ends_at": "2026-10-31T08:29:48.499732Z"
      }
    }
  ],
  "next_cursor": null
}
```

> Lệnh khóa tự động cũng được ghi vào nhật ký admin (bước 2.14, `action = BAN_USER`, lý do bắt đầu bằng "Tự động"). Để mở khóa, dùng bước 1.24 với id của D.


## 2E. Bảng tin (feed-service)

### 2.16. Bảng tin Theo dõi

```http
GET {{feed}}/feed
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "post": {
        "id": "4b759c79-0838-4c41-aa0c-2a46a6ed5843",
        "author": {
          "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
          "username": "apidemo_830368b",
          "display_name": "Demo B 830368"
        },
        "content": "Chiều nay B đi uống trà đá #apidemo",
        "hashtags": [
          "apidemo"
        ],
        "like_count": 0,
        "reply_count": 0,
        "repost_count": 0,
        "liked_by_me": false,
        "reposted_by_me": false,
        "is_mine": false,
        "created_at": "2026-10-24T08:29:27.422937Z"
      },
      "reposted_by": null
    },
    {
      "post": {
        "id": "3455edf6-3ea7-4041-84f8-e9ff734a249f",
        "author": {
          "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
          "username": "apidemo_830368",
          "display_name": "Demo An"
        },
        "content": "Bài quảng cáo spam số 1 #apidemo",
        "hashtags": [
          "apidemo"
        ],
        "like_count": 0,
        "reply_count": 0,
        "repost_count": 0,
        "liked_by_me": false,
        "reposted_by_me": false,
        "is_mine": true,
        "created_at": "2026-10-24T08:27:15.759394Z"
      },
      "reposted_by": null
    },
    {
      "post": {
        "id": "1acf4685-c471-42a3-9471-d42ad01bbdf7",
        "author": {
          "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
          "username": "apidemo_830368",
          "display_name": "Demo An"
        },
        "content": "Buổi sáng uống cà phê ở Sài Gòn #caphe #apidemo",
        "hashtags": [
          "caphe",
          "apidemo"
        ],
        "like_count": 1,
        "reply_count": 1,
        "repost_count": 1,
        "liked_by_me": false,
        "reposted_by_me": false,
        "is_mine": true,
        "created_at": "2026-10-24T08:27:15.587360Z"
      },
      "reposted_by": null
    }
  ],
  "next_cursor": null
}
```

> Gồm bài của chính mình và của những người mình theo dõi, mới nhất trước (đã cắt còn 3 mục đầu). Mỗi mục là `{ post, reposted_by }`. Bảng tin được dựng theo sự kiện nên có thể trễ khoảng 1–2 giây sau khi đăng bài. Phân trang cursor; cursor sai: `400 INVALID_CURSOR`.


### 2.17. Bảng tin Khám phá

```http
GET {{feed}}/feed/explore
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "post": {
        "id": "c2d9f32d-e9e5-4ee1-8737-bdbf636b4857",
        "author": {
          "id": "eac11b53-cfe0-4e57-912f-5265338b6828",
          "username": "thuha.le",
          "display_name": "Lê Thu Hà"
        },
        "content": "Quán cà phê nhỏ trong hẻm Lê Thánh Tôn, cà phê muối ngon lắm mọi người ơi #caphe",
        "hashtags": [
          "caphe"
        ],
        "like_count": 1,
        "reply_count": 2,
        "repost_count": 0,
        "liked_by_me": false,
        "reposted_by_me": false,
        "is_mine": false,
        "created_at": "2026-10-24T07:51:35.800226Z"
      },
      "reposted_by": null
    },
    {
      "post": {
        "id": "f02ffe12-f57f-47e8-bf32-a2d48a258dd7",
        "author": {
          "id": "afc5b9e5-314b-40b3-9398-62d6cbbb745d",
          "username": "minhanh.ng",
          "display_name": "Nguyễn Minh Anh"
        },
        "content": "Đang đọc lại cuốn 'Nhà giả kim', mỗi lần đọc lại thấy một ý mới. #docsach",
        "hashtags": [
          "docsach"
        ],
        "like_count": 0,
        "reply_count": 0,
        "repost_count": 1,
        "liked_by_me": false,
        "reposted_by_me": false,
        "is_mine": false,
        "created_at": "2026-10-24T07:51:35.311533Z"
      },
      "reposted_by": null
    }
  ],
  "next_offset": null
}
```

> Bài nhiều tương tác nhất trong 7 ngày qua (đã cắt còn 2 mục đầu), phân trang kiểu offset (`next_offset`).


### 2.18. Ẩn bài và bỏ ẩn

```http
POST {{feed}}/feed/hide/{{postIdB}}
```

- **Auth:** Bearer `{{token}}`

**Response 204 No Content** (không có body)

> Bài bị ẩn khỏi bảng tin của A (bảng tin chỉ còn bài của A). Bỏ ẩn: `DELETE {{feed}}/feed/hide/{{postIdB}}` → `204`. Lưu ý đường dẫn feed dùng `postId`, `userId` kiểu camelCase.

**Response 200 OK**

```json
{
  "items": [
    {
      "post": {
        "id": "3455edf6-3ea7-4041-84f8-e9ff734a249f",
        "author": {
          "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
          "username": "apidemo_830368",
          "display_name": "Demo An"
        },
        "content": "Bài quảng cáo spam số 1 #apidemo",
        "hashtags": [
          "apidemo"
        ],
        "like_count": 0,
        "reply_count": 0,
        "repost_count": 0,
        "liked_by_me": false,
        "reposted_by_me": false,
        "is_mine": true,
        "created_at": "2026-10-24T08:27:15.759394Z"
      },
      "reposted_by": null
    }
  ],
  "next_cursor": null
}
```


### 2.19. Ẩn người và bỏ ẩn

```http
POST {{feed}}/feed/mute/{{userId2}}
```

- **Auth:** Bearer `{{token}}`

**Response 204 No Content** (không có body)

> Ẩn mọi bài của B khỏi bảng tin của A. Bỏ ẩn: `DELETE {{feed}}/feed/mute/{{userId2}}` → `204`. Tự ẩn mình: `400 CANNOT_MUTE_SELF`.

**Response 400 Bad Request**

```json
{
  "detail": {
    "code": "CANNOT_MUTE_SELF",
    "message": "Không thể tự ẩn chính mình"
  }
}
```


## 2F. Thông báo (notification-service)

### 2.20. Danh sách thông báo

```http
GET {{noti}}/notifications?limit=3
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "a95b00e2-0e0f-4430-80fe-fbd3f2e24ac8",
      "userId": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
      "kind": "REPOST",
      "message": "apidemo_830368b đã đăng lại bài viết của bạn",
      "postId": "1acf4685-c471-42a3-9471-d42ad01bbdf7",
      "groupKey": "REPOST:1acf4685-c471-42a3-9471-d42ad01bbdf7:2026-10-24",
      "actorCount": 1,
      "readAt": null,
      "lastActivityAt": "2026-10-24T08:29:29.128Z",
      "createdAt": "2026-10-24T08:29:29.024Z"
    },
    {
      "id": "bb934b37-b29e-4703-b4b3-549805df08df",
      "userId": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
      "kind": "FOLLOW",
      "message": "apidemo_830368b đã bắt đầu theo dõi bạn",
      "postId": null,
      "groupKey": "FOLLOW:profile:2026-10-24",
      "actorCount": 1,
      "readAt": null,
      "lastActivityAt": "2026-10-24T08:27:18.056Z",
      "createdAt": "2026-10-24T08:27:17.622Z"
    },
    {
      "id": "e1f44f86-a5b4-4813-9a84-48d4a2977115",
      "userId": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
      "kind": "REPLY",
      "message": "apidemo_830368b đã trả lời bài viết của bạn",
      "postId": "4ea6bae4-967a-47e4-b32e-8c110b1b1a56",
      "groupKey": null,
      "actorCount": 1,
      "readAt": null,
      "lastActivityAt": "2026-10-24T08:27:17.032Z",
      "createdAt": "2026-10-24T08:27:17.032Z"
    }
  ],
  "next_cursor": "MjAyNi0xMC0yNFQwODoyNzoxNy4wMzJafGUxZjQ0Zjg2LWE1YjQtNDgxMy05YTg0LTQ4ZDRhMjk3NzExNQ"
}
```

> B thích, trả lời, đăng lại bài và theo dõi A ở các bước trước nên A có thông báo. `kind`: `LIKE`, `REPLY`, `REPOST`, `FOLLOW`, `MENTION`. Lọc chưa đọc: `?unread=true`. Phân trang cursor, `limit` tối đa 100. Thông báo cùng loại cùng bài được **gộp** (`actorCount`).


### 2.21. Đánh dấu một thông báo đã đọc

```http
POST {{noti}}/notifications/{{notificationId}}/read
```

- **Auth:** Bearer `{{token}}`
- **Lưu:** `id` lấy từ bước 2.20 (đặt biến `notificationId`)

**Response 200 OK**

```json
{
  "id": "a95b00e2-0e0f-4430-80fe-fbd3f2e24ac8",
  "userId": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
  "kind": "REPOST",
  "message": "apidemo_830368b đã đăng lại bài viết của bạn",
  "postId": "1acf4685-c471-42a3-9471-d42ad01bbdf7",
  "groupKey": "REPOST:1acf4685-c471-42a3-9471-d42ad01bbdf7:2026-10-24",
  "actorCount": 1,
  "readAt": "2026-10-24T08:29:31.609Z",
  "lastActivityAt": "2026-10-24T08:29:29.128Z",
  "createdAt": "2026-10-24T08:29:29.024Z"
}
```

> `readAt` được điền. Thông báo không phải của mình hoặc không tồn tại: `404 NOTIFICATION_NOT_FOUND`.

**Response 404 Not Found**

```json
{
  "detail": {
    "code": "NOTIFICATION_NOT_FOUND",
    "message": "Không tìm thấy thông báo"
  }
}
```


### 2.22. Số thông báo chưa đọc

```http
GET {{noti}}/notifications/unread-count
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "count": 4
}
```


### 2.23. Đánh dấu đã đọc tất cả

```http
POST {{noti}}/notifications/read-all
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "updated": 4
}
```

> Sau đó `unread-count` trả `{ "count": 0 }`.


### 2.24. Cài đặt thông báo

```http
GET {{noti}}/notifications/settings
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
[
  {
    "type": "LIKE",
    "enabled": true,
    "scope": "EVERYONE"
  },
  {
    "type": "REPLY",
    "enabled": true,
    "scope": "EVERYONE"
  },
  {
    "type": "REPOST",
    "enabled": true,
    "scope": "EVERYONE"
  },
  {
    "type": "FOLLOW",
    "enabled": true,
    "scope": "EVERYONE"
  },
  {
    "type": "MENTION",
    "enabled": true,
    "scope": "EVERYONE"
  }
]
```

> Loại chưa có dòng nghĩa là đang bật. Tắt/bật một loại:


```http
PUT {{noti}}/notifications/settings/LIKE
```

- **Auth:** Bearer `{{token}}`

**Body** (JSON):

```json
{ "enabled": false }
```

**Response 200 OK**

```json
{
  "type": "LIKE",
  "enabled": false,
  "scope": "EVERYONE"
}
```

> `type` hợp lệ: `LIKE`, `REPLY`, `REPOST`, `FOLLOW`, `MENTION`. Loại khác (ví dụ `SYSTEM`, luôn bật): `404 UNKNOWN_NOTIFICATION_TYPE`. Gọi lại với `{ "enabled": true }` để bật lại. Trường `scope` (`EVERYONE` | `FOLLOWING`) được lưu nhưng hiện chưa dùng để lọc.


## 2G. Tìm kiếm, hashtag (search-service, post-service)

### 2.25. Tìm người dùng

```http
GET {{search}}/search/users?q=apidemo_{{n}}
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "user_id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
      "username": "apidemo_830368",
      "display_name": "Demo An",
      "follower_count": 2,
      "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7"
    },
    {
      "user_id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7",
      "username": "apidemo_830368b",
      "display_name": "Demo B 830368",
      "follower_count": 2,
      "id": "adba670c-14b9-40fa-b9d6-8d61e34a90f7"
    },
    {
      "user_id": "4361df7c-49b9-4ddb-9020-a0e8e3c3c88e",
      "username": "apidemo_830368c",
      "display_name": "Demo C",
      "follower_count": 0,
      "id": "4361df7c-49b9-4ddb-9020-a0e8e3c3c88e"
    }
  ],
  "next_offset": null
}
```

> Tìm theo tiền tố username, không dấu, không phân biệt hoa thường; nhiều người theo dõi lên trước. Từ khóa rỗng: `422 EMPTY_QUERY`. Dữ liệu tìm kiếm được dựng theo sự kiện nên tài khoản mới có thể xuất hiện sau 1–2 giây.

**Response 422 Unprocessable Entity**

```json
{
  "detail": {
    "code": "EMPTY_QUERY",
    "message": "Nhập từ khóa để tìm kiếm"
  }
}
```


### 2.26. Tìm bài viết

```http
GET {{search}}/search/posts?q=ca%20phe
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "c2d9f32d-e9e5-4ee1-8737-bdbf636b4857",
      "author": {
        "id": "eac11b53-cfe0-4e57-912f-5265338b6828",
        "username": "thuha.le",
        "display_name": "Lê Thu Hà"
      },
      "content": "Quán cà phê nhỏ trong hẻm Lê Thánh Tôn, cà phê muối ngon lắm mọi người ơi #caphe",
      "hashtags": [
        "caphe"
      ],
      "like_count": 1,
      "reply_count": 2,
      "repost_count": 0,
      "liked_by_me": false,
      "reposted_by_me": false,
      "is_mine": false,
      "created_at": "2026-10-24T07:51:35.800226Z"
    },
    {
      "id": "1acf4685-c471-42a3-9471-d42ad01bbdf7",
      "author": {
        "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
        "username": "apidemo_830368",
        "display_name": "Demo An"
      },
      "content": "Buổi sáng uống cà phê ở Sài Gòn #caphe #apidemo",
      "hashtags": [
        "caphe",
        "apidemo"
      ],
      "like_count": 1,
      "reply_count": 1,
      "repost_count": 1,
      "liked_by_me": false,
      "reposted_by_me": false,
      "is_mine": true,
      "created_at": "2026-10-24T08:27:15.587360Z"
    }
  ],
  "next_offset": null
}
```

> Tìm toàn văn, không dấu ("ca phe" khớp "cà phê"). Đã cắt còn 2 mục đầu; phân trang offset.


### 2.27. Hashtag thịnh hành

```http
GET {{search}}/trending/hashtags
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
[
  {
    "rank": 1,
    "hashtag": "apidemo",
    "post_count": 4
  },
  {
    "rank": 2,
    "hashtag": "caphe",
    "post_count": 3
  },
  {
    "rank": 3,
    "hashtag": "chaybo",
    "post_count": 2
  },
  {
    "rank": 4,
    "hashtag": "docsach",
    "post_count": 1
  },
  {
    "rank": 5,
    "hashtag": "saigon",
    "post_count": 1
  }
]
```

> Top 10 hashtag trong 24 giờ, tính lại khi dữ liệu cũ hơn 15 phút (số liệu mẫu phụ thuộc dữ liệu lúc gọi).


### 2.28. Bài viết theo hashtag

```http
GET {{post}}/hashtags/caphe/posts
```

- **Auth:** Bearer `{{token}}`

**Response 200 OK**

```json
{
  "items": [
    {
      "id": "1acf4685-c471-42a3-9471-d42ad01bbdf7",
      "author": {
        "id": "e4952d92-b8a9-47bf-81ea-7fc815ddb7a7",
        "username": "apidemo_830368",
        "display_name": "Demo An"
      },
      "content": "Buổi sáng uống cà phê ở Sài Gòn #caphe #apidemo",
      "hashtags": [
        "caphe",
        "apidemo"
      ],
      "like_count": 1,
      "reply_count": 1,
      "repost_count": 1,
      "liked_by_me": false,
      "reposted_by_me": false,
      "is_mine": true,
      "created_at": "2026-10-24T08:27:15.587360Z"
    },
    {
      "id": "fe2fd9f1-a347-4cd7-8710-ec1e24575af3",
      "author": {
        "id": "eac11b53-cfe0-4e57-912f-5265338b6828",
        "username": "thuha.le",
        "display_name": "Lê Thu Hà"
      },
      "content": "Cuối tuần này ai đi chợ Bến Thành ăn ốc không? #saigon #caphe",
      "hashtags": [
        "caphe",
        "saigon"
      ],
      "like_count": 0,
      "reply_count": 0,
      "repost_count": 0,
      "liked_by_me": false,
      "reposted_by_me": false,
      "is_mine": false,
      "created_at": "2026-10-24T07:51:36.299430Z"
    }
  ],
  "next_cursor": null
}
```

> Tên hashtag viết có hoặc không có `#`. Đã cắt còn 2 mục đầu; phân trang cursor.


## 2H. Kiểm tra sức khỏe các service

### 2.29. Health của 5 service

Không cần token. Gọi lần lượt `GET {{auth}}/health`, `GET {{post}}/health`, `GET {{noti}}/health`, `GET {{feed}}/health`, `GET {{search}}/health`; cả 5 đều trả `200`:

**Response 200 OK**

```json
{
  "service": "auth-service",
  "database": "ok"
}
```

**Response 200 OK**

```json
{
  "service": "post-service",
  "database": "ok"
}
```

**Response 200 OK**

```json
{
  "service": "feed-service",
  "database": "ok"
}
```

> Mỗi service báo tên và trạng thái kết nối database của riêng nó. Nếu một service không lên, kiểm tra `docker compose ps`.

---

# Phụ lục — Lỗi thường gặp

Mọi lỗi có dạng `{ "detail": { "code": "...", "message": "..." } }`.

| Mã HTTP | `code` | Khi nào | Cách xử lý |
|---|---|---|---|
| 401 | `NOT_AUTHENTICATED` | Thiếu header Bearer. | Kiểm tra tab Auth đã chọn Bearer và biến token có giá trị. |
| 401 | `TOKEN_EXPIRED` / `INVALID_TOKEN` | Access token quá 15 phút / sai token. | Đăng nhập lại (1.3) hoặc refresh (2.1). |
| 401 | `INVALID_CREDENTIALS` | Sai email hoặc mật khẩu. | Kiểm tra lại; sai 5 lần bị `429 LOGIN_LOCKED` 15 phút. |
| 403 | `FORBIDDEN` | Gọi API admin bằng token người thường, hoặc sửa/xóa bài của người khác. | Dùng `{{adminToken}}` / đúng chủ bài. |
| 403 | `ACCOUNT_BANNED` | Tài khoản đang bị khóa (kèm `reason`, `ends_at`). | Admin mở khóa (1.24). |
| 404 | `POST_NOT_FOUND` / `USER_NOT_FOUND` | Id sai, bài đã xóa, hoặc hai bên có quan hệ chặn. | Kiểm tra lại biến `postId`, `username`. |
| 409 | `ALREADY_EXISTS` | Email hoặc username đã dùng (`detail.fields` là object). | Đổi biến `n`. |
| 422 | `VALIDATION_ERROR` | Body sai định dạng (`detail.fields` là mảng `[{field, message}]`). | Sửa theo `message`. |
| 502 | `POST_SERVICE_UNAVAILABLE` | Feed/Search không gọi được post-service. | Kiểm tra `docker compose ps`. |

Nếu cổng nào không phản hồi, mở `http://localhost:<cổng>/health` trên trình duyệt trước; các service Python còn có Swagger tại `http://localhost:<cổng>/docs` (8001, 8002, 8005).
