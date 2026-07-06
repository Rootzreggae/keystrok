// Run: node --experimental-strip-types lib/alerting.test.ts
// Covers the parts with real branches: which incident a key is in, and the
// per-channel request shaping (the whole vendor surface).
import assert from 'node:assert/strict'
import { incidentFor, buildRequest, summaryText, type AlertableKey } from './alerting.ts'

const NOW = new Date('2026-07-06T00:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000)
const base = (o: Partial<AlertableKey>): AlertableKey => ({ id: 'k1', keyName: 'AWS_ACCESS_KEY', platform: 'aws', severity: 'critical', keyPreview: 'AKIA****BT55', ...o })

// incidentFor: rotation_failed wins over live_and_used; recency + liveness gates.
assert.equal(incidentFor(base({ liveStatus: 'live', lastUsedAt: daysAgo(1) }), NOW)?.kind, 'live_and_used')
assert.equal(incidentFor(base({ liveStatus: 'live', lastUsedAt: daysAgo(30) }), NOW), null) // live but not recent
assert.equal(incidentFor(base({ liveStatus: 'revoked', lastUsedAt: daysAgo(1) }), NOW), null) // recent but dead
assert.equal(incidentFor(base({ rotatedAt: daysAgo(5), liveStatus: 'live', liveCheckedAt: daysAgo(4) }), NOW)?.kind, 'rotation_failed')
// rotation_failed takes precedence when both would apply
assert.equal(incidentFor(base({ rotatedAt: daysAgo(5), liveStatus: 'live', liveCheckedAt: daysAgo(4), lastUsedAt: daysAgo(1) }), NOW)?.kind, 'rotation_failed')

// buildRequest: telegram needs token + chat_id; webhook needs a url.
const inc = incidentFor(base({ liveStatus: 'live', lastUsedAt: daysAgo(1) }), NOW)!
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
