/**
 * Approve (invite) an email so it can sign in under the invite-only policy.
 * Marks a Waitlist entry as "approved" (creating it if needed).
 *
 * Usage:  node --env-file=.env.local scripts/allow-user.ts someone@example.com
 *
 * Alternatively, add the address to ALLOWED_EMAILS (or its domain to
 * ALLOWED_EMAIL_DOMAINS) in the environment — no DB write needed.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('Usage: node --env-file=.env.local scripts/allow-user.ts <email>')
    process.exitCode = 1
    return
  }

  const entry = await prisma.waitlist.upsert({
    where: { email },
    create: { email, status: 'approved', reason: 'manually approved' },
    update: { status: 'approved' },
    select: { email: true, status: true },
  })

  console.log(`✓ ${entry.email} is now ${entry.status} — they can sign in.`)
}

main()
  .catch((err) => {
    console.error('Failed to approve user:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
