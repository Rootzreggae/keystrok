import { NextResponse } from 'next/server'

// Simple health check endpoint for the discovery API
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'discovery-api',
    timestamp: new Date().toISOString(),
    endpoints: {
      scan: '/api/discovery/scan (POST)'
    }
  })
}