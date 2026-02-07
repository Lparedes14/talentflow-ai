// ============================================
// src/components/profile/ResumeSection.tsx
// ============================================

'use client'

import { useState } from 'react'
import { FileText, Eye, Download, RefreshCw, Upload, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface ResumeSectionProps {
  resumeUrl?: string
  resumeFilename?: string
  uploadDate?: string
  onUpload?: (file: File) => void
  onView?: () => void
  onDownload?: () => void
}

export function ResumeSection({ 
  resumeUrl, 
  resumeFilename, 
  uploadDate,
  onUpload,
  onView,
  onDownload 
}: ResumeSectionProps) {
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onUpload) {
      setIsUploading(true)
      await onUpload(file)
      setIsUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Resume</h3>
      </div>
      
      {resumeUrl && resumeFilename ? (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900 flex items-center gap-2">
                {resumeFilename}
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xs text-gray-500">
                Uploaded {uploadDate ? formatDate(uploadDate) : 'recently'}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onView}>
              <Eye className="w-4 h-4" />
              View
            </Button>
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="w-4 h-4" />
              Download
            </Button>
            <label>
              <input 
                type="file" 
                accept=".pdf,.doc,.docx" 
                className="hidden" 
                onChange={handleFileChange}
              />
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer">
                  <RefreshCw className="w-4 h-4" />
                  Replace
                </span>
              </Button>
            </label>
          </div>
        </div>
      ) : (
        <label className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors block">
          <input 
            type="file" 
            accept=".pdf,.doc,.docx" 
            className="hidden" 
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600 font-medium mb-1">
            {isUploading ? 'Uploading...' : 'Upload your resume'}
          </p>
          <p className="text-xs text-gray-500">
            PDF, DOC or DOCX. Max 10MB.
          </p>
        </label>
      )}
    </div>
  )
}