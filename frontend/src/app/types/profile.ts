export interface Profile {
  id: string;
  name: string;
  role: string;
  department: string;
  yearsExperience: number;
  imageUrl: string;
  totalSkills: number;
  totalMatches: number;
  profileStrength: number;
  uploadType: 'video' | 'audio';
  extractedKeywords: string[];
  extractedSkills: {
    name: string;
    category: string;
    verified: boolean;
  }[];
  interests: string[];
  resumeFileName: string;
  jobMatches: {
    title: string;
    team: string;
    department: string;
    location: string;
    matchScore: number;
    hiringManager: string;
    transferType: string;
    requiredSkills: string[];
    skillGaps: string[];
    description: string;
  }[];
  learningPaths: {
    title: string;
    provider: string;
    duration: string;
    level: string;
    skills: string[];
    enrollmentCount: number;
    rating: number;
  }[];
  competencyAssessments: {
    name: string;
    category: string;
    currentLevel: number;
    targetLevel: number;
    status: 'not-started' | 'in-progress' | 'completed';
  }[];
  // Additional HR-specific fields
  skills?: string[]; // Derived from extractedSkills
  location?: string;
  email?: string;
  joinDate?: string;
  careerStory?: string;
  learningGoals?: string[];
  appliedJobs?: {
    jobTitle: string;
    jobId: string;
    appliedDate: string;
    status: 'pending' | 'under-review' | 'interview' | 'rejected' | 'accepted';
  }[];
  workPreferences?: {
    types: ('remote' | 'hybrid' | 'in-person')[];
    willingToRelocate: boolean;
  };
  wishlistLocations?: string[];
  certifications?: {
    name: string;
    issuer: string;
    issueDate: string;
    expiryDate?: string;
    credentialId?: string;
    credentialUrl?: string;
  }[];
}