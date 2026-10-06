import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthSplit from '../components/AuthSplit'
import { Icon } from '../components/Icons'

// Quy tắc theo gợi ý trong thiết kế (AU1)
const USERNAME_RE = /^(?!\.)(?!.*\.$)[a-z0-9._]{3,30}$/
const passwordOk = (v) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v)

export default function Register() {
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [tried, setTried] = useState(false)
  const userBad = tried && !USERNAME_RE.test(username)
  const passBad = tried && !passwordOk(password)

  function submit(e) {
    e.preventDefault()
    setTried(true)
    if (USERNAME_RE.test(username) && passwordOk(password) && e.target.checkValidity()) nav('/')
  }

  return (
    <AuthSplit title="Tạo tài khoản">
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="username">Username</label>
          <div className={'input-prefix' + (userBad ? ' invalid' : '')}>
            <span aria-hidden="true">@</span>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" aria-describedby="username-hint" />
          </div>
          <span id="username-hint" className={'hint' + (userBad ? ' bad' : '')}>
            3–30 ký tự gồm chữ thường, số, dấu chấm và gạch dưới; không bắt đầu hoặc kết thúc bằng dấu chấm.
          </span>
        </div>
        <div className="field">
          <label htmlFor="password">Mật khẩu</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password" aria-describedby="password-hint" aria-invalid={passBad} />
          <span id="password-hint" className={'hint' + (passBad ? ' bad' : passwordOk(password) ? ' ok' : '')}>
            {passwordOk(password) && <Icon name="check" size={14} strokeWidth={2.6} />}
            Ít nhất 8 ký tự, có cả chữ và số
          </span>
        </div>
        <button type="submit" className="btn btn-primary btn-xl">Tạo tài khoản</button>
        <p className="auth-alt">Đã có tài khoản? <Link to="/login"><b>Đăng nhập</b></Link></p>
      </form>
    </AuthSplit>
  )
}
