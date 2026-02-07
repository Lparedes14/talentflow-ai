import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SkillAnalysis {
  skill_id: string
  skill_name: string
  status: 'verified' | 'unverified' | 'gap'
  source?: string
  relevance_to_interests: string[]
  priority: 'high' | 'medium' | 'low'
}

interface RecommendedAssessment {
  id: string
  skill_id: string
  skill_name: string
  title: string
  description: string
  reason: string
  priority: 'high' | 'medium' | 'low'
  type: 'validate' | 'learn'
  related_interests: string[]
  estimated_time: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // 1. Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user_id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 2. Get user's career interests
    const { data: interests } = await supabase
      .from('career_interests')
      .select('interest')
      .eq('profile_id', user_id)

    const careerInterests = interests?.map(i => i.interest) || []

    // 3. Get user's current skills (verified and unverified)
    const { data: userSkills } = await supabase
      .from('user_skills')
      .select(`
        skill_id,
        verified,
        source,
        confidence_score,
        skills_taxonomy (id, name, category)
      `)
      .eq('profile_id', user_id)

    const verifiedSkills = userSkills?.filter(s => s.verified).map(s => ({
      id: s.skill_id,
      name: (s.skills_taxonomy as any)?.name || '',
      source: s.source
    })) || []

    const unverifiedSkills = userSkills?.filter(s => !s.verified).map(s => ({
      id: s.skill_id,
      name: (s.skills_taxonomy as any)?.name || '',
      source: s.source,
      confidence: s.confidence_score
    })) || []

    // 4. Get all available skills from taxonomy
    const { data: allSkills } = await supabase
      .from('skills_taxonomy')
      .select('id, name, category, description')

    // 5. Find jobs matching career interests to identify skill gaps
    const { data: allJobs } = await supabase
      .from('job_postings')
      .select(`
        id,
        title,
        department,
        job_required_skills (
          skill_id,
          is_required,
          skills_taxonomy (id, name, category)
        )
      `)
      .eq('status', 'open')

    // Match jobs to interests
    const relevantJobs: any[] = []
    if (allJobs && careerInterests.length > 0) {
      for (const job of allJobs) {
        for (const interest of careerInterests) {
          const jobTitle = job.title.toLowerCase()
          const jobDept = job.department?.toLowerCase() || ''
          const interestLower = interest.toLowerCase()
          
          const interestWords: string[] = interestLower.split(' ')
          const matches = interestWords.some((word: string) => 
            word.length > 3 && (jobTitle.includes(word) || jobDept.includes(word))
          )
          
          if (matches || jobTitle.includes(interestLower)) {
            relevantJobs.push({ ...job, matched_interest: interest })
            break
          }
        }
      }
    }

    // Identify skill gaps from relevant jobs
    const userSkillIds = userSkills?.map(s => s.skill_id) || []
    const verifiedSkillIds = verifiedSkills.map(s => s.id)
    
    const skillGaps: { skill_id: string; skill_name: string; from_jobs: string[]; from_interests: string[] }[] = []
    
    for (const job of relevantJobs) {
      const requiredSkills = job.job_required_skills || []
      for (const rs of requiredSkills) {
        if (!verifiedSkillIds.includes(rs.skill_id)) {
          const existing = skillGaps.find(g => g.skill_id === rs.skill_id)
          if (existing) {
            if (!existing.from_jobs.includes(job.title)) existing.from_jobs.push(job.title)
            if (!existing.from_interests.includes(job.matched_interest)) existing.from_interests.push(job.matched_interest)
          } else {
            skillGaps.push({
              skill_id: rs.skill_id,
              skill_name: rs.skills_taxonomy?.name || '',
              from_jobs: [job.title],
              from_interests: [job.matched_interest]
            })
          }
        }
      }
    }

    // 6. Get previously completed assessments
    const { data: completedAssessments } = await supabase
      .from('user_assessments')
      .select('assessment_id, score, completed_at, assessments(skill_id)')
      .eq('profile_id', user_id)
      .eq('status', 'completed')

    const recentlyPassedSkillIds = completedAssessments
      ?.filter(a => (a.score || 0) >= 70)
      ?.map(a => (a.assessments as any)?.skill_id)
      .filter(Boolean) || []

    // 7. Build context for AI
    const aiContext = {
      profile: {
        name: profile.full_name,
        current_role: profile.job_title,
        department: profile.department,
        years_in_role: profile.years_in_role
      },
      career_interests: careerInterests,
      verified_skills: verifiedSkills.map(s => s.name),
      unverified_skills: unverifiedSkills.map(s => ({ name: s.name, source: s.source, confidence: s.confidence })),
      skill_gaps: skillGaps.map(g => ({
        skill: g.skill_name,
        needed_for_jobs: g.from_jobs,
        related_interests: g.from_interests
      })),
      recently_passed_skills: recentlyPassedSkillIds,
      available_skills: allSkills?.map(s => ({ id: s.id, name: s.name, category: s.category })) || []
    }

