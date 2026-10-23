import { createContext, useContext, useEffect, useState } from 'react'
import { authApi, miscApi, setSessionEndHandler, tokens } from './api'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

// me = null: chưa đăng nhập; undefined: đang kiểm tra phiên
export function AuthProvider({ children }) {
  const [me, setMe] = useState(tokens.get() ? undefined : null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    setSessionEndHandler(() => setMe(null))
    if (tokens.get()) authApi.me().then(setMe).catch(() => setMe(null))
  }, [])

  // Số thông báo chưa đọc, làm mới mỗi 30 giây
  useEffect(() => {
    if (!me) return
    const load = () => miscApi.unread().then((r) => setUnread(r.count)).catch(() => {})
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [me])

  /** Lưu token rồi lấy hồ sơ; dùng sau đăng nhập và sau xác minh email. */
  async function signIn(data, remember = true) {
    tokens.set(data, remember)
    setMe(await authApi.me())
  }

  async function signOut() {
    const t = tokens.get()
    tokens.clear()
    setMe(null)
    if (t?.refresh_token) authApi.logout(t.refresh_token).catch(() => {})
  }

  return <Ctx.Provider value={{ me, unread, signIn, signOut }}>{children}</Ctx.Provider>
}
