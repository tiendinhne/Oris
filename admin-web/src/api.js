// Gọi API qua proxy của Vite: /api/auth/... → Auth Service, /api/post/... → Post Service.
// Tự làm mới access token khi hết hạn (TOKEN_EXPIRED) rồi gọi lại một lần.

const KEY = 'admin_tokens'

export const tokens = {
  get: () => JSON.parse(localStorage.getItem(KEY) || 'null'),
  set: (t) => localStorage.setItem(KEY, JSON.stringify(t)),
  clear: () => localStorage.removeItem(KEY),
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

export const authApi = {
  login: (email, password) => raw('/api/auth/auth/login', { method: 'POST', body: { email, password } }),
  logout: (refresh_token) => raw('/api/auth/auth/logout', { method: 'POST', body: { refresh_token } }),
  me: () => api('/api/auth/auth/me'),
}

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false))
  return s.toString() ? `?${s}` : ''
}

export const adminApi = {
  users: (p) => api(`/api/auth/admin/users${qs(p)}`),
  user: (id) => api(`/api/auth/admin/users/${id}`),
  ban: (id, body) => api(`/api/auth/admin/users/${id}/ban`, { method: 'POST', body }),
  unban: (id, body) => api(`/api/auth/admin/users/${id}/unban`, { method: 'POST', body }),
  auditLogs: (p) => api(`/api/auth/admin/audit-logs${qs(p)}`),
  posts: (p) => api(`/api/post/admin/posts${qs(p)}`),
  deletePost: (id, reason) => api(`/api/post/admin/posts/${id}`, { method: 'DELETE', body: { reason } }),
  reports: (p) => api(`/api/post/admin/reports${qs(p)}`),
  report: (id) => api(`/api/post/admin/reports/${id}`),
  approve: (id, reason) => api(`/api/post/admin/reports/${id}/approve`, { method: 'POST', body: { reason } }),
  dismiss: (id) => api(`/api/post/admin/reports/${id}/dismiss`, { method: 'POST', body: {} }),
}
