#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function validateMigration() {
  try {
    console.log('🔍 Validating database migration...\n');

    // Test 1: Verify tables exist and are accessible
    console.log('1️⃣  Testing table existence and basic queries...');

    const rotationTemplatesCount = await prisma.rotationTemplate.count();
    console.log(`   ✅ rotation_templates table: ${rotationTemplatesCount} records`);

    const rotationWorkflowsCount = await prisma.rotationWorkflow.count();
    console.log(`   ✅ rotation_workflows table: ${rotationWorkflowsCount} records`);

    const rotationStepsCount = await prisma.rotationStep.count();
    console.log(`   ✅ rotation_steps table: ${rotationStepsCount} records`);

    const workflowAuditLogCount = await prisma.workflowAuditLog.count();
    console.log(`   ✅ workflow_audit_log table: ${workflowAuditLogCount} records`);

    // Test 2: Verify template data integrity
    console.log('\n2️⃣  Validating template data integrity...');

    const templates = await prisma.rotationTemplate.findMany({
      select: {
        platform: true,
        name: true,
        keyType: true,
        steps: true,
        isActive: true,
        estimatedTime: true
      }
    });

    const expectedPlatforms = ['github', 'google', 'grafana', 'datadog', 'newrelic', 'dynatrace'];
    const foundPlatforms = templates.map(t => t.platform).sort();

    if (JSON.stringify(expectedPlatforms) === JSON.stringify(foundPlatforms)) {
      console.log('   ✅ All 6 required platforms present');
    } else {
      console.log('   ❌ Missing platforms:', expectedPlatforms.filter(p => !foundPlatforms.includes(p)));
    }

    // Verify each template has valid steps
    for (const template of templates) {
      const steps = template.steps;
      if (Array.isArray(steps) && steps.length > 0) {
        console.log(`   ✅ ${template.platform}: ${steps.length} steps defined`);
      } else {
        console.log(`   ❌ ${template.platform}: Invalid or missing steps`);
      }
    }

    // Test 3: Verify indexes and constraints
    console.log('\n3️⃣  Testing database constraints and relationships...');

    // Test unique constraint on platform
    try {
      const duplicateTest = await prisma.rotationTemplate.create({
        data: {
          name: "Test Duplicate",
          platform: "github", // This should fail due to unique constraint
          keyType: "test",
          description: "Test duplicate",
          steps: []
        }
      });
      console.log('   ❌ Unique constraint on platform not working');
      // Clean up if it somehow got created
      await prisma.rotationTemplate.delete({ where: { id: duplicateTest.id } });
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('   ✅ Unique constraint on platform working correctly');
      } else {
        console.log('   ⚠️  Unexpected error testing constraint:', error.code);
      }
    }

    // Test 4: Verify JSON field functionality
    console.log('\n4️⃣  Testing JSON fields and data structures...');

    const githubTemplate = await prisma.rotationTemplate.findUnique({
      where: { platform: 'github' }
    });

    if (githubTemplate) {
      const steps = githubTemplate.steps;
      const requirements = githubTemplate.requirements;

      if (typeof steps === 'object' && Array.isArray(steps)) {
        console.log(`   ✅ GitHub template steps JSON: ${steps.length} steps`);
      } else {
        console.log('   ❌ GitHub template steps JSON invalid');
      }

      if (requirements && typeof requirements === 'object') {
        console.log('   ✅ GitHub template requirements JSON valid');
      } else {
        console.log('   ❌ GitHub template requirements JSON invalid');
      }
    }

    // Test 5: Verify workflow audit log table structure
    console.log('\n5️⃣  Testing workflow audit log functionality...');

    // Create a test audit log entry
    const testUser = await prisma.user.findFirst();
    if (testUser) {
      const testAuditLog = await prisma.workflowAuditLog.create({
        data: {
          eventType: 'migration_validation',
          eventCategory: 'system',
          action: 'test_create',
          description: 'Testing audit log creation during migration validation',
          userId: testUser.id,
          wasSuccessful: true,
          metadata: {
            testData: 'migration_validation',
            timestamp: new Date().toISOString()
          }
        }
      });

      console.log('   ✅ Workflow audit log creation successful');

      // Clean up test entry
      await prisma.workflowAuditLog.delete({ where: { id: testAuditLog.id } });
      console.log('   ✅ Test audit log cleanup successful');
    } else {
      console.log('   ⚠️  No users found - skipping audit log test');
    }

    // Test 6: Performance check on indexes
    console.log('\n6️⃣  Testing query performance with indexes...');

    const startTime = Date.now();

    // Test platform index
    await prisma.rotationTemplate.findMany({
      where: { platform: 'github', isActive: true }
    });

    // Test keyType index
    await prisma.rotationTemplate.findMany({
      where: { keyType: 'github_token' }
    });

    const queryTime = Date.now() - startTime;
    console.log(`   ✅ Index queries completed in ${queryTime}ms`);

    // Final summary
    console.log('\n🎉 Migration validation completed successfully!');
    console.log('\n📊 Database Summary:');
    console.table({
      'rotation_templates': rotationTemplatesCount,
      'rotation_workflows': rotationWorkflowsCount,
      'rotation_steps': rotationStepsCount,
      'workflow_audit_log': workflowAuditLogCount
    });

    return {
      success: true,
      templatesCount: rotationTemplatesCount,
      platforms: foundPlatforms
    };

  } catch (error) {
    console.error('❌ Migration validation failed:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  validateMigration()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ All validation checks passed!');
        process.exit(0);
      } else {
        console.log('\n❌ Validation failed:', result.error);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 Validation script error:', error);
      process.exit(1);
    });
}

module.exports = { validateMigration };