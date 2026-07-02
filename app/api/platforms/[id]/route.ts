import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptSecret, isMaskedSecret } from '@/lib/crypto'
import { requireAdmin } from '@/lib/roles'

// DELETE /api/platforms/[id] - Remove a platform
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const denied = await requireAdmin(session.user.id)
    if (denied) return denied

    const userId = session.user.id
    const { id: platformId } = await params

    // Shared workspace: look up by id only
    const platform = await prisma.platform.findFirst({
      where: {
        id: platformId
      }
    })

    if (!platform) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 })
    }

    // Delete the platform (discovered keys will be set to null due to SetNull)
    await prisma.platform.delete({
      where: { id: platformId }
    })

    // Create activity log
    await prisma.activity.create({
      data: {
        action: 'platform_removed',
        description: `Removed ${platform.type} platform: ${platform.name}`,
        userId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Platform removed successfully'
    })

  } catch (error) {
    console.error('Error removing platform:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// PUT /api/platforms/[id] - Update a platform
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // PUT can change the stored platform credential, so it's admin-only like DELETE.
    const denied = await requireAdmin(session.user.id)
    if (denied) return denied

    const userId = session.user.id
    const { id: platformId } = await params
    const body = await request.json()

    // Shared workspace: look up by id only
    const existingPlatform = await prisma.platform.findFirst({
      where: {
        id: platformId
      }
    })

    if (!existingPlatform) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 })
    }

    const {
      name,
      platform_type,
      category,
      api_url,
      api_key,
      description
    } = body

    // Update the platform
    const updatedPlatform = await prisma.platform.update({
      where: { id: platformId },
      data: {
        ...(name && { name }),
        ...(platform_type && { type: platform_type }),
        ...(category && { category }),
        ...(api_url && { apiUrl: api_url }),
        // Only update the key when a real new value is supplied, never persist
        // an empty or masked-placeholder resubmission. Encrypt at rest.
        ...(api_key && !isMaskedSecret(api_key) && { apiKey: encryptSecret(api_key) }),
        ...(description !== undefined && { description })
      }
    })

    // Create activity log
    await prisma.activity.create({
      data: {
        action: 'platform_updated',
        description: `Updated ${updatedPlatform.type} platform: ${updatedPlatform.name}`,
        userId
      }
    })

    return NextResponse.json({
      success: true,
      platform: {
        id: updatedPlatform.id,
        name: updatedPlatform.name,
        platform_type: updatedPlatform.type,
        category: updatedPlatform.category,
        api_url: updatedPlatform.apiUrl,
        updated_at: updatedPlatform.updatedAt.toISOString()
      }
    })

  } catch (error) {
    console.error('Error updating platform:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}