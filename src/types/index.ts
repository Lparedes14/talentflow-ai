// ============================================
// src/types/index.ts
// TypeScript Types para InsideTrack
// ============================================

// Enums
export type UserRole = 'employee' | 'recruiter' | 'hr_admin'
export type WorkMode = 'remote' | 'hybrid' | 'onsite'
export type JobStatus = 'draft' | 'open' | 'closed' | 'filled'
export type ApplicationStatus = 'applied' | 'under_review' | 'interview' | 'offer' | 'rejected' | 'withdrawn'
export type AssessmentStatus = 'not_started' | 'in_progress' | 'completed'
export type SkillCategory = 'technical' | 'soft' | 'process' | 'domain'

// Profile
export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  job_title?: string
  department?: string
  years_in_role: number
  avatar_url?: string
  video_url?: string
  video_duration?: string
  resume_url?: string
  resume_filename?: string
  profile_strength: number
  open_to_relocation: boolean
  created_at: string
  updated_at: string
}

export interface ProfileWithRelations extends Profile {
  work_modes: WorkMode[]
  location_wishlist: string[]
  skills: UserSkill[]
  certifications: Certification[]
  career_interests: string[]
  extracted_keywords: string[]
}

// Skills
export interface Skill {
  id: string
  name: string
  category: SkillCategory
  description?: string
}

export interface UserSkill {
  id: string
  profile_id: string
  skill_id: string
  skill?: Skill
  verified: boolean
  source?: string
  confidence_score?: number
}

// Certifications
export interface Certification {
  id: string
  profile_id: string
  name: string
  issuer: string
  issued_date?: string
  expiry_date?: string
  credential_id?: string
  credential_url?: string
}

// Jobs
export interface JobPosting {
  id: string
  title: string
  description?: string
  department: string
  team?: string
  location: string
  work_mode: WorkMode
  status: JobStatus
  urgency?: string
  hiring_manager_id?: string
  hiring_manager?: Profile
  salary_min?: number
  salary_max?: number
  created_at: string
  updated_at: string
}

export interface JobWithSkills extends JobPosting {
  required_skills: JobRequiredSkill[]
}

export interface JobRequiredSkill {
  id: string
  job_id: string
  skill_id: string
  skill?: Skill
  is_required: boolean
}

// Job Matches
export interface JobMatch {
  id: string
  profile_id: string
  job_id: string
  job?: JobPosting
  match_score: number
  match_type?: string
  explanation?: string
  insight?: string
  skills_matched: number
  skills_total: number
  fairness_checked: boolean
  created_at: string
}

export interface JobMatchWithDetails extends JobMatch {
  job: JobWithSkills
  matched_skills: Skill[]
  missing_skills: Skill[]
}

// Applications
export interface JobApplication {
  id: string
  profile_id: string
  job_id: string
  job?: JobPosting
  status: ApplicationStatus
  applied_at: string
  updated_at: string
  notes?: string
}

// Assessments
export interface Assessment {
  id: string
  name: string
  description?: string
  skill_id?: string
  skill?: Skill
  duration_minutes: number
  passing_score: number
}

export interface UserAssessment {
  id: string
  profile_id: string
  assessment_id: string
  assessment?: Assessment
  status: AssessmentStatus
  score?: number
  started_at?: string
  completed_at?: string
}

// Courses
export interface Course {
  id: string
  name: string
  provider: string
  url?: string
  duration_hours?: number
  level?: string
  rating?: number
  enrolled_count: number
}

export interface UserCourse {
  id: string
  profile_id: string
  course_id: string
  course?: Course
  enrolled_at: string
  completed_at?: string
  progress: number
}

// Upskilling Plans
export interface UpskillingPlan {
  id: string
  profile_id: string
  target_job_id?: string
  target_job?: JobPosting
  plan_data: UpskillingPlanData
  estimated_weeks: number
  estimated_cost: number
  explanation?: string
  created_at: string
}

export interface UpskillingPlanData {
  phases: UpskillingPhase[]
  total_courses: number
  total_assessments: number
}

export interface UpskillingPhase {
  name: string
  duration_weeks: number
  items: UpskillingItem[]
}

export interface UpskillingItem {
  type: 'course' | 'assessment' | 'project'
  id: string
  name: string
  provider?: string
  duration?: string
  skill_target?: string
}

// AI Types
export interface SkillExtractionResult {
  skills: ExtractedSkill[]
  keywords: string[]
  career_interests: string[]
  confidence: number
}

export interface ExtractedSkill {
  name: string
  category: SkillCategory
  confidence: number
  source: string
}

export interface JobMatchingResult {
  matches: JobMatchResult[]
  explanation: string
}

export interface JobMatchResult {
  job_id: string
  score: number
  match_type: 'best_match' | 'career_switch' | 'stretch'
  matched_skills: string[]
  missing_skills: string[]
  explanation: string
  insight: string
}

export interface UpskillingPlanResult {
  plan: UpskillingPlanData
  estimated_weeks: number
  estimated_cost: number
  explanation: string
}

// HR Dashboard
export interface HRDashboardStats {
  total_employees: number
  videos_uploaded: number
  total_matches: number
  avg_profile_strength: number
  open_positions: number
  active_applications: number
}

// Audit
export interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id?: string
  actor_id?: string
  details?: Record<string, unknown>
  created_at: string
}

export interface FairnessAudit {
  id: string
  job_id: string
  audit_date: string
  metrics: FairnessMetrics
  passed: boolean
  notes?: string
}

export interface FairnessMetrics {
  demographic_distribution: Record<string, number>
  bias_scores: Record<string, number>
  recommendations: string[]
}

// API Response Types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Form Types
export interface ProfileFormData {
  full_name: string
  job_title: string
  department: string
  years_in_role: number
  open_to_relocation: boolean
  work_modes: WorkMode[]
  location_wishlist: string[]
}

export interface JobPostingFormData {
  title: string
  description: string
  department: string
  team?: string
  location: string
  work_mode: WorkMode
  urgency: string
  required_skills: string[]
  nice_to_have_skills: string[]
  salary_min?: number
  salary_max?: number
}

export interface CertificationFormData {
  name: string
  issuer: string
  issued_date: string
  expiry_date?: string
  credential_id?: string
  credential_url?: string
}