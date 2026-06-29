/**
 * Proof that platform credentials are encrypted at rest.
 *
 * Run:  node --env-file=.env.local scripts/verify-encryption.ts
 *
 * Creates a throwaway user + platform with a known secret, reads the RAW row
 * straight from the database, and asserts:
 *   1. the stored apiKey is NOT the plaintext
 *   2. the stored apiKey is in the enc:v1: envelope format
 *   3. decryptSecret() round-trips back to the original plaintext
 * Then deletes everything it created. Exits non-zero on any failed assertion.
 */
import { PrismaClient } from '@prisma/client'
import { encryptSecret, decryptSecret, isEncrypted } from '../lib/crypto.ts'

const prisma = new PrismaClient()
const PLAINTEXT = 'sk_live_VERIFY_' + 'A'.repeat(24)
const MARKER = 'verify-encryption@keystrok.local'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg)
  console.log('  ✓ ' + msg)
}

async function main() {
  // Clean any leftovers from a previous aborted run.
  await prisma.user.deleteMany({ where: { email: MARKER } })

  const user = await prisma.user.create({
    data: { email: MARKER, emailVerified: new Date() },
  })

  const created = await prisma.platform.create({
    data: {
      name: 'verify-encryption',
      type: 'stripe',
      apiUrl: 'https://api.stripe.com',
      apiKey: encryptSecret(PLAINTEXT), // mirrors what the write paths do
      userId: user.id,
    },
  })

  // Read the RAW stored value back from the database.
  const raw = await prisma.platform.findUniqueOrThrow({
    where: { id: created.id },
    select: { apiKey: true },
  })

  try {
    assert(raw.apiKey !== PLAINTEXT, 'stored apiKey is not the plaintext')
    assert(isEncrypted(raw.apiKey), 'stored apiKey is in enc:v1: envelope format')
    assert(decryptSecret(raw.apiKey) === PLAINTEXT, 'decryptSecret round-trips to original plaintext')
    console.log('\nENCRYPTION-AT-REST: PASS')
  } finally {
    await prisma.user.delete({ where: { id: user.id } }) // cascades to platform
  }
}

main()
  .catch((err) => {
    console.error('\nENCRYPTION-AT-REST: FAIL')
    console.error(err.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
