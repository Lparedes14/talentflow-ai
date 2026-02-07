// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(date))
}

export function formatRelativeDate(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diffInDays = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffInDays === 0) return 'Today'
  if (diffInDays === 1) return 'Yesterday'
  if (diffInDays < 7) return `${diffInDays} days ago`
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
  return formatDate(date)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getMatchScoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-600'
  if (score >= 70) return 'text-blue-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-gray-600'
}

export function getMatchScoreBg(score: number): string {
  if (score >= 85) return 'bg-emerald-100'
  if (score >= 70) return 'bg-blue-100'
  if (score >= 50) return 'bg-amber-100'
  return 'bg-gray-100'
}

export function getStatusColor(status: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    applied: { bg: 'bg-gray-100', text: 'text-gray-700' },
    under_review: { bg: 'bg-blue-100', text: 'text-blue-700' },
    interview: { bg: 'bg-purple-100', text: 'text-purple-700' },
    offer: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700' },
    withdrawn: { bg: 'bg-gray-100', text: 'text-gray-500' },
    completed: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700' },
    not_started: { bg: 'bg-gray-100', text: 'text-gray-600' },
    open: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    closed: { bg: 'bg-gray-100', text: 'text-gray-500' },
    draft: { bg: 'bg-amber-100', text: 'text-amber-700' },
  }
  
  return colors[status] || { bg: 'bg-gray-100', text: 'text-gray-700' }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

export function calculateProfileStrength(profile: {
  resume_url?: string | null
  video_url?: string | null
  skills_count: number
  certifications_count: number
}): number {
  let strength = 0
  
  if (profile.resume_url) strength += 20
  if (profile.video_url) strength += 15
  strength += Math.min(profile.skills_count * 5, 40)
  strength += Math.min(profile.certifications_count * 5, 25)
  
  return Math.min(strength, 100)
}

