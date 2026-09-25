import { Profile } from '../types/profile';
import { X, Mail, MapPin, Calendar, Briefcase, TrendingUp, CheckCircle, Award, ChevronRight, Target, Book, Clock, AlertCircle, BarChart3, Globe } from 'lucide-react';

interface HRApplicantDetailProps {
  profile: Profile;
  onClose: () => void;
}

export function HRApplicantDetail({ profile, onClose }: HRApplicantDetailProps) {
  // Mock job matches data (in real app, this would come from your job matching logic)
  const topJobMatches = [
    {
      title: 'Technical Support Engineer',
      department: 'Customer Success',
      matchScore: 92,
      requiredSkills: 8,
      matchedSkills: 7,
    },
    {
      title: 'Customer Success Operations Specialist',
      department: 'Customer Success',
      matchScore: 85,
      requiredSkills: 9,
      matchedSkills: 8,
    },
    {
      title: 'Implementation Specialist',
      department: 'Customer Success',
      matchScore: 81,
      requiredSkills: 9,
      matchedSkills: 7,
    },
  ];

  // Derive skills array from extractedSkills if skills doesn't exist
  const skills = profile.skills || profile.extractedSkills.map(s => s.name);
  const learningGoals = profile.learningGoals || profile.learningPaths.slice(0, 3).map(lp => lp.title);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <img
                src={profile.imageUrl}
                alt={profile.name}
                className="w-20 h-20 rounded-full object-cover"
              />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{profile.name}</h2>
                <div className="text-gray-600 mb-2">{profile.role}</div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4" />
                    {profile.department}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {profile.location}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Joined {profile.joinDate}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Total Job Matches</span>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-blue-600">{profile.totalMatches}</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Time in Role</span>
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-purple-600">{profile.yearsExperience}</div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Skills Verified</span>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-600">{skills.length}</div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-3">Contact Information</h3>
            <div className="flex items-center gap-2 text-gray-700">
              <Mail className="w-4 h-4 text-gray-500" />
              <a href={`mailto:${profile.email}`} className="text-blue-600 hover:underline">
                {profile.email}
              </a>
            </div>
          </div>

          {/* All Skills */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3">All Skills ({skills.length})</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-full border border-green-200 font-medium"
                >
                  ✓ {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Career Interests */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-gray-900">Career Interests</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-orange-100 text-orange-700 text-sm rounded-full border border-orange-200 font-medium"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>

          {/* Learning Goals */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Book className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-gray-900">Learning Goals</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {learningGoals.map((goal, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-purple-100 text-purple-700 text-sm rounded-full border border-purple-200 font-medium"
                >
                  {goal}
                </span>
              ))}
            </div>
          </div>

          {/* Location Preferences & Work Mode */}
          {profile.workPreferences && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-gray-900">Location Preferences & Work Mode</h3>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-2">Preferred Work Modes</div>
                    <div className="flex flex-wrap gap-2">
                      {profile.workPreferences.types.map((type, idx) => {
                        const workModeLabels = {
                          remote: 'Remote',
                          hybrid: 'Hybrid',
                          'in-person': 'In-Person',
                        };
                        return (
                          <div key={idx} className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm">
                            <Globe className="w-3.5 h-3.5 text-gray-600" />
                            {workModeLabels[type]}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-2">Relocation</div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm">
                      <MapPin className="w-3.5 h-3.5 text-gray-600" />
                      {profile.workPreferences.willingToRelocate ? 'Open to Relocate' : 'Not Open'}
                    </div>
                  </div>
                </div>
                {profile.wishlistLocations && profile.wishlistLocations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="text-xs font-medium text-gray-600 mb-2">Wishlist Locations</div>
                    <div className="flex flex-wrap gap-2">
                      {profile.wishlistLocations.map((location, idx) => (
                        <div key={idx} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm">
                          {location}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Certifications */}
          {profile.certifications && profile.certifications.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-gray-900">Professional Certifications ({profile.certifications.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.certifications.map((cert, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                        <Award className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm mb-1 truncate">{cert.name}</h4>
                        <div className="text-xs text-gray-600 mb-2">{cert.issuer}</div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          <div>{cert.issueDate}</div>
                          {cert.expiryDate && (
                            <>
                              <div>•</div>
                              <div>Exp: {cert.expiryDate}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applied Jobs */}
          {profile.appliedJobs && profile.appliedJobs.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Applied to Internal Positions</h3>
              <div className="space-y-3">
                {profile.appliedJobs.map((job, idx) => {
                  const statusColors = {
                    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                    'under-review': 'bg-blue-50 text-blue-700 border-blue-200',
                    interview: 'bg-purple-50 text-purple-700 border-purple-200',
                    rejected: 'bg-red-50 text-red-700 border-red-200',
                    accepted: 'bg-green-50 text-green-700 border-green-200',
                  };
                  const statusLabels = {
                    pending: 'Pending',
                    'under-review': 'Under Review',
                    interview: 'Interview Stage',
                    rejected: 'Not Selected',
                    accepted: 'Offer Received',
                  };
                  return (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 mb-1">{job.jobTitle}</div>
                          <div className="text-sm text-gray-500">Applied {job.appliedDate}</div>
                        </div>
                        <span className={`px-3 py-1 text-sm font-medium border rounded-full ${statusColors[job.status]}`}>
                          {statusLabels[job.status]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gap Analysis Section */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-6 h-6 text-amber-600" />
              <h3 className="text-xl font-bold text-gray-900">Skills Gap Analysis</h3>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              AI-powered analysis showing how employee skills match open positions and estimated upskilling requirements
            </p>
            
            <div className="space-y-4">
              {profile.jobMatches.slice(0, 3).map((job, idx) => {
                const matchedSkillsCount = job.requiredSkills.filter(skill => 
                  skills.some(s => s.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(s.toLowerCase()))
                ).length;
                const totalSkills = job.requiredSkills.length;
                const matchPercentage = Math.round((matchedSkillsCount / totalSkills) * 100);
                const gapSkills = job.skillGaps.length;
                const estimatedWeeks = gapSkills * 2; // Estimate 2 weeks per skill gap
                
                return (
                  <div key={idx} className="bg-white border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 mb-1">{job.title}</h4>
                        <div className="text-sm text-gray-600">{job.department} • {job.location}</div>
                      </div>
                      <div className="text-center ml-4">
                        <div className={`text-2xl font-bold ${
                          matchPercentage >= 80 ? 'text-green-600' : matchPercentage >= 60 ? 'text-blue-600' : 'text-orange-600'
                        }`}>
                          {matchPercentage}%
                        </div>
                        <div className="text-xs text-gray-500">Ready</div>
                      </div>
                    </div>

                    {/* Skills Match Breakdown */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-700 font-medium">Current Skills Match</span>
                        <span className="text-gray-600">{matchedSkillsCount}/{totalSkills} required skills</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            matchPercentage >= 80 ? 'bg-green-500' : matchPercentage >= 60 ? 'bg-blue-500' : 'bg-orange-500'
                          }`}
                          style={{ width: `${matchPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Skill Gaps */}
                    {job.skillGaps.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium mb-2">
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          Skills to Develop ({job.skillGaps.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {job.skillGaps.map((gap, gapIdx) => (
                            <span
                              key={gapIdx}
                              className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full border border-orange-200"
                            >
                              {gap}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ramp-up Time Estimate */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">Estimated Ramp-up Time</div>
                          <div className="text-xs text-gray-600">With targeted learning paths</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-blue-600">{estimatedWeeks} weeks</div>
                        <div className="text-xs text-gray-600">to full readiness</div>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
                      <div className="text-xs font-medium text-emerald-900 mb-1">HR Recommendation</div>
                      <div className="text-sm text-gray-700">
                        {matchPercentage >= 80 
                          ? '✓ Strong candidate - Ready for role with minimal onboarding'
                          : matchPercentage >= 60
                          ? '⚡ Good fit - Recommend targeted training for skill gaps'
                          : '📚 Moderate fit - Requires comprehensive upskilling program'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Job Matches */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3">Top Job Matches ({profile.totalMatches} total)</h3>
            <div className="space-y-3">
              {topJobMatches.map((job, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">{job.title}</h4>
                      <div className="text-sm text-gray-600">{job.department}</div>
                    </div>
                    <div className="text-center ml-4">
                      <div className={`text-2xl font-bold ${
                        job.matchScore >= 85 ? 'text-green-600' : 'text-blue-600'
                      }`}>
                        {job.matchScore}%
                      </div>
                      <div className="text-xs text-gray-500">Match</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Skills: {job.matchedSkills}/{job.requiredSkills} required
                    </div>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          job.matchScore >= 85 ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${(job.matchedSkills / job.requiredSkills) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Career Summary (from video transcript) */}
          {profile.careerStory && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-2">Career Story Summary</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                {profile.careerStory}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Contact Employee
            </button>
            <button className="flex-1 px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
              View All Matches
            </button>
            <button className="flex-1 px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
              Export Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}