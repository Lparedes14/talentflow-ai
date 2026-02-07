// src/app/(auth)/register/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Mail, Lock, Eye, EyeOff, Briefcase } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'candidate' | 'recruiter'>('candidate')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          }
        }
      })

      if (authError) {
        throw new Error(authError.message)
      }

      if (data.user) {
        setSuccess(true)
        // Redirigir después de 2 segundos
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #ecfdf5, #f0fdfa, #ecfeff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ width: '64px', height: '64px', background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg style={{ width: '32px', height: '32px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Account Created!</h2>
          <p style={{ color: '#6b7280' }}>Please check your email to verify your account. Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #ecfdf5, #f0fdfa, #ecfeff)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '24px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(to bottom right, #10b981, #0d9488)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* Register Card */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', paddingBottom: '48px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)', padding: '40px' }}>
            {/* Icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ width: '64px', height: '64px', background: 'linear-gradient(to bottom right, #10b981, #0d9488)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User style={{ width: '32px', height: '32px', color: 'white' }} />
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>Create your account</h2>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Join InsideTrack to find your next opportunity</p>
            </div>

            {/* Error */}
            {error && (
              <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Role Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>I am a...</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setRole('candidate')}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: role === 'candidate' ? '2px solid #10b981' : '2px solid #e5e7eb',
                      backgroundColor: role === 'candidate' ? '#ecfdf5' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <User style={{ width: '24px', height: '24px', color: role === 'candidate' ? '#10b981' : '#9ca3af', margin: '0 auto 8px' }} />
                    <div style={{ fontWeight: '600', color: role === 'candidate' ? '#10b981' : '#374151' }}>Candidate</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Looking for opportunities</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('recruiter')}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: role === 'recruiter' ? '2px solid #10b981' : '2px solid #e5e7eb',
                      backgroundColor: role === 'recruiter' ? '#ecfdf5' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <Briefcase style={{ width: '24px', height: '24px', color: role === 'recruiter' ? '#10b981' : '#9ca3af', margin: '0 auto 8px' }} />
                    <div style={{ fontWeight: '600', color: role === 'recruiter' ? '#10b981' : '#374151' }}>HR / Recruiter</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Hiring talent</div>
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <User style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#9ca3af', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  style={{ width: '100%', height: '56px', paddingLeft: '48px', paddingRight: '16px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '12px', fontSize: '16px', color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

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
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <Lock style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#9ca3af', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (min. 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
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

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                style={{ width: '100%', height: '56px', backgroundColor: '#1f2937', color: 'white', fontWeight: '600', fontSize: '16px', borderRadius: '12px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1 }}
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            {/* Login Link */}
            <p style={{ textAlign: 'center', marginTop: '32px', color: '#6b7280', fontSize: '14px' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#10b981', fontWeight: '600', textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}