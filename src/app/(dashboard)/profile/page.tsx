'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  User, Upload, FileText, Video, MapPin, CheckCircle, 
  Plus, Briefcase, Award, TrendingUp, Edit2, X, Trash2,
  Loader2, Eye, Download, Sparkles, ExternalLink,
  Calendar, RefreshCw, Check, Camera, Play, Lock, Globe, Linkedin, Target
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
  job_title: string | null
  department: string | null
  years_in_role: number
  avatar_url: string | null
  video_url: string | null
  resume_url: string | null
  resume_filename: string | null
  resume_uploaded_at: string | null
  profile_strength: number
  location: string | null
  open_to_relocation: boolean
}

interface Skill {
  id: string
  skill_id: string
  name: string
  category: string
  verified: boolean
  source: string
}

interface Certification {
  id: string
  name: string
  issuer: string
  issued_date: string | null
  expiry_date: string | null
  credential_id: string | null
  credential_url: string | null
}

interface CareerInterest {
  id: string
  interest: string
}

interface ExtractedKeyword {
  id: string
  keyword: string
  source: string
}

interface JobApplication {
  id: string
  job_title: string
  applied_at: string
  status: string
  skills_to_develop: string[]
}

interface WorkModePreference {
  id: string
  work_mode: string
}

interface WishlistLocation {
  id: string
  location: string
}

