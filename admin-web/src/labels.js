// Nhãn tiếng Việt cho các enum của backend. Tông màu (tone) quyết định màu của nhãn.
export const USER_STATUS = {
  ACTIVE: { label: 'Hoạt động', tone: 'ok' },
  BANNED: { label: 'Bị khóa', tone: 'danger' },
  DEACTIVATED: { label: 'Chờ xóa', tone: 'muted' },
  UNVERIFIED: { label: 'Chưa xác minh', tone: 'warn' },
}

export const REASONS = {
  SPAM: 'Spam', HARASSMENT: 'Quấy rối', HATE: 'Thù ghét',
  VIOLENCE: 'Bạo lực', SENSITIVE: 'Nội dung nhạy cảm', OTHER: 'Khác',
}

export const CASE_STATUS = {
  PENDING: 'Chờ xử lý', APPROVED: 'Đã duyệt', DISMISSED: 'Đã bỏ qua', CLOSED: 'Đã đóng',
}

export const AUDIT_ACTIONS = {
  BAN_USER: { label: 'Khóa tài khoản', tone: 'danger' },
  UNBAN_USER: { label: 'Mở khóa tài khoản', tone: 'ok' },
  DELETE_POST: { label: 'Xóa bài viết', tone: 'danger' },
  APPROVE_REPORT: { label: 'Duyệt báo cáo', tone: 'warn' },
  DISMISS_REPORT: { label: 'Bỏ qua báo cáo', tone: 'muted' },
}

const fmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})
const fmtDate = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
})
export const dateTime = (iso) => {
  if (!iso) return ''
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` // dd/mm/yyyy hh:mm, giờ Việt Nam
}
export const dateOnly = (iso) => (iso ? fmtDate.format(new Date(iso)) : '')

