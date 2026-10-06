// Dữ liệu mẫu khớp thiết kế/seed backend. Thay bằng API khi backend có phía người dùng.
export const me = { name: 'Nguyễn Minh Anh', user: 'minhanh.ng', unread: 3 }

export const trending = [
  ['caphe', 214], ['saigonmua', 187], ['docsach', 142],
  ['chaybobuoisang', 118], ['nauanmoingay', 96], ['nhiepanhphim', 74],
]

export const posts = [
  { id: 1, name: 'Lê Thu Hà', user: 'thuha.le', time: '12 phút', tone: 1, liked: true,
    text: 'Sáng nay ghé quán mới mở ở Quận 3, cà phê muối đậm vị, chỗ ngồi yên tĩnh. Ai cần chỗ làm việc cuối tuần thì ghé thử nhé.',
    tag: 'caphe', likes: 48, replies: 9, reposts: 3, images: 2 },
  { id: 2, name: 'Bùi Đức Thịnh', user: 'thinh.bd', time: '35 phút', tone: 2,
    text: 'Tháng này mình muốn đọc thêm sách phi hư cấu. Mọi người gợi ý giúp vài cuốn đọc cuối tuần với.',
    tag: 'docsach', likes: 21, replies: 30, reposts: 1 },
  { id: 3, repostedBy: 'Hoàng Mai', name: 'Võ Ngọc Lan', user: 'lan.vo', time: '1 giờ', tone: 0,
    text: 'Mưa chiều Sài Gòn, kẹt xe nhưng trời đẹp.', tag: 'saigonmua',
    likes: 312, replies: 18, reposts: 27, video: true, duration: '0:42' },
  { id: 4, name: 'Hoàng Mai', user: 'maihoang_', time: '2 giờ', tone: 3, edited: true,
    text: 'Lịch chạy bộ tuần này: thứ Ba, thứ Năm và sáng Chủ nhật ở công viên Gia Định. Ai muốn chạy chung thì trả lời ở đây.',
    tag: 'chaybobuoisang', likes: 64, replies: 12, reposts: 5 },
  { id: 5, name: 'Đặng Tuấn Kiệt', user: 'kiet.dang', time: '3 giờ', tone: 2, repliesOff: true,
    text: 'Vài tấm phim chụp ở Đà Lạt tuần trước. Tắt trả lời vì chỉ muốn lưu lại.',
    tag: 'nhiepanhphim', likes: 37, replies: 0, reposts: 2, images: 1 },
]

// Trả lời của bài số 1; children = trả lời cấp 2 (deleted: nội dung đã xóa)
export const replies = [
  { name: 'Lê Thu Hà', user: 'thuha.le', tone: 1, time: '8 phút', isAuthor: true, likes: 12,
    text: 'Quán ở đường Võ Văn Tần nha mọi người, mở cửa từ 7 giờ sáng.',
    moreChildren: 3,
    children: [
      { name: 'Bùi Đức Thịnh', tone: 2, time: '6 phút', text: 'Có chỗ cắm sạc laptop không chị?' },
      { deleted: true },
      { name: 'Lê Thu Hà', tone: 1, time: '4 phút', text: 'Có nha, bàn dài sát cửa sổ đều có ổ cắm.' },
    ] },
  { name: 'Hoàng Mai', user: 'maihoang_', tone: 3, time: '10 phút', likes: 3,
    text: 'Cà phê muối ở đây mặn nhẹ hay đậm vậy? Mình không hợp vị mặn lắm.' },
  { name: 'Phạm Gia Huy', user: 'giahuy', tone: 2, time: '11 phút', likes: 1,
    text: 'Lưu lại, cuối tuần đi thử.' },
]
