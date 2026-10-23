import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authApi, setSessionEndHandler, tokens } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null)
  const [checking, setChecking] = useState(!!tokens.get())

  const signOut = useCallback(async () => {
    const t = tokens.get()
    tokens.clear()
    setMe(null)
    if (t?.refresh_token) authApi.logout(t.refresh_token).catch(() => {})
  }, [])

  useEffect(() => {
    setSessionEndHandler(() => setMe(null))
    if (!tokens.get()) return
    authApi.me().then(setMe).catch(() => tokens.clear()).finally(() => setChecking(false))
  }, [])

  const signIn = async (email, password, remember = true) => {
    tokens.set(await authApi.login(email, password), remember)
    const profile = await authApi.me()
    if (profile.role !== 'ADMIN') {
      await signOut()
      throw new Error('Tài khoản này không có quyền quản trị')
    }
    setMe(profile)
  }

  return <AuthContext.Provider value={{ me, checking, signIn, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
