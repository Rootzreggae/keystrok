/**
 * Proof that invite-only access control behaves correctly.
 *
 * Run:  node --env-file=.env.local --import ./scripts/register-alias.mjs scripts/verify-allowlist.ts
 *
 * Covers: explicit allowlist, domain allowlist, waitlist-approved (DB), the
 * deny-by-default for unknown emails, and the AUTH_OPEN_REGISTRATION opt-out.
 * Creates and removes a throwaway waitlist row. Exits non-zero on failure.
 */
import { PrismaClient } from '@prisma/client'
import { isAllowedEmail } from '../lib/allowlist.ts'

const prisma = new PrismaClient()
let failed = 0
const ok = (m: string) => console.log('  ✓ ' + m)
const bad = (m: string) => { console.log('  ✗ ' + m); failed = 1 }

async function expect(email: string, want: boolean, label: string) {
  const got = await isAllowedEmail(email)
  if (got === want) ok(`${label}: ${email} -> ${got}`)
  else bad(`${label}: ${email} -> ${got} (expected ${want})`)
}

async function main() {
  // Deterministic env for the test.
  process.env.AUTH_OPEN_REGISTRATION = 'false'
  process.env.ALLOWED_EMAILS = 'owner@example.com'
  process.env.ALLOWED_EMAIL_DOMAINS = 'trusted.dev'

  const APPROVED = 'verify-allow-approved@keystrok.local'
  const UNKNOWN = 'verify-allow-stranger@keystrok.local'

  await prisma.waitlist.deleteMany({ where: { email: { in: [APPROVED, UNKNOWN] } } })
  await prisma.waitlist.create({ data: { email: APPROVED, status: 'approved' } })
  await prisma.waitlist.create({ data: { email: UNKNOWN, status: 'pending' } })

  try {
    console.log('== invite-only (default) ==')
    await expect('owner@example.com', true, 'explicit allowlist')
    await expect('anyone@trusted.dev', true, 'domain allowlist')
    await expect(APPROVED, true, 'waitlist approved')
    await expect(UNKNOWN, false, 'waitlist pending denied')
    await expect('random@gmail.com', false, 'unknown denied')
    await expect('', false, 'empty denied')

    console.log('== open registration opt-out ==')
    process.env.AUTH_OPEN_REGISTRATION = 'true'
    await expect('random@gmail.com', true, 'open registration allows anyone')

    console.log(failed ? '\nALLOWLIST: FAIL' : '\nALLOWLIST: PASS')
  } finally {
    await prisma.waitlist.deleteMany({ where: { email: { in: [APPROVED, UNKNOWN] } } })
  }
}

main()
  .catch((e) => { console.error(e); failed = 1 })
  .finally(async () => {
    await prisma.$disconnect()
    process.exitCode = failed
  })
