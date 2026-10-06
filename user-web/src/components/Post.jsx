import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from './Avatar'
import { Heart, Icon } from './Icons'

export default function Post({ post: p }) {
  const [liked, setLiked] = useState(!!p.liked)
  const likes = p.likes + (liked && !p.liked ? 1 : 0) - (!liked && p.liked ? 1 : 0)
  const n = p.images || 0

  return (
    <article className="card post">
      {p.repostedBy && (
        <div className="post-repost"><Icon name="repost" size={15} />{p.repostedBy} đã đăng lại</div>
      )}
      <div className="post-row">
        <Link to="/" aria-label={`Hồ sơ của ${p.name}`} style={{ textDecoration: 'none' }}><Avatar name={p.name} tone={p.tone} /></Link>
        <div className="post-body">
          <div className="post-head">
            <Link to="/" className="post-name">{p.name}</Link>
            <span className="muted small">@{p.user}</span>
            <span className="post-time muted small">{p.time}{p.edited && ' (đã chỉnh sửa)'}</span>
            <button type="button" className="icon-btn post-menu" aria-label="Tùy chọn bài viết">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
              </svg>
            </button>
          </div>
          {p.text && <p className="post-text">{p.text}</p>}
          {p.tag && <Link to="/" className="post-tag">#{p.tag}</Link>}
          {n > 0 && (
            <div className="media-grid" style={{ gridTemplateColumns: n > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', maxWidth: n > 1 ? '100%' : 280 }}>
              {Array.from({ length: n }, (_, i) => (
                <div key={i} className="media-ph" role="img" aria-label="Ảnh đính kèm, khung 3:4">
                  <Icon name="image" size={28} strokeWidth={1.6} />Ảnh 3:4
                </div>
              ))}
            </div>
          )}
          {p.video && (
            <div className="video-ph">
              <button type="button" aria-label="Phát video">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              </button>
              <span>{p.duration}</span>
            </div>
          )}
          <div className="post-actions">
            <button type="button" className={liked ? 'liked' : ''} aria-pressed={liked}
              aria-label={`Thích, ${likes} lượt`} onClick={() => setLiked(!liked)}>
              <Heart filled={liked} />{likes}
            </button>
            {p.repliesOff ? (
              <span className="muted"><Icon name="commentOff" />Đã tắt trả lời</span>
            ) : (
              <Link to={`/post/${p.id}`} aria-label={`Trả lời, ${p.replies} trả lời`}><Icon name="comment" />{p.replies}</Link>
            )}
            <button type="button" aria-label={`Đăng lại, ${p.reposts} lượt`}><Icon name="repost" />{p.reposts}</button>
          </div>
        </div>
      </div>
    </article>
  )
}
