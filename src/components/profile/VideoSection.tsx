// ============================================
// src/components/profile/VideoSection.tsx
// ============================================

'use client'

import { useState } from 'react'
import { Video, Play, Lock, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VideoSectionProps {
  videoUrl?: string
  videoDuration?: string
  onUpload?: (file: File) => void
}

export function VideoSection({ videoUrl, videoDuration, onUpload }: VideoSectionProps) {
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
        <Video className="w-5 h-5 text-emerald-600" />
        <h3 className="font-semibold text-gray-900">About Me Video</h3>
      </div>
      
      <p className="text-gray-600 text-sm mb-4">
        Upload a short video introducing yourself, your work experience, and your career goals. 
        Our AI will extract keywords and skills to match you with relevant jobs.
      </p>
      
      {/* Privacy Notice */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 flex items-start gap-2">
        <Lock className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-emerald-800">
          <span className="font-medium">Privacy Protected:</span> Your video is encrypted and 
          accessible only to you and authorized HR personnel. It will never be shared externally 
          without your consent.
        </p>
      </div>
      
      {videoUrl ? (
        <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
          <video 
            src={videoUrl} 
            className="w-full h-full object-cover"
            controls={false}
          />
          <button className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
            <div className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
              <Play className="w-5 h-5" fill="currentColor" />
              Play Video
            </div>
          </button>
          {videoDuration && (
            <div className="absolute bottom-4 right-4 text-white text-sm bg-black/50 px-2 py-1 rounded">
              {videoDuration}
            </div>
          )}
        </div>
      ) : (
        <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors block">
          <input 
            type="file" 
            accept="video/*" 
            className="hidden" 
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium mb-2">
            {isUploading ? 'Uploading...' : 'No video uploaded yet'}
          </p>
          <p className="text-emerald-600 font-medium hover:text-emerald-700">
            Click to upload a video
          </p>
          <p className="text-xs text-gray-500 mt-2">
            MP4, WebM or MOV. Max 100MB.
          </p>
        </label>
      )}
    </div>
  )
}