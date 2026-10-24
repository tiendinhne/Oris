import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Avatar from './Avatar'
import { Icon, Logo } from './Icons'

const items = [
  ['home', '/', 'home', 'Trang chủ'],
  ['search', '/search', 'search', 'Tìm kiếm'],
  ['notifications', '/notifications', 'bell', 'Thông báo'],
  ['profile', '/profile', 'user', 'Hồ sơ'],
  ['settings', '/settings', 'settings', 'Cài đặt'],
]

// Tìm kiếm, Thông báo, Cài đặt chưa có màn hình: route dự kiến tạm rơi về trang chủ.
export default function Nav({ active = 'home' }) {
  const { me, unread, signOut } = useAuth()
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
            {key === 'notifications' && unread > 0 && (
              <span className="badge" aria-label={`${unread} chưa đọc`}>{unread}</span>
            )}
          </Link>
        ))}
      </div>
      <Link to="/" className="btn btn-primary btn-lg"><Icon name="plus" size={20} strokeWidth={2} />Đăng bài</Link>
      <div className="nav-account">
        <Avatar name={me.display_name} size={36} />
        <span className="grow nav-account-name">
          <strong>{me.display_name}</strong>
          <span>@{me.username}</span>
        </span>
        <button type="button" className="icon-btn" aria-label="Đăng xuất" onClick={signOut}><Icon name="logout" /></button>
      </div>
    </nav>
  )
}
