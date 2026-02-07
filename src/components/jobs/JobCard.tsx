// ============================================
// src/components/jobs/JobCard.tsx
// ============================================

'use client'

import { Building2, MapPin, Zap, Check, X, ArrowRight } from 'lucide-react'
import { JobMatchWithDetails } from '@/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn, getMatchScoreColor } from '@/lib/utils'

interface JobCardProps {
  match: JobMatchWithDetails
  onClick?: () => void
}

export function JobCard({ match, onClick }: JobCardProps) {
  const { job, match_score, match_type, insight, skills_matched, skills_total, matched_skills, missing_skills } = match
  
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "px-2 py-0.5 text-xs font-semibold rounded",
              match_type === 'best_match' 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-purple-100 text-purple-700'
            )}>
              {match_type === 'best_match' ? 'Best Match' : 'Career Switch'}
            </span>
          </div>
          <h3 className="font-bold text-gray-900 text-lg">{job.title}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Building2 className="w-4 h-4" />
            {job.team || job.department}
            <MapPin className="w-4 h-4 ml-2" />
            {job.location}
          </div>
        </div>
        <div className="text-right">
          <div className={cn("text-3xl font-bold", getMatchScoreColor(match_score))}>
            {match_score}%
          </div>
          <div className="text-xs text-gray-500">Match</div>
        </div>
      </div>
      
      {/* Insight */}
      {insight && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <Zap className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">{insight}</p>
        </div>
      )}
      
      <p className="text-gray-600 text-sm mb-4">{job.description}</p>
      
      {/* Skills Match */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">Skills Match</span>
          <span className="font-medium text-gray-900">
            {skills_matched}/{skills_total} required skills
          </span>
        </div>
        <Progress 
          value={skills_matched} 
          max={skills_total} 
          className="h-2"
        />
      </div>
      
      {/* Skills Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {matched_skills.slice(0, 3).map((skill, idx) => (
          <span 
            key={idx}
            className="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 bg-emerald-100 text-emerald-700"
          >
            <Check className="w-3 h-3" />
            {skill.name}
          </span>
        ))}
        {missing_skills.slice(0, 2).map((skill, idx) => (
          <span 
            key={idx}
            className="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 bg-gray-100 text-gray-500"
          >
            <X className="w-3 h-3" />
            {skill.name}
          </span>
        ))}
        {(matched_skills.length + missing_skills.length) > 5 && (
          <span className="px-2 py-1 text-xs text-gray-500">
            +{matched_skills.length + missing_skills.length - 5} more
          </span>
        )}
      </div>
      
      <Button 
        variant="secondary" 
        className="w-full" 
        onClick={onClick}
      >
        View Details
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  )
}
