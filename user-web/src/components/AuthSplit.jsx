import { Logo } from './Icons'

// Khung chia đôi: panel tím bên trái, form bên phải (Đăng nhập / Đăng ký)
export default function AuthSplit({ title, children }) {
  return (
    <div className="auth">
      <div className="auth-brand">
        {/* <div className="auth-logo"><span style={{ color: 'var(--accent)' }}>oris</span></div> */}
        <svg viewBox="0 0 400 400" aria-hidden="true">
          <circle cx="185" cy="220" r="138" fill="none" stroke="#fff" strokeWidth="36" />
          <circle cx="338" cy="66" r="32" fill="var(--accent)" />
        </svg>
        {/* <p>Demo SOA</p> */}
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <h1>{title}</h1>
          {children}
        </div>
      </div>
    </div>
  )
}
