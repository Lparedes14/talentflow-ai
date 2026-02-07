'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Briefcase, MapPin, CheckCircle, XCircle, ChevronRight, 
  ChevronDown, ChevronUp, Search, TrendingUp, Sparkles,
  Loader2, Building, Lightbulb, Zap, RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface JobMatch {
  id: string
  job_id: string
  match_score: number
  match_type: string
  explanation: string
  insight: string
  skills_matched: number
  skills_total: number
  job: {
    id: string
    title: string
    description: string
    department: string
    team: string
    location: string
    work_mode: string
    urgency: string
    required_skills: {
      skill_id: string
      skill_name: string
      is_required: boolean
    }[]
  }
}

interface UserSkill {
  skill_id: string
  name: string
}

export default function JobMatchesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [matches, setMatches] = useState<JobMatch[]>([])
  const [allPositions, setAllPositions] = useState<any[]>([])
  const [userSkills, setUserSkills] = useState<UserSkill[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [pipelineExpanded, setPipelineExpanded] = useState(true)
  const [runningAI, setRunningAI] = useState(false)
  const [aiStatus, setAiStatus] = useState('')

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

    // Load user skills
    const { data: skillsData } = await supabase
      .from('user_skills')
      .select('skill_id, skills_taxonomy(name)')
      .eq('profile_id', user.id)

    if (skillsData) {
      setUserSkills(skillsData.map((s: any) => ({
        skill_id: s.skill_id,
        name: s.skills_taxonomy?.name || ''
      })))
    }

    // Load all open positions
    const { data: positionsData } = await supabase
      .from('job_postings')
      .select('*')
      .eq('status', 'open')

    if (positionsData) {
      setAllPositions(positionsData)
    }

    // Load job matches with job details
    const { data: matchesData } = await supabase
      .from('job_matches')
      .select(`
        id,
        job_id,
        match_score,
        match_type,
        explanation,
        insight,
        skills_matched,
        skills_total,
        job_postings (
          id,
          title,
          description,
          department,
          team,
          location,
          work_mode,
          urgency
        )
      `)
      .eq('profile_id', user.id)
      .order('match_score', { ascending: false })

    if (matchesData) {
      // For each match, get the required skills
      const matchesWithSkills = await Promise.all(matchesData.map(async (match: any) => {
        const { data: reqSkills } = await supabase
          .from('job_required_skills')
          .select('skill_id, is_required, skills_taxonomy(name)')
          .eq('job_id', match.job_id)

        return {
          ...match,
          job: {
            ...match.job_postings,
            required_skills: reqSkills?.map((rs: any) => ({
              skill_id: rs.skill_id,
              skill_name: rs.skills_taxonomy?.name || '',
              is_required: rs.is_required
            })) || []
          }
        }
      }))

      setMatches(matchesWithSkills)
    }

    setLoading(false)
  }

  // Run AI Job Matching
  async function runAIMatching() {
    if (!userId) return
    
    setRunningAI(true)
    setAiStatus('Analyzing your skills and open positions...')
    
    try {
      const response = await fetch('/api/ai/match-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })
      
      const data = await response.json()
      
      if (data.error) {
        setAiStatus(`Error: ${data.error}`)
        setTimeout(() => setAiStatus(''), 5000)
      } else {
        setAiStatus(`✓ ${data.message}`)
        // Reload data to show new matches
        await loadData()
        setTimeout(() => setAiStatus(''), 5000)
      }
    } catch (error: any) {
      console.error('AI matching error:', error)
      setAiStatus('Error running AI matching')
      setTimeout(() => setAiStatus(''), 5000)
    } finally {
      setRunningAI(false)
    }
  }

  // Filter matches
  const filteredMatches = matches.filter(match => {
    const matchesSearch = !searchQuery || 
      match.job?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.job?.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.job?.location?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter = 
      activeFilter === 'all' ||
      (activeFilter === 'best' && match.match_score >= 80) ||
      (activeFilter === 'career_switch' && match.match_type === 'career_switch') ||
      activeFilter === 'positions'

    return matchesSearch && matchesFilter
  })

  // Count by type
  const bestMatchesCount = matches.filter(m => m.match_score >= 80).length
  const careerSwitchCount = matches.filter(m => m.match_type === 'career_switch').length

  // Check if user has a skill
  const hasSkill = (skillId: string) => userSkills.some(s => s.skill_id === skillId)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: '48px', height: '48px', color: '#10b981', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>Loading job matches...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#111827', margin: '0 0 8px' }}>
            Your Job Matches
          </h1>
          <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
            Discover internal opportunities that match your skills and career aspirations
          </p>
        </div>
        <button
          onClick={runAIMatching}
          disabled={runningAI}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: runningAI ? '#9ca3af' : '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: runningAI ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {runningAI ? (
            <>
              <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
              Analyzing...
            </>
          ) : (
            <>
              <Zap style={{ width: '18px', height: '18px' }} />
              Run AI Matching
            </>
          )}
        </button>
      </div>

      {/* AI Status Message */}
      {aiStatus && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: aiStatus.startsWith('✓') ? '#f0fdf4' : aiStatus.startsWith('Error') ? '#fef2f2' : '#eff6ff',
          border: `1px solid ${aiStatus.startsWith('✓') ? '#bbf7d0' : aiStatus.startsWith('Error') ? '#fecaca' : '#bfdbfe'}`,
          borderRadius: '8px',
          color: aiStatus.startsWith('✓') ? '#166534' : aiStatus.startsWith('Error') ? '#dc2626' : '#1e40af',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {runningAI && <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
          {aiStatus}
        </div>
      )}

      {/* AI Recommendation Pipeline */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '12px', 
        border: '1px solid #e5e7eb', 
        marginBottom: '24px',
        overflow: 'hidden'
      }}>
        <button
          onClick={() => setPipelineExpanded(!pipelineExpanded)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>
              AI Recommendation Pipeline
            </span>
            <span style={{ 
              padding: '4px 10px', 
              backgroundColor: '#10b981', 
              color: 'white', 
              fontSize: '12px', 
              fontWeight: '500',
              borderRadius: '4px' 
            }}>
              All Stages Complete
            </span>
          </div>
          {pipelineExpanded ? (
            <ChevronUp style={{ width: '20px', height: '20px', color: '#6b7280' }} />
          ) : (
            <ChevronDown style={{ width: '20px', height: '20px', color: '#6b7280' }} />
          )}
        </button>

        {pipelineExpanded && (
          <div style={{ padding: '0 20px 20px' }}>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px' }}>
              Every recommendation goes through our 4-stage ethical AI decision pipeline to ensure fair, transparent, and privacy-preserving results
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'start' }}>
              {/* Left Column - Blue/Lavender */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Stage 1 - Blue */}
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#f5f3ff', 
                  borderRadius: '10px', 
                  border: '1px solid #c4b5fd'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stage 1</span>
                    <CheckCircle style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: '0 0 4px' }}>Matching</p>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: '1.4' }}>
                    LLM analyzes skills, experience, and interests to generate role candidates
                  </p>
                </div>
                
                {/* Stage 3 - Blue */}
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#f5f3ff', 
                  borderRadius: '10px', 
                  border: '1px solid #c4b5fd'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stage 3</span>
                    <CheckCircle style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: '0 0 4px' }}>Explainability</p>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: '1.4' }}>
                    Human-readable reasoning generated with matching factors and gaps
                  </p>
                </div>
              </div>

              {/* Arrows Column */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', paddingTop: '50px', gap: '80px' }}>
                <ChevronRight style={{ width: '24px', height: '24px', color: '#d1d5db' }} />
                <ChevronRight style={{ width: '24px', height: '24px', color: '#d1d5db' }} />
              </div>

              {/* Right Column - Green */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Stage 2 - Green */}
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#f0fdf4', 
                  borderRadius: '10px', 
                  border: '1px solid #86efac'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stage 2</span>
                    <CheckCircle style={{ width: '18px', height: '18px', color: '#22c55e' }} />
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: '0 0 4px' }}>Fairness Audit</p>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: '1.4' }}>
                    Demographic bias checks and statistical fairness tests applied
                  </p>
                </div>
                
                {/* Stage 4 - Green */}
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#f0fdf4', 
                  borderRadius: '10px', 
                  border: '1px solid #86efac'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stage 4</span>
                    <CheckCircle style={{ width: '18px', height: '18px', color: '#22c55e' }} />
                  </div>
                  <p style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: '0 0 4px' }}>Privacy Output</p>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: '1.4' }}>
                    De-identified results with role-based access controls enforced
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All Matches', count: matches.length },
          { key: 'best', label: 'Best Matches', count: bestMatchesCount },
          { key: 'career_switch', label: 'Career Switch', count: careerSwitchCount },
          { key: 'positions', label: 'All Positions', count: allPositions.length },
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            style={{
              padding: '10px 16px',
              backgroundColor: activeFilter === filter.key ? '#10b981' : 'white',
              color: activeFilter === filter.key ? 'white' : '#374151',
              border: `1px solid ${activeFilter === filter.key ? '#10b981' : '#e5e7eb'}`,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search style={{ 
          position: 'absolute', 
          left: '14px', 
          top: '50%', 
          transform: 'translateY(-50%)',
          width: '20px', 
          height: '20px', 
          color: '#9ca3af' 
        }} />
        <input
          type="text"
          placeholder="Search all company positions by title, department, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 14px 14px 44px',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            fontSize: '14px',
            backgroundColor: 'white'
          }}
        />
      </div>

      {/* Job Cards */}
      {filteredMatches.length === 0 ? (
        <div>
          {/* Stats Cards for Empty State */}
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
                <Briefcase style={{ width: '24px', height: '24px', color: '#10b981' }} />
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>0</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Total Matches</div>
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
                <TrendingUp style={{ width: '24px', height: '24px', color: '#2563eb' }} />
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>0</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Best Matches (80%+)</div>
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
                <Sparkles style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>0</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Stretch Opportunities</div>
              </div>
            </div>
          </div>

          {/* Empty State Card */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            border: '1px solid #e5e7eb', 
            padding: '60px 24px',
            textAlign: 'center'
          }}>
            <Briefcase style={{ width: '56px', height: '56px', color: '#d1d5db', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: '0 0 8px' }}>
              No job matches yet
            </h3>
            <p style={{ fontSize: '15px', color: '#6b7280', margin: '0 0 24px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              Complete your profile and add skills to get AI-powered job recommendations
            </p>
            <button
              onClick={() => router.push('/profile')}
              style={{
                padding: '14px 28px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Complete Your Profile
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {filteredMatches.map(match => {
            const skillsWithStatus = match.job?.required_skills?.map(skill => ({
              ...skill,
              hasSkill: hasSkill(skill.skill_id)
            })) || []
            
            const matchedCount = skillsWithStatus.filter(s => s.hasSkill).length
            const totalRequired = skillsWithStatus.length
            const progressPercent = totalRequired > 0 ? (matchedCount / totalRequired) * 100 : 0

            return (
              <div 
                key={match.id}
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '12px', 
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '20px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '4px 10px', 
                        backgroundColor: match.match_type === 'career_switch' ? '#fef3c7' : '#dcfce7',
                        color: match.match_type === 'career_switch' ? '#92400e' : '#166534',
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: '4px',
                        marginBottom: '10px'
                      }}>
                        {match.match_type === 'career_switch' ? 'Career Switch' : 'Best Match'}
                      </span>
                      <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#111827', margin: '0 0 8px' }}>
                        {match.job?.title}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#6b7280' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Building style={{ width: '14px', height: '14px' }} />
                          {match.job?.department}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin style={{ width: '14px', height: '14px' }} />
                          {match.job?.location}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: '32px', 
                        fontWeight: '700', 
                        color: match.match_score >= 80 ? '#10b981' : match.match_score >= 70 ? '#f59e0b' : '#6b7280',
                        lineHeight: 1
                      }}>
                        {match.match_score}%
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Match</div>
                    </div>
                  </div>

                  {/* Insight Box */}
                  {match.insight && (
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '10px 12px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      marginBottom: '14px'
                    }}>
                      <Lightbulb style={{ width: '16px', height: '16px', color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
                      <p style={{ fontSize: '13px', color: '#92400e', margin: 0, lineHeight: '1.4' }}>
                        {match.insight}
                      </p>
                    </div>
                  )}

                  {/* Description */}
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: '1.5' }}>
                    {match.job?.description?.slice(0, 140)}{match.job?.description?.length > 140 ? '...' : ''}
                  </p>

                  {/* Skills Match */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Skills Match</span>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>{matchedCount}/{totalRequired} required skills</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${progressPercent}%`, 
                        backgroundColor: progressPercent >= 80 ? '#10b981' : progressPercent >= 60 ? '#3b82f6' : '#f59e0b',
                        borderRadius: '9999px',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>

                  {/* Skills Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {skillsWithStatus.slice(0, 5).map((skill, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 10px',
                          backgroundColor: skill.hasSkill ? '#dcfce7' : '#f9fafb',
                          color: skill.hasSkill ? '#166534' : '#6b7280',
                          fontSize: '12px',
                          fontWeight: '500',
                          borderRadius: '6px',
                          border: `1px solid ${skill.hasSkill ? '#bbf7d0' : '#e5e7eb'}`
                        }}
                      >
                        {skill.hasSkill ? (
                          <CheckCircle style={{ width: '12px', height: '12px' }} />
                        ) : (
                          <XCircle style={{ width: '12px', height: '12px' }} />
                        )}
                        {skill.skill_name}
                      </span>
                    ))}
                    {skillsWithStatus.length > 5 && (
                      <span style={{ fontSize: '12px', color: '#9ca3af', padding: '5px 4px' }}>
                        +{skillsWithStatus.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                {/* View Details Button */}
                <button
                  onClick={() => router.push(`/jobs/${match.job_id}`)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '14px',
                    backgroundColor: '#f9fafb',
                    border: 'none',
                    borderTop: '1px solid #e5e7eb',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  View Details
                  <ChevronRight style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}