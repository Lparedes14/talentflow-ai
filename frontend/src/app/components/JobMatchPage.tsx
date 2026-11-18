import { useState } from 'react';
import { Building2, MapPin, Clock, TrendingUp, CheckCircle, X, ChevronRight, Lightbulb, Shield, ArrowRight, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Profile } from '../types/profile';

interface Skill {
  name: string;
  hasSkill: boolean;
  required: boolean;
}

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  matchScore: number;
  matchQuality: 'Strong' | 'Moderate' | 'Weak';
  category: 'best-match' | 'career-switch';
  requiredSkills: number;
  matchedSkills: number;
  team: string;
  hiringManager: string;
  teamSize: string;
  internalNote?: string;
  description: string;
  skills: Skill[];
  matchingFactors: string[];
  skillGaps: string[];
  upskillTimeline: string;
}

interface JobMatchPageProps {
  profile: Profile;
}

export function JobMatchPage({ profile }: JobMatchPageProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'best-match' | 'career-switch' | 'company-wide'>('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isPipelineExpanded, setIsPipelineExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const jobs: Job[] = [
    {
      id: '1',
      title: 'Customer Success Developer',
      department: 'Customer Success',
      location: 'San Francisco, CA',
      type: 'Full-time',
      matchScore: 78,
      matchQuality: 'Moderate',
      category: 'career-switch',
      requiredSkills: 10,
      matchedSkills: 7,
      team: 'CS Engineering Team',
      hiringManager: 'Sarah Chen',
      teamSize: '8 people',
      internalNote: 'Your colleague Marcus Rodriguez moved from Help Desk to this role last year',
      description: 'Build tools and automation that empower our CS team to scale customer support. Work directly with customers to understand pain points and create solutions.',
      skills: [
        { name: 'Customer Communication', hasSkill: true, required: true },
        { name: 'Problem Solving', hasSkill: true, required: true },
        { name: 'JavaScript', hasSkill: false, required: true },
        { name: 'Technical Documentation', hasSkill: true, required: true },
        { name: 'API Development', hasSkill: false, required: true },
        { name: 'SQL', hasSkill: false, required: true },
        { name: 'Technical Troubleshooting', hasSkill: true, required: false },
        { name: 'Workflow Automation', hasSkill: true, required: true },
        { name: 'Customer Empathy', hasSkill: true, required: true },
        { name: 'Version Control (Git)', hasSkill: false, required: false },
      ],
      matchingFactors: [
        'Customer Communication',
        'Problem Solving',
        'Technical Documentation',
        'Workflow Automation',
        'Customer Empathy',
      ],
      skillGaps: [
        'JavaScript',
        'API Development',
        'SQL',
        'Version Control (Git)',
      ],
      upskillTimeline: '3 months',
    },
    {
      id: '2',
      title: 'Technical Support Engineer',
      department: 'Customer Success',
      location: 'Remote',
      type: 'Full-time',
      matchScore: 92,
      matchQuality: 'Strong',
      category: 'best-match',
      requiredSkills: 8,
      matchedSkills: 7,
      team: 'Enterprise Support Team',
      hiringManager: 'David Kim',
      teamSize: '12 people',
      internalNote: 'Natural progression from Help Desk - 3 team members came from your current team',
      description: 'Provide advanced technical support to enterprise customers, troubleshoot complex issues, and collaborate with engineering on bug fixes.',
      skills: [
        { name: 'Technical Troubleshooting', hasSkill: true, required: true },
        { name: 'Customer Communication', hasSkill: true, required: true },
        { name: 'Ticket Management', hasSkill: true, required: true },
        { name: 'Technical Documentation', hasSkill: true, required: true },
        { name: 'IT Support Tools', hasSkill: true, required: true },
        { name: 'Problem Solving', hasSkill: true, required: true },
        { name: 'Python', hasSkill: false, required: true },
        { name: 'Customer Empathy', hasSkill: true, required: true },
      ],
      matchingFactors: [
        'Technical Troubleshooting',
        'Customer Communication',
        'Ticket Management',
        'Technical Documentation',
        'IT Support Tools',
        'Problem Solving',
        'Customer Empathy',
      ],
      skillGaps: [
        'Python',
      ],
      upskillTimeline: '1 month',
    },
    {
      id: '3',
      title: 'Solutions Engineer',
      department: 'Customer Success',
      location: 'San Francisco, CA',
      type: 'Full-time',
      matchScore: 68,
      matchQuality: 'Moderate',
      category: 'career-switch',
      requiredSkills: 11,
      matchedSkills: 6,
      team: 'Pre-Sales Solutions Team',
      hiringManager: 'Jennifer Park',
      teamSize: '6 people',
      internalNote: 'Team values internal candidates with strong customer experience',
      description: 'Bridge the gap between customers and product teams. Design custom solutions, conduct technical demos, and support the sales process.',
      skills: [
        { name: 'Technical Presentation', hasSkill: false, required: true },
        { name: 'Customer Communication', hasSkill: true, required: true },
        { name: 'Solution Design', hasSkill: false, required: true },
        { name: 'API Integration', hasSkill: false, required: true },
        { name: 'Technical Documentation', hasSkill: true, required: true },
        { name: 'Problem Solving', hasSkill: true, required: true },
        { name: 'Sales Support', hasSkill: false, required: false },
        { name: 'Demo Development', hasSkill: false, required: true },
        { name: 'Technical Troubleshooting', hasSkill: true, required: false },
        { name: 'Requirements Gathering', hasSkill: true, required: true },
        { name: 'Product Knowledge', hasSkill: true, required: true },
      ],
      matchingFactors: [
        'Customer Communication',
        'Technical Documentation',
        'Problem Solving',
        'Requirements Gathering',
        'Product Knowledge',
      ],
      skillGaps: [
        'Technical Presentation',
        'Solution Design',
        'API Integration',
        'Sales Support',
        'Demo Development',
      ],
      upskillTimeline: '4 months',
    },
    {
      id: '4',
      title: 'Customer Success Operations Specialist',
      department: 'Customer Success',
      location: 'San Francisco, CA',
      type: 'Full-time',
      matchScore: 85,
      matchQuality: 'Strong',
      category: 'best-match',
      requiredSkills: 9,
      matchedSkills: 8,
      team: 'CS Operations',
      hiringManager: 'Alex Thompson',
      teamSize: '5 people',
      internalNote: 'Your Help Desk systems expertise is highly valued here',
      description: 'Optimize CS workflows, manage support tools and systems, analyze metrics, and identify automation opportunities.',
      skills: [
        { name: 'Ticket Management', hasSkill: true, required: true },
        { name: 'IT Support Tools', hasSkill: true, required: true },
        { name: 'Process Optimization', hasSkill: true, required: true },
        { name: 'Data Analysis', hasSkill: false, required: true },
        { name: 'Technical Documentation', hasSkill: true, required: true },
        { name: 'Workflow Automation', hasSkill: true, required: false },
        { name: 'Customer Communication', hasSkill: true, required: false },
        { name: 'Tool Administration', hasSkill: true, required: true },
        { name: 'Reporting', hasSkill: true, required: true },
      ],
      matchingFactors: [
        'Ticket Management',
        'IT Support Tools',
        'Process Optimization',
        'Technical Documentation',
        'Tool Administration',
        'Reporting',
      ],
      skillGaps: [
        'Data Analysis',
        'Workflow Automation',
        'Customer Communication',
      ],
      upskillTimeline: '2 months',
    },
    {
      id: '5',
      title: 'Implementation Specialist',
      department: 'Customer Success',
      location: 'New York, NY',
      type: 'Full-time',
      matchScore: 81,
      matchQuality: 'Strong',
      category: 'best-match',
      requiredSkills: 9,
      matchedSkills: 7,
      team: 'Customer Onboarding Team',
      hiringManager: 'Rachel Martinez',
      teamSize: '10 people',
      internalNote: 'Actively hiring! Your support background is a perfect fit',
      description: 'Guide new customers through technical onboarding, configure solutions to meet their needs, and provide training.',
      skills: [
        { name: 'Customer Communication', hasSkill: true, required: true },
        { name: 'Technical Troubleshooting', hasSkill: true, required: true },
        { name: 'Technical Documentation', hasSkill: true, required: true },
        { name: 'Configuration Management', hasSkill: false, required: true },
        { name: 'Training Delivery', hasSkill: false, required: true },
        { name: 'Problem Solving', hasSkill: true, required: true },
        { name: 'Project Management', hasSkill: true, required: false },
        { name: 'API Basics', hasSkill: true, required: false },
        { name: 'Customer Empathy', hasSkill: true, required: true },
      ],
      matchingFactors: [
        'Customer Communication',
        'Technical Troubleshooting',
        'Technical Documentation',
        'Problem Solving',
        'Customer Empathy',
      ],
      skillGaps: [
        'Configuration Management',
        'Training Delivery',
        'Project Management',
        'API Basics',
      ],
      upskillTimeline: '2 months',
    },
    {
      id: '6',
      title: 'Support Automation Engineer',
      department: 'Customer Success',
      location: 'Remote',
      type: 'Full-time',
      matchScore: 72,
      matchQuality: 'Moderate',
      category: 'career-switch',
      requiredSkills: 10,
      matchedSkills: 6,
      team: 'Support Engineering',
      hiringManager: 'Tom Wilson',
      teamSize: '7 people',
      internalNote: 'Team offers mentorship program for Help Desk transfers',
      description: 'Build automation tools and scripts to improve support efficiency. Create self-service solutions and chatbot workflows.',
      skills: [
        { name: 'Technical Troubleshooting', hasSkill: true, required: false },
        { name: 'Workflow Automation', hasSkill: true, required: true },
        { name: 'Python', hasSkill: false, required: true },
        { name: 'API Integration', hasSkill: false, required: true },
        { name: 'Technical Documentation', hasSkill: true, required: true },
        { name: 'IT Support Tools', hasSkill: true, required: false },
        { name: 'Scripting', hasSkill: false, required: true },
        { name: 'Problem Solving', hasSkill: true, required: true },
        { name: 'Bot Development', hasSkill: false, required: true },
        { name: 'Customer Communication', hasSkill: true, required: false },
      ],
      matchingFactors: [
        'Workflow Automation',
        'Technical Documentation',
        'Problem Solving',
      ],
      skillGaps: [
        'Python',
        'API Integration',
        'Scripting',
        'Bot Development',
        'Customer Communication',
      ],
      upskillTimeline: '3 months',
    },
  ];

  // Company-wide positions (all roles in the company)
  const companyWidePositions: Job[] = [
    // Include all matched jobs
    ...jobs,
    // Additional positions not matched to user
    {
      id: '7',
      title: 'Senior Software Engineer',
      department: 'Engineering',
      location: 'San Francisco, CA',
      type: 'Full-time',
      matchScore: 45,
      matchQuality: 'Weak',
      category: 'career-switch' as const,
      requiredSkills: 12,
      matchedSkills: 3,
      team: 'Platform Engineering',
      hiringManager: 'Emma Thompson',
      teamSize: '15 people',
      description: 'Build and maintain core platform infrastructure, develop scalable backend services, and collaborate with product teams.',
      skills: [
        { name: 'JavaScript', hasSkill: false, required: true },
        { name: 'Python', hasSkill: false, required: true },
        { name: 'System Design', hasSkill: false, required: true },
        { name: 'API Development', hasSkill: false, required: true },
        { name: 'Database Design', hasSkill: false, required: true },
        { name: 'Cloud Infrastructure', hasSkill: false, required: true },
        { name: 'Problem Solving', hasSkill: true, required: true },
        { name: 'Technical Documentation', hasSkill: true, required: true },
        { name: 'Version Control', hasSkill: false, required: true },
        { name: 'Agile Development', hasSkill: false, required: false },
        { name: 'Code Review', hasSkill: false, required: true },
        { name: 'Technical Communication', hasSkill: true, required: false },
      ],
      matchingFactors: [
        'Problem Solving',
        'Technical Documentation',
        'Technical Communication',
      ],
      skillGaps: [
        'JavaScript',
        'Python',
        'System Design',
        'API Development',
        'Database Design',
        'Cloud Infrastructure',
        'Version Control',
        'Code Review',
      ],
      upskillTimeline: '12 months',
    },
    {
      id: '8',
      title: 'Product Manager',
      department: 'Product',
      location: 'Remote',
      type: 'Full-time',
      matchScore: 52,
      matchQuality: 'Weak',
      category: 'career-switch' as const,
      requiredSkills: 10,
      matchedSkills: 4,
      team: 'Customer Experience Product',
      hiringManager: 'Michael Lee',
      teamSize: '6 people',
      description: 'Define product strategy, gather requirements from customers and stakeholders, and work with engineering to deliver solutions.',
      skills: [
        { name: 'Product Strategy', hasSkill: false, required: true },
        { name: 'Requirements Gathering', hasSkill: false, required: true },
        { name: 'Customer Communication', hasSkill: true, required: true },
        { name: 'Data Analysis', hasSkill: false, required: true },
        { name: 'Roadmap Planning', hasSkill: false, required: true },
        { name: 'Stakeholder Management', hasSkill: false, required: true },
        { name: 'Problem Solving', hasSkill: true, required: true },
        { name: 'Technical Documentation', hasSkill: true, required: false },
        { name: 'Agile Methodologies', hasSkill: false, required: true },
        { name: 'User Research', hasSkill: false, required: true },
      ],
      matchingFactors: [
        'Customer Communication',
        'Problem Solving',
        'Technical Documentation',
      ],
      skillGaps: [
        'Product Strategy',
        'Requirements Gathering',
        'Data Analysis',
        'Roadmap Planning',
        'Stakeholder Management',
        'Agile Methodologies',
        'User Research',
      ],
      upskillTimeline: '6 months',
    },
    {
      id: '9',
      title: 'Sales Development Representative',
      department: 'Sales',
      location: 'Austin, TX',
      type: 'Full-time',
      matchScore: 48,
      matchQuality: 'Weak',
      category: 'career-switch' as const,
      requiredSkills: 8,
      matchedSkills: 3,
      team: 'Outbound Sales',
      hiringManager: 'Lisa Anderson',
      teamSize: '20 people',
      description: 'Generate qualified leads, conduct outreach to potential customers, and schedule demos for the sales team.',
      skills: [
        { name: 'Sales Outreach', hasSkill: false, required: true },
        { name: 'Lead Qualification', hasSkill: false, required: true },
        { name: 'Customer Communication', hasSkill: true, required: true },
        { name: 'CRM Tools', hasSkill: false, required: true },
        { name: 'Prospecting', hasSkill: false, required: true },
        { name: 'Cold Calling', hasSkill: false, required: true },
        { name: 'Email Campaigns', hasSkill: false, required: true },
        { name: 'Problem Solving', hasSkill: true, required: false },
      ],
      matchingFactors: [
        'Customer Communication',
        'Problem Solving',
      ],
      skillGaps: [
        'Sales Outreach',
        'Lead Qualification',
        'CRM Tools',
        'Prospecting',
        'Cold Calling',
        'Email Campaigns',
      ],
      upskillTimeline: '2 months',
    },
    {
      id: '10',
      title: 'Data Analyst',
      department: 'Analytics',
      location: 'New York, NY',
      type: 'Full-time',
      matchScore: 38,
      matchQuality: 'Weak',
      category: 'career-switch' as const,
      requiredSkills: 10,
      matchedSkills: 2,
      team: 'Business Intelligence',
      hiringManager: 'James Carter',
      teamSize: '8 people',
      description: 'Analyze business data, create dashboards and reports, and provide insights to drive decision-making.',
      skills: [
        { name: 'SQL', hasSkill: false, required: true },
        { name: 'Data Visualization', hasSkill: false, required: true },
        { name: 'Statistical Analysis', hasSkill: false, required: true },
        { name: 'Excel', hasSkill: false, required: true },
        { name: 'Python/R', hasSkill: false, required: true },
        { name: 'Business Intelligence Tools', hasSkill: false, required: true },
        { name: 'Problem Solving', hasSkill: true, required: true },
        { name: 'Technical Documentation', hasSkill: true, required: false },
        { name: 'Data Modeling', hasSkill: false, required: true },
        { name: 'Communication', hasSkill: false, required: true },
      ],
      matchingFactors: [
        'Problem Solving',
        'Technical Documentation',
      ],
      skillGaps: [
        'SQL',
        'Data Visualization',
        'Statistical Analysis',
        'Excel',
        'Python/R',
        'Business Intelligence Tools',
        'Data Modeling',
        'Communication',
      ],
      upskillTimeline: '6 months',
    },
    {
      id: '11',
      title: 'UX Designer',
      department: 'Design',
      location: 'San Francisco, CA',
      type: 'Full-time',
      matchScore: 42,
      matchQuality: 'Weak',
      category: 'career-switch' as const,
      requiredSkills: 9,
      matchedSkills: 3,
      team: 'Product Design',
      hiringManager: 'Sophia Williams',
      teamSize: '7 people',
      description: 'Design user interfaces and experiences, conduct user research, and collaborate with product and engineering teams.',
      skills: [
        { name: 'UI Design', hasSkill: false, required: true },
        { name: 'User Research', hasSkill: false, required: true },
        { name: 'Prototyping', hasSkill: false, required: true },
        { name: 'Figma/Sketch', hasSkill: false, required: true },
        { name: 'Wireframing', hasSkill: false, required: true },
        { name: 'Customer Empathy', hasSkill: true, required: true },
        { name: 'Problem Solving', hasSkill: true, required: true },
        { name: 'Visual Design', hasSkill: false, required: true },
        { name: 'Technical Communication', hasSkill: true, required: false },
      ],
      matchingFactors: [
        'Customer Empathy',
        'Problem Solving',
        'Technical Communication',
      ],
      skillGaps: [
        'UI Design',
        'User Research',
        'Prototyping',
        'Figma/Sketch',
        'Wireframing',
        'Visual Design',
      ],
      upskillTimeline: '8 months',
    },
    {
      id: '12',
      title: 'Marketing Manager',
      department: 'Marketing',
      location: 'Remote',
      type: 'Full-time',
      matchScore: 35,
      matchQuality: 'Weak',
      category: 'career-switch' as const,
      requiredSkills: 11,
      matchedSkills: 2,
      team: 'Product Marketing',
      hiringManager: 'Olivia Martinez',
      teamSize: '9 people',
      description: 'Develop marketing campaigns, manage brand messaging, and analyze campaign performance to drive growth.',
      skills: [
        { name: 'Marketing Strategy', hasSkill: false, required: true },
        { name: 'Campaign Management', hasSkill: false, required: true },
        { name: 'Content Creation', hasSkill: false, required: true },
        { name: 'SEO/SEM', hasSkill: false, required: true },
        { name: 'Social Media', hasSkill: false, required: true },
        { name: 'Analytics', hasSkill: false, required: true },
        { name: 'Problem Solving', hasSkill: true, required: false },
        { name: 'Customer Communication', hasSkill: true, required: false },
        { name: 'Budget Management', hasSkill: false, required: true },
        { name: 'Brand Development', hasSkill: false, required: true },
        { name: 'Project Management', hasSkill: false, required: true },
      ],
      matchingFactors: [
        'Problem Solving',
        'Customer Communication',
      ],
      skillGaps: [
        'Marketing Strategy',
        'Campaign Management',
        'Content Creation',
        'SEO/SEM',
        'Social Media',
        'Analytics',
        'Budget Management',
        'Brand Development',
        'Project Management',
      ],
      upskillTimeline: '6 months',
    },
  ];

  const filteredJobs = (selectedFilter === 'company-wide' ? companyWidePositions : jobs)
    .filter(job => 
      selectedFilter === 'all' || selectedFilter === 'company-wide' || job.category === selectedFilter
    ).filter(job =>
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => b.matchScore - a.matchScore);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Job Matches</h2>
        <p className="text-gray-600">
          Discover internal opportunities that match your skills and career aspirations
        </p>
      </div>

      {/* AI Decision Pipeline */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300 rounded-lg mb-6">
        <button
          onClick={() => setIsPipelineExpanded(!isPipelineExpanded)}
          className="w-full p-5 flex items-center justify-between hover:bg-gray-100 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-gray-900 text-sm">AI Recommendation Pipeline</h3>
            <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full font-medium">
              All Stages Complete
            </span>
          </div>
          {isPipelineExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </button>
        
        {isPipelineExpanded && (
          <div className="px-5 pb-5">
            <p className="text-xs text-gray-600 mb-4">
              Every recommendation goes through our 4-stage ethical AI decision pipeline to ensure fair, transparent, and privacy-preserving results
            </p>
            <div className="grid grid-cols-4 gap-3">
              {/* Stage 1: Matching */}
              <div className="bg-white rounded-lg p-3 border-2 border-blue-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-600 font-bold text-xs">STAGE 1</span>
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div className="font-medium text-gray-900 text-sm mb-1">Matching</div>
                <p className="text-xs text-gray-600">
                  LLM analyzes skills, experience, and interests to generate role candidates
                </p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>

              {/* Stage 2: Fairness Audit */}
              <div className="bg-white rounded-lg p-3 border-2 border-emerald-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-emerald-600 font-bold text-xs">STAGE 2</span>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="font-medium text-gray-900 text-sm mb-1">Fairness Audit</div>
                <p className="text-xs text-gray-600">
                  Demographic bias checks and statistical fairness tests applied
                </p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>

              {/* Stage 3: Explainability */}
              <div className="bg-white rounded-lg p-3 border-2 border-purple-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-600 font-bold text-xs">STAGE 3</span>
                  <CheckCircle className="w-4 h-4 text-purple-600" />
                </div>
                <div className="font-medium text-gray-900 text-sm mb-1">Explainability</div>
                <p className="text-xs text-gray-600">
                  Human-readable reasoning generated with matching factors and gaps
                </p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>

              {/* Stage 4: Privacy */}
              <div className="bg-white rounded-lg p-3 border-2 border-gray-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 font-bold text-xs">STAGE 4</span>
                  <CheckCircle className="w-4 h-4 text-gray-600" />
                </div>
                <div className="font-medium text-gray-900 text-sm mb-1">Privacy Output</div>
                <p className="text-xs text-gray-600">
                  De-identified results with role-based access controls enforced
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Matches ({jobs.length})
        </button>
        <button
          onClick={() => setSelectedFilter('best-match')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedFilter === 'best-match'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Best Matches ({jobs.filter(j => j.category === 'best-match').length})
        </button>
        <button
          onClick={() => setSelectedFilter('career-switch')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedFilter === 'career-switch'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Career Switch ({jobs.filter(j => j.category === 'career-switch').length})
        </button>
        <button
          onClick={() => setSelectedFilter('company-wide')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedFilter === 'company-wide'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Positions ({companyWidePositions.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search all company positions by title, department, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-600">
            Showing {filteredJobs.length} position{filteredJobs.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Job List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredJobs.map(job => (
          <div
            key={job.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedJob(job)}
          >
            {/* Match Score Badge */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {job.category === 'best-match' ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                      Best Match
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                      Career Switch
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{job.title}</h3>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    {job.department}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {job.location}
                  </div>
                </div>
                {job.internalNote && (
                  <div className="mt-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700">
                    💡 {job.internalNote}
                  </div>
                )}
              </div>
              <div className="text-center ml-4">
                <div className={`text-3xl font-bold ${
                  job.matchScore >= 85 ? 'text-green-600' :
                  job.matchScore >= 70 ? 'text-blue-600' :
                  'text-orange-600'
                }`}>
                  {job.matchScore}%
                </div>
                <div className="text-xs text-gray-500">Match</div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{job.description}</p>

            {/* Skills Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 font-medium">Skills Match</span>
                <span className="text-gray-600">
                  {job.matchedSkills}/{job.requiredSkills} required skills
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    job.matchScore >= 85 ? 'bg-green-500' :
                    job.matchScore >= 70 ? 'bg-blue-500' :
                    'bg-orange-500'
                  }`}
                  style={{ width: `${(job.matchedSkills / job.requiredSkills) * 100}%` }}
                />
              </div>
            </div>

            {/* Skill Badges Preview */}
            <div className="flex flex-wrap gap-2 mb-4">
              {job.skills.slice(0, 5).map((skill, idx) => (
                <div
                  key={idx}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    skill.hasSkill
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  {skill.hasSkill ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                  {skill.name}
                </div>
              ))}
              {job.skills.length > 5 && (
                <div className="px-2.5 py-1 text-xs text-gray-500">
                  +{job.skills.length - 5} more
                </div>
              )}
            </div>

            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm">
              View Details
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedJob(null)}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedJob.category === 'best-match' ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                        Best Match
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                        Career Switch
                      </span>
                    )}
                    <div className={`text-2xl font-bold ${
                      selectedJob.matchScore >= 85 ? 'text-green-600' :
                      selectedJob.matchScore >= 70 ? 'text-blue-600' :
                      'text-orange-600'
                    }`}>
                      {selectedJob.matchScore}% Match
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {selectedJob.department}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {selectedJob.location}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedJob.type}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-bold text-gray-900 mb-2">About this role</h4>
                <p className="text-gray-600">{selectedJob.description}</p>
              </div>

              {/* Internal Transfer Details */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Internal Transfer Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Team</div>
                    <div className="font-medium text-gray-900">{selectedJob.team}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Hiring Manager</div>
                    <div className="font-medium text-gray-900">{selectedJob.hiringManager}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Team Size</div>
                    <div className="font-medium text-gray-900">{selectedJob.teamSize}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Location</div>
                    <div className="font-medium text-gray-900">{selectedJob.location}</div>
                  </div>
                </div>
                {selectedJob.internalNote && (
                  <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-blue-800">
                    💡 <strong>Internal Note:</strong> {selectedJob.internalNote}
                  </div>
                )}
              </div>

              {/* Why This Role Was Recommended - Explainable AI */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-purple-600" />
                  <h4 className="font-medium text-gray-900">AI Recommendation Analysis</h4>
                  <span className={`ml-auto px-3 py-1 text-xs font-bold rounded-full ${
                    selectedJob.matchQuality === 'Strong' ? 'bg-green-600 text-white' :
                    selectedJob.matchQuality === 'Moderate' ? 'bg-blue-600 text-white' :
                    'bg-orange-600 text-white'
                  }`}>
                    {selectedJob.matchQuality} Match
                  </span>
                </div>
                
                {/* Matching Factors */}
                <div className="mb-4">
                  <div className="font-medium text-gray-900 mb-2 text-sm">✓ Matching Factors (Skills You Have):</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.matchingFactors.map((factor, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full border border-green-200 font-medium">
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Skill Gaps */}
                {selectedJob.skillGaps.length > 0 && (
                  <div className="mb-4">
                    <div className="font-medium text-gray-900 mb-2 text-sm">⚠ Skill Gaps Identified:</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedJob.skillGaps.map((gap, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs rounded-full border border-orange-200 font-medium">
                          {gap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upskilling Timeline */}
                <div className="bg-white rounded-lg p-3 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-gray-900 text-sm">Upskilling Timeline:</span>
                    <span className="text-purple-700 font-bold text-sm">{selectedJob.upskillTimeline}</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Recommended learning path available to close skill gaps and become fully qualified for this role
                  </p>
                  <div className="flex items-start gap-2 mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
                    <Shield className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      <span className="font-medium">Important:</span> Completing this learning path does not guarantee job placement. Final hiring decisions are based on role availability, organizational needs, and a comprehensive evaluation process.
                    </p>
                  </div>
                </div>

                {/* Detailed Reasoning */}
                <div className="mt-4 pt-4 border-t border-purple-200 space-y-2 text-sm">
                  <div className="font-medium text-gray-900 mb-2">Why This Role Was Recommended:</div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-700">
                      Your <strong>{selectedJob.matchingFactors.length} verified skills</strong> match job requirements, including proficiency in {selectedJob.matchingFactors.slice(0, 2).join(' and ')}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-700">
                      <strong>{profile.yearsExperience} years in role</strong> in {profile.department} meets this role's seniority requirement
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-700">
                      Similar employees in this role have successfully transitioned from {profile.role} with comparable skill profiles
                    </p>
                  </div>
                  {selectedJob.skillGaps.length > 0 && (
                    <div className="flex items-start gap-2">
                      <TrendingUp className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-700">
                        <strong>Gap identified:</strong> No experience in {selectedJob.skillGaps.slice(0, 2).join(' or ')}. 
                        Suggested learning path: {selectedJob.upskillTimeline} of online courses available
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Fairness & Bias Detection */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-medium text-gray-900">Fairness & Bias Audit</h4>
                  <span className="ml-auto px-2 py-0.5 bg-emerald-600 text-white text-xs rounded-full font-medium">
                    ✓ PASS
                  </span>
                </div>
                
                <div className="space-y-3">
                  {/* Demographic Baseline Comparison */}
                  <div className="bg-white rounded-lg p-3 border border-emerald-200">
                    <div className="font-medium text-gray-900 mb-2 text-sm">📊 Demographic Baseline Comparison:</div>
                    <div className="space-y-1.5 text-xs text-gray-700">
                      <div className="flex items-center justify-between">
                        <span>Recommendation rate for women/minorities with identical skills:</span>
                        <span className="font-bold text-emerald-700">97% match</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Variance from baseline recommendation rate:</span>
                        <span className="font-bold text-emerald-700">+2.1%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Protected attributes correlation test:</span>
                        <span className="font-bold text-emerald-700">No correlation</span>
                      </div>
                    </div>
                  </div>

                  {/* Statistical Test Results */}
                  <div className="bg-white rounded-lg p-3 border border-emerald-200">
                    <div className="font-medium text-gray-900 mb-2 text-sm">🔬 Statistical Test Results:</div>
                    <div className="space-y-1.5 text-xs text-gray-700">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <p>
                          <strong>Demographic parity:</strong> Recommendation rates differ by <strong>&lt;5%</strong> across demographic groups for identical skill profiles (threshold: 10%)
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <p>
                          <strong>Equal opportunity:</strong> No significant difference in false negative rates across protected groups (p-value: 0.89)
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <p>
                          <strong>Calibration check:</strong> Prediction accuracy is consistent across all demographic segments (±3%)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Audit Log */}
                  <div className="bg-white rounded-lg p-3 border border-emerald-200">
                    <div className="font-medium text-gray-900 mb-2 text-sm">📋 Audit Trail:</div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div>• Last fairness audit: Jan 20, 2026</div>
                      <div>• Auditor: Third-party AI Ethics Board (TrustAI Inc.)</div>
                      <div>• Next scheduled audit: Feb 20, 2026</div>
                      <div>• Discrepancies logged: 0 in past 30 days</div>
                    </div>
                  </div>

                  {/* Compliance Statement */}
                  <div className="pt-3 border-t border-emerald-200 text-xs text-gray-600">
                    This recommendation has been verified for fairness using demographic-blind skill matching. 
                    All employees with similar skill profiles receive equivalent recommendations regardless of age, gender, race, or tenure.
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Express Interest
                </button>
                <button className="flex-1 px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                  View Learning Path
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}