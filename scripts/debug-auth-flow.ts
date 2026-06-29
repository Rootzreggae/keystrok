import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugAuthFlow() {
  console.log('=== Debugging Auth Flow ===\n')
  console.log('Current timestamp:', new Date().toISOString())
  console.log()

  try {
    // 1. Check if verification tokens can be created
    console.log('1. Testing verification token creation with proper timestamp...')
    const testIdentifier = 'debug-test@keystrok.dev'
    const testToken = `debug-${Date.now()}`
    const expiresIn24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const token = await prisma.verificationToken.create({
      data: {
        identifier: testIdentifier,
        token: testToken,
        expires: expiresIn24Hours,
      },
    })

    console.log('✓ Created token:', {
      identifier: token.identifier,
      expires: token.expires,
      expiresISO: token.expires.toISOString(),
      isValid: token.expires > new Date(),
    })

    // 2. Retrieve it
    console.log('\n2. Retrieving token using unique constraint...')
    const retrieved = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: testIdentifier,
          token: testToken,
        },
      },
    })

    if (retrieved) {
      console.log('✓ Token retrieved successfully')
      console.log('  Matches expected:', retrieved.token === testToken)
    } else {
      console.log('❌ Token NOT found - this is the problem!')
    }

    // 3. Check if there's a constraint issue
    console.log('\n3. Checking database constraints...')
    const allTokens = await prisma.verificationToken.findMany({
      where: {
        identifier: testIdentifier,
      },
    })
    console.log(`  Found ${allTokens.length} token(s) with identifier: ${testIdentifier}`)

    // 4. Test the exact flow NextAuth uses
    console.log('\n4. Simulating NextAuth verification flow...')

    // NextAuth creates token
    const authToken = `nextauth-${Date.now()}`
    const authExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.verificationToken.create({
      data: {
        identifier: testIdentifier,
        token: authToken,
        expires: authExpires,
      },
    })
    console.log('✓ Step 1: Token created')

    // User clicks link, NextAuth tries to verify
    const verifyToken = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: testIdentifier,
          token: authToken,
        },
      },
    })

    if (!verifyToken) {
      console.log('❌ Step 2: Token verification FAILED')
    } else {
      console.log('✓ Step 2: Token found')

      // Check if expired
      if (verifyToken.expires < new Date()) {
        console.log('❌ Step 3: Token is EXPIRED')
      } else {
        console.log('✓ Step 3: Token is valid')
      }

      // NextAuth deletes token after use
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: testIdentifier,
            token: authToken,
          },
        },
      })
      console.log('✓ Step 4: Token deleted after use')
    }

    // Clean up test tokens
    console.log('\n5. Cleaning up test tokens...')
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: testIdentifier,
      },
    })
    console.log('✓ Cleanup complete')

    // 6. Check for any database-level issues
    console.log('\n6. Checking for potential issues...')

    const expiredTokens = await prisma.verificationToken.findMany({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    })
    console.log(`  - Expired tokens: ${expiredTokens.length}`)

    const futureTokens = await prisma.verificationToken.findMany({
      where: {
        expires: {
          gte: new Date(),
        },
      },
    })
    console.log(`  - Valid tokens: ${futureTokens.length}`)

    // 7. Check Account table for email provider
    console.log('\n7. Checking Account table...')
    const accounts = await prisma.account.findMany({
      where: {
        type: 'email',
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    })
    console.log(`  - Email accounts: ${accounts.length}`)
    if (accounts.length === 0) {
      console.log('  ⚠️  WARNING: No email accounts found!')
      console.log('  This means NextAuth is not properly creating Account records for email provider')
    }

  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

debugAuthFlow()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })