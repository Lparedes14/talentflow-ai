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
    const formData = await request.formData()
    const videoFile = formData.get('video') as File | null
    const profileId = formData.get('profileId') as string | null

    if (!videoFile || !profileId) {
      return NextResponse.json(
        { error: 'Missing video file or profileId' },
        { status: 400 }
      )
    }

    console.log('Analyzing video:', videoFile.name, 'Size:', videoFile.size)

    // Step 1: Transcribe video audio using Whisper
    console.log('Transcribing video with Whisper...')
    
    const transcription = await openai.audio.transcriptions.create({
      file: videoFile,
      model: 'whisper-1',
      language: 'en', // or 'es' for Spanish, or remove for auto-detect
      response_format: 'verbose_json',
    })

    const transcriptText = transcription.text
    console.log('Transcription:', transcriptText.substring(0, 500))

    if (!transcriptText || transcriptText.length < 10) {
      return NextResponse.json({
        success: true,
        message: 'Could not detect speech in the video',
        skills: [],
        stats: { total_skills: 0 }
      })
    }

    // Step 2: Analyze transcription with GPT-4 to extract skills
    console.log('Analyzing transcription for skills...')
    
    const analysis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert HR analyst and communication coach. 
          
Your task is to analyze a video pitch transcription and extract:

1. **SOFT SKILLS DEMONSTRATED** - Based on HOW the person communicates:
   - Communication style (clear, confident, articulate, etc.)
   - Presentation skills
   - Confidence level
   - Storytelling ability
   - Professionalism
   - Enthusiasm/Energy
   - Listening cues (if they reference questions/audience)

2. **SKILLS FROM EXPERIENCE** - Based on WHAT they mention:
   - Technical skills they mention having
   - Domain expertise they describe
   - Achievements that imply skills
   - Projects that demonstrate capabilities
   - Tools/technologies mentioned

3. **COMMUNICATION ANALYSIS**:
   - Overall communication score (1-10)
   - Strengths observed
   - Areas for improvement
   - Professional presence assessment

Rules:
- Be generous but realistic in skill assessment
- Infer skills from context (e.g., "managed a team of 5" → Team Leadership, People Management)
- Categorize skills as: "technical", "soft", "process", or "domain"
- For soft skills, base them on observable communication traits

Respond with this JSON format:
{
  "transcript_summary": "Brief 2-3 sentence summary of what the person talked about",
  "demonstrated_soft_skills": [
    {
      "name": "Skill Name",
      "category": "soft",
      "confidence": "high" | "medium",
      "evidence": "Specific observation from video (max 15 words)"
    }
  ],
  "experience_based_skills": [
    {
      "name": "Skill Name", 
      "category": "technical" | "soft" | "process" | "domain",
      "confidence": "high" | "medium",
      "evidence": "What they said that indicates this skill"
    }
  ],
  "communication_analysis": {
    "overall_score": 8,
    "strengths": ["Clear articulation", "Good energy"],
    "improvements": ["Could provide more specific examples"],
    "professional_presence": "Strong/Moderate/Developing",
    "personality_traits": ["Confident", "Enthusiastic", "Detail-oriented"]
  },
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Only return valid JSON.`
        },
        {
          role: 'user',
          content: `Analyze this video pitch transcription and extract skills:\n\n"${transcriptText}"`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    })

    const analysisText = analysis.choices[0].message.content || '{}'
    let result
    
    try {
      result = JSON.parse(analysisText)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI analysis' },
        { status: 500 }
      )
    }

    console.log('Analysis result:', JSON.stringify(result, null, 2))

    // Combine all skills
    const allSkills = [
      ...(result.demonstrated_soft_skills || []),
      ...(result.experience_based_skills || [])
    ]

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
      evidence: string
      isNew: boolean
      source_type: string
    }[] = []

    for (const skill of allSkills) {
      const skillNameLower = skill.name.toLowerCase().trim()
      const existingSkill = existingSkillsMap.get(skillNameLower)

      if (existingSkill) {
        processedSkills.push({
          skill_id: existingSkill.id,
          name: existingSkill.name,
          category: existingSkill.category,
          confidence: skill.confidence || 'medium',
          evidence: skill.evidence || '',
          isNew: false,
          source_type: skill.category === 'soft' ? 'demonstrated' : 'mentioned'
        })
      } else {
        // Create new skill
        const { data: newSkill, error: createError } = await supabase
          .from('skills_taxonomy')
          .insert({
            name: skill.name.trim(),
            category: skill.category || 'soft',
            description: `Identified from video pitch analysis`
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
              confidence: skill.confidence || 'medium',
              evidence: skill.evidence || '',
              isNew: false,
              source_type: skill.category === 'soft' ? 'demonstrated' : 'mentioned'
            })
          }
        } else if (newSkill) {
          console.log('Created new skill from video:', newSkill.name)
          processedSkills.push({
            skill_id: newSkill.id,
            name: newSkill.name,
            category: newSkill.category,
            confidence: skill.confidence || 'medium',
            evidence: skill.evidence || '',
            isNew: true,
            source_type: skill.category === 'soft' ? 'demonstrated' : 'mentioned'
          })
          existingSkillsMap.set(skillNameLower, newSkill)
        }
      }
    }

    // Insert skills for user (source = 'video')
    if (processedSkills.length > 0) {
      const skillsToInsert = processedSkills.map(skill => ({
        profile_id: profileId,
        skill_id: skill.skill_id,
        source: 'video',
        verified: false,
        confidence_score: skill.confidence === 'high' ? 0.85 : 0.70
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

    // Store video keywords
    if (result.keywords && result.keywords.length > 0) {
      // Delete old video keywords
      await supabase
        .from('extracted_keywords')
        .delete()
        .eq('profile_id', profileId)
        .eq('source', 'video')

      const keywordsToInsert = result.keywords.map((keyword: string) => ({
        profile_id: profileId,
        keyword,
        source: 'video'
      }))

      await supabase
        .from('extracted_keywords')
        .insert(keywordsToInsert)
    }

    // Separate skills by type for response
    const softSkillsDemonstrated = processedSkills.filter(s => s.source_type === 'demonstrated')
    const experienceSkills = processedSkills.filter(s => s.source_type === 'mentioned')

    return NextResponse.json({
      success: true,
      transcript: transcriptText,
      transcript_summary: result.transcript_summary,
      skills: {
        demonstrated: softSkillsDemonstrated,
        from_experience: experienceSkills
      },
      communication_analysis: result.communication_analysis,
      keywords: result.keywords || [],
      stats: {
        total_skills: processedSkills.length,
        soft_skills: softSkillsDemonstrated.length,
        experience_skills: experienceSkills.length,
        new_skills_created: processedSkills.filter(s => s.isNew).length
      }
    })

  } catch (error: any) {
    console.error('Video analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze video' },
      { status: 500 }
    )
  }
}