'use client'

import { useState } from 'react'
import type { QuickScanResult } from '../actions'

interface ScanResultsListProps {
  results: QuickScanResult[]
}

export function ScanResultsList({ results }: ScanResultsListProps) {
  const [sortBy, setSortBy] = useState<'severity' | 'platform' | 'confidence'>('severity')
  const [filterBy, setFilterBy] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[severity as keyof typeof colors] || colors.low
  }

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      'Grafana': '📊',
      'Stripe': '💳',
      'AWS': '☁️',
      'GitHub': '🐙',
      'Datadog': '🐕',
      'Generic': '🔑'
    }
    return icons[platform] || '🔑'
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

  // Filter and sort results
  const filteredResults = results
    .filter(result => filterBy === 'all' || result.severity === filterBy)
    .sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
          return (severityOrder[b.severity] || 1) - (severityOrder[a.severity] || 1)
        case 'platform':
          return a.platform.localeCompare(b.platform)
        case 'confidence':
          return (b.confidence || 0) - (a.confidence || 0)
        default:
          return 0
      }
    })

  const severityCounts = results.reduce((acc, result) => {
    acc[result.severity] = (acc[result.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-600 font-semibold text-2xl">
            {severityCounts.critical || 0}
          </div>
          <div className="text-red-700 text-sm">Critical Issues</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-orange-600 font-semibold text-2xl">
            {severityCounts.high || 0}
          </div>
          <div className="text-orange-700 text-sm">High Priority</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-yellow-600 font-semibold text-2xl">
            {severityCounts.medium || 0}
          </div>
          <div className="text-yellow-700 text-sm">Medium Priority</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-gray-600 font-semibold text-2xl">
            {severityCounts.low || 0}
          </div>
          <div className="text-gray-700 text-sm">Low Priority</div>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-lg border">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Filter by:</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value="severity">Severity</option>
              <option value="platform">Platform</option>
              <option value="confidence">Confidence</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Showing {filteredResults.length} of {results.length} findings
        </div>
      </div>

      {/* Results List */}
      <div className="bg-white rounded-lg border">
        {filteredResults.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No results match your current filters
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredResults.map((result, index) => (
              <div key={result.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg">{getPlatformIcon(result.platform)}</span>
                      <span className="font-medium text-gray-900">{result.platform}</span>
                      <span className={`px-2 py-1 text-xs font-medium border rounded ${getSeverityBadge(result.severity)}`}>
                        {result.severity.toUpperCase()}
                      </span>
                      {result.riskLevel && (
                        <span className={`text-xs font-medium ${getRiskLevelColor(result.riskLevel)}`}>
                          {result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1)} Risk
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <div className="flex items-center gap-4">
                        <span>
                          <strong>Key:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-xs">{result.keyPreview}</code>
                        </span>
                        {result.confidence && (
                          <span>
                            <strong>Confidence:</strong> {Math.round(result.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {result.filePath && (
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>{result.filePath}</span>
                        {result.lineNumber && (
                          <>
                            <span>•</span>
                            <span>Line {result.lineNumber}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      className="text-xs px-3 py-1 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        // TODO: Implement view details
                        alert('View details coming soon!')
                      }}
                    >
                      Details
                    </button>
                    <button
                      className="text-xs px-3 py-1 text-green-600 border border-green-300 rounded hover:bg-green-50 transition-colors"
                      onClick={() => {
                        // TODO: Implement mark as fixed
                        alert('Mark as fixed coming soon!')
                      }}
                    >
                      Mark Fixed
                    </button>
                    <button
                      className="text-xs px-3 py-1 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        // TODO: Implement ignore
                        alert('Ignore finding coming soon!')
                      }}
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {results.length > 0 && (
        <div className="flex gap-4 pt-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => {
              // TODO: Implement export functionality
              alert('Export functionality coming soon!')
            }}
          >
            Export Results
          </button>
          <button
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={() => {
              // TODO: Implement create rotation workflow
              alert('Create rotation workflow coming soon!')
            }}
          >
            Create Rotation Workflow
          </button>
        </div>
      )}
    </div>
  )
}