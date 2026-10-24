# Plan: Giao diện Hồ sơ (user-web) + tài liệu API

Spec: thiết kế ngắn đã được người dùng duyệt trong chat ngày 2026-10-24 (đường "bounded"), tóm tắt ở mục Global Constraints.
Bản thiết kế giao diện: `design/oris-ui/source/{Profile,UserProfile,EditProfile,FollowList}.dc.html` và `design/oris-ui/DESIGN.md`.

## Global Constraints

- Ngôn ngữ giao diện, comment, commit message: **tiếng Việt**, giống code hiện có. Comment ít, chỉ giải thích "vì sao".
- Theo đúng kiểu code của `user-web/src` (React 18 function component, không TypeScript, không thư viện UI, CSS thuần trong `src/styles.css` dùng token màu ở `:root`).
- Mọi lệnh gọi API đi qua `api()` trong `user-web/src/api.js` (đường dẫn `/api/<service>/...`, Vite proxy).
- **Không** sửa backend trong plan này. **Không** đụng `user-web/src/components/AuthSplit.jsx` (người dùng đang sửa dở, không được stage/commit file đó).
- Commit: chỉ `git add` đúng file của task (không `git add -A` / `git add .`). Cuối commit message thêm dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tạm KHÔNG làm: đổi/gỡ ảnh đại diện, số bài viết trên hồ sơ, menu ⋯ (chặn/báo cáo).
- Hình dạng API (đã có, đúng như backend trả):
  - `GET /api/auth/users/{username}` → `{id, username, display_name, avatar_url, bio, link_url, created_at, followers_count, following_count, is_me, is_following, follows_me}`; 404 `USER_NOT_FOUND`.
  - `PATCH /api/auth/users/me` body chỉ gồm trường đổi: `{display_name?, username?, bio?, link_url?}` (chuỗi rỗng = xóa trường) → `{id, username, display_name, avatar_url, bio}`.
    Lỗi: 409 `ALREADY_EXISTS` với `detail.fields = {username: "..."}` (object); 400 `USERNAME_COOLDOWN` với `detail.available_at`; 422 `VALIDATION_ERROR` với `detail.fields = [{field, message}]` (mảng — khác dạng 409).
  - `POST` / `DELETE /api/auth/users/{username}/follow` → 204; 400 `CANNOT_FOLLOW_SELF`.
  - `GET /api/auth/users/{username}/followers?offset=N` và `.../following?offset=N` → `{items: [{id, username, display_name, avatar_url, bio}], next_offset: number|null}`.
  - `GET /api/auth/users/me/relations` → `{blocked: uuid[], blocked_by: uuid[], following: uuid[]}`.
  - `GET /api/post/posts/by-user/{username}?replies=true|false&cursor=...` → `{items: PostOut[], next_cursor: string|null}` (PostOut giống component `Post` đang dùng).
- Test: Vitest + jsdom + @testing-library/react (+ user-event, jest-dom), chạy bằng `npm test` trong `user-web/` trên máy host (node 22 đã có). Mock ở ranh giới mạng (`globalThis.fetch`) hoặc mock module `../api` trong test component; không mock component con.
- Docker: container `user-web` có `node_modules` riêng (volume ẩn danh) nên cài devDependencies trên host không ảnh hưởng container; chỉ cần `vite dev` vẫn chạy.

## Task 1: Hạ tầng test + hàm API cho hồ sơ

Files: `user-web/package.json`, `user-web/package-lock.json`, `user-web/vite.config.js` (thêm khối `test`), `user-web/src/test/setup.js`, `user-web/src/api.js`, `user-web/src/api.test.js`.

1. Cài devDependencies tương thích Vite 5: `vitest@^2`, `jsdom`, `@testing-library/react@^16`, `@testing-library/user-event@^14`, `@testing-library/jest-dom@^6`. Thêm script `"test": "vitest run"`. Cấu hình `test: { environment: 'jsdom', setupFiles: './src/test/setup.js' }` trong `vite.config.js`; `setup.js` import `@testing-library/jest-dom/vitest`.
2. TDD — viết `api.test.js` trước (mock `globalThis.fetch`, kiểm tra URL, method, body), xem fail, rồi thêm vào `api.js`:
   ```js
   export const userApi = {
     profile: (username) => api(`/api/auth/users/${encodeURIComponent(username)}`),
     update: (body) => api('/api/auth/users/me', { method: 'PATCH', body }),
     follow: (username, on) => api(`/api/auth/users/${encodeURIComponent(username)}/follow`, { method: on ? 'POST' : 'DELETE' }),
     followers: (username, p) => api(`/api/auth/users/${encodeURIComponent(username)}/followers${qs(p)}`),
     following: (username, p) => api(`/api/auth/users/${encodeURIComponent(username)}/following${qs(p)}`),
     relations: () => api('/api/auth/users/me/relations'),
   }
   ```
   và `postApi.byUser: (username, p) => api(`/api/post/posts/by-user/${encodeURIComponent(username)}${qs(p)}`)`.
   Thêm hàm `fieldErrors(err)` export từ `api.js`: trả object `{tên_trường: thông_báo}` từ `err.detail.fields` cho cả hai dạng (object của 409, mảng `[{field, message}]` của 422); không có thì `{}`.
