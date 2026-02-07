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

interface RecommendedCourse {
  id: string
  name: string
  provider: string
  url: string
  description: string
  skills_covered: string[]
  duration_hours: number
  estimated_completion_weeks: number
  level: 'beginner' | 'intermediate' | 'advanced'
  priority: 'high' | 'medium' | 'low'
  reason: string
  related_interests: string[]
  price: string
  rating?: number
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

    const careerInterests = interests?.map((i: any) => i.interest) || []

    // 3. Get user's current skills
    const { data: userSkills } = await supabase
      .from('user_skills')
      .select(`
        skill_id,
        verified,
        source,
        skills_taxonomy (id, name, category)
      `)
      .eq('profile_id', user_id)

    const verifiedSkills = userSkills?.filter((s: any) => s.verified).map((s: any) => ({
      name: (s.skills_taxonomy as any)?.name || '',
      category: (s.skills_taxonomy as any)?.category || ''
    })) || []

    const unverifiedSkills = userSkills?.filter((s: any) => !s.verified).map((s: any) => ({
      name: (s.skills_taxonomy as any)?.name || '',
      category: (s.skills_taxonomy as any)?.category || ''
    })) || []

    // 4. Find skill gaps from job matches
    const { data: jobMatches } = await supabase
      .from('job_matches')
      .select(`
        job_id,
        match_score,
        job_postings (
          id,
          title,
          job_required_skills (
            skill_id,
            skills_taxonomy (name, category)
          )
        )
      `)
      .eq('profile_id', user_id)
      .order('match_score', { ascending: false })
      .limit(5)

    const verifiedSkillNames = verifiedSkills.map((s: any) => s.name.toLowerCase())
    const skillGaps: { name: string; from_jobs: string[] }[] = []

    if (jobMatches) {
      for (const match of jobMatches) {
        const job = match.job_postings as any
        const requiredSkills = job?.job_required_skills || []
        
        for (const rs of requiredSkills) {
          const skillName = rs.skills_taxonomy?.name || ''
          if (skillName && !verifiedSkillNames.includes(skillName.toLowerCase())) {
            const existing = skillGaps.find((g: any) => g.name.toLowerCase() === skillName.toLowerCase())
            if (existing) {
              if (!existing.from_jobs.includes(job.title)) {
                existing.from_jobs.push(job.title)
              }
            } else {
              skillGaps.push({ name: skillName, from_jobs: [job.title] })
            }
          }
        }
      }
    }

