import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { Heart, Icon } from '../components/Icons'
import Post from '../components/Post'
import Shell from '../components/Shell'
import { me, posts, replies } from '../data'

function Reply({ r }) {
  return (
    <div className="reply">
      <Avatar name={r.name} tone={r.tone} size={36} />
      <div className="reply-body">
        <div className="reply-head">
          <Link to="/" className="post-name">{r.name}</Link>
          {r.isAuthor && <span className="pill">Tác giả</span>}
          <span className="muted small">@{r.user}</span>
          <span className="post-time muted small">{r.time}</span>
        </div>
        <p>{r.text}</p>
        <div className="reply-actions">
          <button type="button" aria-label={`Thích, ${r.likes} lượt`}><Heart size={17} />{r.likes}</button>
          <button type="button">Trả lời</button>
        </div>
        {r.children && (
          <div className="thread">
            {r.children.map((c, i) => c.deleted ? (
              <div key={i} className="child"><p className="deleted">Nội dung đã bị xóa</p></div>
            ) : (
              <div key={i} className="child">
                <Avatar name={c.name} tone={c.tone} size={30} />
                <div className="col">
                  <div className="reply-head">
                    <Link to="/" className="post-name small-name">{c.name}</Link>
                    <span className="muted small">{c.time}</span>
                  </div>
                  <p>{c.text}</p>
                </div>
              </div>
            ))}
            {r.moreChildren > 0 && <button type="button" className="thread-more">Xem thêm {r.moreChildren} trả lời</button>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PostDetail() {
  const { id } = useParams()
  const post = posts.find((p) => String(p.id) === id) ?? posts[0]
  const [text, setText] = useState('')
  // Dữ liệu mẫu chỉ có trả lời cho bài số 1
  const list = post.id === 1 ? replies : []

  return (
    <Shell active="home">
      <div className="page-head">
        <Link to="/" className="icon-btn back" aria-label="Quay lại bảng tin"><Icon name="back" size={22} strokeWidth={2} /></Link>
        <h1>Bài viết</h1>
      </div>
      <Post key={post.id} post={post} />
      <button type="button" className="likes-link">Xem {post.likes} người đã thích</button>
      {!post.repliesOff && (
        <form className="card reply-form" onSubmit={(e) => { e.preventDefault(); setText('') }}>
          <Avatar name={me.name} size={36} />
          <div className="col grow">
            <label htmlFor="reply-box" className="muted small">Trả lời {post.name}</label>
            <textarea id="reply-box" rows={2} maxLength={500} placeholder="Viết câu trả lời…"
              value={text} onChange={(e) => setText(e.target.value)} />
            <div className="reply-form-foot">
              <span className="muted small">{text.length}/500</span>
              <button type="submit" className="btn btn-primary" disabled={!text.trim()}>Trả lời</button>
            </div>
          </div>
        </form>
      )}
      <section className="card replies" aria-labelledby="replies-title">
        <h2 id="replies-title">{post.replies} trả lời</h2>
        {list.map((r, i) => <Reply key={i} r={r} />)}
      </section>
    </Shell>
  )
}
