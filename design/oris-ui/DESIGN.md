# Thiết kế giao diện người dùng Oris

Bản thiết kế gốc nằm trên canvas claude.ai ("Oris – giao diện người dùng"). Thư mục này là bản xuất để
Claude Code / thành viên nhóm dựng giao diện React thật.

- `screens/*.png` – ảnh chụp từng màn hình (dùng để nhìn bố cục).
- `source/*.dc.html` – mã nguồn thiết kế (HTML + style inline + dữ liệu mẫu trong `renderVals`).
  Không chạy độc lập được; dùng để đọc chính xác màu, khoảng cách, cấu trúc phần tử.

## Bảng màu và chữ (dùng chung với admin-web)

| Token | Giá trị | Dùng cho |
|---|---|---|
| primary | `#4F46E5` | nút chính, tab đang chọn, liên kết, mục điều hướng đang chọn (chữ `#4338CA` trên nền `#E0E7FF`) |
| primary-strong | `#4338CA` | chữ đậm trên nền tím nhạt, hover |
| primary-soft | `#E0E7FF` | nền mục đang chọn, avatar mặc định |
| bg | `#F4F5FA` | nền trang |
| surface | `#FFFFFF` | thẻ, hộp thoại |
| ink / ink-2 / ink-3 | `#0F172A` / `#334155` / `#64748B` | chữ chính / phụ / chú thích |
| line / line-soft | `#E4E7EF` / `#EEF0F6` | viền thẻ / đường kẻ trong thẻ |
| input-border | `#CBD2E1` | viền ô nhập, nút phụ |
| danger | `#B91C1C` | xóa, chặn, lỗi (nền `#FEF2F2`) |
| warn | `#B45309` trên `#FFFBEB` | cảnh báo |
| like | `#C92A5B` | trái tim khi đã thích |
| accent | `#F3B562` | chấm cam trên logo (chỉ dùng ở logo) |

- Phông: **Be Vietnam Pro** 400/500/600/700, cỡ chữ nền 15px, line-height 1.5.
- Bo góc: thẻ 16px, ô nhập 10px, nút tròn 20–25px, hộp thoại 20px.
- Khung ảnh và video: **tỉ lệ 3:4** – ảnh `object-fit: cover`, video `object-fit: contain` trên nền đen.

## Bố cục trang (máy tính)

Thanh điều hướng trái 248px (`Nav`) · cột nội dung tối đa 620px · cột phải 300px (`Trending`), khoảng cách 32px.

## Thành phần dùng chung

| File | Mô tả |
|---|---|
| `Nav.dc.html` | Logo, Trang chủ / Tìm kiếm / Thông báo (badge số chưa đọc) / Hồ sơ / Cài đặt, nút "Đăng bài", tài khoản. Chế độ khách: Khám phá, Tìm kiếm, Tạo tài khoản, Đăng nhập |
| `Trending.dc.html` | Top hashtag thịnh hành 24 giờ (BR-SE3) |
| `Post.dc.html` | Thẻ bài viết: nhãn "đã đăng lại", Riêng tư, (đã chỉnh sửa), ảnh/video 3:4, thích / trả lời / đăng lại, "Đã tắt trả lời", menu ⋯ |

## Danh sách màn hình

| Màn hình | Use case / rule chính |
|---|---|
| Main – Bảng tin Theo dõi | FE1 |
| Explore – Khám phá (khách) | FE2, BR-GEN-08 |
| PostDetail – Chi tiết bài, trả lời lồng 2 cấp, tác giả lên trước | PO2, PO3 |
| Profile / UserProfile – Hồ sơ của mình / người khác | AU4, AU6 |
| FollowList – Người theo dõi / Đang theo dõi | AU7 |
| Notifications – gộp "A và N người khác", lọc theo loại | NO1, NO2 |
| NotificationSettings – bật/tắt, phạm vi | NO4 |
| Search / SearchUsers / Hashtag | SE1, SE2, SE3 |
| Settings – danh sách chặn, xóa tài khoản | AU8, AU5 |
| Login / Register / VerifyEmail / ForgotPassword / ResetPassword | AU1, AU2, AU3 |
| Composer – 500 ký tự, tối đa 10 tệp, quyền xem và quyền trả lời | PO1 |
| EditProfile – tên 50, tiểu sử 150, đổi username 30 ngày/lần | AU4 |
| ReportDialog – lý do, "Khác" bắt buộc mô tả | PO6 |
| LikesDialog | PO4 |
| DeleteAccount – chờ 30 ngày, nhập mật khẩu | AU5 |
| MenuOther / MenuOwn / HideConfirm – ẩn bài (không hoàn tác), báo cáo, chặn; sửa trong 15 phút | FE3, PO1, AU8 |

Dữ liệu trong thiết kế là dữ liệu mẫu, khớp với seed của backend (minhanh.ng, thuha.le, kiet.dang…).
