// ============================================
// src/components/jobs/JobFilters.tsx
// ============================================

'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface JobFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  activeFilter: 'all' | 'best' | 'career'
  onFilterChange: (filter: 'all' | 'best' | 'career') => void
  counts: {
    all: number
    best: number
    career: number
  }
}

export function JobFilters({ 
  searchQuery, 
  onSearchChange, 
  activeFilter, 
  onFilterChange,
  counts 
}: JobFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button 
          variant={activeFilter === 'all' ? 'default' : 'outline'}
          onClick={() => onFilterChange('all')}
        >
          All Matches ({counts.all})
        </Button>
        <Button 
          variant={activeFilter === 'best' ? 'default' : 'outline'}
          onClick={() => onFilterChange('best')}
        >
          Best Matches ({counts.best})
        </Button>
        <Button 
          variant={activeFilter === 'career' ? 'default' : 'outline'}
          onClick={() => onFilterChange('career')}
        >
          Career Switch ({counts.career})
        </Button>
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Search all company positions by title, department, or location..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-12 h-12"
        />
      </div>
    </div>
  )
}