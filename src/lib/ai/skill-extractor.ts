// ============================================
// src/lib/ai/skill-extractor.ts
// AI-powered skill extraction from resume/video (OpenAI version)
// ============================================

import { getOpenAIClient } from './openai'
import { SkillExtractionResult, ExtractedSkill, SkillCategory } from '@/types'

const SKILL_EXTRACTION_PROMPT = `You are an expert HR analyst specializing in skill extraction from resumes and video transcripts.

Analyze the following content and extract:
1. Technical skills (programming languages, tools, frameworks, technologies)
2. Soft skills (communication, leadership, problem-solving)
3. Process skills (methodologies, workflows, project management)
4. Domain knowledge (industry expertise, certifications)

Also identify:
- Keywords that represent the candidate's experience
- Potential career interests based on their experience

For each skill, provide a confidence score (0.0 to 1.0) based on how clearly the skill is demonstrated.

IMPORTANT: Only extract skills that are explicitly mentioned or strongly implied. Do not hallucinate skills.

Respond ONLY in JSON format (no markdown, no code blocks):
{
  "skills": [
    {"name": "Skill Name", "category": "technical|soft|process|domain", "confidence": 0.85, "source": "resume|video"}
  ],
  "keywords": ["keyword1", "keyword2"],
  "career_interests": ["interest1", "interebst2"],
  "confidence": 0.9
}`

export async function extractSkillsFromResume(
  resumeText: string
): Promise<SkillExtractionResult> {
  const client = getOpenAIClient()
  
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: SKILL_EXTRACTION_PROMPT
      },
      {
        role: 'user',
        content: `--- RESUME CONTENT ---\n${resumeText}`
      }
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: "json_object" }
  })

  const responseText = response.choices[0]?.message?.content || ''
  
  try {
    const result = JSON.parse(responseText)
    
    return {
      skills: result.skills.map((s: any) => ({
        name: s.name,
        category: s.category as SkillCategory,
        confidence: s.confidence,
        source: 'resume'
      })),
      keywords: result.keywords || [],
      career_interests: result.career_interests || [],
      confidence: result.confidence || 0.8
    }
  } catch (error) {
    console.error('Error parsing skill extraction response:', error)
    return {
      skills: [],
      keywords: [],
      career_interests: [],
      confidence: 0
    }
  }
}

export async function extractSkillsFromVideoTranscript(
  transcript: string
): Promise<SkillExtractionResult> {
  const client = getOpenAIClient()
  
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: SKILL_EXTRACTION_PROMPT
      },
      {
        role: 'user',
        content: `--- VIDEO TRANSCRIPT ---\n${transcript}`
      }
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: "json_object" }
  })

  const responseText = response.choices[0]?.message?.content || ''
  
  try {
    const result = JSON.parse(responseText)
    
    return {
      skills: result.skills.map((s: any) => ({
        name: s.name,
        category: s.category as SkillCategory,
        confidence: s.confidence,
        source: 'video'
      })),
      keywords: result.keywords || [],
      career_interests: result.career_interests || [],
      confidence: result.confidence || 0.8
    }
  } catch (error) {
    console.error('Error parsing skill extraction response:', error)
    return {
      skills: [],
      keywords: [],
      career_interests: [],
      confidence: 0
    }
  }
}

// Merge skills from multiple sources
export function mergeSkillResults(
  results: SkillExtractionResult[]
): SkillExtractionResult {
  const skillMap = new Map<string, ExtractedSkill>()
  const allKeywords = new Set<string>()
  const allInterests = new Set<string>()
  let totalConfidence = 0
  
  for (const result of results) {
    totalConfidence += result.confidence
    
    for (const skill of result.skills) {
      const existing = skillMap.get(skill.name.toLowerCase())
      if (!existing || existing.confidence < skill.confidence) {
        skillMap.set(skill.name.toLowerCase(), skill)
      }
    }
    
    result.keywords.forEach(k => allKeywords.add(k))
    result.career_interests.forEach(i => allInterests.add(i))
  }
  
  return {
    skills: Array.from(skillMap.values()),
    keywords: Array.from(allKeywords),
    career_interests: Array.from(allInterests),
    confidence: results.length > 0 ? totalConfidence / results.length : 0
  }
}