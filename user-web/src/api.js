// Gọi API qua proxy của Vite: /api/<service>/... → service tương ứng.
// Tự làm mới access token khi hết hạn (TOKEN_EXPIRED) rồi gọi lại một lần.

const KEY = 'user_tokens'

const read = () => sessionStorage.getItem(KEY) || localStorage.getItem(KEY)
export const tokens = {
  get: () => JSON.parse(read() || 'null'),
  // remember bỏ trống = giữ nguyên nơi đang lưu (dùng khi làm mới access token)
  set: (t, remember) => {
    const persist = remember ?? !sessionStorage.getItem(KEY)
    tokens.clear()
    ;(persist ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(t))
  },
  clear: () => { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY) },
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail?.message || 'Đã có lỗi xảy ra, vui lòng thử lại')
    this.status = status
    this.code = detail?.code || 'UNKNOWN'
    this.detail = detail || {}
  }
}

let onSessionEnd = () => {}
export const setSessionEndHandler = (fn) => { onSessionEnd = fn }

async function raw(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError(0, { code: 'NETWORK', message: 'Không kết nối được máy chủ' })
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.detail)
  return data
}

async function refreshAccessToken() {
  const t = tokens.get()
  if (!t?.refresh_token) return null
  try {
    const data = await raw('/api/auth/auth/refresh', { method: 'POST', body: { refresh_token: t.refresh_token } })
    tokens.set({ ...t, access_token: data.access_token })
    return data.access_token
  } catch {
    return null
  }
}

export async function api(path, options = {}) {
  try {
    return await raw(path, { ...options, token: tokens.get()?.access_token })
  } catch (err) {
    if (err.status === 401 && err.code === 'TOKEN_EXPIRED') {
      const fresh = await refreshAccessToken()
      if (fresh) return raw(path, { ...options, token: fresh })
    }
    if (err.status === 401) {
      tokens.clear()
      onSessionEnd()
    }
    throw err
  }
}

const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  return s.toString() ? `?${s}` : ''
}
const post = (path, body) => api(path, { method: 'POST', body: body ?? {} })

// Lỗi theo trường: 409 trả object {trường: thông_báo}, 422 trả mảng [{field, message}].
export const fieldErrors = (err) => {
  const f = err?.detail?.fields
  if (Array.isArray(f)) return Object.fromEntries(f.map((x) => [x.field, x.message]))
  return f && typeof f === 'object' ? { ...f } : {}
}

export const authApi = {
  login: (email, password) => raw('/api/auth/auth/login', { method: 'POST', body: { email, password } }),
  logout: (refresh_token) => raw('/api/auth/auth/logout', { method: 'POST', body: { refresh_token } }),
  register: (body) => raw('/api/auth/auth/register', { method: 'POST', body }),
  verifyEmail: (email, code) => raw('/api/auth/auth/verify-email', { method: 'POST', body: { email, code } }),
  resendOtp: (email) => raw('/api/auth/auth/resend-otp', { method: 'POST', body: { email } }),
  me: () => api('/api/auth/auth/me'),
}

export const userApi = {
  profile: (username) => api(`/api/auth/users/${encodeURIComponent(username)}`),
  update: (body) => api('/api/auth/users/me', { method: 'PATCH', body }),
  follow: (username, on) => api(`/api/auth/users/${encodeURIComponent(username)}/follow`, { method: on ? 'POST' : 'DELETE' }),
  followers: (username, p) => api(`/api/auth/users/${encodeURIComponent(username)}/followers${qs(p)}`),
  following: (username, p) => api(`/api/auth/users/${encodeURIComponent(username)}/following${qs(p)}`),
  relations: () => api('/api/auth/users/me/relations'),
}

export const postApi = {
  create: (body) => post('/api/post/posts', body),
  get: (id) => api(`/api/post/posts/${id}`),
  replies: (id, p) => api(`/api/post/posts/${id}/replies${qs(p)}`),
  reply: (id, body) => post(`/api/post/posts/${id}/replies`, body),
  like: (id, on) => api(`/api/post/posts/${id}/like`, { method: on ? 'POST' : 'DELETE' }),
  repost: (id, on) => api(`/api/post/posts/${id}/repost`, { method: on ? 'POST' : 'DELETE' }),
  byUser: (username, p) => api(`/api/post/posts/by-user/${encodeURIComponent(username)}${qs(p)}`),
}

export const feedApi = {
  following: (p) => api(`/api/feed/feed${qs(p)}`),
  explore: (p) => api(`/api/feed/feed/explore${qs(p)}`),
}

export const miscApi = {
  trending: () => api('/api/search/trending/hashtags'),
  unread: () => api('/api/notification/notifications/unread-count'),
}
