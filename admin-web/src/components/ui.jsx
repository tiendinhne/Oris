import { useEffect, useRef } from 'react'
import { CloseIcon, SearchIcon } from './Icons'

export const Badge = ({ tone = 'muted', children }) => <span className={`badge badge-${tone}`}>{children}</span>

export function Avatar({ name }) {
  // Lấy chữ cái đầu của từ đầu và từ cuối (bỏ qua từ là số, ví dụ "Người dùng 07" → "ND")
  const words = (name || '?').trim().split(/\s+/).filter((w) => /\p{L}/u.test(w))
  const text = ((words[0]?.[0] || '?') + (words.length > 1 ? words.at(-1)[0] : '')).toUpperCase()
  return <span className="avatar" aria-hidden="true">{text}</span>
}

export function ErrorNote({ error }) {
  if (!error) return null
  return <p className="error-note" role="alert">{error.message}</p>
}

/** Hộp thoại có tiêu đề, đóng bằng Esc hoặc bấm nền, focus vào ô nhập đầu tiên. */
export function Modal({ title, subtitle, onClose, children, footer }) {
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector('select, textarea, input')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <div className="modal-head">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}><CloseIcon /></button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [message, onDone])
  return message ? <div className="toast" role="status">{message}</div> : null
}

/** Nhóm nút chọn một giá trị, thay cho ô select khi chỉ có vài lựa chọn. */
export function Segmented({ label, value, onChange, options }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} className={`seg-btn ${value === o.value ? 'is-on' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const Stat = ({ label, value, tone = 'muted' }) => (
  <div className={`stat stat-${tone}`}>
    <span className="stat-label">{label}</span>
    <strong className="stat-value">{value}</strong>
  </div>
)

export function SearchBox({ id, placeholder, value, onChange }) {
  return (
    <div className="search">
      <SearchIcon />
      <input id={id} type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={onChange} />
    </div>
  )
}
