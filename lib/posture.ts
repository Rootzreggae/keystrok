// Secret-hygiene posture: SLOs and a trend, all derived from timestamps we
// already store on a discovered key (riskStart, rotatedAt, severity + its SLA).
// No new data collection, no history table: the backlog trend is reconstructed
// from the same timestamps. Pure so it's unit-testable (see posture.test.ts).
import { riskStart, slaDays } from './rotation-policy.ts'

export interface PostureKey {
  foundAt: Date
  exposedAt?: Date | null
  rotatedAt?: Date | null
  status: string
  severity: string
}

export interface TrendPoint { weekEnd: string; open: number }
export interface Posture {
  compliance: { within: number; total: number; pct: number | null } // open keys inside their rotation SLA
  mttrDays: number | null   // mean time to rotate, over resolved keys
  resolvedCount: number
  openExposureDays: number  // days open keys have spent at risk and are still burning
  trend: TrendPoint[]       // weekly open-at-risk backlog, oldest -> newest
}

const DAY = 86400000
const isResolved = (k: PostureKey) => k.status === 'rotated' || !!k.rotatedAt
const isFalsePositive = (k: PostureKey) => k.status === 'false_positive'

export function computePosture(keys: PostureKey[], now: Date = new Date(), weeks = 12): Posture {
  const active = keys.filter((k) => !isFalsePositive(k))
  const open = active.filter((k) => !isResolved(k))
  const resolved = active.filter(isResolved)

  // Within SLA if the rotation due date (SLA counted from when the key went at-risk) is still ahead.
  let within = 0
  for (const k of open) {
    const due = riskStart(k, now).getTime() + slaDays(k.severity) * DAY
    if (due >= now.getTime()) within++
  }
  const compliance = { within, total: open.length, pct: open.length ? Math.round((within / open.length) * 100) : null }

  // MTTR: mean (rotatedAt - riskStart) over keys that were actually rotated.
  const rot = resolved.filter((k) => k.rotatedAt)
  const mttrDays = rot.length
    ? Math.round(rot.reduce((s, k) => s + Math.max(0, (k.rotatedAt!.getTime() - riskStart(k, now).getTime()) / DAY), 0) / rot.length)
    : null

  // Exposure still accruing: for each open key, days since it went at-risk.
  const openExposureDays = Math.round(open.reduce((s, k) => s + Math.max(0, (now.getTime() - riskStart(k, now).getTime()) / DAY), 0))

  // Retroactive backlog trend: at each week boundary, how many keys were at-risk
  // and not yet resolved. ponytail: riskStart is evaluated at `now`, a fine
  // approximation for past buckets (a set exposure date doesn't move).
  const trend: TrendPoint[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const end = now.getTime() - i * 7 * DAY
    let count = 0
    for (const k of active) {
      const rs = riskStart(k, now).getTime()
      // Resolved-by-status but no rotatedAt: we can't time when it closed, so
      // collapse it to rs (never shows as open backlog), consistent with `open`.
      const resolvedAt = k.rotatedAt ? k.rotatedAt.getTime() : isResolved(k) ? rs : Infinity
      if (rs <= end && resolvedAt > end) count++
    }
    trend.push({ weekEnd: new Date(end).toISOString().slice(0, 10), open: count })
  }

  return { compliance, mttrDays, resolvedCount: resolved.length, openExposureDays, trend }
}
