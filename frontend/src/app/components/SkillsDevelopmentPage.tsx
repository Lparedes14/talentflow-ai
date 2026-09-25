import { useState } from 'react';
import { GraduationCap, CheckCircle, Clock, TrendingUp, Star, Users, Play, ChevronRight, X, BookOpen, Award, PlayCircle, ExternalLink, Lightbulb, Shield } from 'lucide-react';
import { Profile } from '../types/profile';

interface Assessment {
  id: string;
  name: string;
  category: string;
  currentLevel: number;
  targetLevel: number;
  description: string;
  status: 'not-started' | 'in-progress' | 'completed';
  estimatedTime: string;
}

interface Course {
  id: string;
  title: string;
  provider: string;
  duration: string;
  level: string;
  skills: string[];
  enrollmentCount: number;
  rating: number;
}

interface SkillsDevelopmentPageProps {
  profile: Profile;
}

export function SkillsDevelopmentPage({ profile }: SkillsDevelopmentPageProps) {
  const [selectedTab, setSelectedTab] = useState<'assessments' | 'courses'>('assessments');
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);

  const assessments: Assessment[] = [
    {
      id: '1',
      name: 'Technical Troubleshooting',
      category: 'Technical Skills',
      currentLevel: 3,
      targetLevel: 5,
      description: 'Assess your ability to diagnose and resolve technical issues.',
      status: 'completed',
      estimatedTime: '30 mins',
    },
    {
      id: '2',
      name: 'Customer Communication',
      category: 'Soft Skills',
      currentLevel: 4,
      targetLevel: 5,
      description: 'Evaluate your communication skills with customers.',
      status: 'completed',
      estimatedTime: '25 mins',
    },
    {
      id: '3',
      name: 'Technical Documentation',
      category: 'Technical Skills',
      currentLevel: 3,
      targetLevel: 5,
      description: 'Test your ability to create and understand technical documentation.',
      status: 'completed',
      estimatedTime: '30 mins',
    },
    {
      id: '4',
      name: 'JavaScript Fundamentals',
      category: 'Technical Skills',
      currentLevel: 2,
      targetLevel: 5,
      description: 'Assess your understanding of JavaScript basics.',
      status: 'in-progress',
      estimatedTime: '45 mins',
    },
    {
      id: '5',
      name: 'API Development',
      category: 'Technical Skills',
      currentLevel: 1,
      targetLevel: 5,
      description: 'Evaluate your knowledge of API development.',
      status: 'not-started',
      estimatedTime: '50 mins',
    },
    {
      id: '6',
      name: 'SQL Basics',
      category: 'Technical Skills',
      currentLevel: 1,
      targetLevel: 5,
      description: 'Test your understanding of SQL basics.',
      status: 'not-started',
      estimatedTime: '40 mins',
    },
  ];

  const courses: Course[] = [
    {
      id: '1',
      title: 'JavaScript for Beginners',
      provider: 'Coursera',
      duration: '4 weeks',
      level: 'Beginner',
      skills: ['JavaScript'],
      enrollmentCount: 120000,
      rating: 4.8,
    },
    {
      id: '2',
      title: 'Introduction to APIs and RESTful Services',
      provider: 'edX',
      duration: '5 weeks',
      level: 'Beginner',
      skills: ['API Development'],
      enrollmentCount: 80000,
      rating: 4.7,
    },
    {
      id: '3',
      title: 'SQL for Data Analysis',
      provider: 'LinkedIn Learning',
      duration: '3 hours',
      level: 'Beginner',
      skills: ['SQL'],
      enrollmentCount: 50000,
      rating: 4.6,
    },
    {
      id: '4',
      title: 'Python Automation for Everybody',
      provider: 'Coursera',
      duration: '8 weeks',
      level: 'Beginner',
      skills: ['Automation & Scripting'],
      enrollmentCount: 150000,
      rating: 4.9,
    },
    {
      id: '5',
      title: 'Building Customer Success Tools',
      provider: 'LinkedIn Learning',
      duration: '2 hours',
      level: 'Intermediate',
      skills: ['CS Tools Development'],
      enrollmentCount: 30000,
      rating: 4.5,
    },
    {
      id: '6',
      title: 'Git and GitHub Essentials',
      provider: 'edX',
      duration: '3 weeks',
      level: 'Beginner',
      skills: ['Version Control'],
      enrollmentCount: 100000,
      rating: 4.7,
    },
    {
      id: '7',
      title: 'Solutions Engineering Fundamentals',
      provider: 'Coursera',
      duration: '6 weeks',
      level: 'Intermediate',
      skills: ['Solution Design'],
      enrollmentCount: 70000,
      rating: 4.6,
    },
    {
      id: '8',
      title: 'Technical Presentation Skills',
      provider: 'LinkedIn Learning',
      duration: '1.5 hours',
      level: 'Beginner',
      skills: ['Technical Presentation'],
      enrollmentCount: 20000,
      rating: 4.8,
    },
  ];

  const getProviderLogo = (provider: Course['provider']) => {
    const colors = {
      'Coursera': 'bg-blue-600',
      'edX': 'bg-red-600',
      'LinkedIn Learning': 'bg-sky-600',
    };
    return colors[provider];
  };

  const completedCount = assessments.filter(a => a.status === 'completed').length;
  const inProgressCount = assessments.filter(a => a.status === 'in-progress').length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Skills Development</h2>
        <p className="text-gray-600">
          Validate your skills and discover learning paths to transition into Customer Success development roles
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{completedCount}</div>
              <div className="text-sm text-gray-600">Assessments Completed</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{inProgressCount}</div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{courses.length}</div>
              <div className="text-sm text-gray-600">Recommended Courses</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setSelectedTab('assessments')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            selectedTab === 'assessments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Skill Assessments
        </button>
        <button
          onClick={() => setSelectedTab('courses')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            selectedTab === 'courses'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Recommended Courses
        </button>
      </div>

      {/* Assessments Tab */}
      {selectedTab === 'assessments' && (
        <div className="space-y-4">
          {assessments.map(assessment => (
            <div
              key={assessment.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-gray-900">{assessment.name} Assessment</h3>
                    {assessment.status === 'completed' ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Completed
                      </span>
                    ) : assessment.status === 'in-progress' ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        In Progress
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                        Not Started
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {assessment.estimatedTime}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-sm text-gray-700 font-medium mb-1">Description:</div>
                    <div className="text-sm text-gray-600">{assessment.description}</div>
                  </div>

                  {assessment.status === 'completed' && (
                    <div>
                      <div className="text-sm text-gray-600 mb-2">Performance</div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            assessment.currentLevel >= 4 ? 'bg-green-500' :
                            assessment.currentLevel >= 3 ? 'bg-blue-500' :
                            'bg-orange-500'
                          }`}
                          style={{ width: `${(assessment.currentLevel / assessment.targetLevel) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="ml-4">
                  {assessment.status === 'completed' ? (
                    <button className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm">
                      Retake
                    </button>
                  ) : assessment.status === 'in-progress' ? (
                    <button
                      onClick={() => setSelectedAssessment(assessment)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedAssessment(assessment)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      Start Assessment
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Courses Tab */}
      {selectedTab === 'courses' && (
        <div className="space-y-6">
          {/* Why These Courses Were Recommended - Explainable AI */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-purple-600" />
              <h3 className="font-medium text-gray-900">AI-Powered Learning Path Explanation</h3>
            </div>
            
            {/* Positive Factors */}
            <div className="mb-3">
              <div className="font-medium text-gray-900 mb-2 text-sm">✓ Why These Courses Match Your Goals:</div>
              <div className="space-y-1.5 text-sm text-gray-700">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <p>
                    Based on your interest in <strong>{profile.interests[0]}</strong>, these courses directly address the required technical skills
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <p>
                    Your <strong>{profile.yearsExperience} years in role</strong> as a {profile.role} indicates you're ready for beginner-to-intermediate technical training
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <p>
                    These courses align with <strong>{profile.totalMatches} internal job opportunities</strong> you're matched to, including top roles like Customer Success Developer
                  </p>
                </div>
              </div>
            </div>

            {/* Negative Factors / Gaps */}
            <div className="bg-white rounded-lg p-3 border border-purple-200">
              <div className="font-medium text-gray-900 mb-2 text-sm">⚠ Skill Gaps Identified from Job Matches:</div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs rounded-full border border-orange-200 font-medium">
                  JavaScript
                </span>
                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs rounded-full border border-orange-200 font-medium">
                  API Development
                </span>
                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs rounded-full border border-orange-200 font-medium">
                  SQL
                </span>
                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs rounded-full border border-orange-200 font-medium">
                  Python/Scripting
                </span>
              </div>
              <p className="text-xs text-gray-600">
                <strong>Gap identified:</strong> No formal training in JavaScript, APIs, or SQL detected from your profile. 
                Recommended learning path below follows a structured progression: <strong>Fundamentals → Intermediate → Advanced</strong>
              </p>
            </div>

            {/* Timeline Breakdown */}
            <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-gray-900 text-sm">Estimated Upskilling Timeline:</span>
              </div>
              <div className="space-y-1 text-xs text-gray-700">
                <div className="flex justify-between">
                  <span>• JavaScript Fundamentals (4 weeks)</span>
                  <span className="font-medium">Month 1</span>
                </div>
                <div className="flex justify-between">
                  <span>• SQL Basics (3 weeks) + APIs Intro (5 weeks)</span>
                  <span className="font-medium">Months 2-3</span>
                </div>
                <div className="flex justify-between">
                  <span>• Python Automation (8 weeks, optional)</span>
                  <span className="font-medium">Months 3-4</span>
                </div>
                <div className="pt-2 border-t border-purple-200 mt-2 flex justify-between font-bold text-purple-700">
                  <span>Total estimated time to qualify:</span>
                  <span>3-4 months</span>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  <span className="font-medium">Important:</span> Completing this learning path does not guarantee job placement. While it will help you develop the required skills, final hiring decisions are based on role availability, organizational needs, and a comprehensive evaluation process.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map(course => (
              <div
                key={course.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`px-3 py-1 ${getProviderLogo(course.provider)} text-white text-xs font-medium rounded`}>
                    {course.provider}
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-yellow-500">★</span>
                    <span className="font-medium text-gray-900">{course.rating}</span>
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{course.title}</h3>

                <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {course.duration}
                  </div>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                    {course.level}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-700 font-medium mb-1">Skills:</div>
                  <div className="flex flex-wrap gap-2">
                    {course.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-purple-100 text-purple-700 text-sm rounded border border-purple-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <a
                  href={`https://www.${course.provider.toLowerCase().replace(' ', '-')}.org/course/${course.title.toLowerCase().replace(/ /g, '-')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  View Course
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assessment Modal */}
      {selectedAssessment && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedAssessment(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {selectedAssessment.name} Assessment
              </h3>
              <p className="text-gray-600">
                This assessment will validate your competency in {selectedAssessment.name}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Assessment Details</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Duration: {selectedAssessment.estimatedTime}</li>
                      <li>• Question format: Multiple choice and practical exercises</li>
                      <li>• Passing score: 70%</li>
                      <li>• Certification upon completion</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Description:</h4>
                <p className="text-sm text-gray-600">{selectedAssessment.description}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">What to expect:</h4>
                <p className="text-sm text-gray-600">
                  This assessment will test your knowledge through real-world scenarios and practical questions. 
                  You'll demonstrate your understanding of core concepts, best practices, and problem-solving abilities.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setSelectedAssessment(null)}
                className="flex-1 px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2">
                <PlayCircle className="w-5 h-5" />
                {selectedAssessment.status === 'in-progress' ? 'Continue Assessment' : 'Start Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}