import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getPostureData } from '@/lib/posture-data'

// GET /api/posture - secret-hygiene SLOs + backlog trend for the signed-in user,
// derived from the timestamps already on each discovered key.
// Query + compute live in lib/posture-data.ts, shared with the SSR prefetch.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(await getPostureData(session.user.id))
}
