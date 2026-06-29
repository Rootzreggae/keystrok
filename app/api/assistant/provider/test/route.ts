import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { testProvider } from '@/lib/assistant'

// Validate a provider config (creds + model + endpoint) before connecting.
export async function POST(request: NextRequest) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { type, baseUrl, model, apiKey } = await request.json()
  if (!type || !model) return NextResponse.json({ ok: false, error: 'type and model are required' }, { status: 400 })
  const r = await testProvider({ type, baseUrl, model, apiKey })
  return NextResponse.json(r)
}
