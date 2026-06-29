/**
 * Proof that the DB-backed fixed-window rate limiter behaves correctly.
 *
 * Run:  node --env-file=.env.local --import ./scripts/register-alias.mjs scripts/verify-rate-limit.ts
 *
 * Covers: allowing up to `limit` hits, blocking the next one, the `remaining`
 * countdown, window rollover (resets the counter), and isolation between keys.
 * Uses throwaway keys and cleans them up. Exits non-zero on failure.
 */
import { PrismaClient } from '@prisma/client'
import { checkRateLimit } from '../lib/rate-limit.ts'

const prisma = new PrismaClient()
let failed = 0
const ok = (m: string) => console.log('  ✓ ' + m)
const bad = (m: string) => { console.log('  ✗ ' + m); failed = 1 }

const K1 = 'verify-rl:key-a'
const K2 = 'verify-rl:key-b'
const SHORT = 'verify-rl:short-window'

async function main() {
  await prisma.rateLimit.deleteMany({ where: { key: { in: [K1, K2, SHORT] } } })

  console.log('== allow up to the limit, then block ==')
  const opts = { limit: 3, windowMs: 60_000 }
  const r1 = await checkRateLimit(K1, opts)
  const r2 = await checkRateLimit(K1, opts)
  const r3 = await checkRateLimit(K1, opts)
  const r4 = await checkRateLimit(K1, opts)
  if (r1.allowed && r2.allowed && r3.allowed) ok('first 3 hits allowed')
  else bad(`expected first 3 allowed, got ${[r1, r2, r3].map((r) => r.allowed)}`)
  if (!r4.allowed) ok('4th hit blocked') ; else bad('4th hit should be blocked')
  if (r1.remaining === 2 && r3.remaining === 0) ok('remaining counts down 2 -> 0')
  else bad(`remaining wrong: r1=${r1.remaining} r3=${r3.remaining}`)
  if (!r4.allowed && r4.retryAfterMs > 0) ok(`retryAfterMs set on block (${r4.retryAfterMs}ms)`)
  else bad('retryAfterMs should be > 0 when blocked')

  console.log('== keys are isolated ==')
  const b1 = await checkRateLimit(K2, opts)
  if (b1.allowed && b1.remaining === 2) ok('separate key has its own fresh window')
  else bad(`key isolation failed: ${JSON.stringify(b1)}`)

  console.log('== window rollover resets the counter ==')
  const tiny = { limit: 1, windowMs: 1 } // 1ms window: second call is a new window
  const s1 = await checkRateLimit(SHORT, tiny)
  await new Promise((res) => setTimeout(res, 5))
  const s2 = await checkRateLimit(SHORT, tiny)
  if (s1.allowed && s2.allowed) ok('after the window elapses, a new request is allowed again')
  else bad(`rollover failed: s1=${s1.allowed} s2=${s2.allowed}`)

  console.log(failed ? '\nRATE LIMIT: FAIL' : '\nRATE LIMIT: PASS')
}

main()
  .catch((e) => { console.error(e); failed = 1 })
  .finally(async () => {
    await prisma.rateLimit.deleteMany({ where: { key: { in: [K1, K2, SHORT] } } })
    await prisma.$disconnect()
    process.exitCode = failed
  })
