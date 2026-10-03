import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../api'
import { useRefreshPending } from '../components/Layout'
import { Avatar, ErrorNote, Toast } from '../components/ui'
import { CASE_STATUS, REASONS, dateTime } from '../labels'

const TABS = ['PENDING', 'APPROVED', 'DISMISSED']

export default function Reports() {
  const [status, setStatus] = useState('PENDING')
  const [cases, setCases] = useState([])
  const [nextOffset, setNextOffset] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [reason, setReason] = useState('SPAM')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState('')
  const refreshPending = useRefreshPending()
  const clearToast = useCallback(() => setToast(''), [])

  const loadCases = useCallback(async (offset = 0) => {
    setError(null)
    try {
      const d = await adminApi.reports({ status, offset })
      setCases((prev) => (offset ? [...prev, ...d.items] : d.items))
      setNextOffset(d.next_offset)
      if (!offset) setSelectedId(d.items[0]?.id ?? null)
    } catch (e) {
      setError(e)
    }
  }, [status])
  useEffect(() => { loadCases(0) }, [loadCases])

  useEffect(() => {
    setDetail(null)
    if (!selectedId) return
    adminApi.report(selectedId).then((d) => { setDetail(d); setReason(d.top_reason) }).catch(setError)
  }, [selectedId])

  const act = async (kind) => {
    setBusy(true)
    setError(null)
    try {
      if (kind === 'approve') {
        const res = await adminApi.approve(detail.id, reason)
        setToast(res.author_auto_banned
          ? 'Đã duyệt và xóa nội dung. Tác giả đủ 3 lần vi phạm nên đã bị khóa 7 ngày.'
          : 'Đã duyệt và xóa nội dung.')
      } else {
        await adminApi.dismiss(detail.id)
        setToast('Đã bỏ qua báo cáo. Nội dung được giữ nguyên.')
      }
      refreshPending()
      await loadCases(0)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const total = detail?.report_count || 1
  return (
    <>
      <header className="page-head">
        <h1>Báo cáo vi phạm</h1>
        <p className="muted">Báo cáo được gom theo nội dung. Duyệt sẽ xóa nội dung và tính một lần vi phạm cho tác giả.</p>
      </header>

      <div className="tabs" role="group" aria-label="Lọc theo trạng thái">
        {TABS.map((t) => (
          <button key={t} type="button" aria-pressed={status === t} className={`tab ${status === t ? 'is-on' : ''}`} onClick={() => setStatus(t)}>
            {CASE_STATUS[t]}
          </button>
        ))}
      </div>
      <ErrorNote error={error} />

      <div className="split">
        <div className="case-list">
          {cases.map((c) => (
            <button key={c.id} type="button" className={`case ${c.id === selectedId ? 'is-on' : ''}`} onClick={() => setSelectedId(c.id)}>
              <span className="case-top">
                <span className="muted small">@{c.post.author.username} · {c.post.type === 'REPLY' ? 'Trả lời' : 'Bài viết'}</span>
                <span className="count count-high">{c.report_count} báo cáo</span>
              </span>
              <span className="clamp">{c.post.content || '(Chỉ có media)'}</span>
              <span className="muted small">Lý do chính: {REASONS[c.top_reason]} · báo cáo đầu {dateTime(c.first_reported_at)}</span>
            </button>
          ))}
          {cases.length === 0 && <p className="empty-box">{status === 'PENDING' ? 'Không còn báo cáo nào chờ xử lý.' : 'Chưa có báo cáo nào ở mục này.'}</p>}
          {nextOffset !== null && <button type="button" className="btn" onClick={() => loadCases(nextOffset)}>Xem thêm</button>}
        </div>

        {detail && (
          <section className="panel" aria-label="Chi tiết báo cáo">
            <div className="panel-block">
              <h2 className="panel-label">Nội dung bị báo cáo</h2>
              <div className="quote person-quote">
                <Avatar name={detail.post.author.display_name} />
                <div>
                  <p><strong>{detail.post.author.display_name}</strong> <span className="muted">@{detail.post.author.username} · {dateTime(detail.post.created_at)} · {detail.post.visibility === 'PRIVATE' ? 'Riêng tư' : 'Công khai'}</span></p>
                  <p className="post-body">{detail.post.content || '(Chỉ có media)'}</p>
                </div>
              </div>
            </div>
            <div className="two-col">
              <div className="panel-block">
                <h2 className="panel-label">Lý do được báo cáo</h2>
                {detail.reasons.map((r) => (
                  <div key={r.reason} className="bar-row">
                    <span className="bar-head"><span>{REASONS[r.reason]}</span><span className="num">{r.count}</span></span>
                    <span className="bar"><span style={{ width: `${(r.count / total) * 100}%` }} /></span>
                  </div>
                ))}
                {detail.other_descriptions.length > 0 && (
                  <ul className="other-list">{[...new Set(detail.other_descriptions)].map((d) => <li key={d}>“{d}”</li>)}</ul>
                )}
              </div>
              <div className="panel-block">
                <h2 className="panel-label">Lịch sử tác giả</h2>
                <div className={`note ${detail.author_violations_90d >= 2 ? 'note-danger' : 'note-info'}`}>
                  <strong>{detail.author_violations_90d ?? 0} lần vi phạm trong 90 ngày</strong>
                  {detail.post.author.status === 'BANNED' && <span className="block">Tài khoản đang bị khóa.</span>}
                  {status === 'PENDING' && detail.author_violations_90d >= 2 && detail.post.author.status !== 'BANNED' &&
                    <span className="block">Duyệt báo cáo này sẽ là lần thứ {detail.author_violations_90d + 1}, tài khoản sẽ tự động bị khóa 7 ngày.</span>}
                </div>
              </div>
            </div>
            {status === 'PENDING' ? (
              <>
                <div className="field narrow">
                  <label htmlFor="r-reason">Lý do xóa (bắt buộc khi duyệt)</label>
                  <select id="r-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                    {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="actions">
                  <button type="button" className="btn" disabled={busy} onClick={() => act('dismiss')}>Bỏ qua</button>
                  <button type="button" className="btn btn-danger" disabled={busy} onClick={() => act('approve')}>Duyệt và xóa nội dung</button>
                </div>
              </>
            ) : (
              <p className="muted">{CASE_STATUS[detail.status]} lúc {dateTime(detail.resolved_at)}</p>
            )}
          </section>
        )}
      </div>
      <Toast message={toast} onDone={clearToast} />
    </>
  )
}
