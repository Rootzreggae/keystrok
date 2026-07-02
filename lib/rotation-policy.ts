// Single source of truth for "when should this key be rotated?"
//
// We do NOT know a key's real age. Keystrok only knows when *we* discovered it.
// So every recommendation is anchored to DiscoveredKey.foundAt, never a faked
// creation date. This is advisory only: we recommend rotation and hand off to the
// guided workflow. We never rotate automatically.
//
// ponytail: replaces the scattered 30/60/90-day magic numbers that used to live in
// 5 separate routes. Change the policy here, nowhere else.

export type Severity = 'critical' | 'high' | 'medium' | 'low'

// Days after discovery when rotation becomes recommended, by severity.
const ROTATION_DAYS: Record<Severity, number> = {
  critical: 7,
  high: 30,
  medium: 60,
  low: 90,
}

const DAY_MS = 1000 * 60 * 60 * 24

function bandDays(severity: string): number {
  return ROTATION_DAYS[severity?.toLowerCase() as Severity] ?? ROTATION_DAYS.high
}

/** Date by which rotation is recommended = foundAt + severity band. */
export function rotationDueAt(foundAt: Date, severity: string): Date {
  return new Date(foundAt.getTime() + bandDays(severity) * DAY_MS)
}

/** The SLA window (days) for a severity, same bands, named for the Keys ledger. */
export function slaDays(severity: string): number {
  return bandDays(severity)
}

/** Whole days since the key was discovered (never a creation date, we don't have one). */
export function foundAgoDays(foundAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - foundAt.getTime()) / DAY_MS))
}

/** Percent of the SLA window consumed since discovery (0-100), the "SLA used" bar. */
export function slaUsedPct(foundAt: Date, severity: string, now: Date = new Date()): number {
  return Math.max(0, Math.min(100, Math.round((foundAgoDays(foundAt, now) / slaDays(severity)) * 100)))
}

/**
 * Whole days until rotation is recommended. Negative = overdue.
 * Rounds up so a freshly-discovered key shows its full band (e.g. a new critical
 * reads "7 days", not "6" from flooring 6.999d) and counts down from there.
 */
export function daysUntilDue(foundAt: Date, severity: string, now: Date = new Date()): number {
  return Math.ceil((rotationDueAt(foundAt, severity).getTime() - now.getTime()) / DAY_MS)
}

/**
 * The single irreversible step in a rotation: revoking / disabling / removing
 * the OLD key. Every template types this step as `stepType: 'cleanup'`; we also
 * match a legacy 'revoke' type and the step names as a backstop. This is the
 * one step gated to admins, and the one the UI marks "irreversible", so both
 * must agree. Do NOT loosen the /revoke/i-only check: templates name it
 * "Disable Old Keys" / "Remove Old Keys" too, which that regex misses.
 */
export function isDestructiveStep(step: { stepType?: string | null; name?: string | null }): boolean {
  const t = step.stepType ?? ''
  if (t === 'cleanup' || t === 'revoke') return true
  return /revoke|disable old|remove old|delete old/i.test(step.name ?? '')
}

export type RotationStatus = 'rotated' | 'overdue' | 'due-soon' | 'ok'

/**
 * Advisory rotation status for a discovered key.
 * `due-soon` = within `soonDays` of the recommended date (default 7).
 */
export function rotationStatus(
  key: { foundAt: Date; severity: string; status?: string | null },
  now: Date = new Date(),
  soonDays = 7,
): RotationStatus {
  if (key.status === 'rotated') return 'rotated'
  const d = daysUntilDue(key.foundAt, key.severity, now)
  if (d <= 0) return 'overdue'
  if (d <= soonDays) return 'due-soon'
  return 'ok'
}
