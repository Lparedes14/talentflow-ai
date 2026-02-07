// ============================================
// src/components/layout/Header.tsx
// ============================================

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  User, Users, ChevronDown, Check, LogOut, Settings, Bell 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Profile {
  id: string
  full_name: string
  job_title?: string
  avatar_url?: string
}

interface HeaderProps {
  currentProfile?: Profile
  viewMode: 'applicant' | 'hr'
  onViewModeChange: (mode: 'applicant' | 'hr') => void
}

export function Header({ currentProfile, viewMode, onViewModeChange }: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    // TODO: Implement logout with Supabase
    router.push('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 6 L20 6" strokeLinecap="round" />
                <path d="M4 18 L20 18" strokeLinecap="round" />
                <path d="M7 6 L7 18" strokeLinecap="round" />
                <path d="M12 6 L12 18" strokeLinecap="round" />
                <path d="M17 6 L17 18" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg">InsideTrack</h1>
              <p className="text-xs text-gray-500">Your Internal Career Path</p>
            </div>
          </Link>
          
          {/* View Mode Toggle + Profile */}
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onViewModeChange('applicant')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                  viewMode === 'applicant' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <User className="w-4 h-4" />
                Applicant
              </button>
              <button
                onClick={() => onViewModeChange('hr')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                  viewMode === 'hr' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Users className="w-4 h-4" />
                HR
              </button>
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
            
            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {currentProfile?.avatar_url ? (
                  <img 
                    src={currentProfile.avatar_url} 
                    alt={currentProfile.full_name}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-emerald-600" />
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-semibold text-gray-900">
                    {currentProfile?.full_name || 'User'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentProfile?.job_title || 'Employee'}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              
              {showDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowDropdown(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowDropdown(false)}
                    >
                      <User className="w-4 h-4" />
                      My Profile
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowDropdown(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <hr className="my-2 border-gray-100" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}