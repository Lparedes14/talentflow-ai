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

export async function POST(request: NextRequest) {
  try {
    const { user_id, target_job_id } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user_id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get user skills
    const { data: userSkills } = await supabase
      .from('user_skills')
      .select('*, skills_taxonomy(*)')
      .eq('profile_id', user_id)

    const skills = userSkills?.map((s: any) => ({
      name: s.skills_taxonomy?.name,
      verified: s.verified
    })) || []

    // Get target job if specified
    let targetJob = null
    if (target_job_id) {
      const { data: job } = await supabase
        .from('job_postings')
        .select('*, job_required_skills(*, skills_taxonomy(*))')
        .eq('id', target_job_id)
        .single()
      targetJob = job
    }

    // Generate plan with AI
    const prompt = `Create a personalized upskilling plan for this employee:

Employee: ${profile.full_name}
Current Role: ${profile.job_title || 'Not specified'}
Current Skills: ${skills.map((s: any) => s.name).join(', ') || 'None listed'}
${targetJob ? `Target Role: ${targetJob.title}
Required Skills: ${targetJob.job_required_skills?.map((rs: any) => rs.skills_taxonomy?.name).join(', ')}` : ''}

Create a structured learning plan with:
1. Skills to develop (prioritized)
2. Recommended courses/resources
3. Timeline (in weeks)
4. Milestones

Respond in JSON format:
{
  "summary": "Brief overview of the plan",
  "duration_weeks": 12,
  "skills_to_develop": [
    {"skill": "Skill Name", "priority": "high/medium/low", "current_level": "none/basic/intermediate", "target_level": "intermediate/advanced"}
  ],
  "phases": [
    {
      "phase": 1,
      "title": "Phase Title",
      "duration_weeks": 4,
      "focus": "Main focus area",
      "activities": ["Activity 1", "Activity 2"],
      "milestone": "What they should achieve"
    }
  ],
  "resources": [
    {"name": "Resource name", "type": "course/book/project", "url": "optional url"}
  ]
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a career development expert. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const aiResponse = completion.choices[0]?.message?.content || '{}'
    
    let plan
    try {
      let cleanJson = aiResponse.trim()
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7)
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3)
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3)
      plan = JSON.parse(cleanJson.trim())
    } catch {
      plan = {
        summary: 'Unable to generate plan',
        duration_weeks: 12,
        skills_to_develop: [],
        phases: [],
        resources: []
      }
    }

    // Save plan to database
    await supabase.from('upskilling_plans').insert({
      profile_id: user_id,
      target_job_id: target_job_id || null,
      plan_data: plan,
      estimated_weeks: plan.duration_weeks,
      explanation: plan.summary
    })

    return NextResponse.json({
      success: true,
      plan
    })

  } catch (error: any) {
    console.error('Error generating plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate plan' },
      { status: 500 }
    )
  }
}