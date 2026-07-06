// Secret-hygiene posture: SLOs and a trend, all derived from timestamps we
// already store on a discovered key (riskStart, rotatedAt, severity + its SLA).
// No new data collection, no history table: the backlog trend is reconstructed
// from the same timestamps. Pure so it's unit-testable (see posture.test.ts).
import { riskStart, slaDays } from './rotation-policy.ts'
import { rotationFailed } from './liveness.ts'

export interface PostureKey {
  foundAt: Date
  exposedAt?: Date | null
  rotatedAt?: Date | null
  liveStatus?: string | null
  liveCheckedAt?: Date | null
  status: string
  severity: string
}

export interface TrendPoint { weekEnd: string; expDays: number }
export interface Posture {
  compliance: { within: number; total: number; pct: number | null } // open keys inside their rotation SLA
  mttrDays: number | null   // mean time to rotate, over resolved keys
  resolvedCount: number
  rotationsFailed: number   // rotated, but a post-rotation check still found it live
  openExposureDays: number  // days open keys have spent at risk and are still burning
  trend: TrendPoint[]       // weekly open-at-risk backlog, oldest -> newest
}

const DAY = 86400000
const isFalsePositive = (k: PostureKey) => k.status === 'false_positive'
// Resolved = rotated AND the rotation actually stuck. A rotated-but-still-live
// key is NOT resolved: it reads "handled" while still exposed, so posture must
// treat it as open and non-compliant, not credit it as done.
const isResolved = (k: PostureKey) => (k.status === 'rotated' || !!k.rotatedAt) && !rotationFailed(k)

export function computePosture(keys: PostureKey[], now: Date = new Date(), weeks = 12): Posture {
  const active = keys.filter((k) => !isFalsePositive(k))
  const open = active.filter((k) => !isResolved(k)) // includes rotated-but-still-live
  const resolved = active.filter(isResolved)
  const rotationsFailed = active.filter(rotationFailed).length

  // Within SLA if the rotation due date (SLA counted from when the key went at-risk)
  // is still ahead. A failed rotation is a demonstrated violation, never "within".
  let within = 0
  for (const k of open) {
    if (rotationFailed(k)) continue
    const due = riskStart(k, now).getTime() + slaDays(k.severity) * DAY
    if (due >= now.getTime()) within++
  }
  const compliance = { within, total: open.length, pct: open.length ? Math.round((within / open.length) * 100) : null }

  // MTTR: mean (rotatedAt - riskStart) over keys that were actually rotated and stuck.
  const rot = resolved.filter((k) => k.rotatedAt)
  const mttrDays = rot.length
    ? Math.round(rot.reduce((s, k) => s + Math.max(0, (k.rotatedAt!.getTime() - riskStart(k, now).getTime()) / DAY), 0) / rot.length)
    : null

  // Exposure still accruing: for each open key, days since it went at-risk.
  const openExposureDays = Math.round(open.reduce((s, k) => s + Math.max(0, (now.getTime() - riskStart(k, now).getTime()) / DAY), 0))

  // Retroactive exposure trend: exposure-days burned each week, reconstructed
  // from timestamps (overlap of each key's at-risk interval with the week).
  // ponytail: riskStart is evaluated at `now`, a fine approximation for past
  // buckets (a set exposure date doesn't move).
  const WEEK = 7 * DAY
  const trend: TrendPoint[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const wEnd = now.getTime() - i * WEEK
    const wStart = wEnd - WEEK
    let expDays = 0
    for (const k of active) {
      const rs = riskStart(k, now).getTime()
      // When exposure stopped: a failed rotation never stops; a real rotation at
      // rotatedAt; resolved-without-timestamp is treated as instantly closed;
      // a still-open key runs to now.
      const stop = rotationFailed(k) ? now.getTime() : k.rotatedAt ? k.rotatedAt.getTime() : isResolved(k) ? rs : now.getTime()
      const overlap = Math.min(wEnd, stop) - Math.max(wStart, rs)
      if (overlap > 0) expDays += overlap / DAY
    }
    trend.push({ weekEnd: new Date(wEnd).toISOString().slice(0, 10), expDays: Math.round(expDays) })
  }

  return { compliance, mttrDays, resolvedCount: resolved.length, rotationsFailed, openExposureDays, trend }
}
