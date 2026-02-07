// ============================================
// src/components/profile/ProfileHeader.tsx
// ============================================

'use client'

import { ProfileWithRelations } from '@/types'

interface ProfileHeaderProps {
  profile: ProfileWithRelations
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-start gap-6">
        {profile.avatar_url ? (
          <img 
            src={profile.avatar_url} 
            alt={profile.full_name}
            className="w-24 h-24 rounded-2xl object-cover ring-4 ring-gray-100"
          />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-2xl font-bold">
            {profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
        )}
        
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{profile.full_name}</h2>
          <p className="text-gray-600 font-medium">{profile.job_title}</p>
          <p className="text-gray-500 text-sm">
            {profile.department} • {profile.years_in_role} years in role
          </p>
          
          <div className="flex gap-6 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {profile.skills?.length || 0}
              </div>
              <div className="text-xs text-gray-500">Skills</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                8 {/* This would come from job matches count */}
              </div>
              <div className="text-xs text-gray-500">Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {profile.profile_strength}%
              </div>
              <div className="text-xs text-gray-500">Profile Strength</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
