/**
 * One-time, idempotent migration: encrypt any Platform.apiKey rows that are
 * still stored as plaintext (written before encryption-at-rest was introduced).
 *
 * Run:  node --env-file=.env.local scripts/encrypt-existing-platform-keys.ts
 *
 * Safe to run repeatedly. Already-encrypted and empty rows are skipped.
 */
import { PrismaClient } from '@prisma/client'
import { encryptSecret, isEncrypted } from '../lib/crypto.ts'

const prisma = new PrismaClient()

async function main() {
  const platforms = await prisma.platform.findMany({
    select: { id: true, name: true, apiKey: true },
  })

  let encrypted = 0
  let skippedEmpty = 0
  let skippedAlready = 0

  for (const p of platforms) {
    if (!p.apiKey) {
      skippedEmpty++
      continue
    }
    if (isEncrypted(p.apiKey)) {
      skippedAlready++
      continue
    }
    await prisma.platform.update({
      where: { id: p.id },
      data: { apiKey: encryptSecret(p.apiKey) },
    })
    encrypted++
    console.log(`  encrypted apiKey for platform "${p.name}" (${p.id})`)
  }

  console.log('\nMigration complete:')
  console.log(`  total platforms:        ${platforms.length}`)
  console.log(`  newly encrypted:        ${encrypted}`)
  console.log(`  already encrypted:      ${skippedAlready}`)
  console.log(`  empty (no key):         ${skippedEmpty}`)
}

main()
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
