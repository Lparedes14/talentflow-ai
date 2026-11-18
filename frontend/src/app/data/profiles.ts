import { Profile } from '../types/profile';

export const profiles: Profile[] = [
  {
    id: 'christine-wu',
    name: 'Christine Wu',
    role: 'Help Desk Specialist',
    department: 'IT Support',
    yearsExperience: 3,
    imageUrl: 'https://images.unsplash.com/photo-1758600587839-56ba05596c69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMGFzaWFuJTIwd29tYW4lMjBidXNpbmVzcyUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NjkxNzA5NzJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    totalSkills: 18,
    totalMatches: 8,
    profileStrength: 72,
    uploadType: 'video',
    extractedKeywords: ['3+ Years Experience', 'Help Desk Support', 'Technical Troubleshooting', 'Customer Success', 'ITSM Tools', 'Ticket Management', 'Problem Solving', 'Team Collaboration'],
    extractedSkills: [
      { name: 'Technical Troubleshooting', category: 'Technical', verified: true },
      { name: 'Customer Communication', category: 'Soft Skills', verified: true },
      { name: 'Ticket Management', category: 'Process', verified: true },
      { name: 'Problem Solving', category: 'Soft Skills', verified: true },
      { name: 'Technical Documentation', category: 'Technical', verified: true },
      { name: 'IT Support Tools', category: 'Technical', verified: true },
      { name: 'Basic Scripting', category: 'Technical', verified: false },
      { name: 'API Basics', category: 'Technical', verified: false },
    ],
    interests: ['Customer Success Developer', 'Technical Customer Success', 'Support Engineering', 'Solution Development'],
    resumeFileName: 'Christine_Wu_Resume.pdf',
    jobMatches: [
      {
        title: 'Customer Success Developer',
        team: 'Customer Success Engineering',
        department: 'Customer Experience',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 92,
        hiringManager: 'Sarah Mitchell',
        transferType: 'Lateral Move',
        requiredSkills: ['Customer Communication', 'Technical Troubleshooting', 'API Knowledge', 'Scripting'],
        skillGaps: ['Advanced API Integration', 'JavaScript Basics'],
        description: 'Bridge the gap between customers and engineering teams by providing technical solutions and integrations.'
      },
      {
        title: 'Technical Support Engineer II',
        team: 'Enterprise Support',
        department: 'Customer Experience',
        location: 'Remote',
        matchScore: 89,
        hiringManager: 'James Chen',
        transferType: 'Promotion',
        requiredSkills: ['Technical Troubleshooting', 'Documentation', 'Customer Communication'],
        skillGaps: ['Python'],
        description: 'Provide advanced technical support for enterprise customers with complex infrastructure.'
      },
      {
        title: 'Solutions Consultant',
        team: 'Solutions Team',
        department: 'Sales Engineering',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 85,
        hiringManager: 'Michael Torres',
        transferType: 'Lateral Move',
        requiredSkills: ['Technical Communication', 'Problem Solving', 'Presentation Skills'],
        skillGaps: ['Sales Process', 'Demo Skills'],
        description: 'Work with sales to demonstrate technical solutions and help close deals with enterprise customers.'
      },
      {
        title: 'Implementation Specialist',
        team: 'Customer Onboarding',
        department: 'Customer Experience',
        location: 'Austin, TX (Hybrid)',
        matchScore: 83,
        hiringManager: 'Emily Watson',
        transferType: 'Lateral Move',
        requiredSkills: ['Technical Documentation', 'Customer Communication', 'Project Management'],
        skillGaps: ['Implementation Methodologies'],
        description: 'Guide new customers through technical onboarding and implementation processes.'
      },
      {
        title: 'Product Support Specialist',
        team: 'Product Support',
        department: 'Product',
        location: 'Remote',
        matchScore: 81,
        hiringManager: 'David Kim',
        transferType: 'Lateral Move',
        requiredSkills: ['Product Knowledge', 'Technical Troubleshooting', 'Customer Communication'],
        skillGaps: ['Product Analytics'],
        description: 'Provide expert product support and gather customer feedback for product improvements.'
      },
      {
        title: 'Customer Success Manager',
        team: 'Customer Success',
        department: 'Customer Experience',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 78,
        hiringManager: 'Rachel Green',
        transferType: 'Career Pivot',
        requiredSkills: ['Customer Communication', 'Relationship Management', 'Problem Solving'],
        skillGaps: ['Account Management', 'Business Strategy'],
        description: 'Manage customer relationships and ensure they achieve their business objectives with our platform.'
      }
    ],
    learningPaths: [
      {
        title: 'Python for IT Support Professionals',
        provider: 'Coursera',
        duration: '8 weeks',
        level: 'Beginner',
        skills: ['Python Programming', 'Automation Scripts', 'Data Handling'],
        enrollmentCount: 423,
        rating: 4.8
      },
      {
        title: 'Customer Success Management Fundamentals',
        provider: 'LinkedIn Learning',
        duration: '8 weeks',
        level: 'Intermediate',
        skills: ['Customer Success Strategy', 'Account Management', 'Customer Communication'],
        enrollmentCount: 245,
        rating: 4.8
      },
      {
        title: 'Technical Solutions Engineering',
        provider: 'Coursera',
        duration: '12 weeks',
        level: 'Intermediate',
        skills: ['API Integration', 'Technical Demos', 'Solution Architecture'],
        enrollmentCount: 189,
        rating: 4.6
      },
      {
        title: 'JavaScript for Support Engineers',
        provider: 'edX',
        duration: '6 weeks',
        level: 'Beginner',
        skills: ['JavaScript Basics', 'API Scripting', 'Debugging'],
        enrollmentCount: 312,
        rating: 4.7
      }
    ],
    competencyAssessments: [
      { name: 'Customer Communication', category: 'Soft Skills', currentLevel: 4, targetLevel: 5, status: 'completed' },
      { name: 'Technical Troubleshooting', category: 'Technical', currentLevel: 4, targetLevel: 5, status: 'completed' },
      { name: 'API Integration', category: 'Technical', currentLevel: 2, targetLevel: 4, status: 'in-progress' },
      { name: 'JavaScript Fundamentals', category: 'Technical', currentLevel: 1, targetLevel: 3, status: 'not-started' },
      { name: 'Account Management', category: 'Business', currentLevel: 1, targetLevel: 3, status: 'not-started' },
      { name: 'Solution Architecture', category: 'Technical', currentLevel: 1, targetLevel: 3, status: 'not-started' }
    ],
    appliedJobs: [
      {
        jobTitle: 'Customer Success Developer',
        jobId: 'job-001',
        appliedDate: 'Jan 20, 2026',
        status: 'under-review'
      },
      {
        jobTitle: 'Technical Support Engineer II',
        jobId: 'job-002',
        appliedDate: 'Jan 18, 2026',
        status: 'interview'
      }
    ],
    workPreferences: {
      types: ['remote', 'hybrid'],
      willingToRelocate: true
    },
    wishlistLocations: ['San Francisco, CA', 'Austin, TX', 'Seattle, WA', 'Remote'],
    certifications: [
      {
        name: 'AWS Certified Cloud Practitioner',
        issuer: 'Amazon Web Services',
        issueDate: 'Nov 2025',
        expiryDate: 'Nov 2028',
        credentialId: 'AWS-CCP-2025-1234',
        credentialUrl: 'https://aws.amazon.com/verification'
      },
      {
        name: 'ITIL Foundation Certificate',
        issuer: 'Axelos',
        issueDate: 'Mar 2024',
        credentialId: 'ITIL-2024-5678'
      },
      {
        name: 'Customer Success Manager Certification',
        issuer: 'SuccessCoaching',
        issueDate: 'Jul 2025'
      }
    ]
  },
  {
    id: 'marcus-johnson',
    name: 'Marcus Johnson',
    role: 'Frontend Developer',
    department: 'Engineering',
    yearsExperience: 4,
    imageUrl: 'https://images.unsplash.com/photo-1570215170761-f056128eda48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBtYW4lMjBzb2Z0d2FyZSUyMGRldmVsb3BlcnxlbnwxfHx8fDE3NjkxODcxOTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    totalSkills: 22,
    totalMatches: 6,
    profileStrength: 85,
    uploadType: 'video',
    extractedKeywords: ['React', 'TypeScript', 'Frontend Architecture', 'UI/UX', 'Component Design', 'Performance Optimization', 'Team Leadership', 'Agile Development'],
    extractedSkills: [
      { name: 'React', category: 'Technical', verified: true },
      { name: 'TypeScript', category: 'Technical', verified: true },
      { name: 'CSS/Tailwind', category: 'Technical', verified: true },
      { name: 'Component Architecture', category: 'Technical', verified: true },
      { name: 'Performance Optimization', category: 'Technical', verified: true },
      { name: 'UI/UX Design', category: 'Design', verified: true },
      { name: 'Team Collaboration', category: 'Soft Skills', verified: true },
      { name: 'System Design', category: 'Technical', verified: false },
    ],
    interests: ['Engineering Manager', 'Senior Frontend Engineer', 'Full Stack Development', 'Design Systems Lead'],
    resumeFileName: 'Marcus_Johnson_Resume.pdf',
    jobMatches: [
      {
        title: 'Senior Frontend Engineer',
        team: 'Platform Engineering',
        department: 'Engineering',
        location: 'Seattle, WA (Hybrid)',
        matchScore: 94,
        hiringManager: 'Lisa Anderson',
        transferType: 'Promotion',
        requiredSkills: ['React', 'TypeScript', 'System Design', 'Mentoring'],
        skillGaps: ['Advanced System Design'],
        description: 'Lead frontend architecture decisions and mentor junior developers on best practices.'
      },
      {
        title: 'Frontend Engineering Manager',
        team: 'Web Platform',
        department: 'Engineering',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 88,
        hiringManager: 'Robert Chen',
        transferType: 'Management Track',
        requiredSkills: ['Technical Leadership', 'Team Management', 'Frontend Architecture'],
        skillGaps: ['People Management', 'Strategic Planning'],
        description: 'Manage a team of frontend engineers and drive technical strategy for web platform.'
      },
      {
        title: 'Full Stack Engineer',
        team: 'Product Engineering',
        department: 'Engineering',
        location: 'Remote',
        matchScore: 82,
        hiringManager: 'Amanda Rodriguez',
        transferType: 'Lateral Move',
        requiredSkills: ['React', 'Node.js', 'Database Design', 'API Development'],
        skillGaps: ['Backend Development', 'Database Architecture'],
        description: 'Build end-to-end features across frontend and backend systems.'
      },
      {
        title: 'Design Systems Engineer',
        team: 'Design Systems',
        department: 'Design & Engineering',
        location: 'New York, NY (Hybrid)',
        matchScore: 90,
        hiringManager: 'Christina Lee',
        transferType: 'Lateral Move',
        requiredSkills: ['React', 'Component Libraries', 'Design Tokens', 'Documentation'],
        skillGaps: ['Figma Plugin Development'],
        description: 'Build and maintain the company-wide design system and component library.'
      },
      {
        title: 'UI Engineering Lead',
        team: 'Consumer Apps',
        department: 'Product',
        location: 'Austin, TX (Hybrid)',
        matchScore: 87,
        hiringManager: 'Kevin Park',
        transferType: 'Promotion',
        requiredSkills: ['Frontend Architecture', 'UI/UX', 'Performance', 'Leadership'],
        skillGaps: ['Mobile Development'],
        description: 'Lead UI development for consumer-facing applications with millions of users.'
      },
      {
        title: 'Technical Product Manager',
        team: 'Product Management',
        department: 'Product',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 79,
        hiringManager: 'Sophia Martinez',
        transferType: 'Career Pivot',
        requiredSkills: ['Technical Background', 'Product Strategy', 'Stakeholder Management'],
        skillGaps: ['Product Management', 'Market Analysis'],
        description: 'Bridge engineering and product to define technical product strategy.'
      }
    ],
    learningPaths: [
      {
        title: 'Engineering Leadership & Management',
        provider: 'Coursera',
        duration: '10 weeks',
        level: 'Advanced',
        skills: ['Team Leadership', 'Strategic Planning', 'Performance Management'],
        enrollmentCount: 156,
        rating: 4.7
      },
      {
        title: 'Advanced System Design for Frontend Engineers',
        provider: 'Frontend Masters',
        duration: '8 weeks',
        level: 'Advanced',
        skills: ['System Architecture', 'Scalability', 'Design Patterns'],
        enrollmentCount: 203,
        rating: 4.9
      },
      {
        title: 'Full Stack Development with Node.js',
        provider: 'edX',
        duration: '12 weeks',
        level: 'Intermediate',
        skills: ['Node.js', 'Express', 'Database Design', 'API Development'],
        enrollmentCount: 287,
        rating: 4.6
      }
    ],
    competencyAssessments: [
      { name: 'React Advanced Patterns', category: 'Technical', currentLevel: 5, targetLevel: 5, status: 'completed' },
      { name: 'System Design', category: 'Technical', currentLevel: 3, targetLevel: 5, status: 'in-progress' },
      { name: 'Team Leadership', category: 'Management', currentLevel: 2, targetLevel: 4, status: 'in-progress' },
      { name: 'Backend Development', category: 'Technical', currentLevel: 2, targetLevel: 4, status: 'not-started' },
      { name: 'People Management', category: 'Management', currentLevel: 1, targetLevel: 3, status: 'not-started' },
      { name: 'Product Strategy', category: 'Business', currentLevel: 2, targetLevel: 4, status: 'not-started' }
    ],
    appliedJobs: [
      {
        jobTitle: 'Senior Frontend Engineer',
        jobId: 'job-003',
        appliedDate: 'Jan 22, 2026',
        status: 'under-review'
      }
    ],
    workPreferences: {
      types: ['hybrid', 'remote'],
      willingToRelocate: false
    },
    wishlistLocations: ['Seattle, WA', 'Portland, OR', 'Remote'],
    certifications: [
      {
        name: 'Meta Frontend Developer Professional Certificate',
        issuer: 'Meta (Coursera)',
        issueDate: 'Aug 2024',
        credentialUrl: 'https://coursera.org/verify/professional-cert'
      },
      {
        name: 'AWS Certified Developer - Associate',
        issuer: 'Amazon Web Services',
        issueDate: 'Dec 2025',
        expiryDate: 'Dec 2028',
        credentialId: 'AWS-DEV-2025-5678'
      }
    ]
  },
  {
    id: 'sarah-chen',
    name: 'Sarah Chen',
    role: 'Product Manager',
    department: 'Product',
    yearsExperience: 5,
    imageUrl: 'https://images.unsplash.com/photo-1764795849885-e226e3cabe87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHdvbWFuJTIwcHJvZHVjdCUyMG1hbmFnZXIlMjBidXNpbmVzc3xlbnwxfHx8fDE3NjkxODcyMDB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    totalSkills: 20,
    totalMatches: 7,
    profileStrength: 88,
    uploadType: 'audio',
    extractedKeywords: ['Product Strategy', 'Data-Driven Decisions', 'Roadmap Planning', 'Stakeholder Management', 'User Research', 'A/B Testing', 'Cross-functional Leadership', 'Agile'],
    extractedSkills: [
      { name: 'Product Strategy', category: 'Product', verified: true },
      { name: 'User Research', category: 'Product', verified: true },
      { name: 'Data Analysis', category: 'Technical', verified: true },
      { name: 'Roadmap Planning', category: 'Product', verified: true },
      { name: 'Stakeholder Management', category: 'Soft Skills', verified: true },
      { name: 'A/B Testing', category: 'Product', verified: true },
      { name: 'SQL', category: 'Technical', verified: true },
      { name: 'Product Analytics', category: 'Product', verified: false },
    ],
    interests: ['Senior Product Manager', 'Group Product Manager', 'Product Operations', 'Head of Product'],
    resumeFileName: 'Sarah_Chen_Resume.pdf',
    jobMatches: [
      {
        title: 'Senior Product Manager',
        team: 'Growth Product',
        department: 'Product',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 93,
        hiringManager: 'Alex Thompson',
        transferType: 'Promotion',
        requiredSkills: ['Product Strategy', 'Data Analysis', 'Team Leadership', 'Growth Metrics'],
        skillGaps: ['Advanced Analytics', 'Growth Experimentation'],
        description: 'Lead product strategy for growth initiatives and drive user acquisition and retention.'
      },
      {
        title: 'Group Product Manager',
        team: 'Platform',
        department: 'Product',
        location: 'Seattle, WA (Hybrid)',
        matchScore: 91,
        hiringManager: 'Jennifer Wu',
        transferType: 'Promotion',
        requiredSkills: ['Strategic Planning', 'Team Management', 'Product Vision', 'Executive Communication'],
        skillGaps: ['Managing Managers', 'Strategic Vision'],
        description: 'Manage multiple product teams and set strategic direction for platform products.'
      },
      {
        title: 'Product Operations Manager',
        team: 'Product Operations',
        department: 'Product',
        location: 'Remote',
        matchScore: 85,
        hiringManager: 'Daniel Kim',
        transferType: 'Lateral Move',
        requiredSkills: ['Process Optimization', 'Data Analysis', 'Tool Selection', 'Cross-functional Coordination'],
        skillGaps: ['Operations Strategy', 'Process Automation'],
        description: 'Optimize product development processes and improve team efficiency across the organization.'
      },
      {
        title: 'Technical Product Manager',
        team: 'API Platform',
        department: 'Engineering',
        location: 'Austin, TX (Hybrid)',
        matchScore: 88,
        hiringManager: 'Mark Stevens',
        transferType: 'Lateral Move',
        requiredSkills: ['API Design', 'Technical Documentation', 'Developer Experience', 'Product Strategy'],
        skillGaps: ['API Architecture', 'Developer Tools'],
        description: 'Define product strategy for developer-facing API platform and tools.'
      },
      {
        title: 'Strategy & Operations Lead',
        team: 'Corporate Strategy',
        department: 'Strategy',
        location: 'San Francisco, CA (On-site)',
        matchScore: 82,
        hiringManager: 'Victoria Chen',
        transferType: 'Career Pivot',
        requiredSkills: ['Strategic Analysis', 'Business Intelligence', 'Executive Communication'],
        skillGaps: ['Financial Modeling', 'Market Analysis'],
        description: 'Drive strategic initiatives and support executive decision-making with data and analysis.'
      },
      {
        title: 'Head of Product Analytics',
        team: 'Analytics',
        department: 'Data',
        location: 'New York, NY (Hybrid)',
        matchScore: 86,
        hiringManager: 'Brian Taylor',
        transferType: 'Lateral Move',
        requiredSkills: ['Data Analysis', 'Product Metrics', 'Team Leadership', 'Analytics Tools'],
        skillGaps: ['Advanced Statistics', 'Machine Learning Basics'],
        description: 'Lead product analytics function and provide data-driven insights to product teams.'
      },
      {
        title: 'Director of Product',
        team: 'Enterprise',
        department: 'Product',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 89,
        hiringManager: 'Patricia Moore',
        transferType: 'Promotion',
        requiredSkills: ['Product Leadership', 'Strategic Vision', 'Team Building', 'Executive Presence'],
        skillGaps: ['Enterprise Sales Process', 'P&L Management'],
        description: 'Lead enterprise product strategy and manage multiple senior product managers.'
      }
    ],
    learningPaths: [
      {
        title: 'Advanced Product Leadership',
        provider: 'Reforge',
        duration: '6 weeks',
        level: 'Advanced',
        skills: ['Product Vision', 'Team Leadership', 'Strategic Planning'],
        enrollmentCount: 128,
        rating: 4.9
      },
      {
        title: 'Data Science for Product Managers',
        provider: 'Coursera',
        duration: '10 weeks',
        level: 'Intermediate',
        skills: ['Advanced Analytics', 'Machine Learning', 'Statistical Analysis'],
        enrollmentCount: 234,
        rating: 4.7
      },
      {
        title: 'Growth Product Management',
        provider: 'LinkedIn Learning',
        duration: '8 weeks',
        level: 'Advanced',
        skills: ['Growth Strategy', 'Experimentation', 'Retention Optimization'],
        enrollmentCount: 167,
        rating: 4.8
      }
    ],
    competencyAssessments: [
      { name: 'Product Strategy', category: 'Product', currentLevel: 5, targetLevel: 5, status: 'completed' },
      { name: 'Data Analysis', category: 'Technical', currentLevel: 4, targetLevel: 5, status: 'in-progress' },
      { name: 'Team Leadership', category: 'Management', currentLevel: 3, targetLevel: 5, status: 'in-progress' },
      { name: 'Advanced Analytics', category: 'Technical', currentLevel: 2, targetLevel: 4, status: 'not-started' },
      { name: 'Executive Communication', category: 'Soft Skills', currentLevel: 3, targetLevel: 5, status: 'not-started' },
      { name: 'Strategic Vision', category: 'Leadership', currentLevel: 3, targetLevel: 5, status: 'not-started' }
    ],
    appliedJobs: [
      {
        jobTitle: 'Senior Product Manager',
        jobId: 'job-004',
        appliedDate: 'Jan 25, 2026',
        status: 'pending'
      }
    ],
    workPreferences: {
      types: ['hybrid', 'in-person'],
      willingToRelocate: true
    },
    wishlistLocations: ['San Francisco, CA', 'New York, NY', 'Seattle, WA'],
    certifications: [
      {
        name: 'Certified Scrum Product Owner (CSPO)',
        issuer: 'Scrum Alliance',
        issueDate: 'May 2023',
        credentialId: 'CSPO-2023-9012'
      },
      {
        name: 'Product Management Certificate',
        issuer: 'ProductSchool',
        issueDate: 'Jan 2024',
        credentialUrl: 'https://productschool.com/certificates'
      },
      {
        name: 'Google Analytics Certification',
        issuer: 'Google',
        issueDate: 'Sep 2025',
        expiryDate: 'Sep 2027',
        credentialId: 'GA-CERT-2025-3456'
      }
    ]
  },
  {
    id: 'david-rodriguez',
    name: 'David Rodriguez',
    role: 'Data Analyst',
    department: 'Data & Analytics',
    yearsExperience: 3,
    imageUrl: 'https://images.unsplash.com/photo-1752778935928-ee12da5e3fbe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoaXNwYW5pYyUyMG1hbiUyMGRhdGElMjBhbmFseXN0JTIwcHJvZmVzc2lvbmFsfGVufDF8fHx8MTc2OTE4NzIwMHww&ixlib=rb-4.1.0&q=80&w=1080',
    totalSkills: 16,
    totalMatches: 9,
    profileStrength: 78,
    uploadType: 'video',
    extractedKeywords: ['SQL', 'Python', 'Data Visualization', 'Business Intelligence', 'Tableau', 'Statistical Analysis', 'ETL', 'Stakeholder Communication'],
    extractedSkills: [
      { name: 'SQL', category: 'Technical', verified: true },
      { name: 'Python', category: 'Technical', verified: true },
      { name: 'Data Visualization', category: 'Technical', verified: true },
      { name: 'Tableau', category: 'Technical', verified: true },
      { name: 'Statistical Analysis', category: 'Technical', verified: true },
      { name: 'Business Intelligence', category: 'Business', verified: true },
      { name: 'ETL Pipelines', category: 'Technical', verified: false },
      { name: 'Machine Learning', category: 'Technical', verified: false },
    ],
    interests: ['Data Scientist', 'Analytics Engineer', 'Business Intelligence Manager', 'Machine Learning Engineer'],
    resumeFileName: 'David_Rodriguez_Resume.pdf',
    jobMatches: [
      {
        title: 'Data Scientist',
        team: 'Data Science',
        department: 'Data & Analytics',
        location: 'Remote',
        matchScore: 91,
        hiringManager: 'Elena Popov',
        transferType: 'Promotion',
        requiredSkills: ['Python', 'Machine Learning', 'Statistical Analysis', 'Data Visualization'],
        skillGaps: ['Advanced ML Algorithms', 'Model Deployment'],
        description: 'Build predictive models and conduct advanced analytics to drive business decisions.'
      },
      {
        title: 'Analytics Engineer',
        team: 'Data Platform',
        department: 'Engineering',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 89,
        hiringManager: 'Thomas Lee',
        transferType: 'Lateral Move',
        requiredSkills: ['SQL', 'Python', 'ETL', 'Data Modeling', 'dbt'],
        skillGaps: ['dbt', 'Data Warehousing'],
        description: 'Build and maintain data pipelines and analytics infrastructure for the organization.'
      },
      {
        title: 'Senior Data Analyst',
        team: 'Product Analytics',
        department: 'Product',
        location: 'Seattle, WA (Hybrid)',
        matchScore: 87,
        hiringManager: 'Maria Garcia',
        transferType: 'Promotion',
        requiredSkills: ['SQL', 'Data Visualization', 'Product Metrics', 'A/B Testing'],
        skillGaps: ['Product Analytics Tools', 'Experimentation'],
        description: 'Lead analytics for key product initiatives and provide insights to product teams.'
      },
      {
        title: 'Business Intelligence Developer',
        team: 'BI Team',
        department: 'Data & Analytics',
        location: 'Austin, TX (Hybrid)',
        matchScore: 85,
        hiringManager: 'Christopher Wong',
        transferType: 'Lateral Move',
        requiredSkills: ['Tableau', 'SQL', 'Dashboard Design', 'Data Modeling'],
        skillGaps: ['Power BI', 'Advanced Tableau'],
        description: 'Design and build executive dashboards and reporting solutions.'
      },
      {
        title: 'Machine Learning Engineer',
        team: 'ML Platform',
        department: 'Engineering',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 82,
        hiringManager: 'Raj Patel',
        transferType: 'Career Pivot',
        requiredSkills: ['Python', 'Machine Learning', 'MLOps', 'Software Engineering'],
        skillGaps: ['Deep Learning', 'Model Serving', 'Software Engineering'],
        description: 'Build and deploy machine learning models at scale for production systems.'
      },
      {
        title: 'Data Analytics Manager',
        team: 'Analytics',
        department: 'Data & Analytics',
        location: 'New York, NY (Hybrid)',
        matchScore: 80,
        hiringManager: 'Susan Miller',
        transferType: 'Management Track',
        requiredSkills: ['Analytics Strategy', 'Team Leadership', 'Stakeholder Management'],
        skillGaps: ['People Management', 'Strategic Planning'],
        description: 'Manage a team of data analysts and drive analytics strategy for the business.'
      },
      {
        title: 'Product Analyst',
        team: 'Product',
        department: 'Product',
        location: 'Remote',
        matchScore: 88,
        hiringManager: 'Nicole Chen',
        transferType: 'Lateral Move',
        requiredSkills: ['SQL', 'Product Metrics', 'Data Visualization', 'User Research'],
        skillGaps: ['Product Sense', 'User Research Methods'],
        description: 'Support product teams with data analysis and insights to inform product decisions.'
      },
      {
        title: 'Revenue Operations Analyst',
        team: 'Revenue Ops',
        department: 'Sales',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 84,
        hiringManager: 'Michael Brown',
        transferType: 'Lateral Move',
        requiredSkills: ['SQL', 'Business Intelligence', 'Sales Analytics', 'CRM Tools'],
        skillGaps: ['Salesforce', 'Sales Processes'],
        description: 'Analyze sales data and optimize revenue operations processes.'
      },
      {
        title: 'Marketing Analytics Lead',
        team: 'Marketing Analytics',
        department: 'Marketing',
        location: 'Remote',
        matchScore: 83,
        hiringManager: 'Anna Schmidt',
        transferType: 'Lateral Move',
        requiredSkills: ['Marketing Analytics', 'Attribution Modeling', 'SQL', 'Visualization'],
        skillGaps: ['Marketing Attribution', 'Marketing Tools'],
        description: 'Lead marketing analytics and measure the effectiveness of marketing campaigns.'
      }
    ],
    learningPaths: [
      {
        title: 'Machine Learning Specialization',
        provider: 'Coursera',
        duration: '16 weeks',
        level: 'Intermediate',
        skills: ['Supervised Learning', 'Neural Networks', 'ML Deployment'],
        enrollmentCount: 423,
        rating: 4.9
      },
      {
        title: 'Advanced SQL for Data Analysis',
        provider: 'LinkedIn Learning',
        duration: '4 weeks',
        level: 'Advanced',
        skills: ['Window Functions', 'CTEs', 'Query Optimization'],
        enrollmentCount: 298,
        rating: 4.7
      },
      {
        title: 'Analytics Engineering with dbt',
        provider: 'dbt Labs',
        duration: '6 weeks',
        level: 'Intermediate',
        skills: ['dbt', 'Data Modeling', 'Data Testing', 'Documentation'],
        enrollmentCount: 187,
        rating: 4.8
      }
    ],
    competencyAssessments: [
      { name: 'SQL Advanced', category: 'Technical', currentLevel: 4, targetLevel: 5, status: 'completed' },
      { name: 'Python for Data Science', category: 'Technical', currentLevel: 3, targetLevel: 5, status: 'in-progress' },
      { name: 'Machine Learning', category: 'Technical', currentLevel: 2, targetLevel: 4, status: 'in-progress' },
      { name: 'Data Engineering', category: 'Technical', currentLevel: 2, targetLevel: 4, status: 'not-started' },
      { name: 'Statistical Modeling', category: 'Technical', currentLevel: 3, targetLevel: 4, status: 'not-started' },
      { name: 'Team Leadership', category: 'Management', currentLevel: 1, targetLevel: 3, status: 'not-started' }
    ],
    appliedJobs: [
      {
        jobTitle: 'Data Scientist',
        jobId: 'job-005',
        appliedDate: 'Jan 23, 2026',
        status: 'under-review'
      },
      {
        jobTitle: 'Analytics Engineer',
        jobId: 'job-006',
        appliedDate: 'Jan 19, 2026',
        status: 'pending'
      }
    ],
    workPreferences: {
      types: ['remote', 'hybrid'],
      willingToRelocate: true
    },
    wishlistLocations: ['San Francisco, CA', 'Austin, TX', 'Remote', 'Denver, CO'],
    certifications: [
      {
        name: 'Google Data Analytics Professional Certificate',
        issuer: 'Google (Coursera)',
        issueDate: 'Jun 2024',
        credentialUrl: 'https://coursera.org/verify/professional-cert'
      },
      {
        name: 'Tableau Desktop Specialist',
        issuer: 'Tableau',
        issueDate: 'Mar 2025',
        expiryDate: 'Mar 2028',
        credentialId: 'TABLEAU-DS-2025-4567'
      },
      {
        name: 'IBM Data Science Professional Certificate',
        issuer: 'IBM (Coursera)',
        issueDate: 'Oct 2025'
      }
    ]
  },
  {
    id: 'priya-patel',
    name: 'Priya Patel',
    role: 'QA Engineer',
    department: 'Engineering',
    yearsExperience: 4,
    imageUrl: 'https://images.unsplash.com/photo-1681164315430-6159b2361615?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpYW4lMjB3b21hbiUyMHNvZnR3YXJlJTIwZW5naW5lZXIlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzY5MTg3MjAwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    totalSkills: 19,
    totalMatches: 7,
    profileStrength: 81,
    uploadType: 'audio',
    extractedKeywords: ['Test Automation', 'Selenium', 'API Testing', 'CI/CD', 'Python', 'Quality Assurance', 'Agile Testing', 'Performance Testing'],
    extractedSkills: [
      { name: 'Test Automation', category: 'Technical', verified: true },
      { name: 'Selenium', category: 'Technical', verified: true },
      { name: 'API Testing', category: 'Technical', verified: true },
      { name: 'Python', category: 'Technical', verified: true },
      { name: 'CI/CD', category: 'Technical', verified: true },
      { name: 'Agile Methodologies', category: 'Process', verified: true },
      { name: 'Performance Testing', category: 'Technical', verified: false },
      { name: 'Security Testing', category: 'Technical', verified: false },
    ],
    interests: ['Senior QA Engineer', 'QA Manager', 'DevOps Engineer', 'SDET', 'Quality Engineering Lead'],
    resumeFileName: 'Priya_Patel_Resume.pdf',
    jobMatches: [
      {
        title: 'Senior QA Engineer',
        team: 'Quality Engineering',
        department: 'Engineering',
        location: 'Remote',
        matchScore: 92,
        hiringManager: 'James Wilson',
        transferType: 'Promotion',
        requiredSkills: ['Test Automation', 'Framework Design', 'Mentoring', 'API Testing'],
        skillGaps: ['Framework Architecture', 'Mobile Testing'],
        description: 'Lead QA automation efforts and mentor junior QA engineers on testing best practices.'
      },
      {
        title: 'SDET (Software Development Engineer in Test)',
        team: 'Platform Engineering',
        department: 'Engineering',
        location: 'Seattle, WA (Hybrid)',
        matchScore: 90,
        hiringManager: 'Andrew Kim',
        transferType: 'Lateral Move',
        requiredSkills: ['Test Automation', 'Software Development', 'System Design', 'CI/CD'],
        skillGaps: ['Advanced Programming', 'Distributed Systems'],
        description: 'Build testing infrastructure and tools to improve developer productivity and product quality.'
      },
      {
        title: 'DevOps Engineer',
        team: 'Infrastructure',
        department: 'Engineering',
        location: 'Austin, TX (Hybrid)',
        matchScore: 85,
        hiringManager: 'Carlos Mendez',
        transferType: 'Career Pivot',
        requiredSkills: ['CI/CD', 'Infrastructure as Code', 'Automation', 'Cloud Platforms'],
        skillGaps: ['Kubernetes', 'Cloud Architecture', 'Terraform'],
        description: 'Manage infrastructure, build deployment pipelines, and improve system reliability.'
      },
      {
        title: 'Quality Engineering Manager',
        team: 'QA',
        department: 'Engineering',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 88,
        hiringManager: 'Michelle Zhang',
        transferType: 'Management Track',
        requiredSkills: ['QA Strategy', 'Team Leadership', 'Process Improvement'],
        skillGaps: ['People Management', 'Quality Metrics'],
        description: 'Manage QA team and define quality engineering strategy across the organization.'
      },
      {
        title: 'Release Engineer',
        team: 'Release Engineering',
        department: 'Engineering',
        location: 'Remote',
        matchScore: 83,
        hiringManager: 'Ryan O\'Connor',
        transferType: 'Lateral Move',
        requiredSkills: ['CI/CD', 'Release Management', 'Automation', 'Scripting'],
        skillGaps: ['Release Tooling', 'Change Management'],
        description: 'Own release processes and ensure smooth deployments across all environments.'
      },
      {
        title: 'Performance Engineer',
        team: 'Performance',
        department: 'Engineering',
        location: 'San Francisco, CA (Hybrid)',
        matchScore: 86,
        hiringManager: 'Timothy Jackson',
        transferType: 'Lateral Move',
        requiredSkills: ['Performance Testing', 'Load Testing', 'Monitoring', 'Analysis'],
        skillGaps: ['JMeter', 'Performance Tuning'],
        description: 'Test and optimize system performance to ensure scalability and reliability.'
      },
      {
        title: 'Security QA Engineer',
        team: 'Security',
        department: 'Security & Compliance',
        location: 'Remote',
        matchScore: 81,
        hiringManager: 'Laura Martinez',
        transferType: 'Lateral Move',
        requiredSkills: ['Security Testing', 'Penetration Testing', 'Vulnerability Assessment'],
        skillGaps: ['Security Certifications', 'Ethical Hacking'],
        description: 'Test security controls and identify vulnerabilities in applications and systems.'
      }
    ],
    learningPaths: [
      {
        title: 'Advanced Test Automation Architecture',
        provider: 'Test Automation University',
        duration: '8 weeks',
        level: 'Advanced',
        skills: ['Framework Design', 'Design Patterns', 'Scalable Testing'],
        enrollmentCount: 176,
        rating: 4.8
      },
      {
        title: 'DevOps Engineering Fundamentals',
        provider: 'Coursera',
        duration: '12 weeks',
        level: 'Intermediate',
        skills: ['Kubernetes', 'Docker', 'Terraform', 'Cloud Infrastructure'],
        enrollmentCount: 312,
        rating: 4.7
      },
      {
        title: 'Engineering Management Essentials',
        provider: 'LinkedIn Learning',
        duration: '6 weeks',
        level: 'Intermediate',
        skills: ['Team Leadership', 'Performance Management', 'Strategic Planning'],
        enrollmentCount: 198,
        rating: 4.6
      }
    ],
    competencyAssessments: [
      { name: 'Test Automation', category: 'Technical', currentLevel: 5, targetLevel: 5, status: 'completed' },
      { name: 'Python Programming', category: 'Technical', currentLevel: 4, targetLevel: 5, status: 'in-progress' },
      { name: 'DevOps Practices', category: 'Technical', currentLevel: 2, targetLevel: 4, status: 'in-progress' },
      { name: 'Cloud Platforms', category: 'Technical', currentLevel: 2, targetLevel: 4, status: 'not-started' },
      { name: 'Team Leadership', category: 'Management', currentLevel: 2, targetLevel: 4, status: 'not-started' },
      { name: 'System Architecture', category: 'Technical', currentLevel: 2, targetLevel: 4, status: 'not-started' }
    ],
    appliedJobs: [
      {
        jobTitle: 'Senior QA Engineer',
        jobId: 'job-007',
        appliedDate: 'Jan 24, 2026',
        status: 'interview'
      }
    ],
    workPreferences: {
      types: ['remote', 'hybrid'],
      willingToRelocate: false
    },
    wishlistLocations: ['Remote', 'Seattle, WA', 'Austin, TX'],
    certifications: [
      {
        name: 'ISTQB Certified Tester Foundation Level',
        issuer: 'ISTQB',
        issueDate: 'Apr 2023',
        credentialId: 'ISTQB-CTFL-2023-7890'
      },
      {
        name: 'AWS Certified Cloud Practitioner',
        issuer: 'Amazon Web Services',
        issueDate: 'Sep 2025',
        expiryDate: 'Sep 2028',
        credentialId: 'AWS-CCP-2025-6789'
      },
      {
        name: 'Certified Kubernetes Application Developer (CKAD)',
        issuer: 'Cloud Native Computing Foundation',
        issueDate: 'Dec 2025',
        expiryDate: 'Dec 2027',
        credentialId: 'CKAD-2025-3456'
      }
    ]
  }
];