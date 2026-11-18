import { useState } from 'react';
import { Profile } from '../types/profile';
import { Search, Filter, TrendingUp, CheckCircle, ChevronRight, MapPin, Briefcase, Award } from 'lucide-react';

interface HRDashboardProps {
  profiles: Profile[];
  onSelectApplicant: (profileId: string) => void;
}

export function HRDashboard({ profiles, onSelectApplicant }: HRDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'matches' | 'experience'>('matches');

  // Get unique departments
  const departments = ['all', ...Array.from(new Set(profiles.map(p => p.department)))];

  // Filter and sort profiles
  const filteredProfiles = profiles
    .filter(profile => {
      const matchesSearch = 
        profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.department.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = filterDepartment === 'all' || profile.department === filterDepartment;
      
      return matchesSearch && matchesDepartment;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'matches') return b.totalMatches - a.totalMatches;
      if (sortBy === 'experience') return b.yearsExperience - a.yearsExperience;
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Active Employees</h2>
        <p className="text-sm text-gray-500 mt-1">
          {filteredProfiles.length} employee{filteredProfiles.length !== 1 ? 's' : ''} • {Array.from(new Set(profiles.map(p => p.department))).length} departments
        </p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">All Departments</option>
              {departments.filter(d => d !== 'all').map(dept => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'matches' | 'experience')}
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
          >
            <option value="matches">Sort: Most Matches</option>
            <option value="name">Sort: Name (A-Z)</option>
            <option value="experience">Sort: Time in Role</option>
          </select>
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-700">
          <div className="col-span-3">Employee</div>
          <div className="col-span-2">Department</div>
          <div className="col-span-3">Top Skills</div>
          <div className="col-span-1 text-center">Matches</div>
          <div className="col-span-1 text-center">Time</div>
          <div className="col-span-2">Status</div>
        </div>

        {/* Employee Rows */}
        {filteredProfiles.map((profile, index) => {
          const skills = profile.skills || profile.extractedSkills.map(s => s.name);
          
          return (
            <div
              key={profile.id}
              className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-4 py-3 hover:bg-blue-50 transition-colors cursor-pointer ${
                index !== filteredProfiles.length - 1 ? 'border-b border-gray-200' : ''
              }`}
              onClick={() => onSelectApplicant(profile.id)}
            >
              {/* Employee Info */}
              <div className="col-span-12 md:col-span-3 flex items-center gap-3">
                <img
                  src={profile.imageUrl}
                  alt={profile.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{profile.name}</div>
                  <div className="text-xs text-gray-500 truncate">{profile.role}</div>
                </div>
              </div>

              {/* Department */}
              <div className="col-span-6 md:col-span-2 flex items-center">
                <span className="text-sm text-gray-600">{profile.department}</span>
              </div>

              {/* Top Skills */}
              <div className="col-span-6 md:col-span-3 flex items-center">
                <div className="flex flex-wrap gap-1">
                  {skills.slice(0, 2).map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded border border-green-200"
                    >
                      {skill}
                    </span>
                  ))}
                  {skills.length > 2 && (
                    <span className="px-2 py-0.5 text-xs text-gray-500">
                      +{skills.length - 2}
                    </span>
                  )}
                </div>
              </div>

              {/* Job Matches */}
              <div className="col-span-3 md:col-span-1 flex items-center justify-center">
                <div className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">{profile.totalMatches}</span>
                </div>
              </div>

              {/* Time in Role */}
              <div className="col-span-3 md:col-span-1 flex items-center justify-center">
                <span className="text-sm text-gray-600">{profile.yearsExperience}y</span>
              </div>

              {/* Application Status */}
              <div className="col-span-6 md:col-span-2 flex items-center">
                {profile.appliedJobs && profile.appliedJobs.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-xs text-purple-700 font-medium">
                      {profile.appliedJobs.length} active app{profile.appliedJobs.length === 1 ? '' : 's'}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">No applications</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredProfiles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 mb-2">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}