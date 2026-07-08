import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getActivityFeed } from '@/lib/activity'

// GET /api/activity/feed - the composed Activity feed (see lib/activity). Shared
// with the server-side prefetch so the shapes never drift. Shared workspace.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getActivityFeed())
}
