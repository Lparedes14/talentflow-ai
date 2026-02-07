'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Users, Briefcase, LayoutDashboard } from 'lucide-react'

export default function HRLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const navItems = [
    { href: '/hr/applicants', label: 'Applicants', icon: Users },
    { href: '/hr/positions', label: 'Positions', icon: Briefcase },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* HR Navigation */}
      <div style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        padding: '0 32px'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '32px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '16px 0',
            borderRight: '1px solid #e5e7eb',
            paddingRight: '32px'
          }}>
            <LayoutDashboard style={{ width: '20px', height: '20px', color: '#4f46e5' }} />
            <span style={{ fontWeight: '600', color: '#111827' }}>HR Dashboard</span>
          </div>
          
          <nav style={{ display: 'flex', gap: '8px' }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    textDecoration: 'none',
                    backgroundColor: isActive ? '#eef2ff' : 'transparent',
                    color: isActive ? '#4f46e5' : '#6b7280',
                    transition: 'all 0.2s'
                  }}
                >
                  <Icon style={{ width: '18px', height: '18px' }} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  )
}