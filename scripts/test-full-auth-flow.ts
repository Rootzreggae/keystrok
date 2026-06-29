import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

async function testFullAuthFlow() {
  console.log('=== Testing Full NextAuth Email Flow ===\n')

  const testEmail = `test-${Date.now()}@keystrok.dev`
  console.log(`Test email: ${testEmail}\n`)

  try {
    // Step 1: User requests magic link (NextAuth creates verification token)
    console.log('1. Creating verification token (simulating email send)...')
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: testEmail,
        token,
        expires,
      },
    })
    console.log('✓ Token created')
    console.log(`  Magic link would be: http://localhost:3001/api/auth/callback/email?token=${token}&email=${encodeURIComponent(testEmail)}`)

    // Step 2: User clicks magic link (NextAuth callback)
    console.log('\n2. Simulating magic link click (callback)...')

    // Verify token exists and is valid
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: testEmail,
          token,
        },
      },
    })

    if (!verificationToken) {
      console.log('❌ Token not found!')
      return
    }

    if (verificationToken.expires < new Date()) {
      console.log('❌ Token expired!')
      return
    }

    console.log('✓ Token verified')

    // Step 3: NextAuth creates or updates user
    console.log('\n3. Creating/updating user...')

    let user = await prisma.user.findUnique({
      where: {
        email: testEmail,
      },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: testEmail,
          emailVerified: new Date(),
        },
      })
      console.log('✓ New user created:', user.id)
    } else {
      user = await prisma.user.update({
        where: {
          email: testEmail,
        },
        data: {
          emailVerified: new Date(),
        },
      })
      console.log('✓ Existing user updated:', user.id)
    }

    // Step 4: NextAuth deletes verification token (one-time use)
    console.log('\n4. Deleting verification token...')
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: testEmail,
          token,
        },
      },
    })
    console.log('✓ Token deleted')

    // Step 5: NextAuth creates session
    console.log('\n5. Creating session...')
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const session = await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: sessionExpires,
      },
    })
    console.log('✓ Session created:', session.id)
    console.log(`  Session token: ${sessionToken.substring(0, 20)}...`)
    console.log(`  Expires: ${sessionExpires}`)

    // Step 6: Verify user can be authenticated
    console.log('\n6. Verifying session...')
    const sessionCheck = await prisma.session.findUnique({
      where: {
        sessionToken,
      },
      include: {
        user: true,
      },
    })

    if (!sessionCheck) {
      console.log('❌ Session not found!')
      return
    }

    if (sessionCheck.expires < new Date()) {
      console.log('❌ Session expired!')
      return
    }

    console.log('✓ Session valid')
    console.log(`  User: ${sessionCheck.user.email}`)
    console.log(`  User ID: ${sessionCheck.user.id}`)

    // Summary
    console.log('\n=== Test Summary ===')
    console.log('✓ All steps completed successfully')
    console.log('\nThis is the exact flow NextAuth should be executing.')
    console.log('If magic links are failing, check the NextAuth logs for errors in these steps.\n')

    // Cleanup
    console.log('Cleaning up test data...')
    await prisma.session.delete({
      where: { id: session.id },
    })
    await prisma.user.delete({
      where: { id: user.id },
    })
    console.log('✓ Cleanup complete')

  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testFullAuthFlow()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })