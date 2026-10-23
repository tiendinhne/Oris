import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { miscApi } from '../api'

export default function Trending() {
  const [tags, setTags] = useState([])
  useEffect(() => { miscApi.trending().then(setTags).catch(() => {}) }, [])

  return (
    <aside className="trending" aria-labelledby="trend-title">
      <h2 id="trend-title">Hashtag thịnh hành</h2>
      <p className="muted small">Theo số bài viết trong 24 giờ qua</p>
      {tags.length === 0 && <p className="muted small">Chưa có hashtag nào.</p>}
      <ol>
        {tags.map((t) => (
          <li key={t.hashtag}>
            <Link to="/">
              <span className="rank">{t.rank}</span>
              <span className="col">
                <strong>#{t.hashtag}</strong>
                <span className="muted small">{t.post_count} bài</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </aside>
  )
}
