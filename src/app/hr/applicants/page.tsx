'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Search, Filter, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function HRApplicantsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [applicants, setApplicants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadApplicants()
  }, [])

  async function loadApplicants() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    
    setApplicants(data || [])
    setLoading(false)
  }

  const filteredApplicants = applicants.filter(a => 
    a.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.job_title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <p>Loading applicants...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
          All Applicants
        </h1>
        <p style={{ color: '#6b7280' }}>View and manage employee profiles</p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search by name or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 10px 10px 44px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{applicants.length}</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Applicants</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>{applicants.filter(a => a.profile_strength >= 70).length}</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Strong Profiles</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6' }}>{applicants.filter(a => a.video_url).length}</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>With Video Pitch</div>
        </div>
      </div>

      {/* Applicants List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {filteredApplicants.map((applicant) => (
          <div
            key={applicant.id}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '20px',
              cursor: 'pointer',
              transition: 'box-shadow 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: '600',
                color: '#4f46e5'
              }}>
                {applicant.full_name?.charAt(0) || '?'}
              </div>
              <div>
                <div style={{ fontWeight: '600', color: '#111827' }}>{applicant.full_name || 'Unknown'}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{applicant.job_title || 'No title'}</div>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
              {applicant.department || 'No department'} • {applicant.years_in_role || 0} years
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Profile: <span style={{ fontWeight: '600', color: applicant.profile_strength >= 70 ? '#10b981' : '#f59e0b' }}>
                  {applicant.profile_strength || 0}%
                </span>
              </div>
              <ChevronRight style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
            </div>
          </div>
        ))}
      </div>

      {filteredApplicants.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
          No applicants found
        </div>
      )}
    </div>
  )
}