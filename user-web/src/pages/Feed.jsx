import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import Post from '../components/Post'
import Shell from '../components/Shell'
import { me, posts } from '../data'

export default function Feed() {
  return (
    <Shell active="home">
      <h1 className="sr-only">Bảng tin</h1>
      <nav className="tabs" aria-label="Chọn bảng tin">
        <Link to="/" aria-current="page">Theo dõi</Link>
        <Link to="/">Khám phá</Link>
      </nav>
      <div className="card composer-bar">
        <Avatar name={me.name} />
        <Link to="/" className="grow muted">Có gì mới, {me.name.split(' ').slice(-2).join(' ')}?</Link>
        <Link to="/" className="btn btn-primary">Đăng</Link>
      </div>
      {posts.map((p) => <Post key={p.id} post={p} />)}
      <p className="muted small center">Đang tải thêm bài viết…</p>
    </Shell>
  )
}
