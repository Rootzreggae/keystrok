'use client'

import { deletePlatform } from '../actions'

export function PlatformsList({ platformsByCategory }: { 
  platformsByCategory: Record<string, any[]> 
}) {
  const maskApiKey = (key: string) => {
    if (!key || key.length <= 8) return '••••••••'
    return `${key.slice(0, 6)}...${key.slice(-4)}`
  }

  return (
    <div className="space-y-8">
      {Object.entries(platformsByCategory).map(([category, platforms]) => (
        <div key={category}>
          <h2 className="text-lg font-semibold mb-4 text-gray-700">{category}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {platforms.map((platform) => (
              <div key={platform.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{platform.name}</h3>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {platform.type}
                  </span>
                </div>
                
                {platform.description && (
                  <p className="text-sm text-gray-600 mb-3">{platform.description}</p>
                )}
                
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">
                    <span className="font-medium">URL:</span>{' '}
                    <span className="text-xs">{platform.apiUrl}</span>
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">API Key:</span>{' '}
                    <code className="bg-gray-100 px-1 text-xs">{maskApiKey(platform.apiKey)}</code>
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Auth:</span>{' '}
                    <span className="text-xs">{platform.authType} ({platform.authHeader})</span>
                  </p>
                </div>
                
                <div className="mt-4 flex gap-2">
                  <button className="text-blue-500 text-sm hover:underline">
                    Test Connection
                  </button>
                  <button className="text-gray-500 text-sm hover:underline">
                    Edit
                  </button>
                  <form action={deletePlatform} className="inline">
                    <input type="hidden" name="id" value={platform.id} />
                    <button type="submit" className="text-red-500 text-sm hover:underline">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}