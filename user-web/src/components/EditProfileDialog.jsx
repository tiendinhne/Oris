import { useEffect, useState } from 'react'
import { userApi, fieldErrors } from '../api'
import { useAuth } from '../auth'

const FIELDS = ['display_name', 'username', 'bio', 'link_url']

export default function EditProfileDialog({ profile, onClose, onSaved }) {
  const { reloadMe } = useAuth()
  const [form, setForm] = useState({
    display_name: profile.display_name ?? '',
    username: profile.username ?? '',
    bio: profile.bio ?? '',
    link_url: profile.link_url ?? '',
  })
  const [fields, setFields] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e) {
    e.preventDefault()
    // Chỉ gửi trường đã đổi; chuỗi rỗng nghĩa là xóa trường đó
    const diff = {}
    for (const key of FIELDS) {
      const value = form[key].trim()
      if (value !== (profile[key] ?? '')) diff[key] = value
    }
    if (!Object.keys(diff).length) return onClose()

    setBusy(true)
    setFields({})
    setError('')
    try {
      const saved = await userApi.update(diff)
      await reloadMe()
      onSaved(saved)
    } catch (err) {
      if (err.code === 'USERNAME_COOLDOWN') {
        const at = new Date(err.detail.available_at)
        const when = isNaN(at) ? '' : ` Đổi lại được từ ${at.toLocaleDateString('vi-VN')}`
        setFields({ username: `Chỉ được đổi tên người dùng 30 ngày một lần.${when}` })
      } else {
        const byField = fieldErrors(err)
        if (FIELDS.some((k) => byField[k])) setFields(byField)
        else setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const nameEmpty = !form.display_name.trim()

  return (
    <div className="dialog-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div className="dialog-head">
          <h2 id="edit-title">Chỉnh sửa hồ sơ</h2>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <div className="field-row">
              <label htmlFor="display-name">Tên hiển thị</label>
              <span className="hint">{form.display_name.length}/50</span>
            </div>
            <input id="display-name" maxLength={50} value={form.display_name} autoFocus
              onChange={(e) => set('display_name', e.target.value)} aria-invalid={!!fields.display_name} />
            {fields.display_name && <span className="hint bad">{fields.display_name}</span>}
          </div>
          <div className="field">
            <label htmlFor="username">Username</label>
            <div className={'input-prefix' + (fields.username ? ' invalid' : '')}>
              <span aria-hidden="true">@</span>
              <input id="username" value={form.username} autoComplete="off" aria-describedby="username-note"
                onChange={(e) => set('username', e.target.value.toLowerCase())} />
            </div>
            <span id="username-note" className={'hint' + (fields.username ? ' bad' : '')}>
              {fields.username || 'Đổi được 1 lần mỗi 30 ngày. Username cũ sẽ được người khác dùng được ngay.'}
            </span>
          </div>
          <div className="field">
            <div className="field-row">
              <label htmlFor="bio">Tiểu sử</label>
              <span className="hint">{form.bio.length}/150</span>
            </div>
            <textarea id="bio" rows={3} maxLength={150} value={form.bio}
              onChange={(e) => set('bio', e.target.value)} aria-invalid={!!fields.bio} />
            {fields.bio && <span className="hint bad">{fields.bio}</span>}
          </div>
          <div className="field">
            <label htmlFor="link">Liên kết <span className="muted">(không bắt buộc)</span></label>
            <input id="link" type="url" placeholder="https://" value={form.link_url}
              onChange={(e) => set('link_url', e.target.value)} aria-invalid={!!fields.link_url} />
            {fields.link_url && <span className="hint bad">{fields.link_url}</span>}
          </div>
          {error && <p role="alert" className="alert-error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={busy || nameEmpty}>
              {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
