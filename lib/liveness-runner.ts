// The liveness-check core, extracted from its route so both the admin endpoint
// and the scheduled cron tick can run it. Matches every discovered key's last-4
// against the keys a connected platform reports as live, stores live/revoked +
// last-used, then reconciles alerts. A platform that can't list leaves its keys
// untouched (a network error is never turned into a false "revoked").
import { prisma } from './prisma.ts'
import { decryptSecret } from './crypto.ts'
import { providerOf, isListable, statusFor, last4, datadogKeyUsage, awsKeyUsage, type KeyUsage } from './liveness.ts'

export interface LivenessResult {
  success: boolean
  checked: number
  live: number
  revoked: number
  providers: string[]
  warnings: string[]
  alerts: { fired: number; resolved: number }
}

/**
 * Run one liveness pass. `actorId` attributes the activity-log entry to a user
 * (the admin endpoint); omit it for scheduled runs, which skip the per-user log.
 */
export async function runLivenessCheck(opts: { actorId?: string } = {}): Promise<LivenessResult> {
  const { evaluateAllAlerts } = await import('./alert-runner.ts')
  const platforms = await prisma.platform.findMany()
  const listable = platforms.filter((p) => isListable(p.type))

  const warnings: string[] = []
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

  // No platform could list. Standing incidents (rotation_failed, sla_crossed) are
  // still knowable from stored state, so evaluate alerts anyway; the freshness gate
  // correctly suppresses "happening now" (live_and_used) here.
  if (usageByProvider.size === 0) {
    const alerts = await evaluateAllAlerts()
    return {
      success: false, checked: 0, live: 0, revoked: 0, providers: [], alerts,
      warnings: warnings.length ? warnings : ['No connected platform can list keys yet (Datadog needs an application key, AWS a secret access key).'],
    }
  }

  const keys = await prisma.discoveredKey.findMany({
    where: { status: { not: 'false_positive' } },
    select: { id: true, platform: true, keyPreview: true },
  })
  const now = new Date()
  const liveSets = new Map<string, Set<string>>()
  for (const [prov, m] of usageByProvider) liveSets.set(prov, new Set(m.keys()))

  // Classify first, write after: one update per key was N serial round-trips to
  // the remote DB. Keys landing on identical data (revoked, or live with no
  // usage info — lastUsedAt null either way) collapse into one updateMany each;
  // only live keys with a distinct lastUsedAt need per-row updates, and those
  // run in parallel so the wall cost is ~one round trip, not N.
  const revokedIds: string[] = []
  const liveNoUsageIds: string[] = []
  const liveWithUsage: { id: string; usage: KeyUsage; provider: string }[] = []
  for (const k of keys) {
    const provider = providerOf(k.platform)
    const set = liveSets.get(provider)
    if (!set) continue
    const status = statusFor(k.keyPreview, set)
    if (status === 'unknown') continue
    if (status === 'revoked') { revokedIds.push(k.id); continue }
    const usage = usageByProvider.get(provider)?.get(last4(k.keyPreview) ?? '')
    if (usage?.lastUsedAt) liveWithUsage.push({ id: k.id, usage, provider })
    else liveNoUsageIds.push(k.id)
  }

  await Promise.all([
    revokedIds.length ? prisma.discoveredKey.updateMany({
      where: { id: { in: revokedIds } },
      data: { liveStatus: 'revoked', liveCheckedAt: now, lastUsedAt: null, lastUsedSource: null },
    }) : null,
    liveNoUsageIds.length ? prisma.discoveredKey.updateMany({
      where: { id: { in: liveNoUsageIds } },
      data: { liveStatus: 'live', liveCheckedAt: now, lastUsedAt: null, lastUsedSource: null },
    }) : null,
    ...liveWithUsage.map(({ id, usage, provider }) => prisma.discoveredKey.update({
      where: { id },
      data: {
        liveStatus: 'live', liveCheckedAt: now,
        lastUsedAt: usage.lastUsedAt,
        lastUsedSource: usage.location ? `${provider} · ${usage.location}` : provider,
      },
    })),
  ])

  const revoked = revokedIds.length
  const live = liveNoUsageIds.length + liveWithUsage.length
  const checked = live + revoked

  const providers = [...usageByProvider.keys()]
  // Per-user audit entry only for a user-initiated run; a scheduled tick has no actor.
  if (opts.actorId) {
    await prisma.activity.create({
      data: { action: 'liveness_checked', description: `Liveness check: ${live} live, ${revoked} revoked across ${providers.join(', ')}`, userId: opts.actorId },
    }).catch(() => {})
  }

  const alerts = await evaluateAllAlerts()
  return { success: true, checked, live, revoked, providers, warnings, alerts }
}
