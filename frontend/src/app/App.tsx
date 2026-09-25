import { useState } from 'react';
import { ProfilePage } from './components/ProfilePage';
import { JobMatchPage } from './components/JobMatchPage';
import { SkillsDevelopmentPage } from './components/SkillsDevelopmentPage';
import { HRDashboard } from './components/HRDashboard';
import { HRApplicantDetail } from './components/HRApplicantDetail';
import { HRJobPostings } from './components/HRJobPostings';
import { User, Briefcase, GraduationCap, ChevronDown, Shield, Users, Download } from 'lucide-react';
import { profiles } from './data/profiles';
import logo from 'figma:asset/15c86671bf79d2fd41906190771a894bbb54194d.png';

type Page = 'profile' | 'jobs' | 'skills';
type ViewMode = 'applicant' | 'hr';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('profile');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('christine-wu');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('applicant');
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];
  const selectedApplicant = selectedApplicantId ? profiles.find(p => p.id === selectedApplicantId) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img 
                src={logo} 
                alt="TalentFlow Logo" 
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div className="hidden sm:block">
                <h1 className="font-bold text-gray-900">TalentFlow</h1>
                <p className="text-xs text-gray-500">Mapping the Future of Work</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Download Source Button */}
              <a
                href="/download.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-medium transition-colors"
                title="Download all source code"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download Code</span>
              </a>

              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('applicant')}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    viewMode === 'applicant'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Applicant</span>
                  </span>
                </button>
                <button
                  onClick={() => setViewMode('hr')}
                  className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    viewMode === 'hr'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">HR</span>
                  </span>
                </button>
              </div>
            
              {/* Profile Switcher */}
              {viewMode === 'applicant' && (
                <div className="relative">
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <img
                      src={selectedProfile.imageUrl}
                      alt={selectedProfile.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium text-gray-900">{selectedProfile.name}</div>
                      <div className="text-xs text-gray-500">{selectedProfile.role}</div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {/* Dropdown Menu */}
                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                      {profiles.map((profile) => (
                        <button
                          key={profile.id}
                          onClick={() => {
                            setSelectedProfileId(profile.id);
                            setShowProfileDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                            profile.id === selectedProfileId ? 'bg-blue-50' : ''
                          }`}
                        >
                          <img
                            src={profile.imageUrl}
                            alt={profile.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium text-gray-900">{profile.name}</div>
                            <div className="text-xs text-gray-500">{profile.role}</div>
                            <div className="text-xs text-gray-400">{profile.department}</div>
                          </div>
                          {profile.id === selectedProfileId && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage('profile')}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${
                  currentPage === 'profile'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <User className="w-5 h-5" />
                <span className="font-medium">{viewMode === 'hr' ? 'Active Employees' : 'Profile'}</span>
              </button>
              <button
                onClick={() => setCurrentPage('jobs')}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${
                  currentPage === 'jobs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span className="font-medium">{viewMode === 'hr' ? 'Open Positions' : 'Job Matches'}</span>
              </button>
              {viewMode === 'applicant' && (
                <button
                  onClick={() => setCurrentPage('skills')}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${
                    currentPage === 'skills'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <GraduationCap className="w-5 h-5" />
                  <span className="font-medium">Skills Development</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === 'applicant' && currentPage === 'profile' && (
          <ProfilePage profile={selectedProfile} onNavigate={setCurrentPage} />
        )}
        {viewMode === 'applicant' && currentPage === 'jobs' && (
          <JobMatchPage profile={selectedProfile} />
        )}
        {viewMode === 'applicant' && currentPage === 'skills' && (
          <SkillsDevelopmentPage profile={selectedProfile} />
        )}
        
        {viewMode === 'hr' && currentPage === 'profile' && (
          <HRDashboard 
            profiles={profiles} 
            onSelectApplicant={(id) => setSelectedApplicantId(id)} 
          />
        )}
        {viewMode === 'hr' && currentPage === 'jobs' && (
          <HRJobPostings 
            profiles={profiles} 
            onSelectJob={(id) => console.log('Selected job:', id)} 
          />
        )}
        {viewMode === 'hr' && currentPage === 'skills' && (
          <SkillsDevelopmentPage profile={selectedProfile} />
        )}

        {/* HR Applicant Detail Modal */}
        {selectedApplicant && (
          <HRApplicantDetail 
            profile={selectedApplicant} 
            onClose={() => setSelectedApplicantId(null)} 
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Privacy & Compliance Banner */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">Privacy & AI Ethics Protected</span>
                  <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs rounded-full font-medium">SOC 2 Compliant</span>
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">GDPR</span>
                </div>
                <p className="text-sm text-gray-600">
                  Your career data is encrypted and protected. Our AI recommendations undergo bias detection and fairness audits. 
                  All role suggestions include explainable reasoning to ensure transparency and equity.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">Empowering organizations with skills-first internal mobility</p>
            <p className="text-xs text-gray-500">© 2026 TalentFlow. Transforming careers, one opportunity at a time.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}