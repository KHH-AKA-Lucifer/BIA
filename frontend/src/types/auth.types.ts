// Auth related types
export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserProfile {
  id: number
  email: string
  role: string
  is_active: boolean
  is_superuser: boolean
}

export interface AuthState {
  isAuthenticated: boolean
  user: UserProfile | null
  accessToken: string | null
  refreshToken: string | null
  loading: boolean
  error: string | null
}
