// src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        throw new Error(authError.message)
      }

      if (data.user) {
        // Obtener el rol del usuario
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        // Redirigir según el rol
        if (profile?.role === 'hr_admin' || profile?.role === 'recruiter') {
          router.push('/hr/applicants')
        } else {
          router.push('/profile')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #ecfdf5, #f0fdfa, #ecfeff)', display: 'flex', flexDirection: 'column' }}>
      {/* Header con Logo */}
      <header style={{ padding: '24px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            background: 'linear-gradient(to bottom right, #10b981, #0d9488)', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2)'
          }}>
            <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', color: 'white' }} fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6 L20 6" strokeLinecap="round" />
              <path d="M4 18 L20 18" strokeLinecap="round" />
              <path d="M7 6 L7 18" strokeLinecap="round" />
              <path d="M12 6 L12 18" strokeLinecap="round" />
              <path d="M17 6 L17 18" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontWeight: 'bold', color: '#111827', margin: 0, fontSize: '16px' }}>InsideTrack</h1>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Your Internal Career Path</p>
          </div>
        </Link>
      </header>

      {/* Login Card */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', paddingBottom: '48px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)', padding: '40px' }}>
            {/* Icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ width: '64px', height: '64px', background: 'linear-gradient(to bottom right, #10b981, #0d9488)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}>
                <Mail style={{ width: '32px', height: '32px', color: 'white' }} />
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>Sign in with email</h2>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Enter your credentials to access your account</p>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <Mail style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#9ca3af', pointerEvents: 'none' }} />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', height: '56px', paddingLeft: '48px', paddingRight: '16px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '12px', fontSize: '16px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Password */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <Lock style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#9ca3af', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', height: '56px', paddingLeft: '48px', paddingRight: '48px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '12px', fontSize: '16px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {showPassword ? <EyeOff style={{ width: '20px', height: '20px', color: '#9ca3af' }} /> : <Eye style={{ width: '20px', height: '20px', color: '#9ca3af' }} />}
                </button>
              </div>

              {/* Forgot Password */}
              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <Link href="/forgot-password" style={{ color: '#10b981', fontSize: '14px', fontWeight: '500', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                style={{ width: '100%', height: '56px', backgroundColor: '#1f2937', color: 'white', fontWeight: '600', fontSize: '16px', borderRadius: '12px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1 }}
              >
                {isLoading ? 'Signing in...' : 'Get Started'}
              </button>
            </form>

            {/* Sign Up Link */}
            <p style={{ textAlign: 'center', marginTop: '32px', color: '#6b7280', fontSize: '14px' }}>
              Don't have an account?{' '}
              <Link href="/register" style={{ color: '#10b981', fontWeight: '600', textDecoration: 'none' }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}