3. Test tối thiểu: `follow(…, true)` gọi POST, `false` gọi DELETE; `update` gửi PATCH với body JSON; `followers('a', {offset: 20})` có `?offset=20`; `byUser('a', {replies: true})` có `?replies=true`; `fieldErrors` cho cả hai dạng và trường hợp không có fields.
4. `npm test` xanh, `npm run build` thành công. Commit.

## Task 2: FollowButton + hộp thoại Chỉnh sửa hồ sơ + tải lại `me`

Files: `user-web/src/components/FollowButton.jsx`, `user-web/src/components/FollowButton.test.jsx`, `user-web/src/components/EditProfileDialog.jsx`, `user-web/src/components/EditProfileDialog.test.jsx`, `user-web/src/auth.jsx`, `user-web/src/styles.css`.

TDD cho cả hai component (test trước, xem fail, rồi code).

**FollowButton** `({ username, following, followsMe, onChange })`:
- Nhãn: `following` → "Đang theo dõi"; `!following && followsMe` → "Theo dõi lại"; còn lại → "Theo dõi". Chưa theo dõi: kiểu nút chính (`btn btn-primary`); đang theo dõi: nút viền (thêm class mới `btn-outline` trong styles.css, viền `--input-border`, nền `--surface`).
- Bấm → gọi `userApi.follow(username, !following)`, trong lúc chờ thì `disabled`, xong gọi `onChange(!following)`. Lỗi: giữ nguyên trạng thái, hiện lỗi ngắn (`role="alert"`, class `hint bad`) cạnh nút.
- Test: 3 nhãn; bấm khi chưa theo dõi gọi `follow(u, true)` và `onChange(true)`; bấm khi đang theo dõi gọi `follow(u, false)`; lỗi thì không gọi `onChange` và hiện thông báo.

**auth.jsx**: thêm `reloadMe()` vào context — gọi `authApi.me()` rồi `setMe`. Không đổi gì khác.

**EditProfileDialog** `({ profile, onClose, onSaved })` — theo `EditProfile.dc.html`, không có phần ảnh:
- Hộp thoại `role="dialog"` `aria-modal="true"` `aria-labelledby`, tiêu đề "Chỉnh sửa hồ sơ", nút đóng (aria-label "Đóng"), Esc cũng đóng, bấm nền mờ đóng.
- Trường: Tên hiển thị (maxLength 50, bộ đếm `n/50`), Username (tiền tố `@`, dùng class sẵn có `input-prefix`, chuyển chữ thường khi gõ, ghi chú "Đổi được 1 lần mỗi 30 ngày. Username cũ sẽ được người khác dùng được ngay."), Tiểu sử (textarea maxLength 150, bộ đếm `n/150`), Liên kết (type url, placeholder `https://`, nhãn kèm "(không bắt buộc)").
- Nút "Hủy" và "Lưu thay đổi". Chỉ gửi các trường đã thay đổi so với `profile`; không đổi gì thì đóng luôn không gọi API. Tên hiển thị trống → không cho lưu.
- Lưu: `userApi.update(diff)` → gọi `reloadMe()` (từ `useAuth`) rồi `onSaved(kết_quả_update)`. Lỗi: `fieldErrors(err)` hiện dưới từng trường (`hint bad`); `USERNAME_COOLDOWN` hiện dưới ô username kèm ngày `available_at` (định dạng `vi-VN`); lỗi khác hiện `alert-error` chung.
- Test: chỉ gửi trường đã đổi; không đổi gì thì không gọi API và gọi `onClose`; lỗi 409 hiện dưới ô username; bộ đếm ký tự; Esc gọi `onClose`.
- CSS: thêm `.dialog-backdrop`, `.dialog` (bo góc 20px, nền `--surface`, rộng tối đa 520px), dùng token màu có sẵn.

`npm test` xanh, `npm run build` thành công. Commit.

## Task 3: Trang Hồ sơ + route + sửa link

Files: `user-web/src/pages/Profile.jsx`, `user-web/src/pages/Profile.test.jsx`, `user-web/src/App.jsx`, `user-web/src/components/Nav.jsx`, `user-web/src/components/Post.jsx`, `user-web/src/styles.css`.

TDD cho `Profile.jsx` (mock module `../api`, bọc `MemoryRouter` + context auth giả hoặc mock `../auth`).

