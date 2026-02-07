'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Plus, Users, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function HRPositionsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPositions()
  }, [])

  async function loadPositions() {
    const { data } = await supabase
      .from('job_postings')
      .select('*')
      .order('created_at', { ascending: false })
    
    setPositions(data || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <p>Loading positions...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Open Positions
          </h1>
          <p style={{ color: '#6b7280' }}>Manage job postings and view candidates</p>
        </div>
        <button style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          backgroundColor: '#4f46e5',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer'
        }}>
          <Plus style={{ width: '18px', height: '18px' }} />
          New Position
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{positions.length}</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Positions</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>{positions.filter(p => p.status === 'open').length}</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Open</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>{positions.filter(p => p.urgency === 'high').length}</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Urgent</div>
        </div>
      </div>

      {/* Positions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {positions.map((position) => (
          <div
            key={position.id}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>
                    {position.title}
                  </h3>
                  {position.urgency === 'high' && (
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '12px',
                      fontWeight: '500',
                      borderRadius: '9999px'
                    }}>
                      Urgent
                    </span>
                  )}
                  <span style={{
                    padding: '2px 8px',
                    backgroundColor: position.status === 'open' ? '#dcfce7' : '#f3f4f6',
                    color: position.status === 'open' ? '#166534' : '#6b7280',
                    fontSize: '12px',
                    fontWeight: '500',
                    borderRadius: '9999px'
                  }}>
                    {position.status || 'open'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', color: '#6b7280' }}>
                  <span>{position.department}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin style={{ width: '14px', height: '14px' }} />
                    {position.location || 'Remote'}
                  </span>
                  <span>{position.work_mode || 'hybrid'}</span>
                </div>
              </div>
              <button style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                View Candidates
              </button>
            </div>
          </div>
        ))}
      </div>

      {positions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
          No positions found. Create your first job posting!
        </div>
      )}
    </div>
  )
}