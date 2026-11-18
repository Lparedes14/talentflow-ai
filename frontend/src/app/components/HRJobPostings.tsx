import { useState } from 'react';
import { Profile } from '../types/profile';
import { Search, Filter, Plus, Users, MapPin, Briefcase, ChevronRight, TrendingUp, AlertCircle, CheckCircle, Clock, BarChart3 } from 'lucide-react';

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  status: 'open' | 'filled' | 'on-hold';
  requiredSkills: string[];
  candidateCount: number;
  hiringManager: string;
  postedDate: string;
  urgency: 'high' | 'medium' | 'low';
}

interface HRJobPostingsProps {
  profiles: Profile[];
  onSelectJob: (jobId: string) => void;
}

export function HRJobPostings({ profiles, onSelectJob }: HRJobPostingsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  // Mock job postings data
  const jobPostings: JobPosting[] = [
    {
      id: '1',
      title: 'Technical Support Engineer',
      department: 'Customer Success',
      location: 'Remote',
      type: 'Full-time',
      status: 'open',
      requiredSkills: ['Technical Troubleshooting', 'Customer Communication', 'Ticket Management', 'Technical Documentation', 'Problem Solving', 'ITSM Tools', 'API Knowledge', 'Scripting'],
      candidateCount: 8,
      hiringManager: 'David Kim',
      postedDate: 'Jan 15, 2026',
      urgency: 'high',
    },
    {
      id: '2',
      title: 'Customer Success Developer',
      department: 'Customer Success',
      location: 'San Francisco, CA',
      type: 'Full-time',
      status: 'open',
      requiredSkills: ['JavaScript', 'Customer Communication', 'API Development', 'SQL'],
      candidateCount: 5,
      hiringManager: 'Sarah Chen',
      postedDate: 'Jan 10, 2026',
      urgency: 'medium',
    },
    {
      id: '3',
      title: 'Solutions Engineer',
      department: 'Customer Success',
      location: 'San Francisco, CA',
      type: 'Full-time',
      status: 'open',
      requiredSkills: ['Technical Presentation', 'Solution Design', 'API Integration', 'Customer Communication'],
      candidateCount: 4,
      hiringManager: 'Jennifer Park',
      postedDate: 'Jan 8, 2026',
      urgency: 'medium',
    },
    {
      id: '4',
      title: 'Customer Success Operations Specialist',
      department: 'Customer Success',
      location: 'San Francisco, CA',
      type: 'Full-time',
      status: 'open',
      requiredSkills: ['Ticket Management', 'Process Optimization', 'Data Analysis', 'Tool Administration'],
      candidateCount: 6,
      hiringManager: 'Alex Thompson',
      postedDate: 'Jan 5, 2026',
      urgency: 'low',
    },
    {
      id: '5',
      title: 'Implementation Specialist',
      department: 'Customer Success',
      location: 'New York, NY',
      type: 'Full-time',
      status: 'open',
      requiredSkills: ['Customer Communication', 'Technical Troubleshooting', 'Configuration Management', 'Training Delivery'],
      candidateCount: 7,
      hiringManager: 'Rachel Martinez',
      postedDate: 'Dec 20, 2025',
      urgency: 'high',
    },
    {
      id: '6',
      title: 'Support Automation Engineer',
      department: 'Customer Success',
      location: 'Remote',
      type: 'Full-time',
      status: 'open',
      requiredSkills: ['Python', 'Workflow Automation', 'API Integration', 'Scripting'],
      candidateCount: 3,
      hiringManager: 'Tom Wilson',
      postedDate: 'Dec 15, 2025',
      urgency: 'medium',
    },
  ];

  // Get unique departments
  const departments = ['all', ...Array.from(new Set(jobPostings.map(j => j.department)))];

  // Filter jobs
  const filteredJobs = jobPostings.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.hiringManager.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
    const matchesDepartment = filterDepartment === 'all' || job.department === filterDepartment;
    
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  // Calculate total candidates across all jobs
  const totalCandidates = jobPostings.reduce((sum, job) => sum + job.candidateCount, 0);
  const openJobs = jobPostings.filter(j => j.status === 'open').length;
  const urgentJobs = jobPostings.filter(j => j.urgency === 'high').length;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Open Positions</h2>
            <p className="text-gray-600">
              Manage job postings and view matched internal candidates
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            <Plus className="w-5 h-5" />
            New Job Posting
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">{openJobs}</div>
              <div className="text-sm text-gray-600">Open Positions</div>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">{urgentJobs}</div>
              <div className="text-sm text-gray-600">Urgent Positions</div>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(totalCandidates / openJobs * 10) / 10}
              </div>
              <div className="text-sm text-gray-600">Avg Candidates/Job</div>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, department, or manager..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="filled">Filled</option>
            <option value="on-hold">On Hold</option>
          </select>

          {/* Department Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>
                  {dept === 'all' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {searchQuery && (
          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredJobs.length} position{filteredJobs.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Job Postings List */}
      <div className="space-y-4">
        {filteredJobs.map(job => (
          <div
            key={job.id}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelectJob(job.id)}
          >
            <div className="flex items-start justify-between">
              {/* Job Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-gray-900 text-lg">{job.title}</h3>
                  {job.urgency === 'high' && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      Urgent
                    </span>
                  )}
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    job.status === 'open' ? 'bg-green-100 text-green-700' :
                    job.status === 'filled' ? 'bg-gray-100 text-gray-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {job.status === 'open' ? 'Open' : job.status === 'filled' ? 'Filled' : 'On Hold'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4" />
                    {job.department}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {job.location}
                  </div>
                  <div className="text-gray-500">•</div>
                  <div>Posted {job.postedDate}</div>
                </div>

                <div className="mb-3">
                  <div className="text-xs text-gray-600 mb-2">Hiring Manager: <span className="font-medium text-gray-900">{job.hiringManager}</span></div>
                  <div className="text-xs text-gray-600">Required Skills:</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {job.requiredSkills.slice(0, 4).map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
                      >
                        {skill}
                      </span>
                    ))}
                    {job.requiredSkills.length > 4 && (
                      <span className="px-2 py-1 text-xs text-gray-500">
                        +{job.requiredSkills.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                    <Users className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                      {job.candidateCount} Matched Candidates
                    </span>
                  </div>
                  <button className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    View Candidates
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Gap Analysis - Top Candidates */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-amber-600" />
                    <h4 className="text-sm font-bold text-gray-900">Top Candidates - Job Match</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {profiles
                      .map((profile) => {
                        // Calculate match based on job required skills
                        const profileSkills = profile.skills || profile.extractedSkills.map(s => s.name);
                        let matchedSkills = job.requiredSkills.filter(reqSkill => 
                          profileSkills.some(pSkill => 
                            pSkill.toLowerCase().includes(reqSkill.toLowerCase()) || 
                            reqSkill.toLowerCase().includes(pSkill.toLowerCase())
                          )
                        ).length;
                        let matchPercentage = Math.round((matchedSkills / job.requiredSkills.length) * 100);
                        
                        // Override match percentages and skills for Technical Support Engineer job
                        if (job.title === 'Technical Support Engineer') {
                          if (profile.name === 'Christine Wu') {
                            matchPercentage = 92;
                            matchedSkills = 7;
                          } else if (profile.name === 'David Rodriguez') {
                            matchPercentage = 75;
                            matchedSkills = 6;
                          }
                        }
                        
                        return { profile, matchedSkills, matchPercentage };
                      })
                      .filter(({ matchPercentage }) => matchPercentage > 0) // Filter out 0% matches
                      .sort((a, b) => b.matchPercentage - a.matchPercentage) // Sort by match percentage
                      .slice(0, 3) // Take top 3
                      .map(({ profile, matchedSkills, matchPercentage }) => {
                        const skillGap = job.requiredSkills.length - matchedSkills;
                        let estimatedWeeks = skillGap * 2;
                        
                        // Override ramp-up weeks for Technical Support Engineer job
                        if (job.title === 'Technical Support Engineer') {
                          if (profile.name === 'Christine Wu') {
                            estimatedWeeks = 4;
                          } else if (profile.name === 'David Rodriguez') {
                            estimatedWeeks = 6;
                          }
                        }

                        return (
                          <div key={profile.id} className="bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex items-start gap-2 mb-2">
                              <img
                                src={profile.imageUrl}
                                alt={profile.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{profile.name}</div>
                                <div className="text-xs text-gray-600">{profile.role}</div>
                              </div>
                              <div className={`text-lg font-bold ${
                                matchPercentage >= 80 ? 'text-green-600' : matchPercentage >= 60 ? 'text-blue-600' : 'text-orange-600'
                              }`}>
                                {matchPercentage}%
                              </div>
                            </div>

                            {/* Skills Match */}
                            <div className="mb-2">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                <span>Skills Match</span>
                                <span>{matchedSkills}/{job.requiredSkills.length}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    matchPercentage >= 80 ? 'bg-green-500' : matchPercentage >= 60 ? 'bg-blue-500' : 'bg-orange-500'
                                  }`}
                                  style={{ width: `${matchPercentage}%` }}
                                />
                              </div>
                            </div>

                            {/* Ramp-up Time */}
                            {skillGap > 0 && (
                              <div className="flex items-center justify-between p-2 bg-white rounded border border-blue-200">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-blue-600" />
                                  <span className="text-xs text-gray-700">Ramp-up</span>
                                </div>
                                <span className="text-xs font-bold text-blue-600">{estimatedWeeks} weeks</span>
                              </div>
                            )}
                            {skillGap === 0 && (
                              <div className="flex items-center justify-center gap-1 p-2 bg-green-100 rounded border border-green-200">
                                <CheckCircle className="w-3 h-3 text-green-600" />
                                <span className="text-xs font-bold text-green-700">Ready Now</span>
                              </div>
                            )}

                            {/* Application Status */}
                            {profile.appliedJobs?.some(app => app.jobTitle === job.title) && (
                              <div className="mt-2 px-2 py-1 bg-purple-100 border border-purple-200 rounded text-xs text-center">
                                <span className="font-medium text-purple-700">✓ Applied</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredJobs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No job postings found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}