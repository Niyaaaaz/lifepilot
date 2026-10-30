import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from './lib/api'
import { AuthContext } from './AuthState'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    apiRequest('/auth/me')
      .then((result) => {
        if (!active) return
        setUser(result.user)
        setAuthError('')
      })
      .catch((error) => {
        if (!active) return
        setUser(null)
        setAuthError(error.status === 401 ? '' : error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const authenticate = useCallback(async (mode, values) => {
    setAuthError('')
    const result = await apiRequest(`/auth/${mode}`, {
      method: 'POST',
      body: JSON.stringify(values),
    })
    setUser(result.user)
    return result.user
  }, [])

  const signup = useCallback((values) => authenticate('signup', values), [authenticate])
  const login = useCallback((values) => authenticate('login', values), [authenticate])
  const logout = useCallback(async () => {
    await apiRequest('/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    authError,
    login,
    signup,
    logout,
  }), [user, loading, authError, login, signup, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
