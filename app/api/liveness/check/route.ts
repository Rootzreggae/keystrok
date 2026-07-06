import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/crypto'
import { requireAdmin } from '@/lib/roles'
import { providerOf, isListable, statusFor, last4, datadogKeyUsage, awsKeyUsage, type KeyUsage } from '@/lib/liveness'

// POST /api/liveness/check
// Matches every discovered key's last-4 against the keys a connected platform
// reports as live, and stores live/revoked. Admin-gated because it decrypts and
// uses the connected platform credential (same posture as the connection test).
// A platform that fails to list, or lacks the credential to list, leaves its
// keys untouched, we never turn a network error into a false "revoked".
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(session.user.id)
  if (denied) return denied

  const platforms = await prisma.platform.findMany()
  const listable = platforms.filter((p) => isListable(p.type))

  const warnings: string[] = []
  // provider -> (last4 -> usage). Presence = live; value carries lastUsedAt.
  const usageByProvider = new Map<string, Map<string, KeyUsage>>()

  for (const p of listable) {
    const provider = providerOf(p.type)
    try {
      let map: Map<string, KeyUsage> | null = null
      if (provider === 'datadog') {
        if (!p.appKey) { warnings.push(`${p.name}: no application key set, cannot list Datadog keys`); continue }
        map = await datadogKeyUsage({ apiUrl: p.apiUrl, apiKey: decryptSecret(p.apiKey), appKey: decryptSecret(p.appKey) })
      } else if (provider === 'aws') {
        if (!p.appKey) { warnings.push(`${p.name}: no secret access key set, cannot list AWS keys`); continue }
        map = await awsKeyUsage({ accessKeyId: decryptSecret(p.apiKey), secretAccessKey: decryptSecret(p.appKey) })
      }
      if (map) {
        const merged = usageByProvider.get(provider) ?? new Map<string, KeyUsage>()
        for (const [l4, u] of map) merged.set(l4, u)
        usageByProvider.set(provider, merged)
      }
    } catch (e) {
      warnings.push(`${p.name}: ${e instanceof Error ? e.message : 'liveness check failed'}`)
    }
  }

  if (usageByProvider.size === 0) {
    return NextResponse.json({
      success: false, checked: 0, live: 0, revoked: 0,
      warnings: warnings.length ? warnings : ['No connected platform can list keys yet (Datadog needs an application key, AWS a secret access key).'],
    })
  }

  // Only touch keys of a provider we actually listed. Per-key because each match
  // is on its own preview; fine for a normal inventory size.
  const keys = await prisma.discoveredKey.findMany({
    where: { status: { not: 'false_positive' } },
    select: { id: true, platform: true, keyPreview: true },
  })
  const now = new Date()
  // Build a live-key set per provider once (statusFor takes a Set of last-4s).
  const liveSets = new Map<string, Set<string>>()
  for (const [prov, m] of usageByProvider) liveSets.set(prov, new Set(m.keys()))

  let live = 0, revoked = 0, checked = 0
  for (const k of keys) {
    const provider = providerOf(k.platform)
    const set = liveSets.get(provider)
    if (!set) continue
    const status = statusFor(k.keyPreview, set)
    if (status === 'unknown') continue
    // last-used rides the same response; only meaningful when we matched the key.
    const usage = usageByProvider.get(provider)?.get(last4(k.keyPreview) ?? '')
    await prisma.discoveredKey.update({
      where: { id: k.id },
      data: {
        liveStatus: status, liveCheckedAt: now,
        lastUsedAt: usage?.lastUsedAt ?? null,
        // source carries the "from where" when the platform reports it (AWS region/service)
        lastUsedSource: usage?.lastUsedAt ? (usage.location ? `${provider} · ${usage.location}` : provider) : null,
      },
    })
    checked++
    if (status === 'live') live++
    else revoked++
  }

  const providers = [...usageByProvider.keys()]
  await prisma.activity.create({
    data: { action: 'liveness_checked', description: `Liveness check: ${live} live, ${revoked} revoked across ${providers.join(', ')}`, userId: session.user.id },
  }).catch(() => {})

  // Fire-on-check: reconcile alert state now that liveness/usage is fresh. Best-
  // effort, a channel failure must never fail the check. Evaluates all keys (not
  // just those checked) so a rotation_failed incident surfaces too; dedup gates it.
  let alerts = { fired: 0, resolved: 0 }
  try {
    const all = await prisma.discoveredKey.findMany({
      where: { status: { not: 'false_positive' } },
      select: { id: true, keyName: true, platform: true, severity: true, keyPreview: true, liveStatus: true, liveCheckedAt: true, lastUsedAt: true, rotatedAt: true },
    })
    const { runAlerts } = await import('@/lib/alert-runner')
    alerts = await runAlerts(all)
  } catch (e) {
    console.error('alert run failed:', e)
  }

  return NextResponse.json({ success: true, checked, live, revoked, providers, warnings, alerts })
}
