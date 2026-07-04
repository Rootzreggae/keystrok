import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/crypto'
import { requireAdmin } from '@/lib/roles'
import { providerOf, isListable, statusFor, datadogLiveLast4 } from '@/lib/liveness'

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
  const liveByProvider = new Map<string, Set<string>>()

  for (const p of listable) {
    const provider = providerOf(p.type)
    try {
      if (provider === 'datadog') {
        if (!p.appKey) { warnings.push(`${p.name}: no application key set, cannot list Datadog keys`); continue }
        const set = await datadogLiveLast4({ apiUrl: p.apiUrl, apiKey: decryptSecret(p.apiKey), appKey: decryptSecret(p.appKey) })
        const merged = liveByProvider.get(provider) ?? new Set<string>()
        for (const l of set) merged.add(l)
        liveByProvider.set(provider, merged)
      }
    } catch (e) {
      warnings.push(`${p.name}: ${e instanceof Error ? e.message : 'liveness check failed'}`)
    }
  }

  if (liveByProvider.size === 0) {
    return NextResponse.json({
      success: false, checked: 0, live: 0, revoked: 0,
      warnings: warnings.length ? warnings : ['No connected platform can list keys yet (Datadog needs an application key).'],
    })
  }

  // Only touch keys of a provider we actually listed. Per-key because each match
  // is on its own preview; fine for a normal inventory size.
  const keys = await prisma.discoveredKey.findMany({
    where: { status: { not: 'false_positive' } },
    select: { id: true, platform: true, keyPreview: true },
  })
  const now = new Date()
  let live = 0, revoked = 0, checked = 0
  for (const k of keys) {
    const set = liveByProvider.get(providerOf(k.platform))
    if (!set) continue
    const status = statusFor(k.keyPreview, set)
    if (status === 'unknown') continue
    await prisma.discoveredKey.update({ where: { id: k.id }, data: { liveStatus: status, liveCheckedAt: now } })
    checked++
    if (status === 'live') live++
    else revoked++
  }

  const providers = [...liveByProvider.keys()]
  await prisma.activity.create({
    data: { action: 'liveness_checked', description: `Liveness check: ${live} live, ${revoked} revoked across ${providers.join(', ')}`, userId: session.user.id },
  }).catch(() => {})

  return NextResponse.json({ success: true, checked, live, revoked, providers, warnings })
}
