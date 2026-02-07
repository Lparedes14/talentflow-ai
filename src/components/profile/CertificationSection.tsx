// ============================================
// src/components/profile/CertificationsSection.tsx
// ============================================

'use client'

import { Award, ExternalLink, Plus } from 'lucide-react'
import { Certification } from '@/types'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface CertificationsSectionProps {
  certifications: Certification[]
  onAdd?: () => void
}

export function CertificationsSection({ certifications, onAdd }: CertificationsSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-gray-900">Certifications</h3>
        </div>
        <Button variant="link" size="sm" onClick={onAdd}>
          <Plus className="w-4 h-4" />
          Add Certification
        </Button>
      </div>
      
      <p className="text-gray-500 text-sm mb-4">
        Professional certifications that validate your expertise and skills.
      </p>
      
      <div className="space-y-3">
        {certifications.map((cert) => (
          <div key={cert.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{cert.name}</h4>
                <p className="text-sm text-gray-600">{cert.issuer}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Issued: {cert.issued_date ? formatDate(cert.issued_date) : 'N/A'}
                  {cert.expiry_date && ` • Expires: ${formatDate(cert.expiry_date)}`}
                  {cert.credential_id && ` • ID: ${cert.credential_id}`}
                </p>
                {cert.credential_url && (
                  <a 
                    href={cert.credential_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm font-medium mt-2 flex items-center gap-1 hover:text-blue-700"
                  >
                    View Credential
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {certifications.length === 0 && (
          <p className="text-gray-500 text-center py-6">
            No certifications added yet.
          </p>
        )}
      </div>
    </div>
  )
}