    // 5. Build AI prompt
    const aiPrompt = `You are a career development advisor specializing in online learning recommendations. Your task is to recommend REAL, EXISTING courses from popular learning platforms.

EMPLOYEE PROFILE:
- Name: ${profile.full_name}
- Current Role: ${profile.job_title || 'Not specified'}
- Department: ${profile.department || 'Not specified'}
- Years in Role: ${profile.years_in_role || 0}

CAREER INTERESTS (where they want to transition):
${careerInterests.length > 0 ? careerInterests.map((i: string) => `- ${i}`).join('\n') : '- None specified (recommend general professional development)'}

CURRENT VERIFIED SKILLS (already proven competent):
${verifiedSkills.length > 0 ? verifiedSkills.map((s: any) => `- ${s.name} (${s.category})`).join('\n') : '- None verified yet'}

SKILLS TO DEVELOP (mentioned in resume, not verified):
${unverifiedSkills.length > 0 ? unverifiedSkills.map((s: any) => `- ${s.name}`).join('\n') : '- None'}

SKILL GAPS (required for career goals but not verified):
${skillGaps.length > 0 ? skillGaps.map((g: any) => `- ${g.name} → needed for: ${g.from_jobs.join(', ')}`).join('\n') : '- No specific gaps identified'}

TASK: Recommend 6-8 courses from these platforms. USE REAL COURSE NAMES AND REALISTIC URLS:

PLATFORMS AND URL FORMATS:
1. LinkedIn Learning → https://www.linkedin.com/learning/[exact-course-name-lowercase-hyphenated]
2. Coursera → https://www.coursera.org/learn/[course-slug] or https://www.coursera.org/professional-certificates/[cert-name]
3. Udemy → https://www.udemy.com/course/[course-slug]/
4. Pluralsight → https://www.pluralsight.com/courses/[course-name]
5. edX → https://www.edx.org/learn/[topic]/[course-name]
6. DataCamp → https://www.datacamp.com/courses/[course-name]
7. Codecademy → https://www.codecademy.com/learn/[course-name]
8. freeCodeCamp → https://www.freecodecamp.org/learn/[certification-name]
9. Udacity → https://www.udacity.com/course/[course-name]--[code]
10. Google Skillshop → https://skillshop.google.com/

PRIORITIZATION RULES:
- HIGH PRIORITY: Courses that directly close skill gaps or enable career transition
- MEDIUM PRIORITY: Courses that strengthen existing skills or add complementary ones  
- LOW PRIORITY: Nice-to-have courses for general growth

RESPOND WITH THIS EXACT JSON STRUCTURE (array of objects):
[
  {
    "name": "Exact Course Title",
    "provider": "Platform Name",
    "url": "https://full-url-to-course",
    "description": "2-3 sentence description of what you'll learn",
    "skills_covered": ["Skill 1", "Skill 2", "Skill 3"],
    "duration_hours": 15,
    "estimated_completion_weeks": 3,
    "level": "beginner|intermediate|advanced",
    "priority": "high|medium|low",
    "reason": "Personalized explanation why THIS course for THIS person",
    "related_interests": ["Career Interest 1"],
    "price": "Free|Subscription|$XX.XX",
    "rating": 4.7
  }
]

IMPORTANT: 
- Use well-known, popular courses that actually exist
- Make URLs realistic and following platform patterns
- Include a mix of free and paid options
- Vary difficulty levels appropriately
- Be specific with course names (e.g., "Google Project Management: Professional Certificate" not just "Project Management Course")

Respond ONLY with valid JSON array. No explanations.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a career development expert with extensive knowledge of online learning platforms. Recommend real, high-quality courses. Always respond with valid JSON only.' 
        },
        { role: 'user', content: aiPrompt }
      ],
      temperature: 0.7,
      max_tokens: 3000
    })

    const aiResponse = completion.choices[0]?.message?.content || '[]'
    
    // Parse AI response
    let recommendedCourses: RecommendedCourse[] = []
    try {
      let cleanJson = aiResponse.trim()
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7)
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3)
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3)
      recommendedCourses = JSON.parse(cleanJson.trim())
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      // Return fallback courses
      recommendedCourses = generateFallbackCourses(careerInterests, skillGaps)
    }

    // Enrich with IDs
    const enrichedCourses = recommendedCourses.map((course: any, index: number) => ({
      id: `ai-course-${index}-${Date.now()}`,
      name: course.name || 'Recommended Course',
      provider: course.provider || 'Online Platform',
      url: course.url || '#',
      description: course.description || '',
      skills_covered: course.skills_covered || [],
      duration_hours: course.duration_hours || 10,
      estimated_completion_weeks: course.estimated_completion_weeks || 2,
      level: course.level || 'intermediate',
      priority: course.priority || 'medium',
      reason: course.reason || 'This course aligns with your career goals.',
      related_interests: course.related_interests || [],
      price: course.price || 'Varies',
      rating: course.rating || null
    }))

    // Log to audit
    await supabase.from('audit_logs').insert({
      action: 'ai_course_recommendation',
      entity_type: 'course',
      actor_id: user_id,
      details: {
        career_interests: careerInterests,
        skill_gaps_count: skillGaps.length,
        recommendations_count: enrichedCourses.length
      }
    })

    return NextResponse.json({
      success: true,
      profile_summary: {
        name: profile.full_name,
        role: profile.job_title,
        career_interests: careerInterests,
        skill_gaps: skillGaps.map((g: any) => g.name)
      },
      courses: enrichedCourses
    })

  } catch (error: any) {
    console.error('Error recommending courses:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to recommend courses' },
      { status: 500 }
    )
  }
}

// Fallback courses when AI fails
function generateFallbackCourses(interests: string[], gaps: any[]): RecommendedCourse[] {
  const fallbackCourses: RecommendedCourse[] = [
    {
      id: 'fallback-1',
      name: 'Learning How to Learn',
      provider: 'Coursera',
      url: 'https://www.coursera.org/learn/learning-how-to-learn',
      description: 'Powerful mental tools to help you master tough subjects. This course gives you easy access to the invaluable learning techniques used by experts in art, music, literature, math, science, sports, and many other disciplines.',
      skills_covered: ['Learning Strategies', 'Problem Solving', 'Critical Thinking'],
      duration_hours: 15,
      estimated_completion_weeks: 4,
      level: 'beginner',
      priority: 'medium',
      reason: 'This foundational course helps you learn any skill more effectively.',
      related_interests: interests.slice(0, 2),
      price: 'Free',
      rating: 4.8
    },
    {
      id: 'fallback-2',
      name: 'Communication Skills for Business',
      provider: 'LinkedIn Learning',
      url: 'https://www.linkedin.com/learning/communication-foundations-2018',
      description: 'Learn the fundamentals of business communication, including how to communicate clearly and professionally in any workplace setting.',
      skills_covered: ['Business Communication', 'Presentation Skills', 'Professional Writing'],
      duration_hours: 8,
      estimated_completion_weeks: 2,
      level: 'beginner',
      priority: 'high',
      reason: 'Strong communication skills are essential for career advancement in any field.',
      related_interests: interests,
      price: 'Subscription',
      rating: 4.6
    },
    {
      id: 'fallback-3',
      name: 'Project Management Principles and Practices',
      provider: 'Coursera',
      url: 'https://www.coursera.org/specializations/project-management',
      description: 'Learn the principles and practices of project management. This specialization covers the essential skills needed to manage projects effectively.',
      skills_covered: ['Project Management', 'Agile', 'Team Leadership'],
      duration_hours: 40,
      estimated_completion_weeks: 8,
      level: 'intermediate',
      priority: 'medium',
      reason: 'Project management skills are valuable for coordinating work and leading initiatives.',
      related_interests: interests.slice(0, 1),
      price: 'Free with certificate fee',
      rating: 4.7
    }
  ]

  return fallbackCourses
}