const tones = [['#E0E7FF', '#4338CA'], ['#FCE8EE', '#8E1F45'], ['#E0F2FE', '#075985'], ['#FFF0DC', '#7A4A00']]

export function initials(name) {
  const w = name.trim().split(/\s+/)
  return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase()
}

export default function Avatar({ name, tone = 0, size = 40 }) {
  const [bg, fg] = tones[tone % tones.length]
  return (
    <span className="avatar" aria-hidden="true"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size >= 40 ? 14 : size >= 36 ? 13 : 12 }}>
      {initials(name)}
    </span>
  )
}
