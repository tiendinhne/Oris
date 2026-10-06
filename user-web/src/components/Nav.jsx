import { Link } from 'react-router-dom'
import { me } from '../data'
import Avatar from './Avatar'
import { Icon, Logo } from './Icons'

const items = [
  ['home', '/', 'home', 'Trang chủ'],
  ['search', '/search', 'search', 'Tìm kiếm'],
  ['notifications', '/notifications', 'bell', 'Thông báo'],
  ['profile', '/profile', 'user', 'Hồ sơ'],
  ['settings', '/settings', 'settings', 'Cài đặt'],
]

// Chế độ thành viên. Mục chưa có màn hình trỏ về route dự kiến (tạm rơi về trang chủ).
export default function Nav({ active = 'home' }) {
  return (
    <nav className="nav" aria-label="Điều hướng chính">
      <Link to="/" className="nav-logo" aria-label="Oris, về trang chủ">
        <Logo />
        <span>oris</span>
      </Link>
      <div className="nav-items">
        {items.map(([key, to, icon, label]) => (
          <Link key={key} to={to} className="nav-item" aria-current={active === key ? 'page' : undefined}>
            <Icon name={icon} size={22} />
            <span className="grow">{label}</span>
            {key === 'notifications' && me.unread > 0 && (
              <span className="badge" aria-label={`${me.unread} chưa đọc`}>{me.unread}</span>
            )}
          </Link>
        ))}
      </div>
      <Link to="/" className="btn btn-primary btn-lg"><Icon name="plus" size={20} strokeWidth={2} />Đăng bài</Link>
      <div className="nav-account">
        <Avatar name={me.name} size={36} />
        <span className="grow nav-account-name">
          <strong>{me.name}</strong>
          <span>@{me.user}</span>
        </span>
        <Link to="/login" className="icon-btn" aria-label="Đăng xuất"><Icon name="logout" /></Link>
      </div>
    </nav>
  )
}
