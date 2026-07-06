// Run: node --experimental-strip-types lib/posture.test.ts
// Checks the derived hygiene math: SLA compliance, MTTR, exposure-days, and the
// retroactive backlog trend, the parts with real branches.
import assert from 'node:assert/strict'
import { computePosture, type PostureKey } from './posture.ts'

const NOW = new Date('2026-07-06T00:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000)

// critical SLA is short; a critical key found 40d ago is overdue, a high found 2d ago is within.
const keys: PostureKey[] = [
  { foundAt: daysAgo(2), status: 'warning', severity: 'high' },                         // open, within SLA
  { foundAt: daysAgo(40), status: 'warning', severity: 'critical' },                    // open, overdue
  { foundAt: daysAgo(30), rotatedAt: daysAgo(20), status: 'rotated', severity: 'high' },// resolved in 10d
  { foundAt: daysAgo(5), status: 'false_positive', severity: 'low' },                   // ignored entirely
]
const p = computePosture(keys, NOW, 8)

// compliance: 2 open keys, 1 within -> 50%
assert.equal(p.compliance.total, 2)
assert.equal(p.compliance.within, 1)
assert.equal(p.compliance.pct, 50)

// MTTR: the one rotated key took 10 days
assert.equal(p.resolvedCount, 1)
assert.equal(p.mttrDays, 10)

// open exposure-days = 2 + 40 = 42 (FP excluded, resolved excluded)
assert.equal(p.openExposureDays, 42)

// trend: newest bucket (this week) has both open keys still open -> 2
assert.equal(p.trend.length, 8)
assert.equal(p.trend.at(-1)!.open, 2)
// 8 weeks ago (56d), only the 40d key wasn't at risk yet, and the rotated key (found 30d ago) also not yet -> 0
assert.equal(p.trend[0].open, 0)

// resolved-by-status but no rotatedAt: excluded from open backlog, not counted as open
const noTs = computePosture([{ foundAt: daysAgo(10), status: 'rotated', severity: 'high' }], NOW, 4)
assert.equal(noTs.trend.at(-1)!.open, 0)
assert.equal(noTs.compliance.total, 0)

// rotated-but-still-live: NOT resolved. Counts as open + non-compliant, drops
// out of MTTR, keeps accruing exposure, stays in the backlog trend.
const failed = { foundAt: daysAgo(10), rotatedAt: daysAgo(5), liveStatus: 'live', liveCheckedAt: daysAgo(4), status: 'rotated', severity: 'high' }
const pf = computePosture([failed], NOW, 4)
assert.equal(pf.rotationsFailed, 1)
assert.equal(pf.resolvedCount, 0)
assert.equal(pf.compliance.total, 1)
assert.equal(pf.compliance.within, 0)   // demonstrated violation, never within SLA
assert.equal(pf.compliance.pct, 0)
assert.equal(pf.mttrDays, null)          // not credited as a rotation
assert.equal(pf.openExposureDays, 10)    // still burning from foundAt
assert.equal(pf.trend.at(-1)!.open, 1)   // still open backlog

// empty input: no open keys -> pct null, mttr null, no throw
const empty = computePosture([], NOW)
assert.equal(empty.compliance.pct, null)
assert.equal(empty.mttrDays, null)
assert.equal(empty.openExposureDays, 0)

console.log('posture: ok')
