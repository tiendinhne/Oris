import { Link } from 'react-router-dom'
import { trending } from '../data'

export default function Trending() {
  return (
    <aside className="trending" aria-labelledby="trend-title">
      <h2 id="trend-title">Hashtag thịnh hành</h2>
      <p className="muted small">Theo số bài viết trong 24 giờ qua</p>
      <ol>
        {trending.map(([tag, count], i) => (
          <li key={tag}>
            <Link to="/">
              <span className="rank">{i + 1}</span>
              <span className="col">
                <strong>#{tag}</strong>
                <span className="muted small">{count} bài</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <Link to="/" className="trending-more">Xem đủ 10 hashtag</Link>
    </aside>
  )
}
