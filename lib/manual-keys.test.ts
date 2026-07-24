// Run: node --experimental-strip-types lib/manual-keys.test.ts
// ponytail: no framework, plain asserts. Covers the pure half of manual key
// registration (lib/scanner/classify.ts): classification, extraction identity,
// hash matching, and the static error messages the register route returns.
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { classifyPastedKey, matchTrackedCandidate, REGISTER_MESSAGES } from './scanner/classify.ts'

// --- classification of recognized shapes ---
// Fixtures are concatenated so neither Keystrok's own scanner nor GitHub push
// protection reads this file as a leak.

const stripe = 'sk_live_' + 'a1B2c3D4e5F6g7H8j9K0mN4q'
let cls = classifyPastedKey(stripe)
assert.ok(cls && cls.recognized, 'stripe live key is recognized')
assert.equal(cls!.platform, 'Stripe')
assert.equal(cls!.severity, 'critical')
assert.equal(cls!.key, stripe)

const aws = 'AKIA' + 'J4H2K9X7Q3W8E5R2'
cls = classifyPastedKey(aws)
assert.ok(cls && cls.recognized, 'AWS access key id is recognized')
assert.equal(cls!.platform, 'AWS')

// The dogfood case: a Resend key classifies without a user-supplied platform.
const resend = 're_' + 'hJk3PqZx_M9nT4vW7yB2cD5fG8hJ1kL0'
cls = classifyPastedKey(resend)
assert.ok(cls && cls.recognized, 'resend key is recognized')
assert.equal(cls!.platform, 'Resend')
assert.equal(cls!.severity, 'high')

// --- extraction identity: pasting `NAME=key` registers the key itself, so its
// hash equals what a later scan of `NAME=key` in a file would extract ---

cls = classifyPastedKey(`STRIPE_SECRET=${stripe}`)
assert.ok(cls && cls.recognized)
assert.equal(cls!.key, stripe, 'submatch extracted, not the whole paste')

// --- masked preview never contains the key body ---

cls = classifyPastedKey(stripe)!
assert.ok(cls.preview.includes('*'), 'preview is masked')
assert.ok(!cls.preview.includes(stripe.slice(8, 24)), 'preview hides the body')

// --- unrecognized pastes fall back to generic (route then requires platform) ---

cls = classifyPastedKey('super-secret-webhook-signing-token-2026')
assert.ok(cls, 'plausible secret accepted as generic')
assert.equal(cls!.recognized, false)
assert.equal(cls!.severity, 'high', 'unknown severity reads as high')

assert.equal(classifyPastedKey('short'), null, 'under 8 chars is not a secret')
assert.equal(classifyPastedKey('   '), null, 'whitespace is not a secret')

// --- tracked-candidate matching: same construction as crypto.hashKey ---

const trackedKey = 'sk_live_' + randomBytes(18).toString('hex')
const salt = randomBytes(32).toString('hex')
const hash = createHash('sha256').update(salt + trackedKey).digest('hex')
const candidates = [{ keyId: 'k1', keyHashId: 'h1', hash, salt }]

assert.equal(matchTrackedCandidate(trackedKey, candidates)?.keyId, 'k1', 'planted key links')
assert.equal(matchTrackedCandidate('sk_live_' + randomBytes(18).toString('hex'), candidates), null, 'different key does not link')
assert.equal(matchTrackedCandidate(trackedKey, []), null, 'no candidates, no link')

// --- register error messages are static: no fragment of any input can appear ---

for (const [code, msg] of Object.entries(REGISTER_MESSAGES)) {
  assert.ok(typeof msg === 'string' && msg.length > 0, `${code} has a message`)
  assert.ok(!msg.includes('${') && !msg.includes('%s'), `${code} message has no interpolation slot`)
}
assert.deepEqual(
  Object.keys(REGISTER_MESSAGES).sort(),
  ['duplicate', 'failed', 'invalid', 'needs_platform', 'rate_limited'],
  'one static message per failure branch'
)

console.log('manual-keys: all assertions passed')
