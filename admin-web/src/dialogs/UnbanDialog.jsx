import { useState } from 'react'
import { adminApi } from '../api'
import { ErrorNote, Modal } from '../components/ui'
import { dateTime } from '../labels'

export default function UnbanDialog({ user, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const ban = user.active_ban

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(await adminApi.unban(user.id, { reason }))
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Mở khóa tài khoản @${user.username}`} subtitle={`${user.display_name} · ${user.email}`} onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Hủy</button>
        <button type="button" className="btn btn-primary" disabled={busy || !reason.trim()} onClick={submit}>Mở khóa</button>
      </>}>
      {ban && (
        <dl className="facts">
          <div><dt>Hình thức</dt><dd>{ban.type === 'PERMANENT' ? 'Vĩnh viễn' : 'Tạm thời'}</dd></div>
          <div><dt>Hết hạn</dt><dd>{ban.ends_at ? dateTime(ban.ends_at) : 'Không có'}</dd></div>
          <div className="span-2"><dt>Lý do khóa</dt><dd>{ban.reason}</dd></div>
        </dl>
      )}
      <div className="field">
        <label htmlFor="unban-reason">Lý do mở khóa (bắt buộc)</label>
        <textarea id="unban-reason" rows={3} maxLength={500} placeholder="Ví dụ: người dùng khiếu nại hợp lệ"
          value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <p className="note note-info">Tài khoản trở về trạng thái Hoạt động và nội dung hiển thị lại.</p>
      <ErrorNote error={error} />
    </Modal>
  )
}
