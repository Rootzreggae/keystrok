import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/roles'
import { prisma } from '@/lib/prisma'

// POST /api/keys/[id]/rotate - Rotate a specific key
// ponytail: appears unused (UI drives rotation via /api/workflows); admin-gated
// as defense-in-depth since it flips key state. Candidate for removal.
export async function POST(
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
    const { id: keyId } = await params

    // Shared workspace: look up by id only
    const key = await prisma.discoveredKey.findFirst({
      where: {
        id: keyId
      }
    })

    if (!key) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    // Update the key status to rotated
    const updatedKey = await prisma.discoveredKey.update({
      where: { id: keyId },
      data: {
        status: 'rotated',
        rotatedAt: new Date(),
        // Reset expiry date to 90 days from now after rotation
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }
    })

    // Create a rotation workflow entry
    await prisma.rotationWorkflow.create({
      data: {
        userId: userId,
        // createdBy/lastModifiedBy are required (no schema default); attribute to the actor.
        createdBy: userId,
        lastModifiedBy: userId,
        // Link the workflow back to the DiscoveredKey being rotated.
        discoveredKeyId: key.id,
        name: `${key.keyName} Rotation`,
        description: `Automated rotation for ${key.keyName}`,
        keyName: key.keyName,
        keyType: key.platform.toLowerCase(),
        // NOTE: DiscoveredKey has no `keyValue` field (zero-knowledge design); only the
        // already-masked `keyPreview` exists, so use it directly.
        keyPreview: key.keyPreview,
        rotationType: 'automated',
        priority: key.severity === 'critical' ? 'critical' : key.severity === 'high' ? 'high' : 'medium',
        status: 'completed',
        currentStep: 5,
        totalSteps: 5,
        automationLevel: 'automated',
        completedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Key rotated successfully',
      key: updatedKey
    })

  } catch (error) {
    console.error('Error rotating key:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}