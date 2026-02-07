// ============================================
// src/components/layout/Navigation.tsx
// ============================================

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Briefcase, GraduationCap, Users, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavigationProps {
  viewMode: 'applicant' | 'hr'
}

export function Navigation({ viewMode }: NavigationProps) {
  const pathname = usePathname()

  const applicantTabs = [
    { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
    { id: 'jobs', label: 'Job Matches', icon: Briefcase, href: '/jobs' },
    { id: 'skills', label: 'Skills Development', icon: GraduationCap, href: '/skills' },
  ]
  
  const hrTabs = [
    { id: 'applicants', label: 'All Applicants', icon: Users, href: '/hr/applicants' },
    { id: 'positions', label: 'Open Positions', icon: Building2, href: '/hr/positions' },
  ]
  
  const tabs = viewMode === 'hr' ? hrTabs : applicantTabs

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
            
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm transition-colors",
                  isActive
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                )}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}