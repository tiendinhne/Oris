import { useState } from 'react'
import { Link } from 'react-router-dom'
import { postApi } from '../api'
import { timeAgo } from '../time'
import Avatar from './Avatar'
import { Heart, Icon } from './Icons'

// post: PostOut từ Post Service; repostedBy: tên người đăng lại (nếu có)
export default function Post({ post: initial, repostedBy, linkReplies = true }) {
  const [p, setP] = useState(initial)
  const [busy, setBusy] = useState(false)
  const name = p.author.display_name || 'Người dùng'

  // Gọi API rồi lấy lại số đếm thật từ server (tránh lệch khi bấm nhanh)
  async function toggle(fn, on) {
    if (busy) return
    setBusy(true)
    try { setP(await fn(p.id, on)) } catch { /* giữ nguyên trạng thái cũ */ } finally { setBusy(false) }
  }

  const images = p.media.filter((m) => m.type === 'IMAGE')
  const video = p.media.find((m) => m.type === 'VIDEO')

  return (
    <article className="card post">
      {repostedBy && <div className="post-repost"><Icon name="repost" size={15} />{repostedBy} đã đăng lại</div>}
      <div className="post-row">
        <Link to="/" aria-label={`Hồ sơ của ${name}`} style={{ textDecoration: 'none' }}><Avatar name={name} /></Link>
        <div className="post-body">
          <div className="post-head">
            <Link to="/" className="post-name">{name}</Link>
            {p.author.username && <span className="muted small">@{p.author.username}</span>}
            <span className="post-time muted small">{timeAgo(p.created_at)}{p.edited_at && ' (đã chỉnh sửa)'}</span>
          </div>
          {p.content && <p className="post-text">{p.content}</p>}
          {images.length > 0 && (
            <div className="media-grid" style={{ gridTemplateColumns: images.length > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', maxWidth: images.length > 1 ? '100%' : 280 }}>
              {images.map((m) => <img key={m.url} src={m.url} alt="Ảnh đính kèm" style={{ aspectRatio: '3 / 4', objectFit: 'cover', width: '100%', borderRadius: 12 }} />)}
            </div>
          )}
          {video && <video src={video.url} controls style={{ width: 240, maxWidth: '100%', aspectRatio: '3 / 4', borderRadius: 12, background: '#15171b' }} />}
          <div className="post-actions">
            <button type="button" className={p.liked_by_me ? 'liked' : ''} aria-pressed={p.liked_by_me}
              aria-label={`Thích, ${p.like_count} lượt`} onClick={() => toggle(postApi.like, !p.liked_by_me)}>
              <Heart filled={p.liked_by_me} />{p.like_count}
            </button>
            {p.reply_permission === 'OFF' ? (
              <span className="muted"><Icon name="commentOff" />Đã tắt trả lời</span>
            ) : linkReplies ? (
              <Link to={`/post/${p.id}`} aria-label={`Trả lời, ${p.reply_count} trả lời`}><Icon name="comment" />{p.reply_count}</Link>
            ) : (
              <span><Icon name="comment" />{p.reply_count}</span>
            )}
            <button type="button" className={p.reposted_by_me ? 'liked' : ''} aria-pressed={p.reposted_by_me}
              aria-label={`Đăng lại, ${p.repost_count} lượt`} onClick={() => toggle(postApi.repost, !p.reposted_by_me)}>
              <Icon name="repost" />{p.repost_count}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
