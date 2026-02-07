// ============================================
// src/lib/ai/plan-generator.ts
// AI-powered upskilling plan generator (OpenAI version)
// ============================================

import { getOpenAIClient } from './openai'
import { UpskillingPlanResult, UpskillingPlanData } from '@/types'

interface PlanRequest {
  current_skills: string[]
  target_skills: string[]
  target_job_title: string
  available_hours_per_week: number
  budget_constraint?: number
  available_courses: Array<{
    id: string
    name: string
    provider: string
    duration_hours: number
    skills_taught: string[]
    cost: number
  }>
  available_assessments: Array<{
    id: string
    name: string
    skill: string
    duration_minutes: number
  }>
}

const PLAN_GENERATION_PROMPT = `You are an expert learning & development specialist. Create a personalized upskilling plan to help an employee transition to a new role.

Consider:
1. Current skill gaps (what they need to learn)
2. Logical learning sequence (prerequisites first)
3. Time constraints (available hours per week)
4. Budget constraints (if provided)
5. Mix of courses and assessments for verification

The plan should be:
- Practical and achievable
- Sequenced in phases (foundation → intermediate → advanced)
- Include estimated completion times
- Balance theoretical learning with practical verification

Respond ONLY in JSON format (no markdown, no code blocks):
{
  "plan": {
    "phases": [
      {
        "name": "Foundation Skills",
        "duration_weeks": 4,
        "items": [
          {
            "type": "course",
            "id": "course-uuid",
            "name": "Course Name",
            "provider": "Provider",
            "duration": "8 hours",
            "skill_target": "Skill being developed"
          },
          {
            "type": "assessment",
            "id": "assessment-uuid",
            "name": "Assessment Name",
            "duration": "30 mins",
            "skill_target": "Skill being verified"
          }
        ]
      }
    ],
    "total_courses": 4,
    "total_assessments": 3
  },
  "estimated_weeks": 12,
  "estimated_cost": 299.00,
  "explanation": "This plan focuses on..."
}`

export async function generateUpskillingPlan(
  request: PlanRequest
): Promise<UpskillingPlanResult> {
  const client = getOpenAIClient()
  
  const skillGaps = request.target_skills.filter(
    skill => !request.current_skills.includes(skill)
  )
  
  const requestSummary = `
UPSKILLING REQUEST:
- Target Role: ${request.target_job_title}
- Current Skills: ${request.current_skills.join(', ')}
- Skills to Acquire: ${skillGaps.join(', ')}
- Available Time: ${request.available_hours_per_week} hours/week
${request.budget_constraint ? `- Budget: $${request.budget_constraint}` : ''}

AVAILABLE COURSES:
${request.available_courses.map(c => 
  `- ${c.name} (${c.provider}): ${c.duration_hours}h, $${c.cost}, teaches: ${c.skills_taught.join(', ')}`
).join('\n')}

AVAILABLE ASSESSMENTS:
${request.available_assessments.map(a => 
  `- ${a.name}: ${a.duration_minutes} mins, verifies: ${a.skill}`
).join('\n')}
`

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: PLAN_GENERATION_PROMPT
      },
      {
        role: 'user',
        content: requestSummary
      }
    ],
    temperature: 0.3,
    max_tokens: 3000,
    response_format: { type: "json_object" }
  })

  const responseText = response.choices[0]?.message?.content || ''
  
  try {
    const result = JSON.parse(responseText)
    
    return {
      plan: result.plan as UpskillingPlanData,
      estimated_weeks: result.estimated_weeks || 12,
      estimated_cost: result.estimated_cost || 0,
      explanation: result.explanation || ''
    }
  } catch (error) {
    console.error('Error parsing plan generation response:', error)
    
    // Return a basic fallback plan
    return {
      plan: {
        phases: [{
          name: 'Skill Development',
          duration_weeks: 8,
          items: request.available_courses.slice(0, 3).map(c => ({
            type: 'course' as const,
            id: c.id,
            name: c.name,
            provider: c.provider,
            duration: `${c.duration_hours} hours`,
            skill_target: c.skills_taught[0] || ''
          }))
        }],
        total_courses: 3,
        total_assessments: 0
      },
      estimated_weeks: 8,
      estimated_cost: 0,
      explanation: 'Basic learning plan generated. Consider consulting with a mentor for personalized guidance.'
    }
  }
}

// Calculate plan metrics
export function calculatePlanMetrics(plan: UpskillingPlanData): {
  total_hours: number
  phases_count: number
  courses_count: number
  assessments_count: number
} {
  let total_hours = 0
  let courses_count = 0
  let assessments_count = 0
  
  for (const phase of plan.phases) {
    for (const item of phase.items) {
      if (item.type === 'course') {
        const hours = parseInt(item.duration || '0')
        total_hours += isNaN(hours) ? 0 : hours
        courses_count++
      } else if (item.type === 'assessment') {
        const mins = parseInt(item.duration || '0')
        total_hours += isNaN(mins) ? 0 : mins / 60
        assessments_count++
      }
    }
  }
  
  return {
    total_hours: Math.round(total_hours),
    phases_count: plan.phases.length,
    courses_count,
    assessments_count
  }
}