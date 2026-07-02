import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptSecret, decryptSecret, maskApiKey, isMaskedSecret } from '@/lib/crypto'
import { requireAdmin } from '@/lib/roles'

// GET /api/platforms - Returns all platforms for the user
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all platforms for the instance (shared workspace)
    const platforms = await prisma.platform.findMany({
      where: {},
      include: {
        _count: {
          select: {
            discoveredKeys: true
          }
        },
        discoveredKeys: {
          where: {
            expiresAt: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
            }
          },
          select: {
            id: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform platforms to match expected format
    const transformedPlatforms = platforms.map(platform => ({
      id: platform.id,
      name: platform.name,
      platform_type: platform.type,
      category: platform.category,
      api_url: platform.apiUrl,
      // Masked preview only. Never return key material to the client.
      api_key: platform.apiKey ? maskApiKey(decryptSecret(platform.apiKey)) : '',
      rotation_schedule: 90, // Default rotation schedule
      description: platform.description,
      created_at: platform.createdAt.toISOString(),
      updated_at: platform.updatedAt.toISOString(),
      key_count: platform._count.discoveredKeys,
      expiring_count: platform.discoveredKeys.length,
      auth_type: platform.authType,
      auth_header: platform.authHeader,
      test_endpoint: platform.testEndpoint
    }))

    return NextResponse.json({
      success: true,
      platforms: transformedPlatforms
    })

  } catch (error) {
    console.error('Error fetching platforms:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// POST /api/platforms - Add a new platform
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const denied = await requireAdmin(session.user.id)
    if (denied) return denied

    const userId = session.user.id
    const body = await request.json()

    const {
      name,
      platform_type,
      category = 'Infrastructure',
      api_url,
      api_key = '',
      auth_type = 'bearer',
      auth_header = 'Authorization',
      test_endpoint = null,
      description = ''
    } = body

    // Validate required fields
    if (!name || !platform_type || !api_url) {
      return NextResponse.json(
        { error: 'Missing required fields: name, platform_type, api_url' },
        { status: 400 }
      )
    }

    // Create the platform
    const platform = await prisma.platform.create({
      data: {
        name,
        type: platform_type,
        category,
        apiUrl: api_url,
        // Encrypt at rest. Skip empty / masked-placeholder values.
        apiKey: api_key && !isMaskedSecret(api_key) ? encryptSecret(api_key) : '',
        description,
        userId,
        authType: auth_type,
        authHeader: auth_header,
        testEndpoint: test_endpoint,
      }
    })

    // Create activity log
    await prisma.activity.create({
      data: {
        action: 'platform_added',
        description: `Added ${platform_type} platform: ${name}`,
        userId
      }
    })

    return NextResponse.json({
      success: true,
      platform: {
        id: platform.id,
        name: platform.name,
        platform_type: platform.type,
        category: platform.category,
        api_url: platform.apiUrl,
        created_at: platform.createdAt.toISOString()
      }
    })

  } catch (error) {
    console.error('Error creating platform:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}