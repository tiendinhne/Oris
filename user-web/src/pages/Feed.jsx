import { useCallback, useEffect, useState } from 'react'
import Avatar from '../components/Avatar'
import Post from '../components/Post'
import Shell from '../components/Shell'
import { feedApi, postApi } from '../api'
import { useAuth } from '../auth'

export default function Feed() {
  const { me } = useAuth()
  const [tab, setTab] = useState('following')
  const [items, setItems] = useState([])
  const [next, setNext] = useState(null) // { cursor } hoặc { offset }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  const load = useCallback(async (more) => {
    setLoading(true)
    setError('')
    try {
      const data = tab === 'following' ? await feedApi.following(more) : await feedApi.explore(more)
      setItems((old) => (more ? [...old, ...data.items] : data.items))
      setNext(data.next_cursor ? { cursor: data.next_cursor } : data.next_offset ? { offset: data.next_offset } : null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { setItems([]); load() }, [load])

  async function publish(e) {
    e.preventDefault()
    setPosting(true)
    try {
      const created = await postApi.create({ content: text })
      setText('')
      // Bảng tin dựng bất đồng bộ nên chèn thẳng bài mới lên đầu cho thấy ngay
      if (tab === 'following') setItems((old) => [{ post: created, reposted_by: null }, ...old])
    } catch (err) {
      setError(err.message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <Shell active="home">
      <h1 className="sr-only">Bảng tin</h1>
      <nav className="tabs" aria-label="Chọn bảng tin">
        {[['following', 'Theo dõi'], ['explore', 'Khám phá']].map(([key, label]) => (
          <a key={key} href="#" aria-current={tab === key ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); setTab(key) }}>{label}</a>
        ))}
      </nav>
      <form className="card reply-form" onSubmit={publish}>
        <Avatar name={me.display_name} size={36} />
        <div className="col grow">
          <label htmlFor="compose" className="sr-only">Nội dung bài viết</label>
          <textarea id="compose" rows={2} maxLength={500} placeholder={`Có gì mới, ${me.display_name}?`}
            value={text} onChange={(e) => setText(e.target.value)} />
          <div className="reply-form-foot">
            <span className="muted small">{text.length}/500</span>
            <button type="submit" className="btn btn-primary" disabled={!text.trim() || posting}>Đăng</button>
          </div>
        </div>
      </form>
      {error && <p role="alert" className="alert-error">{error}</p>}
      {items.map((it) => <Post key={it.post.id} post={it.post} />)}
      {!loading && !error && items.length === 0 && (
        <p className="muted small center">
          {tab === 'following' ? 'Chưa có bài nào. Hãy đăng bài đầu tiên hoặc theo dõi thêm người khác.' : 'Chưa có bài nổi bật.'}
        </p>
      )}
      {loading && <p className="muted small center">Đang tải bài viết…</p>}
      {!loading && next && <button type="button" className="btn btn-primary" onClick={() => load(next)}>Xem thêm</button>}
    </Shell>
  )
}
