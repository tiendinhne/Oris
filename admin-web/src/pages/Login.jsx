import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'

const EMAIL_KEY = 'admin_email'
const savedEmail = () => { try { return localStorage.getItem(EMAIL_KEY) || '' } catch { return '' } }
const saveEmail = (v) => { try { v ? localStorage.setItem(EMAIL_KEY, v) : localStorage.removeItem(EMAIL_KEY) } catch { /* bỏ qua khi bị chặn lưu trữ */ } }

export default function Login() {
  const { me, signIn } = useAuth()
  const [email, setEmail] = useState(savedEmail)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (me) return <Navigate to="/users" replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email, password, remember)
      saveEmail(remember ? email : '') // chỉ nhớ email, không lưu mật khẩu
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">O</span>
          <span className="brand-name">Oris <span>Admin</span></span>
        </div>
        <h1>Đăng nhập</h1>
        <p className="lead">Dành cho quản trị viên của hệ thống.</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Mật khẩu</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Ghi nhớ đăng nhập
        </label>
        {error && <p className="error-note" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
    </div>
  )
}