    // 8. Call AI to recommend assessments
    const aiPrompt = `You are a career development AI assistant. Analyze this employee's profile and recommend personalized skill assessments.

EMPLOYEE PROFILE:
- Name: ${aiContext.profile.name}
- Current Role: ${aiContext.profile.current_role}
- Department: ${aiContext.profile.department}
- Years in Role: ${aiContext.profile.years_in_role}

CAREER INTERESTS (where they want to go):
${careerInterests.length > 0 ? careerInterests.map(i => `- ${i}`).join('\n') : '- None specified'}

VERIFIED SKILLS (already proven):
${verifiedSkills.length > 0 ? verifiedSkills.map(s => `- ${s.name}`).join('\n') : '- None yet'}

UNVERIFIED SKILLS (from resume/video, need validation):
${unverifiedSkills.length > 0 ? unverifiedSkills.map(s => `- ${s.name} (from ${s.source}, confidence: ${s.confidence || 'unknown'})`).join('\n') : '- None'}

SKILL GAPS (needed for career interests but not verified):
${skillGaps.length > 0 ? skillGaps.map(g => `- ${g.skill_name} → needed for: ${g.from_jobs.join(', ')}`).join('\n') : '- No gaps identified'}

AVAILABLE SKILLS IN SYSTEM:
${allSkills?.slice(0, 30).map(s => `- ${s.name} (${s.category})`).join('\n')}

Based on this analysis, recommend 3-6 personalized assessments. Prioritize:
1. HIGH PRIORITY: Skills that are unverified but claimed (validate them)
2. HIGH PRIORITY: Critical skill gaps blocking career goals
3. MEDIUM PRIORITY: Skills that would significantly improve job matches
4. LOW PRIORITY: Nice-to-have skills for career growth

For each assessment, provide:
- skill_name: exact name from the available skills list
- title: a compelling assessment title
- description: 2-3 sentence description of what will be assessed
- reason: why this assessment is recommended for this person specifically
- priority: high/medium/low
- type: "validate" (for unverified skills) or "learn" (for gaps)
- related_interests: which career interests this helps with
- estimated_time: minutes (15-45)
- difficulty: beginner/intermediate/advanced

Respond ONLY with a valid JSON array of assessment objects. No explanation, just the JSON array.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a career development AI. Always respond with valid JSON only.' },
        { role: 'user', content: aiPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const aiResponse = completion.choices[0]?.message?.content || '[]'
    
    // Parse AI response
    let recommendedAssessments: any[] = []
    try {
      // Clean up response if needed
      let cleanJson = aiResponse.trim()
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.slice(7)
      }
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.slice(3)
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.slice(0, -3)
      }
      recommendedAssessments = JSON.parse(cleanJson.trim())
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      // Fallback: generate basic assessments from skill gaps
      recommendedAssessments = skillGaps.slice(0, 5).map((gap, idx) => ({
        skill_name: gap.skill_name,
        title: `${gap.skill_name} Assessment`,
        description: `Validate your knowledge and skills in ${gap.skill_name}. This assessment covers core concepts and practical applications.`,
        reason: `This skill is required for ${gap.from_jobs[0]} which aligns with your interest in ${gap.from_interests[0]}.`,
        priority: idx < 2 ? 'high' : 'medium',
        type: 'learn',
        related_interests: gap.from_interests,
        estimated_time: 30,
        difficulty: 'intermediate'
      }))
    }

    // 9. Match skill names to skill IDs from taxonomy
    const enrichedAssessments = recommendedAssessments.map((assessment, index) => {
      const matchedSkill = allSkills?.find(s => 
        s.name.toLowerCase() === assessment.skill_name?.toLowerCase() ||
        s.name.toLowerCase().includes(assessment.skill_name?.toLowerCase()) ||
        assessment.skill_name?.toLowerCase().includes(s.name.toLowerCase())
      )

      return {
        id: `ai-assessment-${index}-${Date.now()}`,
        skill_id: matchedSkill?.id || null,
        skill_name: matchedSkill?.name || assessment.skill_name,
        skill_category: matchedSkill?.category || 'technical',
        title: assessment.title,
        description: assessment.description,
        reason: assessment.reason,
        priority: assessment.priority || 'medium',
        type: assessment.type || 'learn',
        related_interests: assessment.related_interests || [],
        estimated_time: assessment.estimated_time || 30,
        difficulty: assessment.difficulty || 'intermediate'
      }
    }).filter(a => a.skill_name) // Only keep assessments with valid skill names

    // 10. Log to audit
    await supabase.from('audit_logs').insert({
      action: 'ai_assessment_recommendation',
      entity_type: 'assessment',
      actor_id: user_id,
      details: {
        career_interests: careerInterests,
        skill_gaps_count: skillGaps.length,
        recommendations_count: enrichedAssessments.length
      }
    })

    return NextResponse.json({
      success: true,
      profile_summary: {
        name: profile.full_name,
        role: profile.job_title,
        career_interests: careerInterests,
        verified_skills_count: verifiedSkills.length,
        unverified_skills_count: unverifiedSkills.length,
        skill_gaps_count: skillGaps.length
      },
      assessments: enrichedAssessments,
      skill_gaps: skillGaps.map(g => ({
        skill_name: g.skill_name,
        from_interests: g.from_interests
      }))
    })

  } catch (error: any) {
    console.error('Error recommending assessments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to recommend assessments' },
      { status: 500 }
    )
  }
}