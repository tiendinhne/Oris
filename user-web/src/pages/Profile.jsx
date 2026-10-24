import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { postApi, userApi } from '../api'
import Avatar from '../components/Avatar'
import EditProfileDialog from '../components/EditProfileDialog'
import FollowButton from '../components/FollowButton'
import Post from '../components/Post'
import Shell from '../components/Shell'

const SAFE_LINK = /^https?:\/\//i
const fmt =(n) => n.toLocaleString('vi-VN')

function joinedLabel(iso) {
  const d = new Date(iso)
  return `Tham gia tháng ${d.getMonth() + 1}/${d.getFullYear()}`
}

export default function Profile() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null) // { notFound, message }
  const [tab, setTab] = useState('posts')
  const [items, setItems] = useState([])
  const [next, setNext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [postsError, setPostsError] = useState('')
  const [editing, setEditing] = useState(false)

  // Đổi người xem: dọn trạng thái ngay trong lúc render để không lộ dữ liệu của người cũ
  const [shownUser, setShownUser] = useState(username)
  if (shownUser !== username) {
    setShownUser(username)
    setProfile(null); setError(null); setTab('posts'); setItems([]); setNext(null); setPostsError(''); setEditing(false)
    setLoading(true) // bài của người mới chưa về: không được lóe "Chưa có bài viết."
  }

  const currentUser = useRef(username)
  currentUser.current = username

  useEffect(() => {
    let ignore = false
    userApi.profile(username)
      .then((data) => { if (!ignore) setProfile(data) })
      .catch((err) => { if (!ignore) setError({ notFound: err.code === 'USER_NOT_FOUND', message: err.message }) })
    return () => { ignore = true }
  }, [username])

  // Tải lại sau khi theo dõi / lưu hồ sơ để số liệu đúng; bỏ qua nếu đã sang người khác
  const reloadProfile = useCallback(async () => {
    try {
      const data = await userApi.profile(username)
      if (currentUser.current === username) setProfile(data)
    } catch { /* giữ hồ sơ đang hiện */ }
  }, [username])

  const epoch = useRef(0)
  const fetchPosts = useCallback(async (cursor) => {
    const mine = epoch.current
    setLoading(true)
    setPostsError('')
    try {
      const data = await postApi.byUser(username, { replies: tab === 'replies', cursor })
      if (mine !== epoch.current) return
      setItems((old) => (cursor ? [...old, ...data.items] : data.items))
      setNext(data.next_cursor)
    } catch (err) {
      if (mine === epoch.current) setPostsError(err.message)
    } finally {
      if (mine === epoch.current) setLoading(false)
    }
  }, [username, tab])

  useEffect(() => {
    epoch.current += 1
    setItems([]); setNext(null)
    fetchPosts()
    return () => { epoch.current += 1 }
  }, [fetchPosts])

  function saved(updated) {
    setEditing(false)
    if (updated.username !== username) navigate(`/u/${updated.username}`, { replace: true })
    else reloadProfile()
  }

  if (error) {
    return (
      <Shell active="none">
        {error.notFound
          ? <p className="muted center">Không tìm thấy người dùng này.</p>
          : <p role="alert" className="alert-error">{error.message}</p>}
      </Shell>
    )
  }

  return (
    <Shell active={profile?.is_me ? 'profile' : 'none'}>
      {!profile && <p className="muted small center">Đang tải…</p>}
      {profile && (
        <section className="card profile-head">
          <div className="profile-top">
            <div className="profile-names">
              <h1>{profile.display_name}</h1>
              <div className="profile-handle">
                <span>@{profile.username}</span>
                {profile.follows_me && !profile.is_me && <span className="tag">Theo dõi bạn</span>}
              </div>
            </div>
            <Avatar name={profile.display_name} size={72} />
          </div>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          {/* Chỉ http(s): backend không kiểm scheme, javascript: trong href sẽ chạy script khi bấm */}
          {SAFE_LINK.test(profile.link_url || '') && (
            <a className="profile-link" href={profile.link_url} target="_blank" rel="noopener noreferrer">
              {profile.link_url.replace(/^https?:\/\//, '')}
            </a>
          )}
          <span className="muted small">{joinedLabel(profile.created_at)}</span>
          <div className="profile-stats">
            <Link to={`/u/${profile.username}/followers`}><strong>{fmt(profile.followers_count)}</strong> người theo dõi</Link>
            <Link to={`/u/${profile.username}/following`}><strong>{fmt(profile.following_count)}</strong> đang theo dõi</Link>
          </div>
          <div className="profile-actions">
            {profile.is_me ? (
              <button type="button" className="btn btn-outline btn-block" onClick={() => setEditing(true)}>Chỉnh sửa hồ sơ</button>
            ) : (
              <FollowButton username={profile.username} following={profile.is_following} followsMe={profile.follows_me}
                onChange={reloadProfile} />
            )}
          </div>
        </section>
      )}
      <nav className="tabs" aria-label="Nội dung hồ sơ">
        {[['posts', 'Bài viết'], ['replies', 'Trả lời']].map(([key, label]) => (
          <a key={key} href="#" aria-current={tab === key ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); setTab(key) }}>{label}</a>
        ))}
      </nav>
      {postsError && <p role="alert" className="alert-error">{postsError}</p>}
      {items.map((p) => <Post key={p.id} post={p} />)}
      {!loading && !postsError && items.length === 0 && (
        <p className="muted small center">{tab === 'posts' ? 'Chưa có bài viết.' : 'Chưa có trả lời.'}</p>
      )}
      {loading && <p className="muted small center">Đang tải bài viết…</p>}
      {!loading && next && <button type="button" className="btn btn-primary" onClick={() => fetchPosts(next)}>Xem thêm</button>}
      {editing && <EditProfileDialog profile={profile} onClose={() => setEditing(false)} onSaved={saved} />}
    </Shell>
  )
}
