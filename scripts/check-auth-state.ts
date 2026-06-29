import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAuthState() {
  console.log('=== Checking Authentication State ===\n')

  try {
    // Check verification tokens
    console.log('1. Verification Tokens:')
    const tokens = await prisma.verificationToken.findMany({
      orderBy: {
        expires: 'desc',
      },
    })

    console.log(`   Total tokens: ${tokens.length}`)
    tokens.forEach((token, index) => {
      const isExpired = new Date(token.expires) < new Date()
      console.log(`   ${index + 1}. Identifier: ${token.identifier}`)
      console.log(`      Token: ${token.token.substring(0, 30)}...`)
      console.log(`      Expires: ${token.expires}`)
      console.log(`      Status: ${isExpired ? '❌ EXPIRED' : '✓ Valid'}`)
      console.log()
    })

    // Check users
    console.log('\n2. Users:')
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    })
    console.log(`   Total users: ${users.length}`)
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. Email: ${user.email}`)
      console.log(`      ID: ${user.id}`)
      console.log(`      Email Verified: ${user.emailVerified || 'Not verified'}`)
      console.log(`      Created: ${user.createdAt}`)
      console.log()
    })

    // Check sessions
    console.log('\n3. Sessions:')
    const sessions = await prisma.session.findMany({
      orderBy: {
        expires: 'desc',
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      take: 5,
    })
    console.log(`   Total sessions: ${sessions.length}`)
    sessions.forEach((session, index) => {
      const isExpired = new Date(session.expires) < new Date()
      console.log(`   ${index + 1}. User: ${session.user.email}`)
      console.log(`      Session Token: ${session.sessionToken.substring(0, 30)}...`)
      console.log(`      Expires: ${session.expires}`)
      console.log(`      Status: ${isExpired ? '❌ EXPIRED' : '✓ Active'}`)
      console.log()
    })

    // Clean up expired tokens
    console.log('\n4. Cleaning up expired verification tokens...')
    const deleteResult = await prisma.verificationToken.deleteMany({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    })
    console.log(`   ✓ Deleted ${deleteResult.count} expired tokens`)

  } catch (error) {
    console.error('\n❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkAuthState()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })