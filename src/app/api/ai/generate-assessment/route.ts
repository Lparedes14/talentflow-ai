import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { skill_name, assessment_name, difficulty = 'intermediate', num_questions = 5 } = await request.json()

    if (!skill_name) {
      return NextResponse.json({ error: 'skill_name is required' }, { status: 400 })
    }

    const difficultyGuide = {
      beginner: 'Focus on fundamental concepts, basic definitions, and simple scenarios. Questions should be straightforward and test basic understanding.',
      intermediate: 'Include practical application questions, common best practices, and real-world scenarios. Mix conceptual understanding with applied knowledge.',
      advanced: 'Focus on complex scenarios, edge cases, optimization strategies, and deep technical knowledge. Questions should challenge experienced practitioners.'
    }

    const prompt = `Generate ${num_questions} multiple choice questions to assess someone's knowledge of "${skill_name}".

Assessment: ${assessment_name || `${skill_name} Assessment`}
Difficulty Level: ${difficulty.toUpperCase()}

Difficulty Guidelines:
${difficultyGuide[difficulty as keyof typeof difficultyGuide] || difficultyGuide.intermediate}

Requirements:
1. All questions must match the ${difficulty} difficulty level
2. Each question should have exactly 4 options (A, B, C, D)
3. Questions should be practical and relevant to real-world scenarios
4. Make sure there is only ONE correct answer per question
5. Options should be plausible - avoid obviously wrong answers
6. Questions should test actual skill competency, not trivia

Respond ONLY with a valid JSON array in this exact format:
[
  {
    "question": "What is the primary purpose of X?",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "correct": 0
  }
]

Where "correct" is the index (0-3) of the correct answer in the options array.

Generate realistic, professional-level questions that would be used in a ${difficulty}-level skills certification assessment.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert assessment creator. Generate clear, fair, and relevant multiple choice questions. Always respond with valid JSON only, no markdown.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 2000
    })

    const responseText = completion.choices[0]?.message?.content || '[]'
    
    // Parse AI response
    let questions
    try {
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      questions = JSON.parse(cleanJson)
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText)
      
      // Return fallback questions
      questions = generateFallbackQuestions(skill_name, num_questions)
    }

    // Validate questions structure
    const validatedQuestions = questions.map((q: any, index: number) => ({
      question: q.question || `Question ${index + 1} about ${skill_name}`,
      options: Array.isArray(q.options) && q.options.length === 4 
        ? q.options 
        : ['Option A', 'Option B', 'Option C', 'Option D'],
      correct: typeof q.correct === 'number' && q.correct >= 0 && q.correct <= 3 
        ? q.correct 
        : 0
    }))

    return NextResponse.json({
      success: true,
      skill_name,
      questions: validatedQuestions
    })

  } catch (error: any) {
    console.error('Assessment generation error:', error)
    
    // Return fallback questions on error
    const { skill_name = 'General', num_questions = 5 } = await request.json().catch(() => ({}))
    
    return NextResponse.json({
      success: true,
      skill_name,
      questions: generateFallbackQuestions(skill_name, num_questions),
      note: 'Using fallback questions due to AI error'
    })
  }
}

// Fallback questions when AI fails
function generateFallbackQuestions(skillName: string, numQuestions: number) {
  const templates = [
    {
      question: `Which of the following best describes a key principle of ${skillName}?`,
      options: [
        'Consistency and reliability',
        'Random implementation',
        'Ignoring best practices',
        'Avoiding documentation'
      ],
      correct: 0
    },
    {
      question: `When working with ${skillName}, what is considered a best practice?`,
      options: [
        'Skip planning and dive straight in',
        'Document your work and follow standards',
        'Work in isolation without feedback',
        'Ignore error handling'
      ],
      correct: 1
    },
    {
      question: `What is an important consideration when applying ${skillName} in a professional setting?`,
      options: [
        'Speed over quality',
        'Working without a plan',
        'Quality, maintainability, and collaboration',
        'Avoiding code reviews'
      ],
      correct: 2
    },
    {
      question: `How should you approach learning ${skillName}?`,
      options: [
        'Practice regularly and seek feedback',
        'Read once and forget',
        'Avoid hands-on practice',
        'Skip the fundamentals'
      ],
      correct: 0
    },
    {
      question: `What distinguishes an expert in ${skillName} from a beginner?`,
      options: [
        'They never make mistakes',
        'They have years of memorization',
        'Deep understanding and ability to solve complex problems',
        'They work alone'
      ],
      correct: 2
    }
  ]

  return templates.slice(0, numQuestions)
}