import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthSplit from '../components/AuthSplit'

export default function Login() {
  const nav = useNavigate()
  const [error, setError] = useState('')

  // Dữ liệu mẫu: chưa có API, điền đủ email và mật khẩu là vào bảng tin.
  function submit(e) {
    e.preventDefault()
    const f = new FormData(e.target)
    if (!f.get('email') || !f.get('password')) return setError('Email hoặc mật khẩu không đúng.')
    nav('/')
  }

  return (
    <AuthSplit title="Đăng nhập">
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" />
        </div>
        <div className="field">
          <div className="field-row">
            <label htmlFor="password">Mật khẩu</label>
            <Link to="/login">Quên mật khẩu?</Link>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password"
            aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} />
        </div>
        {error && <p id="login-error" role="alert" className="alert-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-xl">Đăng nhập</button>
        <p className="auth-alt">Chưa có tài khoản? <Link to="/register"><b>Tạo tài khoản</b></Link></p>
        <p className="auth-alt small"><Link to="/">Xem bài viết mà không cần đăng nhập</Link></p>
      </form>
    </AuthSplit>
  )
}