- Route trong `App.jsx` (đều bọc `Private` như route cũ): `/profile` → `<Navigate to={`/u/${me.username}`} replace />` (component nhỏ đọc `me` từ `useAuth`); `/u/:username` → `Profile`; `/u/:username/:list` → `FollowList` (Task 4 tạo file; ở task này chỉ thêm route cho `/u/:username`, route `:list` để Task 4 thêm).
- `Profile` dùng `<Shell active={profile?.is_me ? 'profile' : undefined}>`. Bố cục theo `UserProfile.dc.html` / `Profile.dc.html`: thẻ đầu trang có tên (h1), `@username`, nhãn "Theo dõi bạn" khi `follows_me && !is_me`, avatar lớn (component `Avatar` có sẵn, size 72) bên phải; tiểu sử; liên kết (thẻ `a` `target="_blank" rel="noopener noreferrer"`, chỉ hiện khi có); "Tham gia tháng M/YYYY" từ `created_at`; hai link `<strong>N</strong> người theo dõi` → `/u/:username/followers` và `<strong>N</strong> đang theo dõi` → `/u/:username/following` (số định dạng `toLocaleString('vi-VN')`).
- Nút: `is_me` → "Chỉnh sửa hồ sơ" (mở `EditProfileDialog`; lưu xong: nếu username đổi thì `navigate('/u/<mới>', { replace: true })`, không thì tải lại hồ sơ); người khác → `FollowButton`, `onChange` thì tải lại hồ sơ (để số người theo dõi đúng).
- Tab `nav.tabs` "Bài viết" / "Trả lời" (giống kiểu tab ở `Feed.jsx`), gọi `postApi.byUser(username, { replies: tab === 'replies', cursor })`, hiện bằng component `Post`, nút "Xem thêm" khi có `next_cursor`, trạng thái trống: "Chưa có bài viết." / "Chưa có trả lời.".
- Đổi `username` trên URL thì tải lại toàn bộ (hồ sơ + tab về "Bài viết").
- 404 `USER_NOT_FOUND` → hiện "Không tìm thấy người dùng này." thay cho hồ sơ.
- `Nav.jsx`: mục "Hồ sơ" giữ `to="/profile"` (đã đúng), bỏ comment "Mục chưa có màn hình… tạm rơi về trang chủ" nếu không còn đúng thì sửa cho đúng (Tìm kiếm/Thông báo/Cài đặt vẫn chưa có).
- `Post.jsx`: avatar và tên tác giả link tới `/u/${p.author.username}` (nếu thiếu username thì giữ không link/`/`).
- Test: hiện tên/username/tiểu sử/số theo dõi từ API; hồ sơ của mình hiện "Chỉnh sửa hồ sơ" và không hiện FollowButton; người khác follows_me → "Theo dõi bạn" + "Theo dõi lại"; chuyển tab "Trả lời" gọi `byUser` với `replies: true`; 404 hiện thông báo.

`npm test` xanh, `npm run build` thành công. Commit.

## Task 4: Trang danh sách Người theo dõi / Đang theo dõi

Files: `user-web/src/pages/FollowList.jsx`, `user-web/src/pages/FollowList.test.jsx`, `user-web/src/App.jsx`, `user-web/src/styles.css`.

TDD (mock module `../api`).

- Route `/u/:username/:list` (bọc `Private`); `list` khác `followers`/`following` → `<Navigate to={`/u/${username}`} replace />`.
- Theo `FollowList.dc.html`: đầu trang có nút quay lại (`/u/:username`, aria-label "Quay lại hồ sơ", icon `back`, kiểu `page-head` sẵn có) + tên hiển thị và `@username` của chủ hồ sơ (lấy từ `userApi.profile`); tab "Người theo dõi N" / "Đang theo dõi N" là `Link` giữa hai route.
- Danh sách: `userApi.followers|following(username, { offset })`, mỗi dòng: `Avatar` + tên (link `/u/<u>`) + `@username` + tiểu sử (nếu có, 1 dòng) + `FollowButton` (trừ dòng là chính mình `me.id`). Trạng thái nút: `following` = id có trong `relations().following`; `followsMe` chỉ biết chắc trên tab "Người theo dõi" **của chính mình** (người trong danh sách theo dõi mình) — các trường hợp khác truyền `false`. `onChange` cập nhật tập `following` cục bộ.
- Nút "Xem thêm" khi có `next_offset`. Trống: "Chưa có ai theo dõi." / "Chưa theo dõi ai.". 404 → "Không tìm thấy người dùng này.".
- Test: gọi đúng API theo `:list`; nút đúng trạng thái theo `relations`; không hiện nút ở dòng của chính mình; "Xem thêm" gọi với `offset` tiếp theo.

`npm test` xanh, `npm run build` thành công. Commit.

