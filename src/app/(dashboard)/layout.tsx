'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, Briefcase, GraduationCap, LogOut, Menu, X, ChevronDown, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  job_title: string | null
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'applicant' | 'hr'>('applicant')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, job_title')
      .eq('id', user.id)
      .single()

    if (data) setProfile(data)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Job Matches', href: '/jobs', icon: Briefcase },
    { label: 'Skills Development', href: '/learning', icon: GraduationCap },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px' }}>
          {/* Top Row - Logo, Toggle, User */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img 
                src="/logo.png" 
                alt="TalentFlow" 
                style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
              />
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0 }}>
                  TalentFlow
                </h1>
                <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                  Mapping the Future of Work
                </p>
              </div>
            </div>

            {/* Right Side - Toggle & User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              {/* Applicant/HR Toggle */}
              <div style={{ 
                display: 'flex', 
                backgroundColor: '#f3f4f6', 
                borderRadius: '8px', 
                padding: '4px',
                border: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={() => setViewMode('applicant')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: viewMode === 'applicant' ? 'white' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: viewMode === 'applicant' ? '#111827' : '#6b7280',
                    cursor: 'pointer',
                    boxShadow: viewMode === 'applicant' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  <User style={{ width: '16px', height: '16px' }} />
                  Applicant
                </button>
                <button
                  onClick={() => setViewMode('hr')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: viewMode === 'hr' ? 'white' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: viewMode === 'hr' ? '#111827' : '#6b7280',
                    cursor: 'pointer',
                    boxShadow: viewMode === 'hr' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  <Users style={{ width: '16px', height: '16px' }} />
                  HR
                </button>
              </div>

              {/* User Menu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '6px 12px 6px 6px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: profile?.avatar_url ? 'transparent' : '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '600',
                    overflow: 'hidden'
                  }}>
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      profile?.full_name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                      {profile?.full_name || 'User'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {profile?.job_title || 'Employee'}
                    </div>
                  </div>
                  <ChevronDown style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
                </button>

                {showUserMenu && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: '8px',
                    width: '220px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden',
                    zIndex: 100
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {profile?.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {profile?.email}
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#dc2626',
                        fontSize: '14px',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <LogOut style={{ width: '16px', height: '16px' }} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="mobile-menu-btn"
                style={{
                  display: 'none',
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {mobileMenuOpen ? (
                  <X style={{ width: '24px', height: '24px', color: '#374151' }} />
                ) : (
                  <Menu style={{ width: '24px', height: '24px', color: '#374151' }} />
                )}
              </button>
            </div>
          </div>

          {/* Navigation Row */}
          <nav style={{ 
            display: 'flex', 
            justifyContent: 'center',
            gap: '8px',
            paddingBottom: '0'
          }} className="desktop-nav">
            {navItems.map(item => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    backgroundColor: 'transparent',
                    color: isActive ? '#2563eb' : '#6b7280',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    marginBottom: '-1px'
                  }}
                >
                  <Icon style={{ width: '18px', height: '18px' }} />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div style={{ 
            borderTop: '1px solid #e5e7eb', 
            padding: '16px',
            backgroundColor: 'white'
          }} className="mobile-nav">
            {navItems.map(item => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href)
                    setMobileMenuOpen(false)
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    backgroundColor: isActive ? '#eff6ff' : 'transparent',
                    color: isActive ? '#2563eb' : '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    marginBottom: '4px'
                  }}
                >
                  <Icon style={{ width: '20px', height: '20px' }} />
                  {item.label}
                </button>
              )
            })}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ 
        backgroundColor: 'white', 
        borderTop: '1px solid #e5e7eb',
        marginTop: '48px',
        padding: '32px 24px'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Privacy & Ethics Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
            border: '1px solid #a7f3d0',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#10b981',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: '600', color: '#111827' }}>Privacy & AI Ethics Protected</span>
                <span style={{ padding: '2px 8px', backgroundColor: '#10b981', color: 'white', fontSize: '11px', borderRadius: '9999px', fontWeight: '500' }}>SOC 2</span>
                <span style={{ padding: '2px 8px', backgroundColor: '#2563eb', color: 'white', fontSize: '11px', borderRadius: '9999px', fontWeight: '500' }}>GDPR</span>
              </div>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                Your career data is encrypted and protected. Our AI recommendations undergo bias detection and fairness audits.
              </p>
            </div>
          </div>

          {/* Footer Content */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <img src="/logo.png" alt="TalentFlow" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
              <span style={{ fontWeight: '600', color: '#111827' }}>TalentFlow</span>
            </div>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>
              Empowering organizations with AI-driven internal mobility
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
              © 2026 TalentFlow. Mapping the Future of Work.
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
        }
      `}</style>
    </div>
  )
}