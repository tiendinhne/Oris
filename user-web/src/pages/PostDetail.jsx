import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { postApi } from '../api'
import { useAuth } from '../auth'
import Avatar from '../components/Avatar'
import { Icon } from '../components/Icons'
import Post from '../components/Post'
import Shell from '../components/Shell'

export default function PostDetail() {
  const { id } = useParams()
  const { me } = useAuth()
  const [post, setPost] = useState(null)
  const [replies, setReplies] = useState([])
  const [cursor, setCursor] = useState(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function loadReplies(c) {
    const data = await postApi.replies(id, c ? { cursor: c } : {})
    setReplies((old) => (c ? [...old, ...data.items] : data.items))
    setCursor(data.next_cursor)
  }

  useEffect(() => {
    setPost(null); setError('')
    Promise.all([postApi.get(id), loadReplies()]).then(([p]) => setPost(p)).catch((err) => setError(err.message))
  }, [id])

  async function send(e) {
    e.preventDefault()
    setSending(true)
    try {
      const r = await postApi.reply(id, { content: text })
      setText('')
      setReplies((old) => [r, ...old])
      setPost((p) => ({ ...p, reply_count: p.reply_count + 1 }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Shell active="home">
      <div className="page-head">
        <Link to="/" className="icon-btn back" aria-label="Quay lại bảng tin"><Icon name="back" size={22} strokeWidth={2} /></Link>
        <h1>Bài viết</h1>
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
      {!post && !error && <p className="muted small center">Đang tải…</p>}
      {post && (
        <>
          <Post key={post.id} post={post} linkReplies={false} />
          {post.reply_permission !== 'OFF' || post.is_mine ? (
            <form className="card reply-form" onSubmit={send}>
              <Avatar name={me.display_name} size={36} />
              <div className="col grow">
                <label htmlFor="reply-box" className="muted small">Trả lời {post.author.display_name}</label>
                <textarea id="reply-box" rows={2} maxLength={500} placeholder="Viết câu trả lời…"
                  value={text} onChange={(e) => setText(e.target.value)} />
                <div className="reply-form-foot">
                  <span className="muted small">{text.length}/500</span>
                  <button type="submit" className="btn btn-primary" disabled={!text.trim() || sending}>Trả lời</button>
                </div>
              </div>
            </form>
          ) : null}
          <section className="card replies" aria-labelledby="replies-title">
            <h2 id="replies-title">{post.reply_count} trả lời</h2>
            {replies.map((r) => <Post key={r.id} post={r} linkReplies={false} />)}
            {cursor && <button type="button" className="thread-more" onClick={() => loadReplies(cursor)}>Xem thêm trả lời</button>}
          </section>
        </>
      )}
    </Shell>
  )
}
