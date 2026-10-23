import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { adminApi } from '../api'
import { useAuth } from '../auth'
import { FlagIcon, ListIcon, LogoutIcon, MoonIcon, PostIcon, SunIcon, UsersIcon } from './Icons'

const PendingContext = createContext(() => {})
/** Trang con gọi hàm này sau khi xử lý báo cáo để cập nhật số trên thanh bên. */
export const useRefreshPending = () => useContext(PendingContext)

/** Giao diện sáng/tối: nhớ lựa chọn, mặc định theo hệ điều hành (index.html đặt sẵn để khỏi nháy màu). */
function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('theme', next) } catch { /* bỏ qua khi bị chặn lưu trữ */ }
    setTheme(next)
  }
  return [theme, toggle]
}

export default function Layout() {
  const { me, signOut } = useAuth()
  const [pending, setPending] = useState(null)
  const [theme, toggleTheme] = useTheme()
  const location = useLocation()

  const refreshPending = useCallback(() => {
    adminApi.reports({ status: 'PENDING' })
      .then((d) => setPending(d.next_offset ? `${d.items.length}+` : d.items.length))
      .catch(() => setPending(null))
  }, [])
  useEffect(refreshPending, [refreshPending, location.pathname])

  const links = [
    { to: '/users', label: 'Người dùng', icon: <UsersIcon /> },
    { to: '/posts', label: 'Bài viết', icon: <PostIcon /> },
    { to: '/reports', label: 'Báo cáo vi phạm', icon: <FlagIcon />, count: pending },
    { to: '/audit-logs', label: 'Nhật ký thao tác', icon: <ListIcon /> },
  ]
  const current = links.find((l) => location.pathname.startsWith(l.to))

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">O</span>
          <span className="brand-name">Oris <span>Admin</span></span>
        </div>
        <nav aria-label="Điều hướng quản trị" className="nav">
          <span className="nav-heading">Quản trị</span>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className="nav-link">
              {l.icon}
              <span className="nav-label">{l.label}</span>
              {l.count ? <span className="nav-count">{l.count}</span> : null}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="content">
        <div className="topbar">
          <span className="crumb">Oris <span aria-hidden="true">/</span> <strong>{current?.label}</strong></span>
          <div className="topbar-right">
            <button type="button" className="icon-btn" aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} onClick={toggleTheme}>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <span className="account">
              <span className="account-avatar" aria-hidden="true">{(me?.username || '?').slice(0, 2).toUpperCase()}</span>
              <span className="account-name">
                <strong>{me?.username}</strong>
                <span>Quản trị viên</span>
              </span>
            </span>
            <button type="button" className="icon-btn" aria-label="Đăng xuất" onClick={signOut}><LogoutIcon /></button>
          </div>
        </div>
        <main className="main">
          <PendingContext.Provider value={refreshPending}>
            <Outlet />
          </PendingContext.Provider>
        </main>
      </div>
    </div>
  )
}
