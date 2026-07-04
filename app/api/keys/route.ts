import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rotationDueAt, daysUntilDue, riskStart } from '@/lib/rotation-policy'
import { isRecentlyUsed } from '@/lib/liveness'

// GET /api/keys - Returns all discovered keys for the user
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all discovered keys for the instance (shared workspace, excluding false positives)
    const keys = await prisma.discoveredKey.findMany({
      where: {
        status: { not: 'false_positive' }
      },
      include: {
        platformRef: true
      },
      orderBy: {
        foundAt: 'desc'
      }
    })

    // Transform keys to match the expected format
    const transformedKeys = keys.map(key => {
      // Rotation recommendation anchored to when the key was at-risk: exposedAt if
      // attested and earlier than discovery, else foundAt. See riskStart().
      // `expires_at` / `daysUntilExpiry` field names kept for callers; they mean "rotation due".
      const anchor = riskStart(key)
      const expiresAt = rotationDueAt(anchor, key.severity)
      const daysUntilExpiry = daysUntilDue(anchor, key.severity)

      // Preserve the actual status from database instead of overriding
      let status = key.status

      // Only override if status is still 'active' (legacy keys) - preserve risk statuses
      if (key.status === 'active') {
        if (daysUntilExpiry <= 7 || key.severity === 'critical') {
          status = 'critical'
        } else if (daysUntilExpiry <= 30 || key.severity === 'high') {
          status = 'warning'
        } else {
          status = 'healthy'
        }
      }

      return {
        id: key.id,
        name: key.keyName || 'Unnamed Key',
        description: key.location || key.source || 'No description',
        platform: key.platform,
        // NOTE: DiscoveredKey has no `keyValue` field (zero-knowledge design); the
        // raw secret is never stored. `keyPreview` is the only available masked value,
        // so both `key` and `key_preview` resolve to it instead of the missing column.
        key: key.keyPreview,
        key_preview: key.keyPreview || '****',
        source: key.source,
        location: key.location,
        status,
        severity: key.severity,
        expires_at: expiresAt.toISOString(),
        created_at: key.foundAt.toISOString(),
        risk_start: anchor.toISOString(),
        exposed_at: key.exposedAt?.toISOString() ?? null,
        exposed_at_source: key.exposedAtSource ?? null,
        live_status: key.liveStatus ?? null,
        live_checked_at: key.liveCheckedAt?.toISOString() ?? null,
        last_used_at: key.lastUsedAt?.toISOString() ?? null,
        last_used_source: key.lastUsedSource ?? null,
        // The incident signal: still live AND used within the recency window.
        usage_active: key.liveStatus === 'live' && isRecentlyUsed(key.lastUsedAt),
        daysUntilExpiry,
        isRotated: key.status === 'rotated',
        rotatedAt: key.rotatedAt?.toISOString() || null
      }
    })

    return NextResponse.json({
      success: true,
      keys: transformedKeys
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