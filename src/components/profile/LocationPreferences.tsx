// ============================================
// src/components/profile/LocationPreferences.tsx
// ============================================

'use client'

import { MapPin, Globe, Edit3 } from 'lucide-react'
import { WorkMode } from '@/types'
import { Button } from '@/components/ui/button'

interface LocationPreferencesProps {
  workModes: WorkMode[]
  openToRelocation: boolean
  wishlistLocations: string[]
  onEdit?: () => void
}

export function LocationPreferences({ 
  workModes, 
  openToRelocation, 
  wishlistLocations,
  onEdit 
}: LocationPreferencesProps) {
  const workModeLabels: Record<WorkMode, string> = {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'On-site'
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Location Preferences</h3>
      </div>
      
      {/* Work Modes */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Preferred Work Modes</p>
        <div className="flex gap-2">
          {workModes.map((mode) => (
            <span 
              key={mode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200"
            >
              <Globe className="w-3.5 h-3.5" />
              {workModeLabels[mode]}
            </span>
          ))}
        </div>
      </div>
      
      {/* Open to Relocation */}
      {openToRelocation && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg mb-4">
          <MapPin className="w-4 h-4 text-gray-500" />
          <div>
            <span className="font-medium text-gray-900">Open to Relocation</span>
            <p className="text-xs text-gray-500">Willing to relocate for the right opportunity</p>
          </div>
        </div>
      )}
      
      {/* Wishlist Locations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-gray-900">Wishlist Locations</span>
          </div>
          <Button variant="link" size="sm" onClick={onEdit}>
            <Edit3 className="w-4 h-4" />
            Edit
          </Button>
        </div>
        <p className="text-gray-500 text-sm mb-3">
          Your preferred locations for internal opportunities.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {wishlistLocations.map((location, idx) => (
            <div 
              key={idx}
              className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <MapPin className={`w-4 h-4 ${idx % 2 === 0 ? 'text-blue-500' : 'text-emerald-500'}`} />
              <span className="text-gray-700 font-medium">{location}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}