// ============================================
// src/components/auth/LoginCard.tsx
// ============================================

'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginCard() {
  const supabase = createClient()
  const emailId = useId()
  const passwordId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const emailIsValid = useMemo(() => {
    if (!email) return true
    return EMAIL_REGEX.test(email)
  }, [email])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!emailIsValid) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    window.location.href = '/profile'
  }

  return (
    <Card className="w-full max-w-[26.5rem] rounded-3xl border-white/70 bg-white/70 shadow-2xl shadow-sky-200/70 backdrop-blur-xl">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/90 shadow-lg shadow-sky-200/70">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-900" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 12h8M12 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl">Sign in with email</CardTitle>
          <CardDescription>
            Securely access your internal career profile and opportunities.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={emailId} className="sr-only">
              Email
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16v12H4z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <Input
                id={emailId}
                type="email"
                autoComplete="email"
                placeholder="Email"
                className="pl-10"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={!emailIsValid}
                required
              />
            </div>
            {!emailIsValid && (
              <p className="mt-1 text-xs text-red-600">Please enter a valid email.</p>
            )}
          </div>

          <div>
            <label htmlFor={passwordId} className="sr-only">
              Password
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <Input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                className="pl-10 pr-12"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 transition hover:text-gray-600"
              >
                {showPassword ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l18 18" strokeLinecap="round" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" strokeLinecap="round" />
                    <path d="M7.1 7.1C5.5 8.4 4.1 10 3 12c2.1 3.8 5.9 6 9 6 1.2 0 2.4-.2 3.5-.7" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <div className="mt-2 text-right">
              <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-gray-700">
                Forgot password?
              </Link>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/25 hover:from-gray-800 hover:to-gray-700"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Get Started'}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          <span>Or sign in with</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            aria-label="Sign in with Google"
            className="flex items-center justify-center rounded-xl border border-white/70 bg-white/90 py-2 text-sm text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          >
            <span className="text-base font-semibold">G</span>
          </button>
          <button
            type="button"
            aria-label="Sign in with Facebook"
            className="flex items-center justify-center rounded-xl border border-white/70 bg-white/90 py-2 text-sm text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          >
            f
          </button>
          <button
            type="button"
            aria-label="Sign in with Apple"
            className="flex items-center justify-center rounded-xl border border-white/70 bg-white/90 py-2 text-sm text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.7 13.2c0 2.9 2.5 3.8 2.5 3.8s-1.1 3.3-3.4 3.3c-1.1 0-2-.7-3.1-.7-1.2 0-2.2.7-3.1.7-2.1 0-4.2-3.2-4.2-6.1 0-2.7 1.7-4.1 3.3-4.1 1 0 2 .7 2.6.7.6 0 1.7-.8 2.9-.8.5 0 2.2.1 3.2 1.7-2.5 1.4-2.7 4.1-2.7 4.5ZM12.4 6.5c.7-.8 1.2-2 1-3.2-1 .1-2.2.7-2.9 1.6-.6.7-1.2 1.9-1 3.1 1.1.1 2.2-.5 2.9-1.5Z" />
            </svg>
          </button>
        </div>

        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-teal-600 hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
