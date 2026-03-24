import React, { createContext, useContext, useEffect, useState } from 'react'
import { AuthState } from '../types/auth.types'
import authService from '../services/auth.service'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: true,
    error: null,
  })

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = authService.getStoredAccessToken()
      if (token) {
        try {
          const user = await authService.getProfile()
          setAuthState({
            isAuthenticated: true,
            user,
            accessToken: token,
            refreshToken: authService.getStoredRefreshToken(),
            loading: false,
            error: null,
          })
        } catch (error) {
          authService.clearTokens()
          setAuthState({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            loading: false,
            error: 'Failed to fetch user profile',
          })
        }
      } else {
        setAuthState((prev) => ({ ...prev, loading: false }))
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    setAuthState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const tokens = await authService.login({ username: email, password })
      authService.setTokens(tokens.access_token, tokens.refresh_token)

      const user = await authService.getProfile()
      setAuthState({
        isAuthenticated: true,
        user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        loading: false,
        error: null,
      })
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail || error.message || 'Login failed'
      setAuthState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        loading: false,
        error: errorMessage,
      })
      throw error
    }
  }

  const logout = async () => {
    setAuthState((prev) => ({ ...prev, loading: true }))
    try {
      await authService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setAuthState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        loading: false,
        error: null,
      })
    }
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
