import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { adminApi } from '../api'
import { useAuth } from '../auth'
import { FlagIcon, ListIcon, LogoutIcon, PostIcon, UsersIcon } from './Icons'

const PendingContext = createContext(() => {})
/** Trang con gọi hàm này sau khi xử lý báo cáo để cập nhật số trên thanh bên. */
export const useRefreshPending = () => useContext(PendingContext)

export default function Layout() {
  const { me, signOut } = useAuth()
  const [pending, setPending] = useState(null)
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

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span className="brand-name">Bảng quản trị</span>
        </div>
        <nav aria-label="Điều hướng quản trị" className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className="nav-link">
              {l.icon}
              <span className="nav-label">{l.label}</span>
              {l.count ? <span className="nav-count">{l.count}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="account">
          <span className="account-avatar" aria-hidden="true">QT</span>
          <span className="account-name">
            <strong>{me?.username}</strong>
            <span>Quản trị viên</span>
          </span>
          <button type="button" className="icon-btn on-dark" aria-label="Đăng xuất" onClick={signOut}><LogoutIcon /></button>
        </div>
      </aside>
      <main className="main">
        <PendingContext.Provider value={refreshPending}>
          <Outlet />
        </PendingContext.Provider>
      </main>
    </div>
  )
}
