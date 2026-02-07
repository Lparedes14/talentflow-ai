// ============================================
// src/lib/ai/job-matcher.ts
// AI-powered job matching with explanations (OpenAI version)
// ============================================

import { getOpenAIClient } from './openai'
import { JobMatchingResult, JobMatchResult } from '@/types'

interface UserProfile {
  skills: string[]
  experience_years: number
  current_role: string
  department: string
  career_interests: string[]
}

interface JobData {
  id: string
  title: string
  description: string
  department: string
  required_skills: string[]
  nice_to_have_skills: string[]
}

const JOB_MATCHING_PROMPT = `You are an expert internal mobility specialist. Your job is to match employees to internal job opportunities based on their skills, experience, and career interests.

For each job, calculate a match score (0-100) based on:
- Skill overlap (60% weight): How many required skills does the candidate have?
- Career fit (25% weight): Does this align with their stated interests?
- Growth potential (15% weight): Is this a reasonable career progression?

Classify each match as:
- "best_match": Score >= 80 AND natural career progression
- "career_switch": Score >= 60 AND different career direction
- "stretch": Score >= 50 AND requires significant upskilling

For each match, provide:
1. A personalized insight (why this is a good fit)
2. An explanation of the match factors
3. List of matched and missing skills

IMPORTANT: Be fair and unbiased. Do not make assumptions based on names, demographics, or other non-skill factors.

Respond ONLY in JSON format (no markdown, no code blocks):
{
  "matches": [
    {
      "job_id": "uuid",
      "score": 85,
      "match_type": "best_match",
      "matched_skills": ["skill1", "skill2"],
      "missing_skills": ["skill3"],
      "explanation": "Your technical troubleshooting experience directly translates to this role...",
      "insight": "3 team members came from your current team"
    }
  ],
  "explanation": "Overall analysis of candidate's fit..."
}`

export async function matchJobsForProfile(
  profile: UserProfile,
  jobs: JobData[]
): Promise<JobMatchingResult> {
  const client = getOpenAIClient()
  
  const profileSummary = `
CANDIDATE PROFILE:
- Current Role: ${profile.current_role}
- Department: ${profile.department}
- Years of Experience: ${profile.experience_years}
- Skills: ${profile.skills.join(', ')}
- Career Interests: ${profile.career_interests.join(', ')}
`

  const jobsSummary = jobs.map(job => `
JOB: ${job.title} (ID: ${job.id})
- Department: ${job.department}
- Description: ${job.description}
- Required Skills: ${job.required_skills.join(', ')}
- Nice to Have: ${job.nice_to_have_skills.join(', ')}
`).join('\n---\n')

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: JOB_MATCHING_PROMPT
      },
      {
        role: 'user',
        content: `${profileSummary}\n\n--- AVAILABLE JOBS ---\n${jobsSummary}`
      }
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: "json_object" }
  })

  const responseText = response.choices[0]?.message?.content || ''
  
  try {
    const result = JSON.parse(responseText)
    
    return {
      matches: result.matches.map((m: any) => ({
        job_id: m.job_id,
        score: m.score,
        match_type: m.match_type,
        matched_skills: m.matched_skills || [],
        missing_skills: m.missing_skills || [],
        explanation: m.explanation || '',
        insight: m.insight || ''
      })),
      explanation: result.explanation || ''
    }
  } catch (error) {
    console.error('Error parsing job matching response:', error)
    return {
      matches: [],
      explanation: 'Error processing job matches'
    }
  }
}

// Fairness check for job matches
export async function checkMatchFairness(
  matches: JobMatchResult[],
  demographicData?: Record<string, any>
): Promise<{
  passed: boolean
  issues: string[]
  recommendations: string[]
}> {
  const issues: string[] = []
  const recommendations: string[] = []
  
  // Check for score distribution anomalies
  const scores = matches.map(m => m.score)
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
  
  if (avgScore < 50) {
    issues.push('Average match score is unusually low')
    recommendations.push('Review skill extraction accuracy')
  }
  
  // Check for match type distribution
  const bestMatches = matches.filter(m => m.match_type === 'best_match').length
  const careerSwitches = matches.filter(m => m.match_type === 'career_switch').length
  
  if (bestMatches === 0 && careerSwitches > 0) {
    recommendations.push('Consider expanding skill taxonomy to improve best match detection')
  }
  
  return {
    passed: issues.length === 0,
    issues,
    recommendations
  }
}