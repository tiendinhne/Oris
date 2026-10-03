import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './components/Layout'
import AuditLogs from './pages/AuditLogs'
import Login from './pages/Login'
import Posts from './pages/Posts'
import Reports from './pages/Reports'
import Users from './pages/Users'

function RequireAdmin({ children }) {
  const { me, checking } = useAuth()
  if (checking) return <p className="page-loading">Đang tải…</p>
  return me ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAdmin><Layout /></RequireAdmin>}>
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="/users" element={<Users />} />
        <Route path="/posts" element={<Posts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