## Task 5: docs/api_endpoint.md — danh sách mọi API hiện có

File: `docs/api_endpoint.md` (mới). Không sửa code.

- Liệt kê **tất cả** endpoint đang có, lấy trực tiếp từ code (không từ README): `auth-service/app/routers/*.py` + `/health` trong `main.py`; `post-service/app/routers/*.py`; `notification-service/src/*.controller.ts`; `feed-service/src/feed.controller.ts`; `search-service/app/routers/*.py`.
- Chia theo từng service (tên, cổng host 8001–8005, đường dẫn qua proxy user-web `/api/<auth|post|notification|feed|search>/...`). Mỗi service một bảng: Method · Path · Quyền (Công khai / Đăng nhập / Admin / Nội bộ `X-Internal-Key`) · Tham số (path/query/body chính) · Mô tả ngắn (tiếng Việt) · Rule (BR-… nếu code ghi).
- Đầu file: cách xác thực (Bearer access token 15 phút, refresh 7 ngày), định dạng lỗi chung `{"detail": {"code", "message", ...}}` (422 có `fields` dạng mảng), phân trang (cursor vs offset — ghi rõ endpoint nào dùng gì), OTP giả `1234` (tạm thời).
- Cuối file: bảng sự kiện nội bộ (`publish_event`): tên sự kiện → service nhận (Notification / Feed / Search), lấy từ `_TYPES`, `_FEED_EVENTS`, `_SEARCH_EVENTS` trong `auth-service/app/notify.py`.
- Ghi chú sai lệch đã biết: README nhắc `GET /users/me` nhưng không có route này (dùng `GET /auth/me`).
- Tự kiểm: đếm số decorator route trong code (`@router.get/post/patch/put/delete`, `@Get/@Post/@Put/@Delete`) và so với số dòng trong bảng — phải bằng nhau; ghi kết quả đếm vào report.
- Commit.

## Task 6: docs/api_demo.md — kịch bản test API trên Thunder Client

File: `docs/api_demo.md` (mới). Không sửa code.

- Hướng dẫn đầu file: tạo Environment trong Thunder Client với biến `auth=http://localhost:8001`, `post=http://localhost:8002`, `noti=http://localhost:8003`, `feed=http://localhost:8004`, `search=http://localhost:8005`, `token`, `token2`, `adminToken`, `postId`, `caseId`…; cách đặt Auth → Bearer `{{token}}`; cách lấy token từ response login (Tests → set env var `json.access_token`).
- **Chỉ 2 phần**:
  - **Phần 1 — API cơ bản (CRUD, demo với thầy):** đăng ký → xác minh OTP `1234` → đăng nhập → `/auth/me` → xem/sửa hồ sơ → tạo bài → xem bài → sửa bài → danh sách bài theo user → trả lời → thích/bỏ thích → theo dõi/bỏ theo dõi → danh sách người theo dõi → xóa bài → đăng xuất. Thêm: đăng nhập admin, danh sách người dùng, khóa / mở khóa, danh sách bài (admin), xóa bài (admin).
  - **Phần 2 — API nâng cao (chưa cần demo vì thời lượng):** refresh token, quên/đặt lại mật khẩu, gửi lại OTP, đổi mật khẩu, tắt tài khoản, chặn/bỏ chặn, đăng lại, danh sách người thích, báo cáo + admin duyệt/bỏ qua báo cáo, nhật ký admin, luật 3 vi phạm tự khóa, bảng tin Theo dõi/Khám phá, ẩn bài / ẩn người, thông báo (danh sách, chưa đọc, đọc, cài đặt), tìm người/bài, hashtag thịnh hành, bài theo hashtag, health của 5 service.
- Mỗi bước: tiêu đề, `METHOD {{biến}}/path`, header cần, body JSON mẫu, **response mẫu thật** (status + JSON rút gọn), và ghi chú ngắn (biến nào cần lưu, lỗi thường gặp kèm mã lỗi).
- **Response mẫu phải lấy từ việc gọi thật** stack đang chạy (`docker compose ps` đang Up; gọi bằng `curl` từ host vào cổng 8001–8005). Dùng tài khoản mới tạo riêng cho việc này, email `apidemo.<n>@example.com`, username `apidemo_<n>`, mật khẩu `Demo1234`; OTP luôn là `1234`. Admin: `admin@example.com` / `Admin@1234`. Rút gọn token trong file (`"eyJhbGciOi…"`); UUID giữ dạng thật hoặc thay bằng `{{postId}}` khi dùng làm biến.
- Không chạy các thao tác Phần 2 có hậu quả khó gỡ lên tài khoản admin hay tài khoản demo chính (`minhanh.ng`, `thuha.le`); tắt tài khoản / khóa / luật 3 vi phạm chỉ chạy trên tài khoản `apidemo_*` riêng.
- Commit.
