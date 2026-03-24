import apiClient from './api.client'
import { LoginRequest, TokenResponse, UserProfile } from '../types/auth.types'

class AuthService {
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    const formData = new URLSearchParams()
    formData.append('username', credentials.username)
    formData.append('password', credentials.password)

    const response = await apiClient.post<TokenResponse>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
    return response.data
  }

  async getProfile(): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>('/auth/me')
    return response.data
  }

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  getStoredAccessToken(): string | null {
    return localStorage.getItem('accessToken')
  }

  getStoredRefreshToken(): string | null {
    return localStorage.getItem('refreshToken')
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
  }

  clearTokens(): void {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  isAuthenticated(): boolean {
    return !!this.getStoredAccessToken()
  }
}

export default new AuthService()
