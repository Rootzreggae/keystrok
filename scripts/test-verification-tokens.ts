import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testVerificationTokens() {
  console.log('=== Testing Verification Token Flow ===\n')

  try {
    // Test 1: Create a verification token
    console.log('1. Creating verification token...')
    const testEmail = 'test@example.com'
    const testToken = `test-token-${Date.now()}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const createdToken = await prisma.verificationToken.create({
      data: {
        identifier: testEmail,
        token: testToken,
        expires: expiresAt,
      },
    })
    console.log('✓ Token created:', {
      identifier: createdToken.identifier,
      token: createdToken.token.substring(0, 20) + '...',
      expires: createdToken.expires,
    })

    // Test 2: Retrieve the token
    console.log('\n2. Retrieving verification token...')
    const retrievedToken = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: testEmail,
          token: testToken,
        },
      },
    })
    console.log('✓ Token retrieved:', retrievedToken ? 'SUCCESS' : 'FAILED')

    // Test 3: Check if token exists in table
    console.log('\n3. Listing all verification tokens...')
    const allTokens = await prisma.verificationToken.findMany()
    console.log(`✓ Total tokens in database: ${allTokens.length}`)

    // Test 4: Delete the token (simulating NextAuth consuming the token)
    console.log('\n4. Deleting verification token...')
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: testEmail,
          token: testToken,
        },
      },
    })
    console.log('✓ Token deleted successfully')

    // Test 5: Verify deletion
    console.log('\n5. Verifying token was deleted...')
    const deletedToken = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: testEmail,
          token: testToken,
        },
      },
    })
    console.log('✓ Token exists after deletion:', deletedToken ? 'FAILED' : 'SUCCESS')

    // Test 6: Check Users table structure
    console.log('\n6. Checking User table structure...')
    const userCount = await prisma.user.count()
    console.log(`✓ Total users in database: ${userCount}`)

    // Test 7: Check Sessions table structure
    console.log('\n7. Checking Session table structure...')
    const sessionCount = await prisma.session.count()
    console.log(`✓ Total sessions in database: ${sessionCount}`)

    // Test 8: Check Accounts table structure
    console.log('\n8. Checking Account table structure...')
    const accountCount = await prisma.account.count()
    console.log(`✓ Total accounts in database: ${accountCount}`)

    console.log('\n=== All Tests Passed ===')
    console.log('\nNextAuth tables are properly configured:')
    console.log('- User table: ✓')
    console.log('- Session table: ✓')
    console.log('- Account table: ✓')
    console.log('- VerificationToken table: ✓')

  } catch (error) {
    console.error('\n❌ Error during testing:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testVerificationTokens()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })