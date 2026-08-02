// Run: node --experimental-strip-types lib/alerting.test.ts
// Covers the parts with real branches: which incident a key is in, and the
// per-channel request shaping (the whole vendor surface).
import assert from 'node:assert/strict'
import { incidentFor, buildRequest, summaryText, recoveryText, type AlertableKey } from './alerting.ts'

const NOW = new Date('2026-07-06T00:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000)
const base = (o: Partial<AlertableKey>): AlertableKey => ({ id: 'k1', keyName: 'AWS_ACCESS_KEY', platform: 'aws', severity: 'critical', keyPreview: 'AKIA****BT55', ...o })

// incidentFor: rotation_failed wins over live_and_used; recency + liveness + freshness gates.
assert.equal(incidentFor(base({ liveStatus: 'live', lastUsedAt: daysAgo(1), liveCheckedAt: daysAgo(1) }), NOW)?.kind, 'live_and_used')
assert.equal(incidentFor(base({ liveStatus: 'live', lastUsedAt: daysAgo(30), liveCheckedAt: daysAgo(1) }), NOW), null) // live but not recently used
assert.equal(incidentFor(base({ liveStatus: 'revoked', lastUsedAt: daysAgo(1), liveCheckedAt: daysAgo(1) }), NOW), null) // recent but dead
// freshness gate: live + recently used, but the liveness check itself is stale -> don't page a "now" claim
assert.equal(incidentFor(base({ liveStatus: 'live', lastUsedAt: daysAgo(1), liveCheckedAt: daysAgo(30) }), NOW), null)
assert.equal(incidentFor(base({ liveStatus: 'live', lastUsedAt: daysAgo(1) }), NOW), null) // never checked -> no page
assert.equal(incidentFor(base({ rotatedAt: daysAgo(5), liveStatus: 'live', liveCheckedAt: daysAgo(4) }), NOW)?.kind, 'rotation_failed')
// rotation_failed is a standing condition: fires even when liveness is old
assert.equal(incidentFor(base({ rotatedAt: daysAgo(90), liveStatus: 'live', liveCheckedAt: daysAgo(85) }), NOW)?.kind, 'rotation_failed')

// sla_crossed: not rotated, past its deadline (critical SLA is short, 40d is well over)
assert.equal(incidentFor(base({ foundAt: daysAgo(40) }), NOW)?.kind, 'sla_crossed')
assert.equal(incidentFor(base({ foundAt: daysAgo(40), severity: 'critical' }), NOW)?.severity, 'critical')
assert.equal(incidentFor(base({ foundAt: daysAgo(2) }), NOW), null) // still inside the window
assert.equal(incidentFor(base({ foundAt: daysAgo(40), rotatedAt: daysAgo(1) }), NOW), null) // rotated -> resolved, no page
// precedence: live_and_used (fresh) outranks sla_crossed for the same overdue key
assert.equal(incidentFor(base({ foundAt: daysAgo(40), liveStatus: 'live', liveCheckedAt: daysAgo(1), lastUsedAt: daysAgo(1) }), NOW)?.kind, 'live_and_used')

// due_soon: inside the severity-scaled lead window, advance notice fires.
// critical: 7d window, 2d lead — found 5d ago = due in 2d
assert.equal(incidentFor(base({ foundAt: daysAgo(5) }), NOW)?.kind, 'due_soon')
assert.equal(incidentFor(base({ foundAt: daysAgo(5) }), NOW)?.severity, 'critical') // mirrors the key
assert.equal(incidentFor(base({ foundAt: daysAgo(4) }), NOW), null) // due in 3d, outside the 2d lead
// high: 30d window, 5d lead — boundary on both sides
assert.equal(incidentFor(base({ foundAt: daysAgo(25), severity: 'high' }), NOW)?.kind, 'due_soon') // due in 5d
assert.equal(incidentFor(base({ foundAt: daysAgo(24), severity: 'high' }), NOW), null) // due in 6d
// past the deadline it's sla_crossed, never due_soon (silent handoff is the runner's job)
assert.equal(incidentFor(base({ foundAt: daysAgo(8) }), NOW)?.kind, 'sla_crossed')
// due today (0d left): neither — the reminder's premise "you still have time" is false
assert.equal(incidentFor(base({ foundAt: daysAgo(7) }), NOW), null)
// rotated inside the lead window -> resolved, nothing fires
assert.equal(incidentFor(base({ foundAt: daysAgo(5), rotatedAt: daysAgo(1) }), NOW), null)
// riskStart anchoring: an attested earlier exposure pulls the reminder in with the deadline
assert.equal(incidentFor(base({ foundAt: daysAgo(1), exposedAt: daysAgo(5) }), NOW)?.kind, 'due_soon')
// exposure that consumed the whole band skips due_soon entirely: straight to overdue
assert.equal(incidentFor(base({ foundAt: daysAgo(1), exposedAt: daysAgo(10) }), NOW)?.kind, 'sla_crossed')
// the reminder reads as notice (amber), incidents page red
const remind = incidentFor(base({ foundAt: daysAgo(5) }), NOW)!
assert.ok(summaryText(base({}), remind).startsWith('🟡'))
assert.ok(summaryText(base({}), remind).includes('rotation due in 2d'))
assert.ok(summaryText(base({}), incidentFor(base({ foundAt: daysAgo(40) }), NOW)!).startsWith('🔴'))
// recovery copy: rotated-ahead-of-deadline, never the sla_crossed line
assert.ok(recoveryText(base({}), 'due_soon').includes('rotated ahead of its deadline'))
assert.ok(!recoveryText(base({}), 'due_soon').includes('back inside its window'))

// buildRequest: telegram needs token + chat_id; webhook needs a url.
const inc = incidentFor(base({ liveStatus: 'live', lastUsedAt: daysAgo(1), liveCheckedAt: daysAgo(1) }), NOW)!
const text = summaryText(base({}), inc)
assert.equal(buildRequest({ channel: 'telegram', telegramToken: 'T', telegramChatId: '42' }, text)!.url, 'https://api.telegram.org/botT/sendMessage')
assert.deepEqual((buildRequest({ channel: 'telegram', telegramToken: 'T', telegramChatId: '42' }, text)!.body as { chat_id: string }).chat_id, '42')
assert.equal(buildRequest({ channel: 'telegram', telegramToken: 'T' }, text), null) // no chat_id
assert.equal(buildRequest({ channel: 'webhook', webhookUrl: 'https://hooks.example/x' }, text)!.url, 'https://hooks.example/x')
assert.equal(buildRequest({ channel: 'webhook' }, text), null) // no url
// webhook carries the structured incident when given one
const wb = buildRequest({ channel: 'webhook', webhookUrl: 'https://h/x' }, text, { ...inc, key: base({}) })!.body as { text: string; incident?: { kind: string } }
assert.equal(wb.incident?.kind, 'live_and_used')
assert.ok(wb.text.includes('AWS_ACCESS_KEY'))

console.log('alerting: ok')
