import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AlertCircle, Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react'

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { login, loading, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')
  const [persistedError, setPersistedError] = useState('')

  // Check for persisted errors on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('LOGIN_ERROR')
    if (stored) {
      setPersistedError(stored)
      sessionStorage.removeItem('LOGIN_ERROR')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    setPersistedError('')

    if (!email || !password) {
      const err = 'Email and password are required'
      setLocalError(err)
      sessionStorage.setItem('LOGIN_ERROR', err)
      return
    }

    try {
      await login(email, password)
      sessionStorage.removeItem('LOGIN_ERROR')
      navigate('/dashboard')
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Login failed. Please try again.'
      setLocalError(errorMsg)
      sessionStorage.setItem('LOGIN_ERROR', errorMsg)
    }
  }

  const handleDemoLogin = () => {
    setEmail('admin@test.com')
    setPassword('NewPassword123!')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Background Effects */}
      <div style={{
        position: 'absolute',
        top: '-200px',
        left: '-200px',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-100px',
        right: '-100px',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(79, 70, 229, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }}></div>

      {/* Main Card */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '2.5rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)'
            }}>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>⚡</span>
            </div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #93c5fd 0%, #dbeafe 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: 0,
              letterSpacing: '-0.5px'
            }}>
              BIA
            </h1>
          </div>
          <p style={{
            fontSize: '16px',
            fontWeight: 500,
            color: '#cbd5e1',
            margin: '0.5rem 0 0.25rem'
          }}>
            Business Intelligence & Analysis
          </p>
          <p style={{
            fontSize: '13px',
            fontWeight: 400,
            color: '#94a3b8',
            margin: 0
          }}>
            Vending Machine Analytics Dashboard
          </p>
        </div>

        {/* Card Container */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 1px rgba(59, 130, 246, 0.1) inset'
        }}>
          {/* Error Alert */}
          {(error || localError || persistedError) && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '0.875rem 1rem',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}>
              <AlertCircle style={{
                width: '18px',
                height: '18px',
                color: '#ef4444',
                flexShrink: 0,
                marginTop: '2px'
              }} />
              <p style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#fca5a5',
                margin: 0
              }}>
                {error || localError || persistedError}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
            {/* Email Field */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#cbd5e1',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.5rem'
              }}>
                Email
              </label>
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Mail style={{
                  position: 'absolute',
                  left: '12px',
                  width: '18px',
                  height: '18px',
                  color: '#64748b',
                  pointerEvents: 'none'
                }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@test.com"
                  disabled={loading}
                  style={{
                    width: '100%',
                    paddingLeft: '40px',
                    paddingRight: '12px',
                    paddingTop: '10px',
                    paddingBottom: '10px',
                    background: 'rgba(71, 85, 105, 0.4)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                    e.currentTarget.style.background = 'rgba(71, 85, 105, 0.6)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)'
                    e.currentTarget.style.background = 'rgba(71, 85, 105, 0.4)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#cbd5e1',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.5rem'
              }}>
                Password
              </label>
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Lock style={{
                  position: 'absolute',
                  left: '12px',
                  width: '18px',
                  height: '18px',
                  color: '#64748b',
                  pointerEvents: 'none'
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  style={{
                    width: '100%',
                    paddingLeft: '40px',
                    paddingRight: '40px',
                    paddingTop: '10px',
                    paddingBottom: '10px',
                    background: 'rgba(71, 85, 105, 0.4)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                    e.currentTarget.style.background = 'rgba(71, 85, 105, 0.6)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)'
                    e.currentTarget.style.background = 'rgba(71, 85, 105, 0.4)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#cbd5e1')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px 16px',
                background: loading 
                  ? 'linear-gradient(135deg, #475569 0%, #334155 100%)' 
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: loading 
                  ? 'none'
                  : '0 10px 25px rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                opacity: loading ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 15px 35px rgba(59, 130, 246, 0.4)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.3)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}
            >
              {loading ? (
                <>
                  <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo Section */}
          <div style={{
            borderTop: '1px solid rgba(148, 163, 184, 0.1)',
            paddingTop: '1.5rem'
          }}>
            <p style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.75px',
              marginBottom: '0.75rem',
              margin: '0 0 0.75rem'
            }}>
              Demo Credentials
            </p>
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  fontWeight: 500,
                  margin: '0 0 0.25rem'
                }}>
                  Email
                </p>
                <code style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#93c5fd',
                  fontFamily: 'Menlo, Monaco, Courier New, monospace',
                  background: 'transparent',
                  wordBreak: 'break-all'
                }}>
                  admin@test.com
                </code>
              </div>
              <div>
                <p style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  fontWeight: 500,
                  margin: '0 0 0.25rem'
                }}>
                  Password
                </p>
                <code style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#93c5fd',
                  fontFamily: 'Menlo, Monaco, Courier New, monospace',
                  background: 'transparent'
                }}>
                  NewPassword123!
                </code>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '9px 12px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#93c5fd',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
                }
              }}
            >
              Auto-fill Credentials
            </button>
          </div>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#64748b',
          marginTop: '1.5rem',
          fontWeight: 500,
          margin: '1.5rem 0 0'
        }}>
          © 2026 BIA • Business Intelligence & Analysis
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default LoginPage
