'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CheckCircle, Clock, BookOpen, Play, RefreshCw, 
  Loader2, Award, TrendingUp, ChevronRight, X,
  AlertCircle, Trophy, Target, Zap, ExternalLink, Check,
  Users, Briefcase, ArrowRight, Sparkles, Heart, Star,
  Brain, ShieldCheck, GraduationCap, Calendar, DollarSign
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AIAssessment {
  id: string
  skill_id: string | null
  skill_name: string
  skill_category: string
  title: string
  description: string
  reason: string
  priority: 'high' | 'medium' | 'low'
  type: 'validate' | 'learn'
  related_interests: string[]
  estimated_time: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  // UI state
  status: 'recommended' | 'in_progress' | 'completed'
  score?: number
}

interface AICourse {
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
  instructor?: string
}

interface SkillGap {
  skill_name: string
  from_interests: string[]
}

export default function SkillsDevelopmentPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [userId, setUserId] = useState<string | null>(null)
  const [assessments, setAssessments] = useState<AIAssessment[]>([])
  const [courses, setCourses] = useState<AICourse[]>([])
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([])
  const [careerInterests, setCareerInterests] = useState<string[]>([])
  const [profileSummary, setProfileSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingAssessments, setLoadingAssessments] = useState(false)
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [activeTab, setActiveTab] = useState<'assessments' | 'courses'>('assessments')
  
  // Assessment modal state
  const [showAssessment, setShowAssessment] = useState(false)
  const [currentAssessment, setCurrentAssessment] = useState<AIAssessment | null>(null)
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [assessmentResult, setAssessmentResult] = useState<{ passed: boolean; score: number } | null>(null)

  useEffect(() => {
    initializePage()
  }, [])

  async function initializePage() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUserId(user.id)

    // Load career interests for display
    const { data: interests } = await supabase
      .from('career_interests')
      .select('interest')
      .eq('profile_id', user.id)
    setCareerInterests(interests?.map(i => i.interest) || [])

    // Load AI-recommended assessments
    await loadAIAssessments(user.id)

    // Load AI-recommended courses
    await loadAICourses(user.id)

    setLoading(false)
  }

  async function loadAIAssessments(uid: string) {
    setLoadingAssessments(true)
    try {
      const response = await fetch('/api/ai/recommend-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid })
      })

      const data = await response.json()

      if (data.success) {
        setProfileSummary(data.profile_summary)
        setSkillGaps(data.skill_gaps || [])
        
        // Check completion status for each assessment
        const { data: completedAssessments } = await supabase
          .from('user_assessments')
          .select('assessment_id, score, status')
          .eq('profile_id', uid)

        const enrichedAssessments = data.assessments.map((assessment: AIAssessment) => {
          // Check if user has completed an assessment for this skill before
          const completed = completedAssessments?.find(
            (ca: any) => ca.assessment_id?.includes(assessment.skill_name?.toLowerCase().replace(/\s+/g, '-'))
          )
          
          return {
            ...assessment,
            status: completed?.status === 'completed' ? 'completed' : 'recommended',
            score: completed?.score
          }
        })

        setAssessments(enrichedAssessments)
      }
    } catch (error) {
      console.error('Error loading AI assessments:', error)
    } finally {
      setLoadingAssessments(false)
    }
  }

  async function loadAICourses(uid: string) {
    setLoadingCourses(true)
    try {
      const response = await fetch('/api/ai/recommend-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid })
      })

      const data = await response.json()

      if (data.success && data.courses) {
        setCourses(data.courses)
      }
    } catch (error) {
      console.error('Error loading AI courses:', error)
    } finally {
      setLoadingCourses(false)
    }
  }

  async function refreshAssessments() {
    if (!userId) return
    await loadAIAssessments(userId)
  }

  async function startAssessment(assessment: AIAssessment) {
    setCurrentAssessment(assessment)
    setAssessmentLoading(true)
    setShowAssessment(true)
    setCurrentQuestion(0)
    setAnswers({})
    setAssessmentResult(null)

    try {
      // Generate questions using AI
      const response = await fetch('/api/ai/generate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_name: assessment.skill_name,
          assessment_name: assessment.title,
          difficulty: assessment.difficulty,
          num_questions: 5
        })
      })

      const data = await response.json()
      
      if (data.questions) {
        setAssessmentQuestions(data.questions)
      } else {
        // Fallback questions
        setAssessmentQuestions([
          { question: `What is a key concept in ${assessment.skill_name}?`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 0 }
        ])
      }

      // Save assessment start
      const assessmentId = `${assessment.skill_name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
      await supabase.from('user_assessments').upsert({
        profile_id: userId,
        assessment_id: assessmentId,
        status: 'in_progress',
        started_at: new Date().toISOString()
      }, { onConflict: 'profile_id,assessment_id' })

    } catch (error) {
      console.error('Error generating assessment:', error)
    } finally {
      setAssessmentLoading(false)
    }
  }

  function submitAnswer(answerIndex: number) {
    setAnswers({ ...answers, [currentQuestion]: answerIndex.toString() })
    if (currentQuestion < assessmentQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  async function completeAssessment() {
    if (!currentAssessment || !userId) return
    setAssessmentLoading(true)

    let correctAnswers = 0
    assessmentQuestions.forEach((q, index) => {
      if (parseInt(answers[index]) === q.correct) correctAnswers++
    })
    
    const score = Math.round((correctAnswers / assessmentQuestions.length) * 100)
    const passed = score >= 70

    // Save assessment result
    const assessmentId = `${currentAssessment.skill_name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
    await supabase.from('user_assessments').upsert({
      profile_id: userId,
      assessment_id: assessmentId,
      status: 'completed',
      score: score,
      completed_at: new Date().toISOString()
    }, { onConflict: 'profile_id,assessment_id' })

    // If passed and we have a skill_id, add/update as verified skill
    if (passed && currentAssessment.skill_id) {
      const { data: existingSkill } = await supabase
        .from('user_skills')
        .select('id')
        .eq('profile_id', userId)
        .eq('skill_id', currentAssessment.skill_id)
        .single()

      if (!existingSkill) {
        await supabase.from('user_skills').insert({
          profile_id: userId,
          skill_id: currentAssessment.skill_id,
          verified: true,
          source: 'assessment',
          confidence_score: score / 100
        })
      } else {
        await supabase.from('user_skills')
          .update({ verified: true, source: 'assessment', confidence_score: score / 100 })
          .eq('id', existingSkill.id)
      }
    } else if (passed && currentAssessment.skill_name) {
      // Try to find skill by name
      const { data: skill } = await supabase
        .from('skills_taxonomy')
        .select('id')
        .ilike('name', `%${currentAssessment.skill_name}%`)
        .single()

      if (skill) {
        const { data: existingSkill } = await supabase
          .from('user_skills')
          .select('id')
          .eq('profile_id', userId)
          .eq('skill_id', skill.id)
          .single()

        if (!existingSkill) {
          await supabase.from('user_skills').insert({
            profile_id: userId,
            skill_id: skill.id,
            verified: true,
            source: 'assessment',
            confidence_score: score / 100
          })
        } else {
          await supabase.from('user_skills')
            .update({ verified: true, source: 'assessment', confidence_score: score / 100 })
            .eq('id', existingSkill.id)
        }
      }
    }

    setAssessmentResult({ passed, score })
    setAssessmentLoading(false)
    
    // Refresh assessments after completion
    if (userId) {
      loadAIAssessments(userId)
    }
  }

  async function refreshCourses() {
    if (!userId) return
    await loadAICourses(userId)
  }

  function startCourse(course: AICourse) {
    // Open course URL in new tab
    if (course.url) {
      window.open(course.url, '_blank')
    }
  }

  // Stats
  const highPriorityAssessments = assessments.filter(a => a.priority === 'high' && a.status !== 'completed').length
  const completedCount = assessments.filter(a => a.status === 'completed').length
  const highPriorityCourses = courses.filter(c => c.priority === 'high').length
  const totalCourses = courses.length

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' }
      case 'medium': return { bg: '#fef3c7', border: '#fcd34d', text: '#d97706' }
      case 'low': return { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' }
      default: return { bg: '#f3f4f6', border: '#e5e7eb', text: '#6b7280' }
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return { bg: '#dcfce7', text: '#166534' }
      case 'intermediate': return { bg: '#dbeafe', text: '#1e40af' }
      case 'advanced': return { bg: '#fae8ff', text: '#86198f' }
      default: return { bg: '#f3f4f6', text: '#374151' }
    }
  }

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner': return { bg: '#dcfce7', text: '#166534' }
      case 'intermediate': return { bg: '#dbeafe', text: '#1e40af' }
      case 'advanced': return { bg: '#fae8ff', text: '#86198f' }
      default: return { bg: '#f3f4f6', text: '#374151' }
    }
  }

  const getProviderStyle = (provider: string) => {
    const p = provider?.toLowerCase() || ''
    if (p.includes('linkedin')) return { bg: '#0077b5', text: 'white', name: 'LinkedIn Learning' }
    if (p.includes('coursera')) return { bg: '#0056d2', text: 'white', name: 'Coursera' }
    if (p.includes('udemy')) return { bg: '#a435f0', text: 'white', name: 'Udemy' }
    if (p.includes('pluralsight')) return { bg: '#f15b2a', text: 'white', name: 'Pluralsight' }
    if (p.includes('edx')) return { bg: '#02262b', text: 'white', name: 'edX' }
    if (p.includes('datacamp')) return { bg: '#03ef62', text: '#1a1a1a', name: 'DataCamp' }
    if (p.includes('codecademy')) return { bg: '#1f4056', text: 'white', name: 'Codecademy' }
    if (p.includes('freecodecamp')) return { bg: '#0a0a23', text: 'white', name: 'freeCodeCamp' }
    if (p.includes('udacity')) return { bg: '#01b3e3', text: 'white', name: 'Udacity' }
    if (p.includes('google') || p.includes('skillshop')) return { bg: '#4285f4', text: 'white', name: 'Google' }
    if (p.includes('microsoft')) return { bg: '#00a4ef', text: 'white', name: 'Microsoft Learn' }
    if (p.includes('aws')) return { bg: '#ff9900', text: '#1a1a1a', name: 'AWS Training' }
    return { bg: '#6b7280', text: 'white', name: provider }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: '48px', height: '48px', color: '#10b981', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>Analyzing your profile with AI...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Brain style={{ width: '28px', height: '28px', color: '#8b5cf6' }} />
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#111827', margin: 0 }}>
            AI-Powered Skills Development
          </h1>
        </div>
        <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
          Personalized assessments based on your career goals and skill gaps
        </p>
      </div>

      {/* Career Interests Display */}
      {careerInterests.length > 0 && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <Heart style={{ width: '20px', height: '20px', color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1e40af', margin: '0 0 8px' }}>
              Your Career Interests
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {careerInterests.map((interest, idx) => (
                <span key={idx} style={{
                  padding: '4px 12px',
                  backgroundColor: 'white',
                  color: '#2563eb',
                  fontSize: '13px',
                  fontWeight: '500',
                  borderRadius: '9999px',
                  border: '1px solid #bfdbfe'
                }}>
                  {interest}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Alert */}
      {profileSummary && (
        <div style={{
          backgroundColor: '#faf5ff',
          border: '1px solid #e9d5ff',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <Brain style={{ width: '24px', height: '24px', color: '#8b5cf6', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#6b21a8', margin: '0 0 4px' }}>
              AI Analysis Complete
            </h3>
            <p style={{ fontSize: '14px', color: '#7e22ce', margin: 0 }}>
              Found {profileSummary.verified_skills_count} verified skills, {profileSummary.unverified_skills_count} skills to validate, and {profileSummary.skill_gaps_count} skill gaps based on your interests.
            </p>
          </div>
          <button
            onClick={refreshAssessments}
            disabled={loadingAssessments}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: 'white',
              color: '#7c3aed',
              border: '1px solid #ddd6fe',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: loadingAssessments ? 'not-allowed' : 'pointer',
              opacity: loadingAssessments ? 0.6 : 1
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px', animation: loadingAssessments ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      )}

      {careerInterests.length === 0 && (
        <div style={{
          backgroundColor: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <Heart style={{ width: '32px', height: '32px', color: '#9ca3af', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 8px' }}>
            Add Your Career Interests
          </h3>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px' }}>
            Go to your Profile and add career interests to get AI-personalized assessment recommendations.
          </p>
          <button
            onClick={() => router.push('/profile')}
            style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
          >
            Go to Profile
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#fef2f2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target style={{ width: '24px', height: '24px', color: '#dc2626' }} />
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{highPriorityAssessments}</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>High Priority</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#f3e8ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain style={{ width: '24px', height: '24px', color: '#8b5cf6' }} />
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{assessments.length}</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>AI Recommended</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#ecfdf5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle style={{ width: '24px', height: '24px', color: '#10b981' }} />
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{completedCount}</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Completed</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#eff6ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen style={{ width: '24px', height: '24px', color: '#2563eb' }} />
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{totalCourses}</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Courses for You</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '32px' }}>
          <button
            onClick={() => setActiveTab('assessments')}
            style={{
              padding: '12px 0',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'assessments' ? '2px solid #8b5cf6' : '2px solid transparent',
              color: activeTab === 'assessments' ? '#8b5cf6' : '#6b7280',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Brain style={{ width: '18px', height: '18px' }} />
            AI Assessments
            {highPriorityAssessments > 0 && (
              <span style={{ padding: '2px 8px', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '600', borderRadius: '9999px' }}>
                {highPriorityAssessments} priority
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            style={{
              padding: '12px 0',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'courses' ? '2px solid #8b5cf6' : '2px solid transparent',
              color: activeTab === 'courses' ? '#8b5cf6' : '#6b7280',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <GraduationCap style={{ width: '18px', height: '18px' }} />
            Recommended Courses
            {highPriorityCourses > 0 && (
              <span style={{ padding: '2px 8px', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '600', borderRadius: '9999px' }}>
                {highPriorityCourses} priority
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Assessments Tab */}
      {activeTab === 'assessments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loadingAssessments ? (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
              <Loader2 style={{ width: '40px', height: '40px', color: '#8b5cf6', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: '#6b7280' }}>AI is analyzing your profile...</p>
            </div>
          ) : assessments.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
              <Brain style={{ width: '48px', height: '48px', color: '#d1d5db', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 8px' }}>No assessments recommended</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px' }}>Add career interests in your profile to get personalized recommendations</p>
              <button onClick={refreshAssessments} style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                <RefreshCw style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
                Refresh Recommendations
              </button>
            </div>
          ) : (
            assessments.map(assessment => {
              const priorityColors = getPriorityColor(assessment.priority)
              const difficultyColors = getDifficultyColor(assessment.difficulty)
              
              return (
                <div
                  key={assessment.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: assessment.priority === 'high' ? '2px solid #fecaca' : '1px solid #e5e7eb',
                    padding: '20px',
                    position: 'relative'
                  }}
                >
                  {/* Priority & Type Badge */}
                  <div style={{ position: 'absolute', top: '-10px', left: '16px', display: 'flex', gap: '8px' }}>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      backgroundColor: priorityColors.bg,
                      color: priorityColors.text,
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: '9999px',
                      border: '2px solid white'
                    }}>
                      {assessment.priority === 'high' && <Zap style={{ width: '12px', height: '12px' }} />}
                      {assessment.priority.charAt(0).toUpperCase() + assessment.priority.slice(1)} Priority
                    </span>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      backgroundColor: assessment.type === 'validate' ? '#eff6ff' : '#fef3c7',
                      color: assessment.type === 'validate' ? '#1e40af' : '#92400e',
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: '9999px',
                      border: '2px solid white'
                    }}>
                      {assessment.type === 'validate' ? <ShieldCheck style={{ width: '12px', height: '12px' }} /> : <Target style={{ width: '12px', height: '12px' }} />}
                      {assessment.type === 'validate' ? 'Validate Skill' : 'Learn Skill'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>{assessment.title}</h3>
                        <span style={{ padding: '3px 10px', backgroundColor: difficultyColors.bg, color: difficultyColors.text, fontSize: '11px', fontWeight: '500', borderRadius: '6px' }}>
                          {assessment.difficulty}
                        </span>
                        {assessment.status === 'completed' && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', backgroundColor: '#dcfce7', color: '#166534', fontSize: '12px', fontWeight: '500', borderRadius: '9999px' }}>
                            <CheckCircle style={{ width: '12px', height: '12px' }} /> Passed
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#6b7280', fontSize: '13px', marginBottom: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock style={{ width: '14px', height: '14px' }} /> {assessment.estimated_time} mins
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Award style={{ width: '14px', height: '14px' }} /> {assessment.skill_name}
                        </span>
                      </div>
                      
                      <p style={{ fontSize: '14px', color: '#4b5563', margin: '0 0 12px' }}>{assessment.description}</p>

                      {/* AI Reason */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '10px 14px',
                        backgroundColor: '#faf5ff',
                        borderRadius: '8px',
                        marginBottom: '12px'
                      }}>
                        <Brain style={{ width: '16px', height: '16px', color: '#8b5cf6', flexShrink: 0, marginTop: '2px' }} />
                        <span style={{ fontSize: '13px', color: '#6b21a8' }}>
                          <strong>Why:</strong> {assessment.reason}
                        </span>
                      </div>

                      {/* Related Interests */}
                      {assessment.related_interests.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>For:</span>
                          {assessment.related_interests.map((interest, idx) => (
                            <span key={idx} style={{
                              padding: '3px 10px',
                              backgroundColor: '#eff6ff',
                              color: '#1e40af',
                              fontSize: '12px',
                              fontWeight: '500',
                              borderRadius: '9999px'
                            }}>
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginLeft: '20px' }}>
                      <button
                        onClick={() => startAssessment(assessment)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 20px',
                          backgroundColor: assessment.priority === 'high' ? '#dc2626' : '#8b5cf6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        {assessment.status === 'completed' ? 'Retake' : 'Start Assessment'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <div>
          {/* Refresh Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              AI-recommended courses from top learning platforms
            </p>
            <button
              onClick={refreshCourses}
              disabled={loadingCourses}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#7c3aed',
                border: '1px solid #ddd6fe',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: loadingCourses ? 'not-allowed' : 'pointer',
                opacity: loadingCourses ? 0.6 : 1
              }}
            >
              <RefreshCw style={{ width: '14px', height: '14px', animation: loadingCourses ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>

          {loadingCourses ? (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
              <Loader2 style={{ width: '40px', height: '40px', color: '#8b5cf6', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: '#6b7280' }}>AI is finding the best courses for you...</p>
            </div>
          ) : courses.length === 0 ? (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center' }}>
              <BookOpen style={{ width: '48px', height: '48px', color: '#d1d5db', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 8px' }}>No courses found</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px' }}>Add career interests to get personalized recommendations</p>
              <button onClick={refreshCourses} style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                Try Again
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {courses.map(course => {
                const levelColors = getLevelColor(course.level)
                const priorityColors = getPriorityColor(course.priority)
                const providerStyle = getProviderStyle(course.provider)
                const hasHighPriority = course.priority === 'high'
                
                return (
                  <div key={course.id} style={{ 
                    backgroundColor: 'white', 
                    borderRadius: '12px', 
                    border: hasHighPriority ? '2px solid #fecaca' : '1px solid #e5e7eb', 
                    padding: '20px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    position: 'relative' 
                  }}>
                    {/* Priority Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      left: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      backgroundColor: priorityColors.bg,
                      color: priorityColors.text,
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: '9999px',
                      border: '2px solid white'
                    }}>
                      {course.priority === 'high' && <Zap style={{ width: '12px', height: '12px' }} />}
                      {course.priority.charAt(0).toUpperCase() + course.priority.slice(1)} Priority
                    </div>

                    {/* Header - Provider Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', marginTop: '8px' }}>
                      <span style={{ 
                        padding: '5px 12px', 
                        backgroundColor: providerStyle.bg, 
                        color: providerStyle.text, 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {providerStyle.name}
                      </span>
                      <span style={{ padding: '4px 10px', backgroundColor: levelColors.bg, color: levelColors.text, fontSize: '12px', fontWeight: '500', borderRadius: '6px' }}>
                        {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
                      </span>
                    </div>

                    {/* Course Name */}
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 8px', lineHeight: '1.4' }}>
                      {course.name}
                    </h3>

                    {/* Description */}
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px', lineHeight: '1.5' }}>
                      {course.description && course.description.length > 120 ? course.description.substring(0, 120) + '...' : course.description}
                    </p>

                    {/* Stats Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#6b7280', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '6px' }}>
                        <Clock style={{ width: '14px', height: '14px' }} /> 
                        {course.duration_hours}h total
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '6px' }}>
                        <Calendar style={{ width: '14px', height: '14px' }} /> 
                        ~{course.estimated_completion_weeks} week{course.estimated_completion_weeks > 1 ? 's' : ''}
                      </span>
                      {course.rating && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef9c3', padding: '4px 8px', borderRadius: '6px', color: '#854d0e' }}>
                          <Star style={{ width: '14px', height: '14px', fill: '#f59e0b', color: '#f59e0b' }} /> 
                          {course.rating}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: course.price === 'Free' ? '#dcfce7' : '#f3f4f6', padding: '4px 8px', borderRadius: '6px', color: course.price === 'Free' ? '#166534' : '#374151' }}>
                        <DollarSign style={{ width: '14px', height: '14px' }} /> 
                        {course.price}
                      </span>
                    </div>

                    {/* AI Reason */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '10px 12px',
                      backgroundColor: '#faf5ff',
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}>
                      <Brain style={{ width: '14px', height: '14px', color: '#8b5cf6', flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ fontSize: '12px', color: '#6b21a8', lineHeight: '1.4' }}>
                        {course.reason && course.reason.length > 120 ? course.reason.substring(0, 120) + '...' : course.reason}
                      </span>
                    </div>

                    {/* Related Interests */}
                    {course.related_interests && course.related_interests.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <Heart style={{ width: '14px', height: '14px', color: '#2563eb', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>For:</span>
                        {course.related_interests.slice(0, 2).map((interest, idx) => (
                          <span key={idx} style={{
                            padding: '3px 8px',
                            backgroundColor: '#eff6ff',
                            color: '#1e40af',
                            fontSize: '11px',
                            fontWeight: '500',
                            borderRadius: '9999px'
                          }}>
                            {interest}
                          </span>
                        ))}
                        {course.related_interests.length > 2 && (
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>
                            +{course.related_interests.length - 2} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Skills Covered */}
                    {course.skills_covered && course.skills_covered.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontWeight: '500' }}>Skills you'll learn:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {course.skills_covered.slice(0, 4).map((skill, idx) => (
                            <span key={idx} style={{ 
                              padding: '4px 8px', 
                              backgroundColor: '#ecfdf5', 
                              color: '#047857', 
                              fontSize: '11px', 
                              fontWeight: '500', 
                              borderRadius: '6px',
                              border: '1px solid #a7f3d0'
                            }}>
                              ✓ {skill}
                            </span>
                          ))}
                          {course.skills_covered.length > 4 && (
                            <span style={{ padding: '4px 8px', backgroundColor: '#f3f4f6', color: '#6b7280', fontSize: '11px', borderRadius: '6px' }}>
                              +{course.skills_covered.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Start Learning Button */}
                    <button 
                      onClick={() => startCourse(course)} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px', 
                        width: '100%', 
                        padding: '12px', 
                        backgroundColor: hasHighPriority ? '#dc2626' : providerStyle.bg, 
                        color: hasHighPriority ? 'white' : providerStyle.text, 
                        border: 'none', 
                        borderRadius: '8px', 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        cursor: 'pointer',
                        marginTop: 'auto',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <ExternalLink style={{ width: '16px', height: '16px' }} /> 
                      Start on {providerStyle.name}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Assessment Modal */}
      {showAssessment && currentAssessment && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>{currentAssessment.title}</h2>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>{currentAssessment.skill_name} • Passing: 70%</p>
              </div>
              <button onClick={() => setShowAssessment(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}><X style={{ width: '24px', height: '24px' }} /></button>
            </div>

            <div style={{ padding: '24px' }}>
              {assessmentLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Loader2 style={{ width: '40px', height: '40px', color: '#8b5cf6', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ color: '#6b7280' }}>{assessmentResult === null ? 'AI is generating questions...' : 'Processing...'}</p>
                </div>
              ) : assessmentResult ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  {assessmentResult.passed ? (
                    <>
                      <div style={{ width: '80px', height: '80px', backgroundColor: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <Trophy style={{ width: '40px', height: '40px', color: '#10b981' }} />
                      </div>
                      <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', margin: '0 0 8px' }}>Congratulations!</h3>
                      <p style={{ fontSize: '16px', color: '#4b5563', margin: '0 0 16px' }}>You scored <strong>{assessmentResult.score}%</strong> and passed!</p>
                      <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <ShieldCheck style={{ width: '18px', height: '18px', color: '#10b981' }} />
                          <span style={{ color: '#166534', fontWeight: '500' }}>"{currentAssessment.skill_name}" is now verified!</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: '80px', height: '80px', backgroundColor: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <AlertCircle style={{ width: '40px', height: '40px', color: '#f59e0b' }} />
                      </div>
                      <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b', margin: '0 0 8px' }}>Keep Learning!</h3>
                      <p style={{ fontSize: '16px', color: '#4b5563', margin: '0 0 16px' }}>You scored <strong>{assessmentResult.score}%</strong>. Need 70% to pass.</p>
                    </>
                  )}
                  <button onClick={() => setShowAssessment(false)} style={{ padding: '12px 32px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>Done</button>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>Question {currentQuestion + 1} of {assessmentQuestions.length}</span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{Math.round(((currentQuestion + 1) / assessmentQuestions.length) * 100)}%</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${((currentQuestion + 1) / assessmentQuestions.length) * 100}%`, backgroundColor: '#8b5cf6', borderRadius: '9999px', transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  {assessmentQuestions[currentQuestion] && (
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 20px', lineHeight: '1.5' }}>{assessmentQuestions[currentQuestion].question}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {assessmentQuestions[currentQuestion].options.map((option: string, index: number) => {
                          const isSelected = answers[currentQuestion] === index.toString()
                          return (
                            <button key={index} onClick={() => submitAnswer(index)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: isSelected ? '#f5f3ff' : 'white', border: `2px solid ${isSelected ? '#8b5cf6' : '#e5e7eb'}`, borderRadius: '10px', textAlign: 'left', cursor: 'pointer' }}>
                              <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${isSelected ? '#8b5cf6' : '#d1d5db'}`, backgroundColor: isSelected ? '#8b5cf6' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {isSelected && <Check style={{ width: '14px', height: '14px', color: 'white' }} />}
                              </div>
                              <span style={{ fontSize: '15px', color: '#374151' }}>{option}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                        {currentQuestion === assessmentQuestions.length - 1 && answers[currentQuestion] !== undefined && (
                          <button onClick={completeAssessment} style={{ padding: '12px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>Submit Assessment</button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}