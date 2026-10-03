import { useEffect, useState } from 'react'
import { adminApi } from '../api'
import { ErrorNote, Modal } from '../components/ui'
import { REASONS, dateTime } from '../labels'

export default function DeletePostDialog({ post, onClose, onDone }) {
  const [reason, setReason] = useState('SPAM')
  const [violations, setViolations] = useState(null)
  const [authorBanned, setAuthorBanned] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminApi.user(post.author.id).then((u) => { setViolations(u.violations_90d); setAuthorBanned(u.status === 'BANNED') }).catch(() => {})
  }, [post.author.id])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(await adminApi.deletePost(post.id, reason))
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  const willBan = violations !== null && violations + 1 >= 3 && !authorBanned
  return (
    <Modal title="Xóa bài viết vi phạm" onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Hủy</button>
        <button type="button" className="btn btn-danger" disabled={busy} onClick={submit}>Xóa bài viết</button>
      </>}>
      <div className="quote">
        <p className="muted small">@{post.author.username} · {post.type === 'REPLY' ? 'Trả lời' : 'Bài viết'} · {dateTime(post.created_at)}
          {post.pending_reports ? ` · ${post.pending_reports} báo cáo` : ''}</p>
        <p>{post.content || <em>(Chỉ có media)</em>}</p>
      </div>
      <div className="field">
        <label htmlFor="del-reason">Lý do xóa (bắt buộc)</label>
        <select id="del-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <p className="note note-danger">
        Bài sẽ bị xóa với mọi người, kể cả tác giả, và không khôi phục được. Tác giả nhận thông báo kèm lý do và bị tính 1 lần vi phạm
        {violations !== null && ` (hiện có ${violations} lần trong 90 ngày${willBan ? ', lần này sẽ tự khóa 7 ngày' : ''})`}.
      </p>
      <ErrorNote error={error} />
    </Modal>
  )
}
