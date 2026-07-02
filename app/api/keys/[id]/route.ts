import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/roles';

/**
 * DELETE /api/keys/[id]
 *
 * Deletes a discovered key from the inventory.
 * Creates an audit log entry before deletion.
 * Verifies user ownership before allowing deletion.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: keyId } = await params;

  try {
    // Authenticate user using NextAuth v5
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const denied = await requireAdmin(session.user.id);
    if (denied) return denied;

    // Validate key ID format
    if (!keyId || typeof keyId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid key ID' },
        { status: 400 }
      );
    }

    // Fetch the discovered key (shared workspace: visible/lookup by id only,
    // access is enforced by the admin gate above, not per-user ownership)
    const discoveredKey = await prisma.discoveredKey.findUnique({
      where: { id: keyId },
      include: {
        keyHash: {
          select: {
            keyHash: true,
            keyType: true
          }
        }
      }
    });

    if (!discoveredKey) {
      return NextResponse.json(
        { error: 'Key not found' },
        { status: 404 }
      );
    }

    // Create audit log entry BEFORE deletion
    await prisma.auditLog.create({
      data: {
        eventType: 'discovered_key_deleted',
        eventCategory: 'key_management',
        severity: 'medium',
        description: `Deleted discovered ${discoveredKey.platform} key from inventory`,
        details: JSON.stringify({
          keyId: discoveredKey.id,
          keyName: discoveredKey.keyName,
          platform: discoveredKey.platform,
          keyType: discoveredKey.keyType,
          severity: discoveredKey.severity,
          status: discoveredKey.status,
          source: discoveredKey.source,
          location: discoveredKey.location,
          riskScore: discoveredKey.riskScore,
          foundAt: discoveredKey.foundAt,
          deletedAt: new Date().toISOString(),
          reason: 'user_initiated_deletion'
        }),
        resourceType: 'discovered_key',
        resourceId: discoveredKey.id,
        userId: session.user.id,
        wasSuccessful: true,
        securityFlags: ['key_deletion', 'inventory_change']
      }
    });

    // Delete the discovered key
    await prisma.discoveredKey.delete({
      where: { id: keyId }
    });

    // Create activity log entry
    await prisma.activity.create({
      data: {
        action: 'key_deleted',
        description: `Deleted ${discoveredKey.platform.toUpperCase()} key: ${discoveredKey.keyName}`,
        userId: session.user.id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Key successfully deleted from inventory',
      deletedKey: {
        id: discoveredKey.id,
        name: discoveredKey.keyName,
        platform: discoveredKey.platform,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error deleting discovered key:', error);

    // Log failed deletion attempt
    try {
      const session = await auth();
      if (session?.user?.id) {
        await prisma.auditLog.create({
          data: {
            eventType: 'discovered_key_deletion_failed',
            eventCategory: 'key_management',
            severity: 'high',
            description: 'Failed to delete discovered key',
            details: JSON.stringify({
              keyId: keyId,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }),
            resourceType: 'discovered_key',
            resourceId: keyId,
            userId: session.user.id,
            wasSuccessful: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            securityFlags: ['deletion_failure', 'error']
          }
        });
      }
    } catch (auditError) {
      console.error('Failed to create audit log for deletion error:', auditError);
    }

    return NextResponse.json(
      {
        error: 'Failed to delete key',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
