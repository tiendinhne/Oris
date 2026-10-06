// Icon nét 1.8px theo thiết kế; mỗi mục chỉ là phần bên trong svg.
const paths = {
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></>,
  settings: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  repost: <><path d="M4 9h13l-3-3" /><path d="M20 15H7l3 3" /></>,
  comment: <path d="M4 5h16v11H9.5L5 20v-4H4z" />,
  commentOff: <><path d="M4 5h16v11H9.5L5 20v-4H4z" /><path d="M3 3l18 18" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" /></>,
  check: <path d="M5 12l5 5 9-10" />,
}

export function Icon({ name, size = 20, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {paths[name]}
    </svg>
  )
}

export function Heart({ filled, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor">
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />
    </svg>
  )
}

export function Logo({ color = 'var(--primary)', dot = color, size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="14.5" cy="17.5" r="10" stroke={color} strokeWidth="3.4" />
      <circle cx="26" cy="6.5" r="3.4" fill={dot} />
    </svg>
  )
}
