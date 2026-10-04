import { useCallback, useState } from 'react'
import { adminApi } from '../api'
import { useRefreshPending } from '../components/Layout'
import { ErrorNote, Modal, SearchBox, Segmented, Stat, Toast } from '../components/ui'
import useCursorList from '../components/useCursorList'
import DeletePostDialog from '../dialogs/DeletePostDialog'
import { dateTime } from '../labels'

const mediaText = ({ images, videos }) =>
  [images && `${images} ảnh`, videos && `${videos} video`].filter(Boolean).join(', ')

export default function Posts() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [days, setDays] = useState('')
  const [reportedOnly, setReportedOnly] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast] = useState('')
  const refreshPending = useRefreshPending()
  const clearToast = useCallback(() => setToast(''), [])
  const list = useCursorList(
    (cursor) => adminApi.posts({ q: search, type, days, reported_only: reportedOnly, cursor }),
    [search, type, days, reportedOnly],
  )

  const onDeleted = (res) => {
    list.removeItem(res.post_id)
    setDeleting(null)
    refreshPending()
    setToast(res.author_auto_banned
      ? 'Đã xóa bài viết. Tác giả đủ 3 lần vi phạm nên đã bị khóa 7 ngày.'
      : 'Đã xóa bài viết.')
  }

  return (
    <>
      <header className="page-head">
        <h1>Quản lý bài viết</h1>
        <p className="muted">Tìm bài viết, trả lời và xóa nội dung vi phạm.</p>
      </header>

      <div className="stats">
        <Stat label="Đang hiển thị" value={list.items.length} />
        <Stat label="Có báo cáo chờ" value={list.items.filter((x) => x.pending_reports > 0).length} tone="warn" />
        <Stat label="Riêng tư" value={list.items.filter((x) => x.visibility === 'PRIVATE').length} />
      </div>

      <div className="toolbar">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()) }}>
          <SearchBox id="p-search" placeholder="Nội dung hoặc @tác_giả, nhấn Enter"
            value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setSearch('') }} />
        </form>
        <Segmented label="Loại nội dung" value={type} onChange={setType}
          options={[{ value: '', label: 'Tất cả' }, { value: 'POST', label: 'Bài viết' }, { value: 'REPLY', label: 'Trả lời' }]} />
        <Segmented label="Thời gian" value={days} onChange={setDays}
          options={[{ value: '', label: 'Mọi lúc' }, { value: '1', label: '24 giờ' }, { value: '7', label: '7 ngày' }, { value: '30', label: '30 ngày' }]} />
        <label className="check">
          <input type="checkbox" checked={reportedOnly} onChange={(e) => setReportedOnly(e.target.checked)} />
          Chỉ có báo cáo
        </label>
      </div>

      <ErrorNote error={list.error} />
      <div className="table-card">
        <table>
          <thead>
            <tr><th>Nội dung</th><th>Tác giả</th><th>Loại</th><th>Quyền</th><th className="num">Báo cáo</th><th>Ngày đăng</th><th className="right">Thao tác</th></tr>
          </thead>
          <tbody>
            {list.items.map((p) => (
              <tr key={p.id}>
                <td className="content-cell">
                  <span className="clamp">{p.content || <em className="muted">(Chỉ có media)</em>}</span>
                  {mediaText(p.media) && <span className="muted small block">{mediaText(p.media)}</span>}
                </td>
                <td>@{p.author.username || 'không rõ'}</td>
                <td>{p.type === 'REPLY' ? 'Trả lời' : 'Bài viết'}</td>
                <td>{p.visibility === 'PRIVATE' ? 'Riêng tư' : 'Công khai'}</td>
                <td className="num"><span className={`count ${p.pending_reports >= 5 ? 'count-high' : p.pending_reports ? 'count-some' : ''}`}>{p.pending_reports}</span></td>
                <td className="nowrap">{dateTime(p.created_at)}</td>
                <td className="right nowrap">
                  <button type="button" className="btn btn-sm" onClick={() => setViewing(p)}>Xem</button>{' '}
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleting(p)}>Xóa</button>
                </td>
              </tr>
            ))}
            {!list.loading && list.items.length === 0 && (
              <tr><td colSpan={7} className="empty">Không có bài viết nào khớp bộ lọc.</td></tr>
            )}
          </tbody>
        </table>
        <div className="table-foot">
          <span>Nội dung đã xóa không thể khôi phục</span>
          {list.hasMore && <button type="button" className="btn" disabled={list.loading} onClick={list.loadMore}>Xem thêm</button>}
        </div>
      </div>

      {viewing && (
        <Modal title={viewing.type === 'REPLY' ? 'Trả lời' : 'Bài viết'} subtitle={`@${viewing.author.username} · ${dateTime(viewing.created_at)}`}
          onClose={() => setViewing(null)}
          footer={<button type="button" className="btn btn-danger" onClick={() => { setDeleting(viewing); setViewing(null) }}>Xóa bài viết</button>}>
          <p className="post-body">{viewing.content || <em className="muted">(Chỉ có media)</em>}</p>
          <p className="muted small">{[viewing.visibility === 'PRIVATE' ? 'Riêng tư' : 'Công khai', mediaText(viewing.media), `${viewing.pending_reports} báo cáo đang chờ`].filter(Boolean).join(' · ')}</p>
        </Modal>
      )}
      {deleting && <DeletePostDialog post={deleting} onClose={() => setDeleting(null)} onDone={onDeleted} />}
      <Toast message={toast} onDone={clearToast} />
    </>
  )
}
