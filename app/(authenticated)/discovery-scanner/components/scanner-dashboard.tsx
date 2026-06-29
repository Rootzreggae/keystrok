'use client'

import { useState, useTransition } from 'react'
import { runQuickScan, getScanSessions, type QuickScanResult, type ScanSessionInfo } from '../actions'
import { ScanResultsList } from './scan-results-list'
import { ScanSessionsList } from './scan-sessions-list'

interface ScannerDashboardProps {
  initialSessions: ScanSessionInfo[]
}

export function ScannerDashboard({ initialSessions }: ScannerDashboardProps) {
  const [isPending, startTransition] = useTransition()
  const [scanResults, setScanResults] = useState<QuickScanResult[]>([])
  const [sessions, setSessions] = useState(initialSessions)
  const [activeTab, setActiveTab] = useState<'scan' | 'history'>('scan')
  const [error, setError] = useState<string | null>(null)

  const handleQuickScan = () => {
    setError(null)
    setScanResults([])
    
    startTransition(async () => {
      try {
        const results = await runQuickScan()
        setScanResults(results)
        
        // Refresh sessions list
        const updatedSessions = await getScanSessions()
        setSessions(updatedSessions)
        
        if (results.length === 0) {
          setError('No API keys found in configuration files. This is good!')
        }
      } catch (err) {
        console.error('Quick scan failed:', err)
        setError(err instanceof Error ? err.message : 'Scan failed. Please try again.')
      }
    })
  }

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[severity as keyof typeof colors] || colors.low
  }

  const getRiskLevelColor = (riskLevel: string) => {
    const colors = {
      critical: 'text-red-600',
      high: 'text-orange-600',
      medium: 'text-yellow-600',
      low: 'text-gray-600'
    }
    return colors[riskLevel as keyof typeof colors] || colors.low
  }

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <button
            onClick={handleQuickScan}
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Quick Scan
              </>
            )}
          </button>
          
          <button
            disabled={true}
            className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed flex items-center gap-2"
            title="Deep scan coming soon"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Deep Scan (Coming Soon)
          </button>
        </div>
        
        {isPending && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              Scanning configuration files for API keys and secrets...
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className={`p-4 rounded-lg border ${
          error.includes('No API keys found') 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p>{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('scan')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'scan'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Latest Scan Results
            {scanResults.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs">
                {scanResults.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Scan History
            {sessions.length > 0 && (
              <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                {sessions.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'scan' && (
        <div>
          {scanResults.length > 0 ? (
            <ScanResultsList results={scanResults} />
          ) : !isPending && (
            <div className="bg-gray-50 rounded-lg p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-gray-500 mb-2">No scan results yet</p>
              <p className="text-sm text-gray-400">
                Run a quick scan to discover API keys in your configuration files
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          {sessions.length > 0 ? (
            <ScanSessionsList sessions={sessions} />
          ) : (
            <div className="bg-gray-50 rounded-lg p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 mb-2">No scan history</p>
              <p className="text-sm text-gray-400">
                Your scan sessions will appear here once you start scanning
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}