// PDF extraction function
async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item: any) => item.str).join(' ')
    fullText += pageText + '\n'
  }
  return fullText.trim()
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [careerInterests, setCareerInterests] = useState<CareerInterest[]>([])
  const [keywords, setKeywords] = useState<ExtractedKeyword[]>([])
  const [allSkills, setAllSkills] = useState<{id: string, name: string, category: string}[]>([])
  const [jobMatchCount, setJobMatchCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [workModes, setWorkModes] = useState<WorkModePreference[]>([])
  const [wishlistLocations, setWishlistLocations] = useState<WishlistLocation[]>([])
  
  // Modal states
  const [showAddCertification, setShowAddCertification] = useState(false)
  const [showAddInterest, setShowAddInterest] = useState(false)
  const [showEditInterests, setShowEditInterests] = useState(false)
  const [showVideoRecorder, setShowVideoRecorder] = useState(false)
  const [showEditLocations, setShowEditLocations] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  
  // Upload & AI states
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [extractionStatus, setExtractionStatus] = useState('')
  const [analyzingVideo, setAnalyzingVideo] = useState(false)
  const [videoAnalysisStatus, setVideoAnalysisStatus] = useState('')
  const [videoPlaying, setVideoPlaying] = useState(false)
  
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const videoPlayerRef = useRef<HTMLVideoElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Load profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData)
    }

    // Load user skills with taxonomy
    const { data: skillsData } = await supabase
      .from('user_skills')
      .select(`id, skill_id, verified, source, skills_taxonomy (name, category)`)
      .eq('profile_id', user.id)

    if (skillsData) {
      setSkills(skillsData.map((s: any) => ({
        id: s.id,
        skill_id: s.skill_id,
        name: s.skills_taxonomy?.name || 'Unknown',
        category: s.skills_taxonomy?.category || 'other',
        verified: s.verified,
        source: s.source || 'manual'
      })))
    }

    // Load all available skills
    const { data: allSkillsData } = await supabase
      .from('skills_taxonomy')
      .select('id, name, category')
      .order('name')
    if (allSkillsData) setAllSkills(allSkillsData)

    // Load certifications
    const { data: certsData } = await supabase
      .from('certifications')
      .select('*')
      .eq('profile_id', user.id)
      .order('issued_date', { ascending: false })
    if (certsData) setCertifications(certsData)

    // Load career interests
    const { data: interestsData } = await supabase
      .from('career_interests')
      .select('*')
      .eq('profile_id', user.id)
    if (interestsData) setCareerInterests(interestsData)

    // Load extracted keywords
    const { data: keywordsData } = await supabase
      .from('extracted_keywords')
      .select('*')
      .eq('profile_id', user.id)
    if (keywordsData) setKeywords(keywordsData)

    // Load work mode preferences
    const { data: workModesData } = await supabase
      .from('work_mode_preferences')
      .select('*')
      .eq('profile_id', user.id)
    if (workModesData) setWorkModes(workModesData)

    // Load wishlist locations
    const { data: locationsData } = await supabase
      .from('location_wishlist')
      .select('*')
      .eq('profile_id', user.id)
    if (locationsData) setWishlistLocations(locationsData)

    // Load job applications
    const { data: appsData } = await supabase
      .from('job_applications')
      .select(`id, status, applied_at, job_postings (title)`)
      .eq('profile_id', user.id)
      .order('applied_at', { ascending: false })
      .limit(5)
    
    if (appsData) {
      setApplications(appsData.map((a: any) => ({
        id: a.id,
        job_title: a.job_postings?.title || 'Unknown Position',
        applied_at: a.applied_at,
        status: a.status,
        skills_to_develop: []
      })))
    }

    // Load job match count
    const { count } = await supabase
      .from('job_matches')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', user.id)
    setJobMatchCount(count || 0)

    setLoading(false)
  }

  // Format keyword to Title Case
  const formatKeyword = (keyword: string) => {
    const acronyms = ['AI', 'IT', 'HR', 'UI', 'UX', 'API', 'SQL', 'CSS', 'HTML', 'JS', 'TS', 'AWS', 'GCP', 'ML', 'NLP', 'KPI', 'ROI', 'B2B', 'B2C', 'SaaS', 'CRM', 'ERP', 'ITSM']
    return keyword.split(' ').map(word => {
      const upperWord = word.toUpperCase()
      if (acronyms.includes(upperWord)) return upperWord
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }).join(' ')
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const formatFullDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Resume upload handler
  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploadingResume(true)
    setExtractionStatus('Uploading resume...')
    
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase()
      const fileName = `${profile.id}/resume_${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName)

      await supabase.from('profiles').update({
        resume_url: publicUrl,
        resume_filename: file.name,
        resume_uploaded_at: new Date().toISOString()
      }).eq('id', profile.id)

      setExtractionStatus('Extracting text from PDF...')

      if (fileExt === 'pdf') {
        const text = await extractTextFromPDF(file)
        
        setExtractionStatus('AI is analyzing your resume...')
        
        const response = await fetch('/api/ai/extract-skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeText: text, profileId: profile.id })
        })

        const result = await response.json()
        if (result.skills) {
          setExtractionStatus(`Found ${result.skills.length} skills!`)
        }
      }

      loadData()
    } catch (error: any) {
      console.error('Upload error:', error)
      alert('Error uploading resume: ' + error.message)
    } finally {
      setUploadingResume(false)
      setTimeout(() => setExtractionStatus(''), 3000)
    }
  }

  // Video upload handler
  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploadingVideo(true)
    
    try {
      const fileName = `${profile.id}/video_${Date.now()}.${file.name.split('.').pop()}`
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName)

      await supabase.from('profiles').update({
        video_url: publicUrl
      }).eq('id', profile.id)

      loadData()
    } catch (error: any) {
      console.error('Video upload error:', error)
      alert('Error uploading video: ' + error.message)
    } finally {
      setUploadingVideo(false)
    }
  }

  // Avatar upload handler
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploadingAvatar(true)
    
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase()
      const fileName = `${profile.id}/avatar_${Date.now()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      await supabase.from('profiles').update({
        avatar_url: publicUrl
      }).eq('id', profile.id)

      loadData()
    } catch (error: any) {
      console.error('Avatar upload error:', error)
      alert('Error uploading photo: ' + error.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  // Delete handlers
  async function deleteCertification(certId: string) {
    await supabase.from('certifications').delete().eq('id', certId)
    setCertifications(certifications.filter(c => c.id !== certId))
  }

  async function deleteInterest(interestId: string) {
    await supabase.from('career_interests').delete().eq('id', interestId)
    setCareerInterests(careerInterests.filter(i => i.id !== interestId))
  }

  // Toggle work mode
  async function toggleWorkMode(mode: string) {
    if (!profile) return
    const existing = workModes.find(w => w.work_mode === mode)
    if (existing) {
      await supabase.from('work_mode_preferences').delete().eq('id', existing.id)
      setWorkModes(workModes.filter(w => w.id !== existing.id))
    } else {
      const { data } = await supabase.from('work_mode_preferences')
        .insert({ profile_id: profile.id, work_mode: mode })
        .select()
        .single()
      if (data) setWorkModes([...workModes, data])
    }
  }

  // Play video
  function playVideo() {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.play()
      setVideoPlaying(true)
    }
  }

  // Group skills by category
  const groupedSkills = skills.reduce((acc, skill) => {
    const cat = skill.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(skill)
    return acc
  }, {} as Record<string, Skill[]>)

  const categoryLabels: Record<string, string> = {
    technical: 'Technical',
    soft: 'Soft Skills',
    process: 'Process',
    domain: 'Domain',
    other: 'Other'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: '48px', height: '48px', color: '#10b981', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>Loading profile...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under_review': return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }
      case 'interview': return { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' }
      case 'offer': return { bg: '#dcfce7', text: '#16a34a', border: '#86efac' }
      case 'rejected': return { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' }
      default: return { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' }
    }
  }

  const formatStatus = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {/* Hidden file inputs */}
      <input type="file" ref={resumeInputRef} onChange={handleResumeUpload} accept=".pdf" style={{ display: 'none' }} />
      <input type="file" ref={videoInputRef} onChange={handleVideoUpload} accept="video/*" style={{ display: 'none' }} />
      <input type="file" ref={avatarInputRef} onChange={handleAvatarUpload} accept="image/*" style={{ display: 'none' }} />

      {/* Profile Header Card */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '32px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* Avatar - Clickable to upload photo */}
          <div 
            onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
            style={{ 
              position: 'relative',
              width: '96px', 
              height: '96px', 
              borderRadius: '50%', 
              backgroundColor: profile?.avatar_url ? 'transparent' : '#10b981', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white', 
              fontSize: '36px', 
              fontWeight: '600', 
              flexShrink: 0,
              cursor: 'pointer',
              overflow: 'hidden'
            }}
          >
            {uploadingAvatar ? (
              <Loader2 style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite' }} />
            ) : profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.full_name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : (
              profile?.full_name?.charAt(0).toUpperCase() || 'U'
            )}
            {/* Hover overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.2s'
            }} className="avatar-overlay">
              <Camera style={{ width: '24px', height: '24px', color: 'white' }} />
            </div>
          </div>
          
          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', margin: '0 0 8px' }}>
                  {profile?.full_name || 'Your Name'}
                </h1>
                <p style={{ fontSize: '18px', color: '#6b7280', margin: '0 0 4px' }}>
                  {profile?.job_title || 'Add your job title'}
                </p>
                <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
                  {profile?.department || 'Add your department'}
                </p>
                {profile?.location && (
                  <p style={{ fontSize: '14px', color: '#9ca3af', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin style={{ width: '14px', height: '14px' }} /> {profile.location}
                  </p>
                )}
              </div>
              <button 
                onClick={() => setShowEditProfile(true)} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '10px 20px', 
                  backgroundColor: '#f3f4f6', 
                  border: 'none', 
                  borderRadius: '8px', 
                  color: '#374151', 
                  fontWeight: '500', 
                  fontSize: '14px', 
                  cursor: 'pointer' 
                }}
              >
                <Edit2 style={{ width: '16px', height: '16px' }} /> Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '24px' }}>
          <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>{jobMatchCount}</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Job Matches</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{skills.length}</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Skills</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#f5f3ff', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>{profile?.years_in_role || 0}</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Years Experience</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#fffbeb', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>{certifications.length}</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Certifications</div>
          </div>
        </div>
      </div>

      {/* Connect to LinkedIn Section */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#0077b5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Linkedin style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 4px' }}>Connect to LinkedIn</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px', lineHeight: '1.5' }}>
              Import your LinkedIn profile to automatically populate your work experience, education, skills, and certifications. This helps us create a more complete profile for better job matching.
            </p>
            <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#0077b5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
              <Linkedin style={{ width: '18px', height: '18px' }} />
              Connect LinkedIn Profile
            </button>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock style={{ width: '12px', height: '12px' }} />
              Your LinkedIn data is securely imported and never shared without your permission
            </p>
          </div>
        </div>
      </div>

      {/* Resume Section */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <FileText style={{ width: '20px', height: '20px', color: '#6b7280' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>Resume</h3>
        </div>
        
        {profile?.resume_url ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', backgroundColor: '#e5e7eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText style={{ width: '20px', height: '20px', color: '#6b7280' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '500', color: '#111827' }}>{profile.resume_filename || 'Resume.pdf'}</span>
                  <CheckCircle style={{ width: '16px', height: '16px', color: '#10b981' }} />
                </div>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>
                  Uploaded {formatFullDate(profile.resume_uploaded_at)} • 245 KB
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => window.open(profile.resume_url!, '_blank')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151', fontSize: '14px', cursor: 'pointer' }}>
                <Eye style={{ width: '16px', height: '16px' }} /> View
              </button>
              <button onClick={() => window.open(profile.resume_url!, '_blank')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151', fontSize: '14px', cursor: 'pointer' }}>
                <Download style={{ width: '16px', height: '16px' }} /> Download
              </button>
              <button onClick={() => resumeInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151', fontSize: '14px', cursor: 'pointer' }}>
                <RefreshCw style={{ width: '16px', height: '16px' }} /> Replace
              </button>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => !uploadingResume && resumeInputRef.current?.click()}
            style={{ border: '2px dashed #d1d5db', borderRadius: '12px', padding: '32px', textAlign: 'center', cursor: uploadingResume ? 'not-allowed' : 'pointer', backgroundColor: '#fafafa' }}
          >
            {uploadingResume ? (
              <>
                <Loader2 style={{ width: '32px', height: '32px', color: '#10b981', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                <p style={{ color: '#374151', fontWeight: '500', margin: 0 }}>{extractionStatus || 'Uploading...'}</p>
              </>
            ) : (
              <>
                <Upload style={{ width: '32px', height: '32px', color: '#9ca3af', margin: '0 auto 8px' }} />
                <p style={{ color: '#374151', fontWeight: '500', margin: '0 0 4px' }}>Upload your resume</p>
                <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>PDF up to 10MB</p>
              </>
            )}
          </div>
        )}
        
        {extractionStatus && profile?.resume_url && (
          <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: '#ecfdf5', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 style={{ width: '16px', height: '16px', color: '#10b981', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#065f46', fontSize: '14px' }}>{extractionStatus}</span>
          </div>
        )}
      </div>

      {/* About Me Video Section */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Video style={{ width: '20px', height: '20px', color: '#10b981' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>About Me Video</h3>
        </div>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px' }}>
          Upload a short video introducing yourself, your work experience, and your career goals. Our AI will extract keywords and skills to match you with relevant jobs.
        </p>
        
        {/* Privacy Notice */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px 16px', backgroundColor: '#ecfdf5', borderRadius: '8px', marginBottom: '16px' }}>
          <Lock style={{ width: '16px', height: '16px', color: '#10b981', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '13px', color: '#065f46', margin: 0 }}>
            <strong>Privacy Protected:</strong> Your video is encrypted and accessible only to you and authorized HR personnel. It will never be shared externally without your consent.
          </p>
        </div>

        {profile?.video_url ? (
          <>
            {/* Video Player */}
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#111827', marginBottom: '16px' }}>
              <video 
                ref={videoPlayerRef}
                src={profile.video_url} 
                style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }}
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
                onEnded={() => setVideoPlaying(false)}
                controls={videoPlaying}
              />
              {!videoPlaying && (
                <div 
                  onClick={playVideo}
                  style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.3)' }}
                >
                  <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
                    <Play style={{ width: '20px', height: '20px' }} fill="white" />
                    Play Video
                  </button>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: '12px', right: '12px', padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: '4px', color: 'white', fontSize: '13px' }}>
                2:34
              </div>
            </div>

            {/* AI-Extracted Keywords from Video */}
            {keywords.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Sparkles style={{ width: '16px', height: '16px', color: '#10b981' }} />
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>AI-Extracted Keywords</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {keywords.map(kw => (
                    <span key={kw.id} style={{ padding: '6px 14px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '9999px', fontSize: '13px', fontWeight: '500', border: '1px solid #a7f3d0' }}>
                      {formatKeyword(kw.keyword)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={() => videoInputRef.current?.click()}
              style={{ color: '#10b981', fontSize: '14px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Upload a new video
            </button>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div 
              onClick={() => setShowVideoRecorder(true)}
              style={{ border: '2px dashed #a7f3d0', borderRadius: '12px', padding: '32px 16px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#ecfdf5' }}
            >
              <Camera style={{ width: '32px', height: '32px', color: '#10b981', margin: '0 auto 8px' }} />
              <p style={{ fontWeight: '600', color: '#065f46', margin: '0 0 4px', fontSize: '14px' }}>Record Video</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Use your camera</p>
            </div>
            <div 
              onClick={() => videoInputRef.current?.click()}
              style={{ border: '2px dashed #d1d5db', borderRadius: '12px', padding: '32px 16px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#fafafa' }}
            >
              <Upload style={{ width: '32px', height: '32px', color: '#6b7280', margin: '0 auto 8px' }} />
              <p style={{ fontWeight: '600', color: '#374151', margin: '0 0 4px', fontSize: '14px' }}>Upload Video</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>MP4, MOV up to 100MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Extracted Skills Section */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '0 0 8px' }}>Extracted Skills</h3>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px' }}>
          These skills were automatically identified from your recording and resume. Verified skills have been confirmed through assessments.
        </p>

        {Object.entries(groupedSkills).map(([category, categorySkills]) => (
          <div key={category} style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '0 0 10px' }}>{categoryLabels[category] || category}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {categorySkills.map(skill => (
                <span 
                  key={skill.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    padding: '8px 14px', 
                    backgroundColor: skill.verified ? '#ecfdf5' : '#f3f4f6', 
                    color: skill.verified ? '#065f46' : '#374151', 
                    borderRadius: '9999px', 
                    fontSize: '13px', 
                    fontWeight: '500',
                    border: `1px solid ${skill.verified ? '#a7f3d0' : '#e5e7eb'}`
                  }}
                >
                  {skill.name}
                  {skill.verified && <CheckCircle style={{ width: '14px', height: '14px' }} />}
                </span>
              ))}
            </div>
          </div>
        ))}

        {skills.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
            No skills extracted yet. Upload a resume or record a video to get started.
          </p>
        )}
      </div>

      {/* Certifications Section */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>Certifications</h3>
          </div>
          <button onClick={() => setShowAddCertification(true)} style={{ color: '#2563eb', fontSize: '14px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}>
            Add Certification
          </button>
        </div>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px' }}>
          Professional certifications that validate your expertise and skills.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {certifications.map(cert => (
            <div key={cert.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px', backgroundColor: '#fffbeb', borderRadius: '12px', border: '1px solid #fef3c7' }}>
              <div style={{ width: '44px', height: '44px', backgroundColor: '#fef3c7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Award style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '600', color: '#111827', margin: '0 0 2px', fontSize: '15px' }}>{cert.name}</p>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 6px' }}>{cert.issuer}</p>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
                  Issued: {formatDate(cert.issued_date)}
                  {cert.expiry_date && ` • Expires: ${formatDate(cert.expiry_date)}`}
                  {cert.credential_id && ` • ID: ${cert.credential_id}`}
                </p>
                {cert.credential_url && (
                  <a href={cert.credential_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb', fontSize: '13px', marginTop: '8px', textDecoration: 'none' }}>
                    View Credential <ExternalLink style={{ width: '12px', height: '12px' }} />
                  </a>
                )}
              </div>
              <button onClick={() => deleteCertification(cert.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}>
                <Trash2 style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          ))}
        </div>

        {certifications.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
            No certifications added yet.
          </p>
        )}
      </div>

      {/* Career Interests Section */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>Career Interests</h3>
          <button
            onClick={() => setShowEditInterests(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
          >
            <Edit2 style={{ width: '14px', height: '14px' }} /> Edit
          </button>
        </div>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px' }}>
          Roles and career paths you're interested in exploring.
        </p>
        {careerInterests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <Target style={{ width: '32px', height: '32px', color: '#9ca3af', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 12px' }}>No career interests added yet</p>
            <button 
              onClick={() => setShowEditInterests(true)}
              style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
            >
              Add Your Interests
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {careerInterests.map(interest => (
              <span key={interest.id} style={{ padding: '10px 18px', backgroundColor: 'white', color: '#2563eb', borderRadius: '9999px', fontSize: '14px', fontWeight: '500', border: '2px solid #2563eb' }}>
                {interest.interest}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Location Preferences Section */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <MapPin style={{ width: '20px', height: '20px', color: '#6b7280' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>Location Preferences</h3>
        </div>

        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 12px' }}>Preferred Work Modes</p>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          {['remote', 'hybrid', 'onsite'].map(mode => {
            const isSelected = workModes.some(w => w.work_mode === mode)
            return (
              <button
                key={mode}
                onClick={() => toggleWorkMode(mode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: isSelected ? '#eff6ff' : 'white',
                  color: isSelected ? '#2563eb' : '#6b7280',
                  border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <Globe style={{ width: '16px', height: '16px' }} />
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            )
          })}
        </div>

        {profile?.open_to_relocation && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <MapPin style={{ width: '18px', height: '18px', color: '#6b7280' }} />
            <div>
              <p style={{ fontWeight: '500', color: '#111827', margin: 0, fontSize: '14px' }}>Open to Relocation</p>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>Willing to relocate for the right opportunity</p>
            </div>
          </div>
        )}
      </div>

      {/* Wishlist Locations Section */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>Wishlist Locations</h3>
          </div>
          <button onClick={() => setShowEditLocations(true)} style={{ color: '#2563eb', fontSize: '14px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}>
            Edit
          </button>
        </div>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px' }}>
          Your preferred locations for internal opportunities. We'll prioritize matches in these areas.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {wishlistLocations.map(loc => (
            <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', backgroundColor: '#faf5ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
              <MapPin style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
              <span style={{ color: '#374151', fontSize: '14px' }}>{loc.location}</span>
            </div>
          ))}
        </div>

        {wishlistLocations.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
            No preferred locations added yet.
          </p>
        )}
      </div>

      {/* Applied Jobs Section */}
      {applications.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '0 0 8px' }}>Applied Jobs</h3>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px' }}>
            Track the status of your internal job applications.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {applications.map(app => {
              const statusColors = getStatusColor(app.status)
              return (
                <div key={app.id} style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <p style={{ fontWeight: '600', color: '#111827', margin: '0 0 4px', fontSize: '15px' }}>{app.job_title}</p>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Applied {formatFullDate(app.applied_at)}</p>
                    </div>
                    <span style={{ padding: '4px 12px', backgroundColor: statusColors.bg, color: statusColors.text, border: `1px solid ${statusColors.border}`, borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                      {formatStatus(app.status)}
                    </span>
                  </div>
                  {app.skills_to_develop.length > 0 && (
                    <div>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: '8px 0 6px' }}>Skills to develop:</p>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {app.skills_to_develop.map((skill, idx) => (
                          <span key={idx} style={{ padding: '4px 10px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* CTA Banner */}
      <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)', borderRadius: '16px', padding: '32px', color: 'white' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px' }}>Ready to Explore Opportunities?</h3>
        <p style={{ fontSize: '15px', opacity: 0.9, margin: '0 0 20px', lineHeight: '1.5' }}>
          Based on your skills and interests, we've found {jobMatchCount} matching roles in Customer Experience and recommended learning paths to help you transition.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => router.push('/jobs')}
            style={{ padding: '12px 24px', backgroundColor: 'white', color: '#6366f1', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
          >
            View Job Matches
          </button>
          <button style={{ padding: '12px 24px', backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
            Start Skills Assessment
          </button>
        </div>
      </div>

      {/* Modals */}
      {showAddCertification && (
        <AddCertificationModal 
          profileId={profile?.id} 
          supabase={supabase} 
          onClose={() => setShowAddCertification(false)} 
          onSave={() => { loadData(); setShowAddCertification(false); }} 
        />
      )}
      
      {showAddInterest && (
        <AddInterestModal 
          profileId={profile?.id} 
          supabase={supabase} 
          onClose={() => setShowAddInterest(false)} 
          onSave={() => { loadData(); setShowAddInterest(false); }} 
        />
      )}

      {showEditInterests && profile && (
        <EditInterestsModal
          profileId={profile.id}
          interests={careerInterests}
          supabase={supabase}
          onClose={() => setShowEditInterests(false)}
          onSave={() => { loadData(); setShowEditInterests(false); }}
        />
      )}

      {showVideoRecorder && profile && (
        <VideoRecorderModal 
          profileId={profile.id} 
          supabase={supabase} 
          onClose={() => setShowVideoRecorder(false)} 
          onSave={() => { loadData(); setShowVideoRecorder(false); }} 
        />
      )}

      {showEditLocations && profile && (
        <EditLocationsModal
          profileId={profile.id}
          locations={wishlistLocations}
          supabase={supabase}
          onClose={() => setShowEditLocations(false)}
          onSave={() => { loadData(); setShowEditLocations(false); }}
        />
      )}

      {showEditProfile && profile && (
        <EditProfileModal
          profile={profile}
          supabase={supabase}
          onClose={() => setShowEditProfile(false)}
          onSave={() => { loadData(); setShowEditProfile(false); }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .avatar-overlay { opacity: 0; transition: opacity 0.2s; }
        div:hover > .avatar-overlay { opacity: 1; }
      `}</style>
    </div>
  )
}

// === MODAL COMPONENTS ===

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X style={{ width: '20px', height: '20px' }} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }
const btnStyle: React.CSSProperties = { width: '100%', padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }

function AddCertificationModal({ profileId, supabase, onClose, onSave }: any) {
  const [form, setForm] = useState({ name: '', issuer: '', issued_date: '', expiry_date: '', credential_id: '', credential_url: '' })
  const [saving, setSaving] = useState(false)
  const [credentialFile, setCredentialFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCredentialFile(file)
      // Clear the URL field if user selects a file
      setForm({ ...form, credential_url: '' })
    }
  }

  const handleSave = async () => {
    if (!form.name || !form.issuer) return
    setSaving(true)
    
    let finalCredentialUrl = form.credential_url

    // If user selected a file, upload it first
    if (credentialFile) {
      setUploadingFile(true)
      try {
        const fileExt = credentialFile.name.split('.').pop()?.toLowerCase()
        const fileName = `${profileId}/cert_${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('certifications')
          .upload(fileName, credentialFile, { upsert: true })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          alert('Error uploading credential file: ' + uploadError.message)
          setSaving(false)
          setUploadingFile(false)
          return
        }

        const { data: { publicUrl } } = supabase.storage
          .from('certifications')
          .getPublicUrl(fileName)
        
        finalCredentialUrl = publicUrl
      } catch (err: any) {
        console.error('File upload error:', err)
        alert('Error uploading file: ' + err.message)
        setSaving(false)
        setUploadingFile(false)
        return
      }
      setUploadingFile(false)
    }

    // Save certification to database
    const { error } = await supabase.from('certifications').insert({
      profile_id: profileId,
      name: form.name,
      issuer: form.issuer,
      issued_date: form.issued_date || null,
      expiry_date: form.expiry_date || null,
      credential_id: form.credential_id || null,
      credential_url: finalCredentialUrl || null
    })

    if (error) {
      console.error('Save error:', error)
      alert('Error saving certification: ' + error.message)
      setSaving(false)
      return
    }

    onSave()
  }

  return (
    <Modal title="Add Certification" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          accept=".pdf,.png,.jpg,.jpeg,.webp" 
          style={{ display: 'none' }} 
        />
        
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Certification Name *</label>
          <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. AWS Certified Cloud Practitioner" style={inputStyle} />
        </div>
        
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Issuing Organization *</label>
          <input type="text" value={form.issuer} onChange={e => setForm({...form, issuer: e.target.value})} placeholder="e.g. Amazon Web Services" style={inputStyle} />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Issue Date</label>
            <input type="date" value={form.issued_date} onChange={e => setForm({...form, issued_date: e.target.value})} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Expiry Date</label>
            <input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} style={inputStyle} />
          </div>
        </div>
        
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Credential ID</label>
          <input type="text" value={form.credential_id} onChange={e => setForm({...form, credential_id: e.target.value})} placeholder="e.g. AWS-CCP-2025-1234" style={inputStyle} />
        </div>
        
        {/* Credential Document Section */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Credential Document</label>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }}>Upload a file or enter a URL to your credential</p>
          
          {/* File Upload */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              border: '2px dashed #d1d5db', 
              borderRadius: '8px', 
              padding: '16px', 
              textAlign: 'center', 
              cursor: 'pointer',
              backgroundColor: credentialFile ? '#ecfdf5' : '#fafafa',
              marginBottom: '8px'
            }}
          >
            {credentialFile ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <FileText style={{ width: '20px', height: '20px', color: '#10b981' }} />
                <span style={{ color: '#065f46', fontWeight: '500' }}>{credentialFile.name}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCredentialFile(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                >
                  <X style={{ width: '16px', height: '16px', color: '#6b7280' }} />
                </button>
              </div>
            ) : (
              <>
                <Upload style={{ width: '24px', height: '24px', color: '#9ca3af', margin: '0 auto 4px' }} />
                <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>Click to upload PDF or image</p>
              </>
            )}
          </div>
          
          {/* OR divider */}
          {!credentialFile && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>OR</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
              </div>
              
              {/* URL Input */}
              <input 
                type="url" 
                value={form.credential_url} 
                onChange={e => setForm({...form, credential_url: e.target.value})} 
                placeholder="https://credly.com/badges/..." 
                style={inputStyle} 
              />
            </>
          )}
        </div>
        
        <button 
          onClick={handleSave} 
          disabled={saving || !form.name || !form.issuer} 
          style={{...btnStyle, opacity: saving || !form.name || !form.issuer ? 0.5 : 1}}
        >
          {uploadingFile ? 'Uploading file...' : saving ? 'Saving...' : 'Add Certification'}
        </button>
      </div>
    </Modal>
  )
}

function AddInterestModal({ profileId, supabase, onClose, onSave }: any) {
  const [interest, setInterest] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!interest.trim()) return
    setSaving(true)
    await supabase.from('career_interests').insert({ profile_id: profileId, interest: interest.trim() })
    onSave()
  }

  return (
    <Modal title="Add Career Interest" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Career Interest</label><input type="text" value={interest} onChange={e => setInterest(e.target.value)} placeholder="e.g. Product Management" style={inputStyle} /></div>
        <button onClick={handleSave} disabled={saving || !interest.trim()} style={{...btnStyle, opacity: saving || !interest.trim() ? 0.5 : 1}}>{saving ? 'Saving...' : 'Add Interest'}</button>
      </div>
    </Modal>
  )
}

function EditInterestsModal({ profileId, interests, supabase, onClose, onSave }: any) {
  const [newInterest, setNewInterest] = useState('')
  const [localInterests, setLocalInterests] = useState(interests)
  const [saving, setSaving] = useState(false)

  // Suggested career interests
  const suggestedInterests = [
    'Product Management',
    'Engineering Management',
    'Technical Lead',
    'Solutions Architect',
    'Data Science',
    'UX Design',
    'DevOps',
    'Customer Success',
    'Sales Engineering',
    'Technical Writing',
    'Project Management',
    'Business Analysis'
  ]

  const addInterest = async () => {
    if (!newInterest.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('career_interests')
      .insert({ profile_id: profileId, interest: newInterest.trim() })
      .select()
      .single()
    
    if (data) {
      setLocalInterests([...localInterests, data])
      setNewInterest('')
    }
    setSaving(false)
  }

  const addSuggestedInterest = async (interest: string) => {
    // Check if already exists
    if (localInterests.some((i: any) => i.interest.toLowerCase() === interest.toLowerCase())) return
    
    setSaving(true)
    const { data } = await supabase
      .from('career_interests')
      .insert({ profile_id: profileId, interest })
      .select()
      .single()
    
    if (data) {
      setLocalInterests([...localInterests, data])
    }
    setSaving(false)
  }

  const removeInterest = async (id: string) => {
    await supabase.from('career_interests').delete().eq('id', id)
    setLocalInterests(localInterests.filter((i: any) => i.id !== id))
  }

  // Filter out suggestions that are already added
  const availableSuggestions = suggestedInterests.filter(
    s => !localInterests.some((i: any) => i.interest.toLowerCase() === s.toLowerCase())
  )

  return (
    <Modal title="Edit Career Interests" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Add new interest */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
            Add Career Interest
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              value={newInterest} 
              onChange={e => setNewInterest(e.target.value)} 
              placeholder="e.g. Senior Software Engineer" 
              style={{...inputStyle, flex: 1}} 
              onKeyPress={e => e.key === 'Enter' && addInterest()} 
            />
            <button 
              onClick={addInterest} 
              disabled={!newInterest.trim() || saving}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: newInterest.trim() ? '#10b981' : '#e5e7eb', 
                color: newInterest.trim() ? 'white' : '#9ca3af', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: newInterest.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '500'
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {availableSuggestions.length > 0 && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
              Suggestions
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availableSuggestions.slice(0, 6).map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => addSuggestedInterest(suggestion)}
                  disabled={saving}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f3f4f6',
                    color: '#4b5563',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus style={{ width: '12px', height: '12px' }} />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current interests */}
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
            Your Career Interests ({localInterests.length})
          </label>
          {localInterests.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#9ca3af', fontStyle: 'italic' }}>
              No interests added yet. Add some above!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {localInterests.map((interest: any) => (
                <div 
                  key={interest.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '12px 16px', 
                    backgroundColor: '#eff6ff', 
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe'
                  }}
                >
                  <span style={{ fontWeight: '500', color: '#1e40af' }}>{interest.interest}</span>
                  <button 
                    onClick={() => removeInterest(interest.id)} 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer', 
                      color: '#9ca3af',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <X style={{ width: '18px', height: '18px' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={onSave} style={btnStyle}>Done</button>
      </div>
    </Modal>
  )
}

function EditLocationsModal({ profileId, locations, supabase, onClose, onSave }: any) {
  const [newLocation, setNewLocation] = useState('')
  const [localLocations, setLocalLocations] = useState(locations)

  const addLocation = async () => {
    if (!newLocation.trim()) return
    const { data } = await supabase.from('location_wishlist').insert({ profile_id: profileId, location: newLocation.trim() }).select().single()
    if (data) {
      setLocalLocations([...localLocations, data])
      setNewLocation('')
    }
  }

  const removeLocation = async (id: string) => {
    await supabase.from('location_wishlist').delete().eq('id', id)
    setLocalLocations(localLocations.filter((l: any) => l.id !== id))
  }

  return (
    <Modal title="Edit Wishlist Locations" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="e.g. San Francisco, CA" style={{...inputStyle, flex: 1}} onKeyPress={e => e.key === 'Enter' && addLocation()} />
          <button onClick={addLocation} style={{ padding: '10px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {localLocations.map((loc: any) => (
            <div key={loc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <span>{loc.location}</span>
              <button onClick={() => removeLocation(loc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X style={{ width: '16px', height: '16px' }} /></button>
            </div>
          ))}
        </div>
        <button onClick={onSave} style={btnStyle}>Done</button>
      </div>
    </Modal>
  )
}

function EditProfileModal({ profile, supabase, onClose, onSave }: any) {
  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    job_title: profile.job_title || '',
    department: profile.department || '',
    years_in_role: profile.years_in_role || 0,
    location: profile.location || '',
    open_to_relocation: profile.open_to_relocation || false
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          job_title: form.job_title,
          department: form.department,
          years_in_role: form.years_in_role,
          location: form.location,
          open_to_relocation: form.open_to_relocation
        })
        .eq('id', profile.id)
      
      if (error) {
        console.error('Update error:', error)
        alert('Error saving profile: ' + error.message)
        setSaving(false)
        return
      }
      
      onSave()
    } catch (err: any) {
      console.error('Save error:', err)
      alert('Error: ' + err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Profile" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Full Name</label>
          <input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Job Title</label>
          <input type="text" value={form.job_title} onChange={e => setForm({...form, job_title: e.target.value})} placeholder="e.g. Software Engineer" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Department</label>
          <input type="text" value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="e.g. Engineering" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Years in Role</label>
          <input type="number" value={form.years_in_role} onChange={e => setForm({...form, years_in_role: parseInt(e.target.value) || 0})} min="0" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>Location</label>
          <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Miami, FL" style={inputStyle} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.open_to_relocation} onChange={e => setForm({...form, open_to_relocation: e.target.checked})} />
          <span style={{ fontSize: '14px' }}>Open to relocation</span>
        </label>
        <button onClick={handleSave} disabled={saving} style={{...btnStyle, opacity: saving ? 0.5 : 1}}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  )
}

function VideoRecorderModal({ profileId, supabase, onClose, onSave }: any) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('')

  const MAX_RECORDING_TIME = 120

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(t => {
          if (t >= MAX_RECORDING_TIME) {
            stopRecording()
            return t
          }
          return t + 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  async function startCamera() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      setCameraError('Could not access camera. Please check permissions.')
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
  }

  function startCountdown() {
    setCountdown(3)
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c === 1) {
          clearInterval(interval)
          startRecording()
          return null
        }
        return c! - 1
      })
    }, 1000)
  }

  function startRecording() {
    if (!stream) return
    chunksRef.current = []
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      setRecordedBlob(blob)
      setRecordedUrl(URL.createObjectURL(blob))
    }
    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.start()
    setIsRecording(true)
    setRecordingTime(0)
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  async function uploadAndAnalyze() {
    if (!recordedBlob) return
    setUploading(true)
    setAnalyzing(true)
    setAnalysisStatus('Uploading video...')

    try {
      const fileName = `${profileId}/video_${Date.now()}.webm`
      const { error: uploadError } = await supabase.storage.from('videos').upload(fileName, recordedBlob, { upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName)
      await supabase.from('profiles').update({ video_url: publicUrl }).eq('id', profileId)

      setAnalysisStatus('Transcribing audio...')
      const formData = new FormData()
      formData.append('video', recordedBlob, 'video.webm')
      formData.append('profileId', profileId)

      setAnalysisStatus('Analyzing soft skills...')
      const response = await fetch('/api/ai/analyze-video', { method: 'POST', body: formData })
      const result = await response.json()

      if (result.success) {
        alert(`✅ Video uploaded and analyzed!\nExtracted ${result.stats?.total_skills || 0} skills`)
      }
      
      stopCamera()
      onSave()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setUploading(false)
      setAnalyzing(false)
    }
  }

  function retake() {
    setRecordedBlob(null)
    setRecordedUrl(null)
    setRecordingTime(0)
  }

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Record Video Pitch</h2>
          <button onClick={() => { stopCamera(); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: '24px', height: '24px' }} /></button>
        </div>

        {cameraError ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#dc2626', marginBottom: '16px' }}>{cameraError}</p>
            <button onClick={startCamera} style={btnStyle}>Retry</button>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#111', marginBottom: '16px' }}>
              {recordedUrl ? (
                <video src={recordedUrl} controls style={{ width: '100%', display: 'block' }} />
              ) : (
                <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
              )}
              
              {countdown && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <span style={{ fontSize: '72px', fontWeight: 'bold', color: 'white' }}>{countdown}</span>
                </div>
              )}

              {isRecording && (
                <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: 'rgba(220,38,38,0.9)', borderRadius: '8px' }}>
                  <div style={{ width: '8px', height: '8px', backgroundColor: 'white', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                  <span style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>REC {formatTime(recordingTime)}</span>
                </div>
              )}
            </div>

            {analyzing && (
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 style={{ width: '16px', height: '16px', color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#1d4ed8' }}>{analysisStatus}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              {!recordedUrl ? (
                isRecording ? (
                  <button onClick={stopRecording} style={{ flex: 1, padding: '12px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>Stop Recording</button>
                ) : (
                  <button onClick={startCountdown} disabled={!!countdown} style={{ flex: 1, padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>Start Recording</button>
                )
              ) : (
                <>
                  <button onClick={retake} style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>Retake</button>
                  <button onClick={uploadAndAnalyze} disabled={uploading} style={{ flex: 1, padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
                    {uploading ? 'Processing...' : 'Analyze & Save'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    </div>
  )
}