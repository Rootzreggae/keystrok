'use client'

import { useState } from 'react'
import type { ScanSessionInfo } from '../actions'

interface ScanSessionsListProps {
  sessions: ScanSessionInfo[]
}

export function ScanSessionsList({ sessions }: ScanSessionsListProps) {
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      running: 'bg-blue-100 text-blue-800 border-blue-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[status as keyof typeof colors] || colors.pending
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'running':
        return (
          <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'pending':
        return (
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date()
    const duration = Math.round((end.getTime() - startTime.getTime()) / 1000)
    
    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.round(duration / 60)}m`
    return `${Math.round(duration / 3600)}h`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date)
  }

  return (
    <div className="bg-white rounded-lg border">
      {sessions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No scan sessions found
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {sessions.map((session) => (
            <div key={session.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(session.status)}
                    <span className="font-medium text-gray-900">{session.name}</span>
                    <span className={`px-2 py-1 text-xs font-medium border rounded ${getStatusBadge(session.status)}`}>
                      {session.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm text-gray-600 mb-2">
                    <span>{formatDate(session.createdAt)}</span>
                    <span>{session.scannedFiles} / {session.totalFiles} files</span>
                    <span>{session.findingsCount} findings</span>
                    {session.completedAt && (
                      <span>Duration: {formatDuration(session.createdAt, session.completedAt)}</span>
                    )}
                  </div>

                  {session.status === 'running' && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(session.progress * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${session.progress * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {session.status === 'completed' && session.findingsCount > 0 && (
                    <button
                      onClick={() => setExpandedSession(
                        expandedSession === session.id ? null : session.id
                      )}
                      className="text-xs px-3 py-1 text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                    >
                      {expandedSession === session.id ? 'Hide' : 'View'} Findings
                    </button>
                  )}
                  
                  <button
                    className="text-xs px-3 py-1 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      // TODO: Implement view details
                      alert('Session details coming soon!')
                    }}
                  >
                    Details
                  </button>

                  {session.status === 'running' && (
                    <button
                      className="text-xs px-3 py-1 text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
                      onClick={() => {
                        // TODO: Implement cancel scan
                        alert('Cancel scan coming soon!')
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {expandedSession === session.id && session.status === 'completed' && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    <p>Loading findings for this session...</p>
                    <p className="text-xs mt-1">
                      Individual finding details will be displayed here in a future update.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {sessions.length > 0 && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <button
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            onClick={() => {
              // TODO: Implement clear old sessions
              alert('Clear old sessions coming soon!')
            }}
          >
            Clear Completed Sessions
          </button>
        </div>
      )}
    </div>
  )
}