'use client'

import { useState } from 'react'
import { createPlatform } from '../actions'

interface PlatformPreset {
  category: string
  authType: string
  authHeader?: string
  testEndpoint?: string
  placeholder: string
}

const PLATFORM_PRESETS: Record<string, PlatformPreset> = {
  grafana: { 
    category: 'Observability', 
    authType: 'bearer',
    testEndpoint: '/api/org',
    placeholder: 'glsa_xxxxxxxxxx'
  },
  datadog: { 
    category: 'Observability', 
    authType: 'api-key',
    authHeader: 'DD-API-KEY',
    testEndpoint: '/api/v1/validate',
    placeholder: 'xxxxxxxxxx'
  },
  stripe: { 
    category: 'Payment', 
    authType: 'bearer',
    testEndpoint: '/v1/charges',
    placeholder: 'sk_live_xxxxxxxxxx'
  },
  github: { 
    category: 'Development', 
    authType: 'bearer',
    testEndpoint: '/user',
    placeholder: 'ghp_xxxxxxxxxx'
  },
  custom: { 
    category: 'Custom', 
    authType: 'bearer',
    authHeader: 'Authorization',
    placeholder: 'your-api-key-here'
  }
}

export function AddPlatformModal({ isOpen, onClose }: { 
  isOpen: boolean
  onClose: () => void 
}) {
  const [platformType, setPlatformType] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isCustom, setIsCustom] = useState(false)

  if (!isOpen) return null

  const handlePlatformTypeChange = (value: string) => {
    setPlatformType(value)
    setIsCustom(value === 'custom' || !PLATFORM_PRESETS[value as keyof typeof PLATFORM_PRESETS])
  }

  const preset = PLATFORM_PRESETS[platformType as keyof typeof PLATFORM_PRESETS] || PLATFORM_PRESETS.custom

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white text-gray-900 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border-2 border-gray-300">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Add Platform</h2>
        
        <form action={async (formData) => {
          await createPlatform(formData)
          onClose()
        }} className="space-y-4">
          
          {/* Platform Name */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Platform Name *
            </label>
            <input
              type="text"
              name="name"
              placeholder="e.g., Production API, Stripe Live, Internal Service"
              className="w-full px-3 py-2 border border-gray-400 rounded-lg bg-white text-gray-900 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-700 mt-1">
              A friendly name to identify this platform
            </p>
          </div>

          {/* Platform Type */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Platform Type *
            </label>
            <input
              type="text"
              name="type"
              list="platform-types"
              value={platformType}
              onChange={(e) => handlePlatformTypeChange(e.target.value)}
              placeholder="e.g., Grafana, Stripe, Custom API"
              className="w-full px-3 py-2 border border-gray-400 rounded-lg bg-white text-gray-900 focus:border-blue-500"
              required
            />
            <datalist id="platform-types">
              <option value="grafana">Grafana</option>
              <option value="datadog">Datadog</option>
              <option value="newrelic">New Relic</option>
              <option value="stripe">Stripe</option>
              <option value="github">GitHub</option>
              <option value="aws">AWS</option>
              <option value="azure">Azure</option>
              <option value="custom">Custom API</option>
            </datalist>
            <p className="text-xs text-gray-700 mt-1">
              Select from common platforms or type your own
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Category *
            </label>
            <input
              type="text"
              name="category"
              list="categories"
              defaultValue={preset.category}
              placeholder="e.g., Observability, Payment, Internal"
              className="w-full px-3 py-2 border border-gray-400 rounded-lg bg-white text-gray-900 focus:border-blue-500"
              required
            />
            <datalist id="categories">
              <option value="Observability" />
              <option value="Payment" />
              <option value="Development" />
              <option value="Infrastructure" />
              <option value="Internal" />
              <option value="Client API" />
              <option value="Custom" />
            </datalist>
          </div>

          {/* API URL */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              API URL *
            </label>
            <input
              type="url"
              name="apiUrl"
              placeholder="https://api.example.com"
              className="w-full px-3 py-2 border border-gray-400 rounded-lg bg-white text-gray-900 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-700 mt-1">
              Base URL for the API endpoint
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              API Key / Token *
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                name="apiKey"
                placeholder={preset.placeholder}
                className="w-full px-3 py-2 border border-gray-400 rounded-lg bg-white text-gray-900 focus:border-blue-500 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showApiKey ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Advanced Options (for custom platforms) */}
          {isCustom && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-medium text-sm text-gray-800">Advanced Configuration</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Authentication Type
                </label>
                <select
                  name="authType"
                  defaultValue={preset.authType}
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg bg-white text-gray-900 focus:border-blue-500"
                >
                  <option value="bearer">Bearer Token</option>
                  <option value="api-key">API Key</option>
                  <option value="basic">Basic Auth</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Auth Header Name
                </label>
                <input
                  type="text"
                  name="authHeader"
                  defaultValue={preset.authHeader || "Authorization"}
                  placeholder="e.g., Authorization, X-API-Key"
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg bg-white text-gray-900 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Test Endpoint (optional)
                </label>
                <input
                  type="text"
                  name="testEndpoint"
                  defaultValue={preset.testEndpoint}
                  placeholder="e.g., /api/health, /v1/status"
                  className="w-full px-3 py-2 border border-gray-400 rounded-lg bg-white text-gray-900 focus:border-blue-500"
                />
                <p className="text-xs text-gray-700 mt-1">
                  Endpoint to verify the API key works
                </p>
              </div>
            </div>
          )}

          {/* Hidden fields for presets */}
          {!isCustom && (
            <>
              <input type="hidden" name="authType" value={preset.authType} />
              <input type="hidden" name="authHeader" value={preset.authHeader || 'Authorization'} />
              <input type="hidden" name="testEndpoint" value={preset.testEndpoint} />
            </>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">
              Description (optional)
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="What is this platform used for?"
              className="w-full px-3 py-2 border border-gray-400 rounded-lg bg-white text-gray-900 focus:border-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-400 text-gray-700 bg-white rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Add Platform
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}