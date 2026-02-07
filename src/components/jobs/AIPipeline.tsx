// ============================================
// src/components/jobs/AIPipeline.tsx
// ============================================

'use client'

import { Sparkles, CheckCircle2 } from 'lucide-react'

const stages = [
  { 
    stage: 1, 
    title: 'Matching', 
    desc: 'LLM analyzes skills, experience, and interests to generate role candidates' 
  },
  { 
    stage: 2, 
    title: 'Fairness Audit', 
    desc: 'Demographic bias checks and statistical fairness tests applied' 
  },
  { 
    stage: 3, 
    title: 'Explainability', 
    desc: 'Human-readable reasoning generated with matching factors and gaps' 
  },
  { 
    stage: 4, 
    title: 'Privacy Output', 
    desc: 'De-identified results with role-based access controls enforced' 
  },
]

export function AIPipeline() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">AI Recommendation Pipeline</h3>
        </div>
        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full">
          All Stages Complete
        </span>
      </div>
      
      <p className="text-gray-500 text-sm mb-6">
        Every recommendation goes through our 4-stage ethical AI decision pipeline to ensure 
        fair, transparent, and privacy-preserving results
      </p>
      
      <div className="grid grid-cols-4 gap-4">
        {stages.map((item) => (
          <div 
            key={item.stage}
            className="rounded-xl p-4 border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-white"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-600 uppercase">
                Stage {item.stage}
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
            <p className="text-xs text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}