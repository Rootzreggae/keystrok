// Run: node --experimental-strip-types lib/liveness.test.ts
// ponytail: plain asserts on the pure match logic (the part with a real branch).
// The Datadog HTTP call is thin and gets verified live against a real account.
import assert from 'node:assert/strict'
import { last4, statusFor, isListable, providerOf, ddLast4, isRecentlyUsed } from './liveness.ts'

// isRecentlyUsed: the "active incident" recency window (7 days).
const NOW = new Date('2026-07-04T00:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000)
assert.equal(isRecentlyUsed(daysAgo(1), NOW), true)
assert.equal(isRecentlyUsed(daysAgo(6), NOW), true)
assert.equal(isRecentlyUsed(daysAgo(30), NOW), false)
assert.equal(isRecentlyUsed(null, NOW), false)

// Datadog attribute field: it's `last4` (EU v2), with `last_four` as a fallback.
// Regression guard: reading only `last_four` returned null against the live EU API.
assert.equal(ddLast4({ last4: '6A0B' }), '6a0b')
assert.equal(ddLast4({ last_four: 'WXYZ' }), 'wxyz')
assert.equal(ddLast4({}), null)
assert.equal(ddLast4(null), null)

// Fingerprint extraction from masked previews.
assert.equal(last4('sk_t********wxyz'), 'wxyz')
assert.equal(last4('AKIA********CDEF'), 'cdef') // lowercased for case-insensitive match
assert.equal(last4(null), null)
assert.equal(last4('abc'), null) // too short

// Match against a provider's live set.
assert.equal(statusFor('sk_t********wxyz', new Set(['wxyz'])), 'live')
assert.equal(statusFor('sk_t********wxyz', new Set(['0000'])), 'revoked')
assert.equal(statusFor('sk_t********wxyz', new Set()), 'revoked') // account has keys, this isn't one
assert.equal(statusFor(null, new Set(['wxyz'])), 'unknown') // no fingerprint
// Datadog returns lowercase last_four; our preview may be upper. Still matches.
assert.equal(statusFor('DDKEY*******ABCD', new Set(['abcd'])), 'live')

// Provider gating.
assert.equal(providerOf('datadog_api_key'), 'datadog')
assert.equal(isListable('datadog'), true)
assert.equal(isListable('datadog_api_key'), true)
assert.equal(isListable('stripe_secret_test'), false)
assert.equal(isListable('github'), false)

console.log('liveness: all assertions passed')
