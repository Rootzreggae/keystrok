import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { testPlatformConnection } from '@/lib/platform-test'

// Validate a platform config BEFORE saving it (test-before-connect).
export async function POST(request: NextRequest) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  const { type, apiUrl, apiKey, authHeader, testEndpoint } = await request.json()
  if (!apiKey) return NextResponse.json({ ok: false, message: 'API key required' }, { status: 400 })
  const r = await testPlatformConnection({ type, apiUrl, apiKey, authHeader, testEndpoint })
  return NextResponse.json(r)
}
