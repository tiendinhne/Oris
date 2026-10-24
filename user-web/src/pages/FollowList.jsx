import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { userApi } from '../api'
import { useAuth } from '../auth'
import Avatar from '../components/Avatar'
import FollowButton from '../components/FollowButton'
import { Icon } from '../components/Icons'
import Shell from '../components/Shell'

const LISTS = ['followers', 'following']
const fmt = (n) => n.toLocaleString('vi-VN')

export default function FollowList() {
  const { username, list } = useParams()
  const { me } = useAuth()
  const valid = LISTS.includes(list)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null) // { notFound, message }
  const [items, setItems] = useState([])
  const [next, setNext] = useState(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(null)
  const [following, setFollowing] = useState(() => new Set())

  // Đổi người xem / đổi tab: dọn trạng thái ngay trong lúc render để không lộ dữ liệu cũ
  const [shownUser, setShownUser] = useState(username)
  if (shownUser !== username) {
    setShownUser(username)
    setProfile(null); setProfileError(null)
  }
  const key = `${username}/${list}`
  const [shownKey, setShownKey] = useState(key)
  if (shownKey !== key) {
    setShownKey(key)
    setItems([]); setNext(null); setListError(null); setLoading(true); setFollowing(new Set())
  }

  useEffect(() => {
    let ignore = false
    userApi.profile(username)
      .then((data) => { if (!ignore) setProfile(data) })
      .catch((err) => { if (!ignore) setProfileError({ notFound: err.code === 'USER_NOT_FOUND', message: err.message }) })
    return () => { ignore = true }
  }, [username])

  const epoch = useRef(0)
  const fetchPage = useCallback(async (offset) => {
    const mine = epoch.current
    setLoading(true)
    setListError(null)
    try {
      // relations chỉ cần ở trang đầu: nó đã chứa toàn bộ id đang theo dõi
      const [data, rel] = await Promise.all([
        userApi[list](username, { offset }),
        offset === undefined ? userApi.relations() : null,
      ])
      if (mine !== epoch.current) return
      setItems((old) => (offset === undefined ? data.items : [...old, ...data.items]))
      setNext(data.next_offset)
      if (rel) setFollowing(new Set(rel.following))
    } catch (err) {
      if (mine === epoch.current) setListError({ notFound: err.code === 'USER_NOT_FOUND', message: err.message })
    } finally {
      if (mine === epoch.current) setLoading(false)
    }
  }, [username, list])

  useEffect(() => {
    if (!valid) return undefined
    epoch.current += 1
    fetchPage()
    return () => { epoch.current += 1 }
  }, [valid, fetchPage])

  if (!valid) return <Navigate to={`/u/${username}`} replace />

  if (profileError?.notFound || listError?.notFound) {
    return <Shell active="none"><p className="muted center">Không tìm thấy người dùng này.</p></Shell>
  }
  if (profileError) {
    return <Shell active="none"><p role="alert" className="alert-error">{profileError.message}</p></Shell>
  }

  const isOwner = me?.username === username

  function changed(id, nowFollowing) {
    setFollowing((old) => {
      const copy = new Set(old)
      if (nowFollowing) copy.add(id); else copy.delete(id)
      return copy
    })
    // Danh sách của chính mình (cả hai tab): theo dõi/bỏ theo dõi đổi số "Đang theo dõi" ngay, không cần tải lại hồ sơ
    if (isOwner) {
      setProfile((p) => (p ? { ...p, following_count: p.following_count + (nowFollowing ? 1 : -1) } : p))
    }
  }

  const tabs = [
    ['followers', 'Người theo dõi', profile?.followers_count],
    ['following', 'Đang theo dõi', profile?.following_count],
  ]

  return (
    <Shell active={isOwner ? 'profile' : 'none'}>
      <div className="page-head">
        <Link to={`/u/${username}`} className="icon-btn back" aria-label="Quay lại hồ sơ"><Icon name="back" size={22} strokeWidth={2} /></Link>
        {profile && (
          <div className="follow-names">
            <h1>{profile.display_name}</h1>
            <span className="muted small">@{profile.username}</span>
          </div>
        )}
      </div>
      <nav className="tabs" aria-label="Danh sách theo dõi">
        {tabs.map(([name, label, count]) => (
          <Link key={name} to={`/u/${username}/${name}`} aria-current={list === name ? 'page' : undefined}>
            {label}{count !== undefined && <>{' '}<span className="tab-count">{fmt(count)}</span></>}
          </Link>
        ))}
      </nav>
      {listError && <p role="alert" className="alert-error">{listError.message}</p>}
      {items.length > 0 && (
        <ul className="card follow-list">
          {items.map((u) => (
            <li key={u.id} className="follow-row">
              <Link to={`/u/${u.username}`} aria-hidden="true" tabIndex={-1}><Avatar name={u.display_name} size={44} /></Link>
              <div className="follow-info">
                <Link to={`/u/${u.username}`} className="follow-name">{u.display_name}</Link>
                <span className="muted small">@{u.username}</span>
                {u.bio && <span className="follow-bio">{u.bio}</span>}
              </div>
              {u.id !== me?.id && (
                <FollowButton username={u.username} following={following.has(u.id)}
                  followsMe={isOwner && list === 'followers'} onChange={(now) => changed(u.id, now)} />
              )}
            </li>
          ))}
        </ul>
      )}
      {!loading && !listError && items.length === 0 && (
        <p className="muted small center">{list === 'followers' ? 'Chưa có ai theo dõi.' : 'Chưa theo dõi ai.'}</p>
      )}
      {loading && <p className="muted small center">Đang tải…</p>}
      {!loading && next !== null && <button type="button" className="btn btn-primary" onClick={() => fetchPage(next)}>Xem thêm</button>}
    </Shell>
  )
}
