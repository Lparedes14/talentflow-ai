import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { certificationText, certificationName, profileId } = body

    if (!certificationText || !profileId) {
      return NextResponse.json(
        { error: 'Missing certificationText or profileId' },
        { status: 400 }
      )
    }

    console.log('Analyzing certification:', certificationName)
    console.log('Text length:', certificationText.length)

    // Use OpenAI to extract skills from certification
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert HR analyst specializing in professional certifications.

Task: Extract skills that this certification validates or teaches.

Rules:
- Focus on skills that this certification PROVES the person has
- Include both technical and soft skills
- Be specific - certifications prove specific competencies
- Categorize each skill as: "technical", "soft", "process", or "domain"
- Keep skill names short (1-4 words)
- Only extract skills that are clearly related to this certification

You MUST respond with a valid JSON object in this exact format:
{
  "skills": [
    {
      "name": "Skill Name (normalized, title case)",
      "category": "technical" | "soft" | "process" | "domain",
      "confidence": "high" | "medium",
      "reason": "Why this certification validates this skill (max 10 words)"
    }
  ],
  "certification_domain": "The main domain/field of this certification",
  "skill_level": "beginner" | "intermediate" | "advanced" | "expert"
}

Only return valid JSON, no markdown, no explanation.`
        },
        {
          role: 'user',
          content: `Extract skills from this certification:

Certification Name: ${certificationName}

Certification Content/Description:
${certificationText}`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    })

    const resultText = completion.choices[0].message.content || '{}'
    let result
    
    try {
      result = JSON.parse(resultText)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    console.log('AI extracted skills from certification:', result.skills?.length || 0)

    // Get existing skills from taxonomy
    const { data: existingSkills } = await supabase
      .from('skills_taxonomy')
      .select('id, name, category')

    const existingSkillsMap = new Map(
      (existingSkills || []).map(s => [s.name.toLowerCase(), s])
    )

    // Process each skill - create if doesn't exist
    const processedSkills: {
      skill_id: string
      name: string
      category: string
      confidence: string
      reason: string
      isNew: boolean
    }[] = []

    if (result.skills && Array.isArray(result.skills)) {
      for (const skill of result.skills) {
        const skillNameLower = skill.name.toLowerCase().trim()
        const existingSkill = existingSkillsMap.get(skillNameLower)

        if (existingSkill) {
          processedSkills.push({
            skill_id: existingSkill.id,
            name: existingSkill.name,
            category: existingSkill.category,
            confidence: skill.confidence || 'high',
            reason: skill.reason || '',
            isNew: false
          })
        } else {
          // Create new skill
          const { data: newSkill, error: createError } = await supabase
            .from('skills_taxonomy')
            .insert({
              name: skill.name.trim(),
              category: skill.category || 'technical',
              description: `Validated by certification: ${certificationName}`
            })
            .select('id, name, category')
            .single()

          if (createError) {
            console.error('Error creating skill:', skill.name, createError)
            const { data: retryFind } = await supabase
              .from('skills_taxonomy')
              .select('id, name, category')
              .ilike('name', skill.name.trim())
              .single()
            
            if (retryFind) {
              processedSkills.push({
                skill_id: retryFind.id,
                name: retryFind.name,
                category: retryFind.category,
                confidence: skill.confidence || 'high',
                reason: skill.reason || '',
                isNew: false
              })
            }
          } else if (newSkill) {
            console.log('Created new skill from certification:', newSkill.name)
            processedSkills.push({
              skill_id: newSkill.id,
              name: newSkill.name,
              category: newSkill.category,
              confidence: skill.confidence || 'high',
              reason: skill.reason || '',
              isNew: true
            })
            existingSkillsMap.set(skillNameLower, newSkill)
          }
        }
      }
    }

    // Insert skills for user (source = 'certification', verified = true because cert proves it)
    if (processedSkills.length > 0) {
      const skillsToInsert = processedSkills.map(skill => ({
        profile_id: profileId,
        skill_id: skill.skill_id,
        source: 'certification',
        verified: true, // Certifications verify skills!
        confidence_score: skill.confidence === 'high' ? 0.95 : 0.80
      }))

      // Use upsert to avoid duplicates
      for (const skillToInsert of skillsToInsert) {
        await supabase
          .from('user_skills')
          .upsert(skillToInsert, { 
            onConflict: 'profile_id,skill_id'
          })
      }
    }

    return NextResponse.json({
      success: true,
      skills: processedSkills,
      certification_domain: result.certification_domain,
      skill_level: result.skill_level,
      stats: {
        total_skills: processedSkills.length,
        new_skills_created: processedSkills.filter(s => s.isNew).length,
        existing_skills_matched: processedSkills.filter(s => !s.isNew).length
      }
    })

  } catch (error: any) {
    console.error('Certification skill extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract skills from certification' },
      { status: 500 }
    )
  }
}