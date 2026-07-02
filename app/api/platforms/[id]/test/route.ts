import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/crypto'
import { testPlatformConnection } from '@/lib/platform-test'
import { requireAdmin } from '@/lib/roles'

// POST /api/platforms/[id]/test: re-test an already-connected platform.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const denied = await requireAdmin(session.user.id)
    if (denied) return denied
    const userId = session.user.id
    const { id } = await params

    // Shared workspace: look up by id only
    const platform = await prisma.platform.findFirst({ where: { id } })
    if (!platform) return NextResponse.json({ error: 'Platform not found' }, { status: 404 })

    // Decrypt only at the point of use; the plaintext never leaves the server.
    const apiKey = platform.apiKey ? decryptSecret(platform.apiKey) : ''
    const result = await testPlatformConnection({
      type: platform.type, apiUrl: platform.apiUrl, apiKey,
      authHeader: platform.authHeader, testEndpoint: platform.testEndpoint,
    })

    await prisma.activity.create({
      data: {
        action: 'platform_tested',
        description: `Connection test for ${platform.type} platform: ${platform.name}, ${result.ok ? 'live' : 'failed'}`,
        userId,
      },
    }).catch(() => {})

    return NextResponse.json({ success: result.ok, message: result.message, platform: platform.name })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
