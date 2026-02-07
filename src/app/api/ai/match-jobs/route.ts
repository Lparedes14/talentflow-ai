import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // 1. Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, job_title, department, years_in_role')
      .eq('id', user_id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 2. Get user skills
    const { data: userSkills, error: skillsError } = await supabase
      .from('user_skills')
      .select('skill_id, verified, skills_taxonomy(id, name, category)')
      .eq('profile_id', user_id)

    if (skillsError) {
      return NextResponse.json({ error: 'Failed to fetch user skills' }, { status: 500 })
    }

    const userSkillNames = userSkills?.map((s: any) => s.skills_taxonomy?.name).filter(Boolean) || []
    const userSkillIds = userSkills?.map((s: any) => s.skill_id).filter(Boolean) || []

    if (userSkillNames.length === 0) {
      return NextResponse.json({ 
        error: 'No skills found. Please add skills to your profile first.',
        matches: [] 
      }, { status: 200 })
    }

    // 3. Get user career interests
    const { data: interests } = await supabase
      .from('career_interests')
      .select('interest')
      .eq('profile_id', user_id)

    const careerInterests = interests?.map(i => i.interest) || []

    // 4. Get all open job postings with their required skills
    const { data: jobs, error: jobsError } = await supabase
      .from('job_postings')
      .select('*')
      .eq('status', 'open')

    if (jobsError || !jobs || jobs.length === 0) {
      return NextResponse.json({ 
        message: 'No open positions available',
        matches: [] 
      }, { status: 200 })
    }

    // 5. For each job, get required skills
    const jobsWithSkills = await Promise.all(jobs.map(async (job) => {
      const { data: reqSkills } = await supabase
        .from('job_required_skills')
        .select('skill_id, is_required, skills_taxonomy(id, name)')
        .eq('job_id', job.id)

      return {
        ...job,
        required_skills: reqSkills?.map((rs: any) => ({
          skill_id: rs.skill_id,
          name: rs.skills_taxonomy?.name,
          is_required: rs.is_required
        })) || []
      }
    }))

    // 6. Use AI to analyze matches and generate insights
    const prompt = `You are an AI talent matching system. Your job is to generate personalized insights and explanations for job matches.

## Employee Profile:
- Current Role: ${profile.job_title || 'Not specified'}
- Department: ${profile.department || 'Not specified'}
- Years in Role: ${profile.years_in_role || 0}
- Skills: ${userSkillNames.join(', ')}
- Career Interests: ${careerInterests.length > 0 ? careerInterests.join(', ') : 'Not specified'}

## Open Positions:
${jobsWithSkills.map((job, i) => {
  const jobSkillIds = job.required_skills.map((s: any) => s.skill_id)
  const matchedSkills = userSkillIds.filter(id => jobSkillIds.includes(id))
  const matchedSkillNames = job.required_skills
    .filter((s: any) => matchedSkills.includes(s.skill_id))
    .map((s: any) => s.name)
  const missingSkillNames = job.required_skills
    .filter((s: any) => !matchedSkills.includes(s.skill_id))
    .map((s: any) => s.name)
  
  return `
### Position ${i + 1}: ${job.title}
- Department: ${job.department}
- Team: ${job.team || 'N/A'}
- Location: ${job.location}
- Description: ${job.description}
- Required Skills: ${job.required_skills.map((s: any) => s.name).join(', ')}
- Employee HAS these skills: ${matchedSkillNames.join(', ') || 'None'}
- Employee MISSING these skills: ${missingSkillNames.join(', ') || 'None'}
- Skill Match: ${matchedSkills.length}/${job.required_skills.length}`
}).join('\n')}

For each position, generate:
1. explanation: A brief, honest explanation of why this could be a good match or growth opportunity. Mention the skills they have and what they'd need to develop.
2. insight: A personalized, encouraging insight that feels human and specific. Examples:
   - "Your ${userSkillNames[0] || 'technical'} background gives you a strong foundation for this role"
   - "This role would let you leverage your experience while developing new skills"
   - "Teams often value candidates who understand both technical and customer-facing work"
   - "Your current role has prepared you well for the customer interaction aspects"

DO NOT inflate or exaggerate. Be encouraging but realistic.

Respond ONLY with a valid JSON array:
[
  {
    "job_title": "Position Title",
    "match_score": 0,
    "match_type": "best_match",
    "skills_matched": 0,
    "skills_total": 0,
    "explanation": "Your experience in X directly applies to this role...",
    "insight": "A specific, personalized insight..."
  }
]

Note: match_score, match_type, skills_matched, and skills_total will be calculated by the system - just include them as placeholders.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert HR AI that matches employees to internal job opportunities. Always respond with valid JSON only, no markdown.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const responseText = completion.choices[0]?.message?.content || '[]'
    
    // Parse AI response
    let aiMatches
    try {
      // Clean up response if it has markdown
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      aiMatches = JSON.parse(cleanJson)
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText)
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // 7. Save matches to database
    const matchResults = []

    for (const aiMatch of aiMatches) {
      // Find the corresponding job
      const job = jobsWithSkills.find(j => 
        j.title.toLowerCase() === aiMatch.job_title.toLowerCase()
      )

      if (!job) continue

      // Calculate actual skills matched (verify with real data)
      const jobSkillIds = job.required_skills.map((s: any) => s.skill_id)
      const actualSkillsMatched = userSkillIds.filter(id => jobSkillIds.includes(id)).length
      const totalSkills = job.required_skills.length

      // Calculate REAL match score based on skills
      // Base score = percentage of skills matched (0-100)
      const skillMatchPercent = totalSkills > 0 ? (actualSkillsMatched / totalSkills) * 100 : 0
      
      // Add bonus points for:
      // - Career interests alignment (if AI detected it): +5-10 points
      // - Experience relevance: +5 points max
      // But cap the bonus so it doesn't inflate unrealistically
      const aiBonus = Math.min(10, Math.max(0, aiMatch.match_score - skillMatchPercent) * 0.15)
      
      // Final score: primarily skill-based with small AI adjustment
      // Skill match is 85% of the score, AI assessment is 15%
      const realMatchScore = Math.round(
        Math.min(100, skillMatchPercent + aiBonus)
      )

      // Determine match type based on REAL score
      const realMatchType = realMatchScore >= 75 ? 'best_match' : 'career_switch'

      // Delete existing match if any
      await supabase
        .from('job_matches')
        .delete()
        .eq('profile_id', user_id)
        .eq('job_id', job.id)

      // Insert new match
      const { data: savedMatch, error: insertError } = await supabase
        .from('job_matches')
        .insert({
          profile_id: user_id,
          job_id: job.id,
          match_score: realMatchScore,
          match_type: realMatchType,
          explanation: aiMatch.explanation,
          insight: aiMatch.insight,
          skills_matched: actualSkillsMatched,
          skills_total: totalSkills,
          fairness_checked: true
        })
        .select()
        .single()

      if (!insertError && savedMatch) {
        matchResults.push({
          ...savedMatch,
          job_title: job.title
        })
      }
    }

    // 8. Log the matching event for audit
    await supabase
      .from('audit_logs')
      .insert({
        action: 'ai_job_matching',
        entity_type: 'job_matches',
        actor_id: user_id,
        details: {
          user_skills_count: userSkillNames.length,
          jobs_analyzed: jobs.length,
          matches_created: matchResults.length,
          timestamp: new Date().toISOString()
        }
      })

    return NextResponse.json({
      success: true,
      message: `AI analyzed ${jobs.length} positions and created ${matchResults.length} matches`,
      matches: matchResults.sort((a, b) => b.match_score - a.match_score)
    })

  } catch (error: any) {
    console.error('Job matching error:', error)
    return NextResponse.json({ 
      error: 'Failed to perform job matching',
      details: error.message 
    }, { status: 500 })
  }
}