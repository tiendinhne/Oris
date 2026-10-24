import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api'
import AuthSplit from '../components/AuthSplit'
import { useAuth } from '../auth'

export default function Verify() {
  const nav = useNavigate()
  const email = useSearchParams()[0].get('email')
  const { signIn } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (!email) return <Navigate to="/login" replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(await authApi.verifyEmail(email, code))
      nav('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError('')
    setInfo('')
    try {
      await authApi.resendOtp(email)
      setInfo('Đã gửi lại mã mới.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AuthSplit title="Xác minh email">
      <form onSubmit={submit} noValidate>
        <p className="muted">Nhập mã xác minh đã gửi tới <b>{email}</b>. Mã có hiệu lực 10 phút.</p>
        <div className="field">
          <label htmlFor="code">Mã xác minh</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-invalid={!!error} />
        </div>
        {error && <p role="alert" className="alert-error">{error}</p>}
        {info && <p className="hint ok">{info}</p>}
        <button type="submit" className="btn btn-primary btn-xl" disabled={busy || code.length < 4}>{/* 4 số khi dùng MOCK_OTP, mã thật 6 số */}
          {busy ? 'Đang xác minh…' : 'Xác minh'}
        </button>
        <p className="auth-alt">Chưa nhận được mã? <button type="button" className="linklike" onClick={resend}><b>Gửi lại</b></button></p>
        <p className="auth-alt small"><Link to="/login">Quay lại đăng nhập</Link></p>
      </form>
    </AuthSplit>
  )
}
