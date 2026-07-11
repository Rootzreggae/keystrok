import { prisma } from '@/lib/prisma'
import { rotationDueAt, daysUntilDue, riskStart } from '@/lib/rotation-policy'
import { isRecentlyUsed, rotationFailed } from '@/lib/liveness'
import { isPipelinePath } from '@/lib/blast-radius'

// The tracked-key ledger in client shape, shared by BOTH the /api/keys route and
// the server-side prefetch so the two can never drift. Caller ensures auth.
export async function getKeys() {
  // All discovered keys for the instance (shared workspace, excluding false positives)
  const keys = await prisma.discoveredKey.findMany({
    where: {
      status: { not: 'false_positive' }
    },
    orderBy: {
      foundAt: 'desc'
    }
  })

  // Radius counts for the ledger column: distinct exposure sites per key hash,
  // with the deploy-pipeline subset classified by path. One query for all keys.
  const hashes = [...new Set(keys.map(k => k.keyHashId))]
  const sitePaths = hashes.length ? await prisma.localScanFinding.findMany({
    where: { keyHashId: { in: hashes } },
    select: { keyHashId: true, relativePath: true },
    distinct: ['keyHashId', 'relativePath'],
  }) : []
  const radius = new Map<string, { sites: number; pipes: number }>()
  for (const p of sitePaths) {
    if (!p.keyHashId) continue // findings can predate hash linking
    const r = radius.get(p.keyHashId) ?? { sites: 0, pipes: 0 }
    r.sites++
    if (isPipelinePath(p.relativePath)) r.pipes++
    radius.set(p.keyHashId, r)
  }
  // User-asserted consumers per key (the map's engine until direct observation exists)
  const assertedCounts = await prisma.assertedConsumer.groupBy({
    by: ['discoveredKeyId'],
    where: { discoveredKeyId: { in: keys.map(k => k.id) } },
    _count: true,
  })
  const asserted = new Map(assertedCounts.map(a => [a.discoveredKeyId, a._count]))

  return keys.map(key => {
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
      // Remediation failed: rotated, but a post-rotation check still found it live.
      rotation_failed: rotationFailed(key),
      daysUntilExpiry,
      isRotated: key.status === 'rotated',
      rotatedAt: key.rotatedAt?.toISOString() || null,
      // Blast radius counts. A key with no linked findings still has its own
      // finding location, so sites never reads 0.
      radius_sites: Math.max(radius.get(key.keyHashId)?.sites ?? 0, 1),
      radius_pipes: radius.get(key.keyHashId)?.pipes ?? (isPipelinePath(key.location || '') ? 1 : 0),
      radius_consumers: asserted.get(key.id) ?? 0
    }
  })
}
