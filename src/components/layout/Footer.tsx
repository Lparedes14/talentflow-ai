// ============================================
// src/components/layout/Footer.tsx
// ============================================

import { Shield } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Privacy Notice */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-gray-900">Privacy & AI Ethics Protected</span>
                <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-medium rounded-full">
                  SOC 2 Compliant
                </span>
                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                  GDPR
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Your career data is encrypted and protected. Our AI recommendations undergo bias detection 
                and fairness audits. All role suggestions include explainable reasoning to ensure 
                transparency and equity.
              </p>
            </div>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="text-center">
          <p className="text-gray-600 mb-2">
            Empowering organizations with skills-first internal mobility
          </p>
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} InsideTrack. Transforming careers, one opportunity at a time.
          </p>
        </div>
      </div>
    </footer>
  )
}

