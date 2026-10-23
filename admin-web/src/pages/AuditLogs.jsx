import { useState } from 'react'
import { adminApi } from '../api'
import { Badge, ErrorNote, Segmented } from '../components/ui'
import useCursorList from '../components/useCursorList'
import { AUDIT_ACTIONS, dateTime } from '../labels'

const TARGET = { USER: 'Tài khoản', POST: 'Bài viết', REPORT_CASE: 'Nhóm báo cáo' }

export default function AuditLogs() {
  const [action, setAction] = useState('')
  const [days, setDays] = useState('7')
  const list = useCursorList((cursor) => adminApi.auditLogs({ action, days, cursor }), [action, days])

  return (
    <>
      <header className="page-head">
        <h1>Nhật ký thao tác</h1>
        <p className="muted">Ghi lại mọi thao tác của quản trị viên. Chỉ xem, không thể sửa hoặc xóa.</p>
      </header>
      <div className="toolbar">
        <div className="field">
          <label htmlFor="a-action">Hành động</label>
          <select id="a-action" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(AUDIT_ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <Segmented label="Thời gian" value={days} onChange={setDays}
          options={[{ value: '7', label: '7 ngày' }, { value: '30', label: '30 ngày' }, { value: '', label: 'Tất cả' }]} />
      </div>
      <ErrorNote error={list.error} />
      <div className="table-card">
        <table>
          <thead><tr><th>Thời điểm</th><th>Quản trị viên</th><th>Hành động</th><th>Đối tượng</th><th>Lý do</th></tr></thead>
          <tbody>
            {list.items.map((l) => (
              <tr key={l.id}>
                <td className="nowrap">{dateTime(l.created_at)}</td>
                <td>@{l.admin_username}</td>
                <td>
                  <Badge tone={AUDIT_ACTIONS[l.action]?.tone}>{AUDIT_ACTIONS[l.action]?.label}</Badge>
                  <code className="code-hint">{l.action}</code>
                </td>
                <td>{l.target_label || `${TARGET[l.target_type]} ${l.target_id.slice(0, 8)}`}</td>
                <td className="reason-cell">{l.reason}</td>
              </tr>
            ))}
            {!list.loading && list.items.length === 0 && <tr><td colSpan={5} className="empty">Chưa có thao tác nào trong khoảng thời gian này.</td></tr>}
          </tbody>
        </table>
        {list.hasMore && <div className="table-foot right"><button type="button" className="btn" disabled={list.loading} onClick={list.loadMore}>Xem thêm</button></div>}
      </div>
    </>
  )
}
