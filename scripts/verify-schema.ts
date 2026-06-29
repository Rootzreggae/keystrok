/**
 * Schema Verification Script
 * 
 * Verifies that the database schema relationships are correctly set up
 * for rotation workflows with both Key and DiscoveredKey support.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifySchema() {
  console.log('🔍 Verifying Keystrok Database Schema...\n')

  try {
    // Test 1: Check Key model exists
    console.log('✓ Testing Key model...')
    const keyCount = await prisma.key.count()
    console.log(`  Found ${keyCount} keys in inventory\n`)

    // Test 2: Check RotationWorkflow model with Key relation
    console.log('✓ Testing RotationWorkflow model...')
    const workflowCount = await prisma.rotationWorkflow.count()
    console.log(`  Found ${workflowCount} rotation workflows\n`)

    // Test 3: Verify relationships exist
    console.log('✓ Testing relationships...')
    
    // Check if we can query with includes
    const workflowsWithRelations = await prisma.rotationWorkflow.findMany({
      take: 1,
      include: {
        key: true,
        discoveredKey: true,
        platform: true,
        user: {
          select: { id: true, email: true }
        },
        steps: {
          take: 1
        }
      }
    })
    
    console.log('  ✓ User relation')
    console.log('  ✓ Key relation (Key Inventory)')
    console.log('  ✓ DiscoveredKey relation (Scanner)')
    console.log('  ✓ Platform relation')
    console.log('  ✓ Steps relation (RotationStep)')
    
    console.log('\n✅ All schema relationships verified successfully!')
    
    // Display schema summary
    console.log('\n📊 Schema Summary:')
    console.log('─'.repeat(50))
    console.log('RotationWorkflow supports:')
    console.log('  • keyId → Key (from Key Inventory)')
    console.log('  • discoveredKeyId → DiscoveredKey (from Scanner)')
    console.log('  • platformId → Platform')
    console.log('  • userId → User')
    console.log('  • steps → RotationStep[] (cascade delete)')
    console.log('─'.repeat(50))

  } catch (error) {
    console.error('❌ Schema verification failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifySchema()
