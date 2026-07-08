import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getKeys } from '@/lib/keys'

// GET /api/keys - Returns all discovered keys for the user.
// Query + transform live in lib/keys.ts, shared with the SSR prefetch.
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      keys: await getKeys()
    })

  } catch (error) {
    console.error('Error fetching keys:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
