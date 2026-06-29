#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testWorkflowCreation() {
  try {
    console.log('🧪 Testing rotation workflow creation...\n');

    // Get or create a test user
    let testUser = await prisma.user.findFirst({
      where: { email: { contains: '@' } }
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test@keystrok.dev',
          name: 'Test User'
        }
      });
      console.log('✅ Created test user for workflow testing');
    } else {
      console.log(`✅ Using existing user: ${testUser.email}`);
    }

    // Test 1: Get available templates
    console.log('\n1️⃣  Testing template retrieval...');
    const templates = await prisma.rotationTemplate.findMany({
      where: { isActive: true },
      orderBy: { platform: 'asc' }
    });

    if (templates.length === 6) {
      console.log(`   ✅ Retrieved ${templates.length} active templates`);
      templates.forEach(template => {
        console.log(`   📋 ${template.platform}: ${template.name} (${template.estimatedTime}min)`);
      });
    } else {
      throw new Error(`Expected 6 templates, found ${templates.length}`);
    }

    // Test 2: Create a workflow from template
    console.log('\n2️⃣  Testing workflow creation from GitHub template...');
    const githubTemplate = templates.find(t => t.platform === 'github');

    const testWorkflow = await prisma.rotationWorkflow.create({
      data: {
        name: 'Test GitHub Token Rotation',
        description: 'Automated test of GitHub token rotation workflow',
        keyName: 'GitHub API Token (Test)',
        keyType: 'github_token',
        keyPreview: 'ghp_****...test123',
        rotationType: 'manual',
        userId: testUser.id,
        createdBy: testUser.id,
        lastModifiedBy: testUser.id,
        status: 'pending',
        priority: 'medium',
        totalSteps: githubTemplate.steps.length,
        estimatedDuration: githubTemplate.estimatedTime
      }
    });

    console.log(`   ✅ Created workflow: ${testWorkflow.id}`);

    // Test 3: Create workflow steps from template
    console.log('\n3️⃣  Testing workflow steps creation...');
    const templateSteps = githubTemplate.steps;

    for (let i = 0; i < templateSteps.length; i++) {
      const templateStep = templateSteps[i];

      const workflowStep = await prisma.rotationStep.create({
        data: {
          workflowId: testWorkflow.id,
          stepNumber: templateStep.stepNumber,
          name: templateStep.name,
          description: templateStep.description,
          stepType: templateStep.stepType,
          isRequired: templateStep.isRequired,
          isAutomated: templateStep.isAutomated,
          instructions: templateStep.instructions,
          status: 'pending'
        }
      });

      console.log(`   ✅ Created step ${templateStep.stepNumber}: ${templateStep.name}`);
    }

    // Test 4: Create workflow audit log entry
    console.log('\n4️⃣  Testing workflow audit logging...');
    const auditEntry = await prisma.workflowAuditLog.create({
      data: {
        workflowId: testWorkflow.id,
        eventType: 'workflow_created',
        eventCategory: 'workflow',
        action: 'create_from_template',
        description: `Created workflow "${testWorkflow.name}" from GitHub template`,
        userId: testUser.id,
        wasSuccessful: true,
        metadata: {
          templateId: githubTemplate.id,
          templatePlatform: githubTemplate.platform,
          workflowName: testWorkflow.name,
          estimatedDuration: githubTemplate.estimatedTime,
          stepCount: templateSteps.length
        }
      }
    });

    console.log(`   ✅ Created audit log entry: ${auditEntry.id}`);

    // Test 5: Verify complete workflow structure
    console.log('\n5️⃣  Verifying complete workflow structure...');

    const completeWorkflow = await prisma.rotationWorkflow.findUnique({
      where: { id: testWorkflow.id },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' }
        },
        user: {
          select: { email: true, name: true }
        }
      }
    });

    if (completeWorkflow && completeWorkflow.steps.length === templateSteps.length) {
      console.log(`   ✅ Workflow has correct structure:`);
      console.log(`   📝 Name: ${completeWorkflow.name}`);
      console.log(`   👤 User: ${completeWorkflow.user.email}`);
      console.log(`   📊 Status: ${completeWorkflow.status}`);
      console.log(`   🔧 Steps: ${completeWorkflow.steps.length}`);
      console.log(`   ⏱️  Estimated time: ${completeWorkflow.estimatedDuration} minutes`);
    } else {
      throw new Error('Workflow structure validation failed');
    }

    // Test 6: Test workflow step operations
    console.log('\n6️⃣  Testing workflow step operations...');

    // Start first step
    const firstStep = completeWorkflow.steps[0];
    const updatedStep = await prisma.rotationStep.update({
      where: { id: firstStep.id },
      data: {
        status: 'in_progress',
        startedAt: new Date()
      }
    });

    console.log(`   ✅ Started step 1: ${updatedStep.name}`);

    // Complete first step
    await prisma.rotationStep.update({
      where: { id: firstStep.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: 'success',
        output: 'Test step completed successfully'
      }
    });

    console.log(`   ✅ Completed step 1: ${firstStep.name}`);

    // Update workflow progress
    await prisma.rotationWorkflow.update({
      where: { id: testWorkflow.id },
      data: {
        currentStep: 2,
        progress: 1.0 / templateSteps.length, // 1 step out of total
        status: 'in_progress',
        startedAt: new Date()
      }
    });

    console.log(`   ✅ Updated workflow progress`);

    // Test 7: Test template usage analytics
    console.log('\n7️⃣  Testing template analytics update...');

    await prisma.rotationTemplate.update({
      where: { id: githubTemplate.id },
      data: {
        usageCount: { increment: 1 },
        avgDuration: 18 // Simulated average duration
      }
    });

    console.log(`   ✅ Updated template usage statistics`);

    // Test 8: Query workflow by different filters
    console.log('\n8️⃣  Testing workflow query capabilities...');

    // Query by status
    const activeWorkflows = await prisma.rotationWorkflow.count({
      where: {
        status: 'in_progress',
        userId: testUser.id
      }
    });

    // Query by key type
    const githubWorkflows = await prisma.rotationWorkflow.count({
      where: {
        keyType: 'github_token',
        userId: testUser.id
      }
    });

    // Query by priority
    const mediumPriorityWorkflows = await prisma.rotationWorkflow.count({
      where: {
        priority: 'medium',
        userId: testUser.id
      }
    });

    console.log(`   ✅ Active workflows: ${activeWorkflows}`);
    console.log(`   ✅ GitHub workflows: ${githubWorkflows}`);
    console.log(`   ✅ Medium priority workflows: ${mediumPriorityWorkflows}`);

    // Test 9: Clean up test data
    console.log('\n9️⃣  Cleaning up test data...');

    // Delete audit logs first (foreign key constraint)
    await prisma.workflowAuditLog.deleteMany({
      where: { workflowId: testWorkflow.id }
    });

    // Delete workflow steps (foreign key constraint)
    await prisma.rotationStep.deleteMany({
      where: { workflowId: testWorkflow.id }
    });

    // Delete workflow
    await prisma.rotationWorkflow.delete({
      where: { id: testWorkflow.id }
    });

    console.log(`   ✅ Cleaned up test workflow and related data`);

    // Final summary
    console.log('\n🎉 Workflow creation test completed successfully!');

    const finalStats = {
      templates_available: templates.length,
      workflow_created: true,
      steps_created: templateSteps.length,
      audit_logging: true,
      progress_tracking: true,
      cleanup_successful: true
    };

    console.log('\n📊 Test Results Summary:');
    console.table(finalStats);

    return {
      success: true,
      templatesCount: templates.length,
      testWorkflowId: testWorkflow.id
    };

  } catch (error) {
    console.error('❌ Workflow creation test failed:', error);
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
  testWorkflowCreation()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ All workflow creation tests passed!');
        process.exit(0);
      } else {
        console.log('\n❌ Workflow creation test failed:', result.error);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 Test script error:', error);
      process.exit(1);
    });
}

module.exports = { testWorkflowCreation };