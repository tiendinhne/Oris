import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import Feed from './pages/Feed'
import FollowList from './pages/FollowList'
import Login from './pages/Login'
import PostDetail from './pages/PostDetail'
import Profile from './pages/Profile'
import Register from './pages/Register'
import Verify from './pages/Verify'

function Private({ children }) {
  const { me } = useAuth()
  if (me === undefined) return <p className="muted center" style={{ marginTop: 80 }}>Đang tải…</p>
  return me ? children : <Navigate to="/login" replace />
}

function MyProfile() {
  const { me } = useAuth()
  return <Navigate to={`/u/${me.username}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/" element={<Private><Feed /></Private>} />
      <Route path="/post/:id" element={<Private><PostDetail /></Private>} />
      <Route path="/profile" element={<Private><MyProfile /></Private>} />
      <Route path="/u/:username" element={<Private><Profile /></Private>} />
      <Route path="/u/:username/:list" element={<Private><FollowList /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
