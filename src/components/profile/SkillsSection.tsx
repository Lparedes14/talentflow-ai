// ============================================
// src/components/profile/SkillsSection.tsx
// ============================================

'use client'

import { CheckCircle2 } from 'lucide-react'
import { UserSkill } from '@/types'
import { cn } from '@/lib/utils'

interface SkillsSectionProps {
  skills: UserSkill[]
}

export function SkillsSection({ skills }: SkillsSectionProps) {
  // Group skills by category
  const groupedSkills = skills.reduce((acc, skill) => {
    const category = skill.skill?.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(skill)
    return acc
  }, {} as Record<string, UserSkill[]>)

  const categoryLabels: Record<string, string> = {
    technical: 'Technical',
    soft: 'Soft Skills',
    process: 'Process',
    domain: 'Domain',
    other: 'Other'
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-2">Extracted Skills</h3>
      <p className="text-gray-500 text-sm mb-6">
        These skills were automatically identified from your recording and resume. 
        Verified skills have been confirmed through assessments.
      </p>
      
      {Object.entries(groupedSkills).map(([category, categorySkills]) => (
        <div key={category} className="mb-6 last:mb-0">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            {categoryLabels[category] || category}
          </h4>
          <div className="flex flex-wrap gap-2">
            {categorySkills.map((skill) => (
              <span 
                key={skill.id}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5",
                  skill.verified 
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                    : "bg-gray-100 text-gray-600 border border-gray-200"
                )}
              >
                {skill.verified && <CheckCircle2 className="w-3.5 h-3.5" />}
                {skill.skill?.name || 'Unknown Skill'}
              </span>
            ))}
          </div>
        </div>
      ))}
      
      {skills.length === 0 && (
        <p className="text-gray-500 text-center py-8">
          No skills extracted yet. Upload a resume or video to get started.
        </p>
      )}
    </div>
  )
}