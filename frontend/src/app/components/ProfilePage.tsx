import { useState } from 'react';
import { Upload, Video, Mic, CheckCircle, Loader2, Play, Sparkles, FileText, Download, Eye, RefreshCw, Shield, Lock, MapPin, Globe, Award } from 'lucide-react';
import { Profile } from '../types/profile';

interface ProfilePageProps {
  profile: Profile;
  onNavigate: (page: 'profile' | 'jobs' | 'skills') => void;
}

export function ProfilePage({ profile, onNavigate }: ProfilePageProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete'>('complete');
  const [uploadType, setUploadType] = useState<'video' | 'audio' | null>(profile.uploadType);

  const handleFileUpload = (type: 'video' | 'audio') => {
    setUploadType(type);
    setUploadStatus('uploading');
    
    // Simulate upload and processing
    setTimeout(() => {
      setUploadStatus('processing');
      setTimeout(() => {
        setUploadStatus('complete');
      }, 2000);
    }, 1500);
  };

  const downloadProfilePhoto = async () => {
    try {
      const response = await fetch(profile.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${profile.name.replace(' ', '_')}_Profile_Photo.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading profile photo:', error);
    }
  };

  // Get unique categories from profile skills
  const categories = Array.from(new Set(profile.extractedSkills.map(s => s.category)));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-6">
          <div className="relative group">
            <img
              src={profile.imageUrl}
              alt={profile.name}
              className="w-24 h-24 rounded-full object-cover"
            />
            <button
              onClick={downloadProfilePhoto}
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-60 rounded-full transition-all opacity-0 group-hover:opacity-100"
              title="Download profile photo"
            >
              <Download className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
            <p className="text-gray-600 mt-1">{profile.role}</p>
            <p className="text-sm text-gray-500 mt-1">{profile.department} • {profile.yearsExperience} years in role</p>
            <div className="flex gap-4 mt-4">
              <div className="text-center">
                <div className="font-bold text-gray-900">{profile.totalSkills}</div>
                <div className="text-xs text-gray-500">Skills</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900">{profile.totalMatches}</div>
                <div className="text-xs text-gray-500">Matches</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900">{profile.profileStrength}%</div>
                <div className="text-xs text-gray-500">Profile Strength</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LinkedIn Connection */}
      {uploadStatus === 'complete' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#0077B5] rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">Connect to LinkedIn</h3>
              <p className="text-sm text-gray-600 mb-4">
                Import your LinkedIn profile to automatically populate your work experience, education, skills, and certifications. This helps us create a more complete profile for better job matching.
              </p>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#0077B5] hover:bg-[#006399] text-white rounded-lg transition-colors font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Connect LinkedIn Profile
              </button>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <Lock className="w-3.5 h-3.5" />
                <span>Your LinkedIn data is securely imported and never shared without your permission</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resume Section */}
      {uploadStatus === 'complete' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-gray-900">Resume</h3>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{profile.resumeFileName}</span>
                    <CheckCircle className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="text-sm text-gray-500">
                    Uploaded Jan 10, 2026 • 245 KB
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                  <RefreshCw className="w-4 h-4" />
                  Replace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Me Video */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-2">
          <Video className="w-5 h-5 text-teal-600" />
          <h3 className="font-bold text-gray-900">About Me Video</h3>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Upload a short video introducing yourself, your work experience, and your career goals. Our AI will extract keywords and skills to match you with relevant jobs.
        </p>
        
        {/* Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            <span className="font-medium">Privacy Protected:</span> Your video is encrypted and accessible only to you and authorized HR personnel. 
            It will never be shared externally without your consent.
          </p>
        </div>

        {uploadStatus === 'complete' && uploadType === 'video' ? (
          <div className="space-y-4">
            {/* Video Player */}
            <div className="relative rounded-lg overflow-hidden group">
              <img
                src="https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHdvbWFuJTIwcG9ydHJhaXR8ZW58MXx8fHwxNzY5MTI4MDkzfDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Video thumbnail"
                className="w-full h-[400px] object-cover"
              />
              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                <button className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all transform hover:scale-105 shadow-lg">
                  <Play className="w-5 h-5 fill-white" />
                  <span className="font-medium">Play Video</span>
                </button>
              </div>
              {/* Duration Badge */}
              <div className="absolute bottom-4 right-4 px-2 py-1 bg-black bg-opacity-75 text-white text-sm rounded">
                2:34
              </div>
            </div>

            {/* AI-Extracted Keywords */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-teal-600" />
                <h4 className="font-medium text-gray-900">AI-Extracted Keywords</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.extractedKeywords.map((keyword, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded text-sm font-medium">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => setUploadStatus('idle')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Upload a new video
            </button>
          </div>
        ) : uploadStatus === 'idle' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={() => handleFileUpload('video')}
              />
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                    <Video className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="font-medium text-gray-900 mb-1">Upload Video</div>
                  <div className="text-sm text-gray-500">MP4, MOV up to 50MB</div>
                </div>
              </div>
            </label>

            <label className="cursor-pointer">
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={() => handleFileUpload('audio')}
              />
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                    <Mic className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="font-medium text-gray-900 mb-1">Upload Audio</div>
                  <div className="text-sm text-gray-500">MP3, WAV up to 25MB</div>
                </div>
              </div>
            </label>
          </div>
        ) : uploadStatus === 'uploading' ? (
          <div className="border border-gray-200 rounded-lg p-8">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-3" />
              <div className="font-medium text-gray-900 mb-1">Uploading {uploadType}...</div>
              <div className="text-sm text-gray-500">Please wait while we upload your file</div>
            </div>
          </div>
        ) : uploadStatus === 'processing' ? (
          <div className="border border-gray-200 rounded-lg p-8">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-3" />
              <div className="font-medium text-gray-900 mb-1">Processing with AI...</div>
              <div className="text-sm text-gray-500">Extracting skills, experience, and career interests</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Extracted Skills */}
      {uploadStatus === 'complete' && (
        <>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4">Extracted Skills</h3>
            <p className="text-sm text-gray-600 mb-6">
              These skills were automatically identified from your recording and resume. Verified skills have been confirmed through assessments.
            </p>
            
            <div className="space-y-4">
              {categories.map(category => (
                <div key={category}>
                  <div className="text-sm font-medium text-gray-700 mb-2">{category}</div>
                  <div className="flex flex-wrap gap-2">
                    {profile.extractedSkills
                      .filter(skill => skill.category === category)
                      .map((skill, idx) => (
                        <div
                          key={idx}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                            skill.verified
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          {skill.name}
                          {skill.verified && <CheckCircle className="w-3.5 h-3.5" />}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Certifications */}
          {profile.certifications && profile.certifications.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-teal-600" />
                  <h3 className="font-bold text-gray-900">Certifications</h3>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Add Certification
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Professional certifications that validate your expertise and skills.
              </p>
              <div className="space-y-4">
                {profile.certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Award className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 mb-1">{cert.name}</h4>
                          <div className="text-sm text-gray-600 mb-2">{cert.issuer}</div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            <div>Issued: {cert.issueDate}</div>
                            {cert.expiryDate && (
                              <>
                                <div>•</div>
                                <div>Expires: {cert.expiryDate}</div>
                              </>
                            )}
                            {cert.credentialId && (
                              <>
                                <div>•</div>
                                <div>ID: {cert.credentialId}</div>
                              </>
                            )}
                          </div>
                          {cert.credentialUrl && (
                            <a
                              href={cert.credentialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              View Credential
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Career Interests */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4">Career Interests</h3>
            <p className="text-sm text-gray-600 mb-4">
              Based on your recording, we identified these career directions you're interested in exploring.
            </p>
            <div className="flex flex-wrap gap-3">
              {profile.interests.map((interest, idx) => (
                <div
                  key={idx}
                  className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium"
                >
                  {interest}
                </div>
              ))}
            </div>
          </div>

          {/* Location Preferences & Work Mode */}
          {profile.workPreferences && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-gray-900">Location Preferences</h3>
              </div>
              
              <div className="space-y-4">
                {/* Work Mode Preferences */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Preferred Work Modes</div>
                  <div className="flex flex-wrap gap-2">
                    {profile.workPreferences.types.map((type, idx) => {
                      const workModeStyles = {
                        remote: 'bg-blue-50 text-blue-700 border-blue-200',
                        hybrid: 'bg-purple-50 text-purple-700 border-purple-200',
                        'in-person': 'bg-green-50 text-green-700 border-green-200',
                      };
                      const workModeLabels = {
                        remote: 'Remote',
                        hybrid: 'Hybrid',
                        'in-person': 'In-Person',
                      };
                      return (
                        <div
                          key={idx}
                          className={`px-4 py-2 border rounded-lg font-medium ${workModeStyles[type]}`}
                        >
                          <Globe className="w-4 h-4 inline-block mr-2" />
                          {workModeLabels[type]}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Relocation Preference */}
                <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {profile.workPreferences.willingToRelocate ? 'Open to Relocation' : 'Not Open to Relocation'}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {profile.workPreferences.willingToRelocate 
                        ? 'Willing to relocate for the right opportunity' 
                        : 'Prefer to stay in current location'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wishlist Locations */}
          {profile.wishlistLocations && profile.wishlistLocations.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-teal-600" />
                  <h3 className="font-bold text-gray-900">Wishlist Locations</h3>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Edit
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Your preferred locations for internal opportunities. We'll prioritize matches in these areas.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.wishlistLocations.map((location, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-teal-50 rounded-full flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{location}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applied Jobs */}
          {profile.appliedJobs && profile.appliedJobs.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Applied Jobs</h3>
              <p className="text-sm text-gray-600 mb-4">
                Track the status of your internal job applications.
              </p>
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
                  
                  // Find the matching job from jobMatches to get skill gap info
                  const matchingJob = profile.jobMatches.find(
                    match => match.title === job.jobTitle
                  );
                  
                  return (
                    <div key={idx} className="border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 mb-1">{job.jobTitle}</div>
                          <div className="text-sm text-gray-500">Applied {job.appliedDate}</div>
                        </div>
                        <span className={`px-3 py-1 text-sm font-medium border rounded-full ${statusColors[job.status]}`}>
                          {statusLabels[job.status]}
                        </span>
                      </div>
                      
                      {matchingJob && matchingJob.skillGaps && matchingJob.skillGaps.length > 0 && (
                        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                          <div className="text-sm text-gray-600 mb-2">Skills to develop:</div>
                          <div className="flex flex-wrap gap-2">
                            {matchingJob.skillGaps.map((skill, skillIdx) => (
                              <span
                                key={skillIdx}
                                className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-sm p-6 text-white">
            <h3 className="font-bold mb-2">Ready to Explore Opportunities?</h3>
            <p className="text-blue-100 mb-4">
              Based on your skills and interests, we've found {profile.totalMatches} matching roles in {profile.jobMatches[0]?.department || 'various departments'} and recommended learning paths to help you transition.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  onNavigate('jobs');
                  window.scrollTo(0, 0);
                }}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
              >
                View Job Matches
              </button>
              <button 
                onClick={() => {
                  onNavigate('skills');
                  window.scrollTo(0, 0);
                }}
                className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium border border-blue-500"
              >
                Start Skills Assessment
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}