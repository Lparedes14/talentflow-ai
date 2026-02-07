'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CheckCircle, Clock, BookOpen, Play, RotateCcw, 
  Loader2, Award, TrendingUp, ChevronRight, X,
  AlertCircle, Trophy, Target, Zap, ExternalLink, Check
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Assessment {
  id: string
  name: string
  description: string
  skill_id: string
  skill_name: string
  duration_minutes: number
  passing_score: number
  user_status: 'not_started' | 'in_progress' | 'completed'
  user_score: number | null
  completed_at: string | null
}

interface Course {
  id: string
  name: string
  provider: string
  url: string | null
  duration_hours: number
  level: string
  rating: number
  enrolled_count: number
  skills: string[]
  is_enrolled: boolean
  progress: number
}

export default function SkillsDevelopmentPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [userId, setUserId] = useState<string | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'assessments' | 'courses'>('assessments')
  
  // Assessment modal state
  const [showAssessment, setShowAssessment] = useState(false)
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null)
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [assessmentResult, setAssessmentResult] = useState<{ passed: boolean; score: number } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUserId(user.id)

    // Load assessments with user progress
    const { data: assessmentsData } = await supabase
      .from('assessments')
      .select(`
        id,
        name,
        description,
        skill_id,
        duration_minutes,
        passing_score,
        skills_taxonomy (name)
      `)

    // Load user assessment results
    const { data: userAssessments } = await supabase
      .from('user_assessments')
      .select('*')
      .eq('profile_id', user.id)

    if (assessmentsData) {
      const enrichedAssessments = assessmentsData.map((a: any) => {
        const userResult = userAssessments?.find((ua: any) => ua.assessment_id === a.id)
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          skill_id: a.skill_id,
          skill_name: a.skills_taxonomy?.name || '',
          duration_minutes: a.duration_minutes,
          passing_score: a.passing_score,
          user_status: userResult?.status || 'not_started',
          user_score: userResult?.score || null,
          completed_at: userResult?.completed_at || null
        }
      })
      setAssessments(enrichedAssessments)
    }

    // Load courses with user enrollment
    const { data: coursesData } = await supabase
      .from('courses')
      .select(`
        id,
        name,
        provider,
        url,
        duration_hours,
        level,
        rating,
        enrolled_count,
        course_skills (
          skills_taxonomy (name)
        )
      `)

    const { data: userCourses } = await supabase
      .from('user_courses')
      .select('*')
      .eq('profile_id', user.id)

    if (coursesData) {
      const enrichedCourses = coursesData.map((c: any) => {
        const userCourse = userCourses?.find((uc: any) => uc.course_id === c.id)
        return {
          id: c.id,
          name: c.name,
          provider: c.provider,
          url: c.url,
          duration_hours: c.duration_hours,
          level: c.level,
          rating: c.rating,
          enrolled_count: c.enrolled_count,
          skills: c.course_skills?.map((cs: any) => cs.skills_taxonomy?.name).filter(Boolean) || [],
          is_enrolled: !!userCourse,
          progress: userCourse?.progress || 0
        }
      })
      setCourses(enrichedCourses)
    }

    setLoading(false)
  }

  // Start or continue an assessment
  async function startAssessment(assessment: Assessment) {
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
          assessment_name: assessment.name,
          num_questions: 5
        })
      })

      const data = await response.json()
      
      if (data.questions) {
        setAssessmentQuestions(data.questions)
      } else {
        // Fallback questions if AI fails
        setAssessmentQuestions([
          {
            question: `What is a key concept in ${assessment.skill_name}?`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correct: 0
          }
        ])
      }

      // Update status to in_progress
      if (assessment.user_status === 'not_started') {
        await supabase.from('user_assessments').upsert({
          profile_id: userId,
          assessment_id: assessment.id,
          status: 'in_progress',
          started_at: new Date().toISOString()
        }, { onConflict: 'profile_id,assessment_id' })
      }

    } catch (error) {
      console.error('Error generating assessment:', error)
    } finally {
      setAssessmentLoading(false)
    }
  }

  // Submit answer and move to next question
  function submitAnswer(answerIndex: number) {
    setAnswers({ ...answers, [currentQuestion]: answerIndex.toString() })
    
    if (currentQuestion < assessmentQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  // Complete the assessment
  async function completeAssessment() {
    if (!currentAssessment || !userId) return
    
    setAssessmentLoading(true)

    // Calculate score
    let correctAnswers = 0
    assessmentQuestions.forEach((q, index) => {
      if (parseInt(answers[index]) === q.correct) {
        correctAnswers++
      }
    })
    
    const score = Math.round((correctAnswers / assessmentQuestions.length) * 100)
    const passed = score >= currentAssessment.passing_score

    // Update user_assessments
    await supabase.from('user_assessments').upsert({
      profile_id: userId,
      assessment_id: currentAssessment.id,
      status: 'completed',
      score: score,
      completed_at: new Date().toISOString()
    }, { onConflict: 'profile_id,assessment_id' })

    // If passed, add the skill to user's profile
    if (passed && currentAssessment.skill_id) {
      // Check if skill already exists
      const { data: existingSkill } = await supabase
        .from('user_skills')
        .select('id')
        .eq('profile_id', userId)
        .eq('skill_id', currentAssessment.skill_id)
        .single()

      if (!existingSkill) {
        // Add the new skill
        await supabase.from('user_skills').insert({
          profile_id: userId,
          skill_id: currentAssessment.skill_id,
          verified: true,
          source: 'assessment',
          confidence_score: score / 100
        })
      } else {
        // Update existing skill as verified
        await supabase.from('user_skills')
          .update({ verified: true, source: 'assessment', confidence_score: score / 100 })
          .eq('id', existingSkill.id)
      }
    }

    setAssessmentResult({ passed, score })
    setAssessmentLoading(false)
    
    // Reload data to reflect changes
    loadData()
  }

  // Enroll in a course
  async function enrollInCourse(courseId: string) {
    if (!userId) return

    await supabase.from('user_courses').insert({
      profile_id: userId,
      course_id: courseId,
      progress: 0
    })

    loadData()
  }

  // Stats
  const completedAssessments = assessments.filter(a => a.user_status === 'completed').length
  const inProgressAssessments = assessments.filter(a => a.user_status === 'in_progress').length
  const recommendedCourses = courses.length

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: '48px', height: '48px', color: '#10b981', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>Loading skills development...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#111827', margin: '0 0 8px' }}>
          Skills Development
        </h1>
        <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
          Validate your skills and discover learning paths to transition into Customer Success development roles
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          border: '1px solid #e5e7eb', 
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            backgroundColor: '#ecfdf5', 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CheckCircle style={{ width: '24px', height: '24px', color: '#10b981' }} />
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{completedAssessments}</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Assessments Completed</div>
          </div>
        </div>

        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          border: '1px solid #e5e7eb', 
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            backgroundColor: '#eff6ff', 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock style={{ width: '24px', height: '24px', color: '#2563eb' }} />
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{inProgressAssessments}</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>In Progress</div>
          </div>
        </div>

        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '12px', 
          border: '1px solid #e5e7eb', 
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            backgroundColor: '#fef3c7', 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BookOpen style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{recommendedCourses}</div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>Recommended Courses</div>
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
              borderBottom: activeTab === 'assessments' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'assessments' ? '#2563eb' : '#6b7280',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '-1px'
            }}
          >
            Skill Assessments
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            style={{
              padding: '12px 0',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'courses' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'courses' ? '#2563eb' : '#6b7280',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '-1px'
            }}
          >
            Recommended Courses
          </button>
        </div>
      </div>

      {/* Assessments Tab */}
      {activeTab === 'assessments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {assessments.length === 0 ? (
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '12px', 
              border: '1px solid #e5e7eb', 
              padding: '48px',
              textAlign: 'center'
            }}>
              <Target style={{ width: '48px', height: '48px', color: '#d1d5db', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 8px' }}>
                No assessments available
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Check back later for skill assessments
              </p>
            </div>
          ) : (
            assessments.map(assessment => (
              <div
                key={assessment.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  padding: '20px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                        {assessment.name}
                      </h3>
                      {assessment.user_status === 'completed' && (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          fontSize: '12px',
                          fontWeight: '500',
                          borderRadius: '9999px'
                        }}>
                          <CheckCircle style={{ width: '12px', height: '12px' }} />
                          Completed
                        </span>
                      )}
                      {assessment.user_status === 'in_progress' && (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          fontSize: '12px',
                          fontWeight: '500',
                          borderRadius: '9999px'
                        }}>
                          <Clock style={{ width: '12px', height: '12px' }} />
                          In Progress
                        </span>
                      )}
                      {assessment.user_status === 'not_started' && (
                        <span style={{
                          padding: '3px 10px',
                          backgroundColor: '#f3f4f6',
                          color: '#6b7280',
                          fontSize: '12px',
                          fontWeight: '500',
                          borderRadius: '9999px'
                        }}>
                          Not Started
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '13px', marginBottom: '8px' }}>
                      <Clock style={{ width: '14px', height: '14px' }} />
                      {assessment.duration_minutes} mins
                    </div>
                    
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>
                      <span style={{ fontWeight: '500' }}>Description:</span>
                    </p>
                    <p style={{ fontSize: '14px', color: '#4b5563', margin: 0 }}>
                      {assessment.description}
                    </p>

                    {/* Performance bar for completed assessments */}
                    {assessment.user_status === 'completed' && assessment.user_score !== null && (
                      <div style={{ marginTop: '12px' }}>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 6px' }}>Performance</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            flex: 1, 
                            height: '8px', 
                            backgroundColor: '#e5e7eb', 
                            borderRadius: '9999px',
                            overflow: 'hidden'
                          }}>
                            <div style={{ 
                              height: '100%', 
                              width: `${assessment.user_score}%`,
                              backgroundColor: assessment.user_score >= 70 ? '#10b981' : '#f59e0b',
                              borderRadius: '9999px'
                            }} />
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827', minWidth: '40px' }}>
                            {assessment.user_score}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div style={{ marginLeft: '20px' }}>
                    {assessment.user_status === 'completed' ? (
                      <button
                        onClick={() => startAssessment(assessment)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          backgroundColor: 'white',
                          color: '#374151',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        <RotateCcw style={{ width: '14px', height: '14px' }} />
                        Retake
                      </button>
                    ) : assessment.user_status === 'in_progress' ? (
                      <button
                        onClick={() => startAssessment(assessment)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        onClick={() => startAssessment(assessment)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Start Assessment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {courses.length === 0 ? (
            <div style={{ 
              gridColumn: '1 / -1',
              backgroundColor: 'white', 
              borderRadius: '12px', 
              border: '1px solid #e5e7eb', 
              padding: '48px',
              textAlign: 'center'
            }}>
              <BookOpen style={{ width: '48px', height: '48px', color: '#d1d5db', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 8px' }}>
                No courses available
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Check back later for recommended courses
              </p>
            </div>
          ) : (
            courses.map(course => (
              <div
                key={course.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  padding: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 4px' }}>
                      {course.name}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                      {course.provider}
                    </p>
                  </div>
                  {course.rating && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>★ {course.rating}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
                  <span>{course.duration_hours} hours</span>
                  <span>•</span>
                  <span>{course.level}</span>
                  <span>•</span>
                  <span>{course.enrolled_count?.toLocaleString()} enrolled</span>
                </div>

                {course.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {course.skills.slice(0, 3).map((skill, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          fontSize: '12px',
                          fontWeight: '500',
                          borderRadius: '6px'
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {course.is_enrolled ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>Progress</span>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>{course.progress}%</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${course.progress}%`, backgroundColor: '#10b981', borderRadius: '9999px' }} />
                    </div>
                    <button
                      onClick={() => course.url && window.open(course.url, '_blank')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        width: '100%',
                        marginTop: '12px',
                        padding: '10px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Continue Learning
                      <ExternalLink style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => enrollInCourse(course.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Enroll Now
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Assessment Modal */}
      {showAssessment && currentAssessment && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>
                  {currentAssessment.name}
                </h2>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>
                  {currentAssessment.skill_name} • Passing score: {currentAssessment.passing_score}%
                </p>
              </div>
              <button 
                onClick={() => setShowAssessment(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X style={{ width: '24px', height: '24px' }} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px' }}>
              {assessmentLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Loader2 style={{ width: '40px', height: '40px', color: '#2563eb', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ color: '#6b7280' }}>
                    {assessmentResult === null ? 'Generating assessment questions...' : 'Processing results...'}
                  </p>
                </div>
              ) : assessmentResult ? (
                // Results
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  {assessmentResult.passed ? (
                    <>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: '#dcfce7',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px'
                      }}>
                        <Trophy style={{ width: '40px', height: '40px', color: '#10b981' }} />
                      </div>
                      <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', margin: '0 0 8px' }}>
                        Congratulations!
                      </h3>
                      <p style={{ fontSize: '16px', color: '#4b5563', margin: '0 0 16px' }}>
                        You scored <strong>{assessmentResult.score}%</strong> and passed the assessment!
                      </p>
                      <div style={{
                        padding: '16px',
                        backgroundColor: '#f0fdf4',
                        borderRadius: '12px',
                        border: '1px solid #bbf7d0',
                        marginBottom: '20px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <Zap style={{ width: '18px', height: '18px', color: '#10b981' }} />
                          <span style={{ color: '#166534', fontWeight: '500' }}>
                            "{currentAssessment.skill_name}" has been added to your skills!
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: '#fef3c7',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px'
                      }}>
                        <AlertCircle style={{ width: '40px', height: '40px', color: '#f59e0b' }} />
                      </div>
                      <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b', margin: '0 0 8px' }}>
                        Keep Learning!
                      </h3>
                      <p style={{ fontSize: '16px', color: '#4b5563', margin: '0 0 16px' }}>
                        You scored <strong>{assessmentResult.score}%</strong>. You need {currentAssessment.passing_score}% to pass.
                      </p>
                      <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px' }}>
                        Review the recommended courses and try again when you're ready.
                      </p>
                    </>
                  )}
                  <button
                    onClick={() => setShowAssessment(false)}
                    style={{
                      padding: '12px 32px',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                // Questions
                <>
                  {/* Progress */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>
                        Question {currentQuestion + 1} of {assessmentQuestions.length}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {Math.round(((currentQuestion + 1) / assessmentQuestions.length) * 100)}%
                      </span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${((currentQuestion + 1) / assessmentQuestions.length) * 100}%`,
                        backgroundColor: '#2563eb',
                        borderRadius: '9999px',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>

                  {/* Question */}
                  {assessmentQuestions[currentQuestion] && (
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '0 0 20px' }}>
                        {assessmentQuestions[currentQuestion].question}
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {assessmentQuestions[currentQuestion].options.map((option: string, index: number) => {
                          const isSelected = answers[currentQuestion] === index.toString()
                          return (
                            <button
                              key={index}
                              onClick={() => submitAnswer(index)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                backgroundColor: isSelected ? '#eff6ff' : 'white',
                                border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
                                borderRadius: '10px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                border: `2px solid ${isSelected ? '#2563eb' : '#d1d5db'}`,
                                backgroundColor: isSelected ? '#2563eb' : 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {isSelected && <Check style={{ width: '14px', height: '14px', color: 'white' }} />}
                              </div>
                              <span style={{ fontSize: '15px', color: '#374151' }}>{option}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Navigation */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
                        {currentQuestion === assessmentQuestions.length - 1 && answers[currentQuestion] !== undefined ? (
                          <button
                            onClick={completeAssessment}
                            style={{
                              padding: '12px 24px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '15px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            Submit Assessment
                          </button>
                        ) : null}
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