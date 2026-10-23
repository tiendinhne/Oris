import { useCallback, useState } from 'react'
import { adminApi } from '../api'
import { Avatar, Badge, ErrorNote, SearchBox, Segmented, Stat, Toast } from '../components/ui'
import useCursorList from '../components/useCursorList'
import BanDialog from '../dialogs/BanDialog'
import UnbanDialog from '../dialogs/UnbanDialog'
import { USER_STATUS, dateOnly, dateTime } from '../labels'

export default function Users() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [dialog, setDialog] = useState(null) // { kind: 'ban' | 'unban', user }
  const [toast, setToast] = useState('')
  const list = useCursorList((cursor) => adminApi.users({ q: search, status, cursor }), [search, status])
  const clearToast = useCallback(() => setToast(''), [])

  const count = (st) => list.items.filter((u) => u.status === st).length

  const done = (updated, message) => {
    list.replaceItem(updated)
    setDialog(null)
    setToast(message)
  }

  return (
    <>
      <header className="page-head">
        <h1>Quản lý người dùng</h1>
        <p className="muted">Xem, tìm kiếm và khóa hoặc mở khóa tài khoản.</p>
      </header>

      <div className="stats">
        <Stat label="Đang hiển thị" value={list.items.length} />
        <Stat label="Hoạt động" value={count('ACTIVE')} tone="ok" />
        <Stat label="Bị khóa" value={count('BANNED')} tone="danger" />
        <Stat label="Chưa xác minh" value={count('UNVERIFIED')} tone="warn" />
      </div>

      <div className="toolbar">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()) }}>
          <SearchBox id="u-search" placeholder="Tìm email hoặc username, nhấn Enter"
            value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setSearch('') }} />
        </form>
        <Segmented label="Lọc theo trạng thái" value={status} onChange={setStatus}
          options={[{ value: '', label: 'Tất cả' }, ...Object.entries(USER_STATUS).map(([k, v]) => ({ value: k, label: v.label }))]} />
      </div>

      <ErrorNote error={list.error} />
      <div className="table-card">
        <table>
          <thead>
            <tr><th>Người dùng</th><th>Email</th><th>Trạng thái</th><th className="num">Vi phạm (90 ngày)</th><th>Ngày tạo</th><th className="right">Thao tác</th></tr>
          </thead>
          <tbody>
            {list.items.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="person"><Avatar name={u.display_name} />
                    <span><strong>{u.display_name}</strong><span className="muted small">@{u.username}</span></span>
                  </div>
                </td>
                <td>{u.email}</td>
                <td>
                  <Badge tone={USER_STATUS[u.status]?.tone}>{USER_STATUS[u.status]?.label || u.status}</Badge>
                  {u.active_ban && <span className="muted small block">{u.active_ban.ends_at ? `đến ${dateTime(u.active_ban.ends_at)}` : 'vĩnh viễn'}</span>}
                </td>
                <td className="num">{u.violations_90d}</td>
                <td>{dateOnly(u.created_at)}</td>
                <td className="right">
                  {u.role === 'ADMIN' ? <span className="muted small">Quản trị viên</span>
                    : u.status === 'BANNED'
                      ? <button type="button" className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: 'unban', user: u })}>Mở khóa</button>
                      : <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDialog({ kind: 'ban', user: u })}>Khóa</button>}
                </td>
              </tr>
            ))}
            {!list.loading && list.items.length === 0 && (
              <tr><td colSpan={6} className="empty">Không có tài khoản nào khớp bộ lọc. Thử bỏ bớt điều kiện tìm kiếm.</td></tr>
            )}
          </tbody>
        </table>
        <div className="table-foot">
          <span>{list.loading ? 'Đang tải…' : `Đang hiển thị ${list.items.length} tài khoản`}</span>
          {list.hasMore && <button type="button" className="btn" disabled={list.loading} onClick={list.loadMore}>Xem thêm</button>}
        </div>
      </div>

      {dialog?.kind === 'ban' && <BanDialog user={dialog.user} onClose={() => setDialog(null)}
        onDone={(u) => done(u, `Đã khóa tài khoản @${u.username}`)} />}
      {dialog?.kind === 'unban' && <UnbanDialog user={dialog.user} onClose={() => setDialog(null)}
        onDone={(u) => done(u, `Đã mở khóa tài khoản @${u.username}`)} />}
      <Toast message={toast} onDone={clearToast} />
    </>
  )
}
