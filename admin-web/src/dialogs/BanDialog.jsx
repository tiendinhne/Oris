import { useState } from 'react'
import { adminApi } from '../api'
import { ErrorNote, Modal } from '../components/ui'

const DURATIONS = [1, 3, 7, 30] // BR-AD1-03

export default function BanDialog({ user, onClose, onDone }) {
  const [type, setType] = useState('TEMPORARY')
  const [days, setDays] = useState(7)
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const body = type === 'TEMPORARY' ? { type, duration_days: days, reason } : { type, reason }
      onDone(await adminApi.ban(user.id, body))
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Khóa tài khoản @${user.username}`} subtitle={`${user.display_name} · ${user.email}`} onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Hủy</button>
        <button type="button" className="btn btn-danger" disabled={busy || !reason.trim()} onClick={submit}>Khóa tài khoản</button>
      </>}>
      <fieldset className="choice-group">
        <legend>Hình thức khóa</legend>
        <label className={`choice ${type === 'TEMPORARY' ? 'is-on' : ''}`}>
          <input type="radio" name="ban-type" checked={type === 'TEMPORARY'} onChange={() => setType('TEMPORARY')} />
          <span className="choice-text"><strong>Tạm thời</strong><span>Tự động mở khóa khi hết hạn</span></span>
          <select aria-label="Thời hạn khóa" value={days} disabled={type !== 'TEMPORARY'} onChange={(e) => setDays(Number(e.target.value))}>
            {DURATIONS.map((d) => <option key={d} value={d}>{d} ngày</option>)}
          </select>
        </label>
        <label className={`choice ${type === 'PERMANENT' ? 'is-on' : ''}`}>
          <input type="radio" name="ban-type" checked={type === 'PERMANENT'} onChange={() => setType('PERMANENT')} />
          <span className="choice-text"><strong>Vĩnh viễn</strong><span>Chỉ mở lại khi quản trị viên mở khóa thủ công</span></span>
        </label>
      </fieldset>
      <div className="field">
        <label htmlFor="ban-reason">Lý do (bắt buộc)</label>
        <textarea id="ban-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <p className="note note-warn">Người dùng sẽ bị đăng xuất khỏi mọi thiết bị, nội dung bị ẩn trong thời gian khóa và nhận email thông báo lý do, thời hạn.</p>
      <ErrorNote error={error} />
    </Modal>
  )
}
