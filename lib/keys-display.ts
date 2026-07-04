// Shared display helpers for the key ledger (Keys + Home). Pure, client-safe.
import { slaDays, foundAgoDays } from '@/lib/rotation-policy'

export interface ApiKey {
  id: string
  name: string
  platform: string
  location?: string
  source?: string
  key_preview?: string
  severity: string
  status: string
  created_at: string
  risk_start?: string // urgency anchor: exposedAt if earlier than discovery, else = created_at
  exposed_at?: string | null
  exposed_at_source?: string | null
  daysUntilExpiry: number
  rotatedAt?: string | null
}

/** The urgency anchor for client-side math. Falls back to discovery if the API is old. */
export const anchorOf = (k: ApiKey) => new Date(k.risk_start ?? k.created_at)

// Platform string (often keyType-derived, e.g. "stripe_secret_live") → code + label.
const PLAT: Record<string, { code: string; label: string }> = {
  aws: { code: 'AWS', label: 'AWS' },
  stripe: { code: 'STR', label: 'Stripe' },
  github: { code: 'GH', label: 'GitHub' },
  slack: { code: 'SLK', label: 'Slack' },
  grafana: { code: 'GRF', label: 'Grafana' },
  datadog: { code: 'DD', label: 'Datadog' },
  newrelic: { code: 'NR', label: 'New Relic' },
  dynatrace: { code: 'DT', label: 'Dynatrace' },
  openai: { code: 'OAI', label: 'OpenAI' },
  google: { code: 'GCP', label: 'Google' },
  sentry: { code: 'SNT', label: 'Sentry' },
}
export function platOf(platform: string) {
  const k = (platform || '').toLowerCase().split('_')[0]
  return PLAT[k] ?? { code: (platform || '?').slice(0, 3).toUpperCase(), label: platform || 'Unknown' }
}

export const SEVL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }
export const sevColor = (s: string) =>
  ({ critical: 'var(--crit)', high: 'var(--high)', medium: 'var(--med)', low: 'var(--low)' }[s] ?? 'var(--tx-mut)')

/** Promoted key names are verbose ("STRIPE_SECRET_LIVE Key - Found in …"); show the bare name. */
export const displayName = (name: string) => name.split(/ Key | - /)[0]

/**
 * Findings from a GitHub clone carry the internal temp path
 * (/Users/…/.keystrok/clones/<sessionId>/…). Strip that prefix so a location
 * reads as the repo-relative path instead of leaking clone-dir plumbing. Works
 * on a bare path or inside an activity message; leaves normal paths untouched.
 */
export const cleanLocation = (loc?: string | null) =>
  (loc ?? '-').replace(/\/?\S*\.keystrok\/clones\/[^/\s]+\//g, '')

/** Discovery-anchored urgency text, never a fake date. Mirrors the handoff urg(). */
export function urgency(k: ApiKey) {
  if (k.status === 'rotated') {
    const ago = k.rotatedAt ? foundAgoDays(new Date(k.rotatedAt)) : null
    return { txt: ago != null ? `rotated ${ago}d ago` : 'rotated', color: 'var(--ok)', overdue: false, rank: 3 }
  }
  const dl = k.daysUntilExpiry
  if (dl < 0) return { txt: `${Math.abs(dl)}d overdue`, color: 'var(--crit)', overdue: true, rank: 0 }
  const sla = slaDays(k.severity)
  if (dl <= Math.max(2, sla * 0.2)) return { txt: `${dl}d left`, color: 'var(--high)', overdue: false, rank: 1 }
  return { txt: `${dl}d left`, color: 'var(--tx-mut)', overdue: false, rank: 2 }
}

/** A key needs action if overdue, in the soon window, or a still-open critical. */
export function needsAction(k: ApiKey) {
  if (k.status === 'rotated') return false
  const u = urgency(k)
  return u.overdue || u.rank === 1 || k.severity === 'critical'
}

/** Compact relative time for activity rows. */
export function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 604800) return `${Math.floor(s / 86400)}d`
  return `${Math.floor(s / 604800)}w`
}
