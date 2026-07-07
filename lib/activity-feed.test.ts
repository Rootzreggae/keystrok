// Run: node --experimental-strip-types lib/activity-feed.test.ts
import assert from 'node:assert/strict'
import { classOf, parseActivity, threadWorkflow, collapseRepeats, composeEvents, buildView } from './activity-feed.ts'

// classification
assert.equal(classOf('liveness_checked'), 'liveness')
assert.equal(classOf('platform_added'), 'platform')
assert.equal(classOf('key_promoted'), 'discovery')
assert.equal(classOf('quick_scan_completed'), 'discovery')
assert.equal(classOf('workflow_created'), null) // rotations come from workflows, not the log
assert.equal(classOf('view'), null)

const A = (action: string, description: string, at = '2026-07-06T14:00:00Z') => ({ id: action + at, action, description, createdAt: new Date(at) })

// liveness with a revocation -> inline crit fragment + row crit
const liv = parseActivity(A('liveness_checked', 'Liveness check: 1 live, 1 revoked across datadog'))!
assert.equal(liv.cls, 'liveness')
assert.equal(liv.crit, true)
assert.ok(liv.parts.some((p) => p.k === 'crit' && p.s === '1 revoked'))
// clean liveness -> no crit
assert.ok(!parseActivity(A('liveness_checked', 'Liveness check: 1 live, 0 revoked across aws'))!.crit)
// platform -> strong entity
const plat = parseActivity(A('platform_added', 'Added aws platform: AWS'))!
assert.ok(plat.parts.some((p) => p.k === 'strong' && p.s === 'AWS'))
// discovery promote -> entity + path tail
const prom = parseActivity(A('key_promoted', 'Local scan finding promoted to inventory: aws_access_key key in /Users/x/.keystrok/clones/abc/app/page.tsx'))!
assert.ok(prom.detail && !prom.detail.includes('.keystrok/clones')) // clone path stripped

// workflow threading -> head + steps, last step tagged completed
const rawWf = {
  id: 'w1', name: 'Rotate AWS', status: 'completed', startedAt: new Date('2026-07-06T14:12:00Z'), completedAt: new Date('2026-07-06T15:02:00Z'),
  discoveredKey: { keyName: 'AWS_ACCESS_KEY Key - Found in x' },
  steps: [
    { name: 'Generate New Key', status: 'completed', completedAt: new Date('2026-07-06T14:14:00Z') },
    { name: 'Revoke Old Key', status: 'completed', completedAt: new Date('2026-07-06T15:02:00Z') },
  ],
}
const wf = threadWorkflow(rawWf)
assert.equal(wf.cls, 'rotation')
assert.equal(wf.steps!.length, 2)
assert.equal(wf.steps!.at(-1)!.tail, 'completed')
assert.ok(wf.parts.some((p) => p.k === 'strong' && p.s === 'AWS_ACCESS_KEY'))

// collapse consecutive identical
const collapsed = collapseRepeats([
  parseActivity(A('platform_added', 'Added datadog platform: Datadog', '2026-07-06T17:44:00Z'))!,
  parseActivity(A('platform_added', 'Added datadog platform: Datadog', '2026-07-06T16:02:00Z'))!,
])
assert.equal(collapsed.length, 1)
assert.equal(collapsed[0].count, 2)
assert.equal(collapsed[0].timeRange, '16:02–17:44')

// compose (server) + buildView (client): counts, day grouping, strip, filter sync
const NOW = new Date('2026-07-07T10:00:00Z')
const raw = composeEvents([rawWf], [A('liveness_checked', 'Liveness check: 1 live, 0 revoked across aws')], NOW)
assert.equal(raw.counts.rotation, 1)
assert.equal(raw.counts.liveness, 1)
assert.equal(raw.counts.all, 2)

const view = buildView(raw.events, NOW)
assert.equal(view.strip.length, 14)
assert.equal(view.days[0].label.startsWith('YESTERDAY'), true) // both on Jul 6 = yesterday of Jul 7
assert.equal(view.total, 2)
// filter by class re-renders both log and strip
const rotOnly = buildView(raw.events, NOW, { cls: 'rotation' })
assert.equal(rotOnly.total, 1)
assert.equal(rotOnly.strip.reduce((n, d) => n + d.total, 0), 1)
// key scope narrows to a key's events
assert.equal(buildView(raw.events, NOW, { scope: 'AWS_ACCESS' }).total, 1)
assert.equal(buildView(raw.events, NOW, { scope: 'nonexistent' }).total, 0)

console.log('activity-feed: ok')
