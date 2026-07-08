import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getRecentActivity } from '@/lib/recent-activity'

// GET /api/activity/recent - Returns last N merged activity/audit entries.
// Query + merge live in lib/recent-activity.ts, shared with the SSR prefetch.
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const actionFilter = searchParams.get('action')

    return NextResponse.json({
      success: true,
      data: await getRecentActivity(limit, offset, actionFilter)
    })

  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
