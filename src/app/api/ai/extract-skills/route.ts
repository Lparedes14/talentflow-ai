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
    const { resumeText, profileId } = body

    if (!resumeText || !profileId) {
      return NextResponse.json(
        { error: 'Missing resumeText or profileId' },
        { status: 400 }
      )
    }

    if (resumeText.length < 50) {
      return NextResponse.json(
        { error: 'Resume text too short. Make sure the PDF contains selectable text.' },
        { status: 400 }
      )
    }

    console.log('Received resume text length:', resumeText.length)
    console.log('First 300 chars:', resumeText.substring(0, 300))

    // Use OpenAI to extract ALL skills
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert ATS resume parser + HR analyst.

Task: Extract ALL skills from the resume text provided.

Rules:
- Use ONLY the resume text. Don't invent skills.
- Separate "Explicit skills" (directly stated) vs "Inferred skills" (strongly implied).
- Deduplicate and normalize synonyms (e.g., "Excel advanced" → "Microsoft Excel").
- If a skill appears multiple times, list it once.
- Keep skills short (1–4 words when possible).
- Categorize each skill as: "technical", "soft", "process", or "domain"
- Be thorough - look for skills in job descriptions, bullet points, summaries, everywhere.

You MUST respond with a valid JSON object in this exact format:
{
  "skills": [
    {
      "name": "Skill Name (normalized, title case)",
      "category": "technical" | "soft" | "process" | "domain",
      "type": "explicit" | "inferred",
      "confidence": "high" | "medium" | "low",
      "evidence": "short quote from resume (max 12 words)"
    }
  ],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "summary": "Brief 1-2 sentence professional summary based on the resume",
  "years_experience": null or number (estimated total years of experience)
}

IMPORTANT: 
- Extract ALL skills you find, not just common ones
- Normalize skill names (e.g., "MS Excel" → "Microsoft Excel", "JS" → "JavaScript")
- Use title case for skill names
- Include technical tools, soft skills, methodologies, domain knowledge

Only return valid JSON, no markdown, no explanation, no code blocks.`
        },
        {
          role: 'user',
          content: `Extract skills from this resume:\n\n${resumeText}`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2500,
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

    console.log('AI extracted skills:', result.skills?.length || 0)

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
      type: string
      confidence: string
      evidence: string
      isNew: boolean
    }[] = []

    if (result.skills && Array.isArray(result.skills)) {
      for (const skill of result.skills) {
        const skillNameLower = skill.name.toLowerCase().trim()
        const existingSkill = existingSkillsMap.get(skillNameLower)

        if (existingSkill) {
          // Skill exists in taxonomy
          processedSkills.push({
            skill_id: existingSkill.id,
            name: existingSkill.name,
            category: existingSkill.category,
            type: skill.type || 'explicit',
            confidence: skill.confidence || 'high',
            evidence: skill.evidence || '',
            isNew: false
          })
        } else {
          // Skill doesn't exist - CREATE IT
          const { data: newSkill, error: createError } = await supabase
            .from('skills_taxonomy')
            .insert({
              name: skill.name.trim(),
              category: skill.category || 'technical',
              description: `Auto-created from resume analysis`
            })
            .select('id, name, category')
            .single()

          if (createError) {
            console.error('Error creating skill:', skill.name, createError)
            // Try to find it again (maybe it exists with different case)
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
                type: skill.type || 'explicit',
                confidence: skill.confidence || 'high',
                evidence: skill.evidence || '',
                isNew: false
              })
            }
          } else if (newSkill) {
            console.log('Created new skill:', newSkill.name)
            processedSkills.push({
              skill_id: newSkill.id,
              name: newSkill.name,
              category: newSkill.category,
              type: skill.type || 'explicit',
              confidence: skill.confidence || 'high',
              evidence: skill.evidence || '',
              isNew: true
            })
            existingSkillsMap.set(skillNameLower, newSkill)
          }
        }
      }
    }

    console.log('Processed skills:', processedSkills.length)
    console.log('New skills created:', processedSkills.filter(s => s.isNew).length)

    // Delete existing AI-extracted skills for this user
    await supabase
      .from('user_skills')
      .delete()
      .eq('profile_id', profileId)
      .eq('source', 'resume')

    // Insert all processed skills
    if (processedSkills.length > 0) {
      const skillsToInsert = processedSkills.map(skill => ({
        profile_id: profileId,
        skill_id: skill.skill_id,
        source: 'resume',
        verified: skill.type === 'explicit',
        confidence_score: skill.confidence === 'high' ? 0.95 : skill.confidence === 'medium' ? 0.75 : 0.55
      }))

      const { error: insertError } = await supabase
        .from('user_skills')
        .insert(skillsToInsert)

      if (insertError) {
        console.error('Error inserting user skills:', insertError)
      }
    }

    // Store extracted keywords
    if (result.keywords && result.keywords.length > 0) {
      await supabase
        .from('extracted_keywords')
        .delete()
        .eq('profile_id', profileId)
        .eq('source', 'resume')

      const keywordsToInsert = result.keywords.map((keyword: string) => ({
        profile_id: profileId,
        keyword,
        source: 'resume'
      }))

      await supabase
        .from('extracted_keywords')
        .insert(keywordsToInsert)
    }

    // Update profile with years of experience if extracted
    if (result.years_experience && typeof result.years_experience === 'number') {
      await supabase
        .from('profiles')
        .update({ years_in_role: result.years_experience })
        .eq('id', profileId)
      
      console.log('Updated years of experience:', result.years_experience)
    }

    return NextResponse.json({
      success: true,
      skills: processedSkills,
      keywords: result.keywords || [],
      summary: result.summary || '',
      years_experience: result.years_experience,
      stats: {
        total_skills: processedSkills.length,
        new_skills_created: processedSkills.filter(s => s.isNew).length,
        existing_skills_matched: processedSkills.filter(s => !s.isNew).length,
        explicit_count: processedSkills.filter(s => s.type === 'explicit').length,
        inferred_count: processedSkills.filter(s => s.type === 'inferred').length
      }
    })

  } catch (error: any) {
    console.error('AI extraction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract skills' },
      { status: 500 }
    )
  }
}