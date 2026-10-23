import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import AuthSplit from '../components/AuthSplit'
import { useAuth } from '../auth'

const fmt = (iso) => new Date(iso).toLocaleString('vi-VN')

export default function Login() {
  const nav = useNavigate()
  const { me, signIn } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (me) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    const email = f.get('email').trim()
    if (!email || !f.get('password')) return setError('Email hoặc mật khẩu không đúng.')
    setBusy(true)
    setError('')
    try {
      await signIn(await authApi.login(email, f.get('password')))
      nav('/')
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') return nav(`/verify?email=${encodeURIComponent(email)}`)
      if (err.code === 'ACCOUNT_BANNED') {
        setError(`Tài khoản đang bị khóa${err.detail.ends_at ? ` đến ${fmt(err.detail.ends_at)}` : ' vĩnh viễn'}. Lý do: ${err.detail.reason}`)
      } else if (err.code === 'LOGIN_LOCKED') {
        setError(`Đăng nhập sai quá nhiều lần, thử lại sau ${fmt(err.detail.locked_until)}.`)
      } else {
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthSplit title="Đăng nhập">
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Mật khẩu</label>
          <input id="password" name="password" type="password" autoComplete="current-password"
            aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} />
        </div>
        {error && <p id="login-error" role="alert" className="alert-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-xl" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        <p className="auth-alt">Chưa có tài khoản? <Link to="/register"><b>Tạo tài khoản</b></Link></p>
      </form>
    </AuthSplit>
  )
}
