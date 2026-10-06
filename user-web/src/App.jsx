import { Navigate, Route, Routes } from 'react-router-dom'
import Feed from './pages/Feed'
import Login from './pages/Login'
import PostDetail from './pages/PostDetail'
import Register from './pages/Register'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Feed />} />
      <Route path="/post/:id" element={<PostDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
