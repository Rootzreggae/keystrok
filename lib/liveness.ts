// Liveness of a *leaked* key, without ever storing its value.
//
// Keystrok is zero-knowledge: we only keep a masked preview, so we can't replay
// a leaked key to test it. Instead we match its last-4 fingerprint against the
// keys a connected platform reports as live. Three honest states only:
//   live    - the last-4 is present (and enabled) on the connected account
//   revoked - the platform lists its keys and this last-4 is not among them
//   unknown - no connected platform for this provider, or it can't list keys
// The scanner's isLikelyActive heuristic is NOT liveness and never maps here.
//
// The SSRF guard is imported lazily inside datadogLiveLast4 (its only user), so
// the pure match helpers below stay importable in a plain node test runner that
// doesn't resolve the "@/" path alias.

export type LiveStatus = 'live' | 'revoked' | 'unknown'

// Providers whose "list keys" API exposes a fingerprint we can match. Others
// stay 'unknown'. Datadog first; AWS (SigV4) and the rest come later.
const LISTABLE = new Set(['datadog'])

/** Bare provider from a platform/keyType string ("datadog_api_key" -> "datadog"). */
export function providerOf(s: string): string {
  return (s || '').toLowerCase().split('_')[0]
}

export function isListable(platformType: string): boolean {
  return LISTABLE.has(providerOf(platformType))
}

/** Last-4 fingerprint from a masked preview ("sk_t********wxyz" -> "wxyz"). */
export function last4(preview: string | null | undefined): string | null {
  if (!preview) return null
  const alnum = preview.replace(/[^A-Za-z0-9]/g, '') // strip mask chars + punctuation
  return alnum.length >= 4 ? alnum.slice(-4).toLowerCase() : null
}

/**
 * Status for one discovered key against a provider's set of live last-4s.
 * Fails toward 'live' on a fingerprint collision (never toward "safe"): if the
 * last-4 is in the live set we say live, matching the one-directional honesty
 * used for exposure dates. No fingerprint -> unknown.
 */
export function statusFor(preview: string | null | undefined, liveSet: Set<string>): LiveStatus {
  const l = last4(preview)
  if (!l) return 'unknown'
  return liveSet.has(l) ? 'live' : 'revoked'
}

/** Pull the last-4 from one Datadog key entry's attributes. Datadog returns
 *  `last4` (EU v2); `last_four` kept as a fallback. Lowercased for matching. */
export function ddLast4(attributes: { last4?: string | null; last_four?: string | null } | null | undefined): string | null {
  const l4 = attributes?.last4 ?? attributes?.last_four
  return l4 ? String(l4).toLowerCase() : null
}

export interface KeyUsage { lastUsedAt: Date | null }

// A key is "recently used" if the platform saw it within this window. Used with
// liveStatus === 'live' to flag an active incident (live AND being used).
export const RECENT_USE_DAYS = 7
export function isRecentlyUsed(lastUsedAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastUsedAt) return false
  return now.getTime() - lastUsedAt.getTime() <= RECENT_USE_DAYS * 24 * 60 * 60 * 1000
}

/**
 * Datadog: map of last-4 -> usage, across BOTH api keys and application keys.
 * Presence in the map means the key is live; the value carries `lastUsedAt`,
 * read from the same response we already fetch for liveness. Checking both
 * endpoints avoids a false 'revoked' when the leaked key is an app key. Throws
 * only if EVERY endpoint failed, so a network error never gets mistaken for
 * "account has no keys" (which would wrongly mark everything revoked).
 * Docs: GET {site}/api/v2/api_keys and /api/v2/application_keys, headers
 * DD-API-KEY + DD-APPLICATION-KEY; attributes carry last4 + date_last_used.
 */
export async function datadogKeyUsage(opts: { apiUrl?: string | null; apiKey: string; appKey: string }): Promise<Map<string, KeyUsage>> {
  // Users often paste their browser URL (app.datadoghq.*), but the API lives on
  // api.datadoghq.*. Normalize so app.datadoghq.eu -> api.datadoghq.eu etc.
  const base = (opts.apiUrl || 'https://api.datadoghq.com').replace(/\/$/, '').replace('://app.', '://api.')
  const headers = { 'DD-API-KEY': opts.apiKey, 'DD-APPLICATION-KEY': opts.appKey, Accept: 'application/json' }
  const { assertSafePlatformUrl } = await import('@/lib/ssrf')
  const map = new Map<string, KeyUsage>()
  let ok = 0
  for (const path of ['/api/v2/api_keys', '/api/v2/application_keys']) {
    const url = base + path
    try {
      await assertSafePlatformUrl(url)
      const res = await fetch(url, { headers })
      if (!res.ok) continue
      const json = await res.json()
      for (const k of json?.data ?? []) {
        const l4 = ddLast4(k?.attributes)
        if (!l4) continue
        const raw = k?.attributes?.date_last_used ?? k?.attributes?.last_used_date?.timestamp ?? null
        const d = raw ? new Date(raw) : null
        map.set(l4, { lastUsedAt: d && !isNaN(d.getTime()) ? d : null })
      }
      ok++
    } catch {
      // try the other endpoint
    }
  }
  if (ok === 0) throw new Error('Could not list Datadog keys (check the api + application keys)')
  return map
}
