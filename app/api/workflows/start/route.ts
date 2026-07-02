import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createWorkflowFromTemplate, getEstimatedDuration } from '@/lib/workflow-templates'

/**
 * POST /api/workflows/start
 *
 * Starts a rotation workflow for a discovered key.
 * Creates the workflow, generates steps from template, and updates key status.
 *
 * Request body:
 * - discoveredKeyId: ID of the discovered key to rotate
 * - autoStart: (optional) Whether to immediately start the workflow
 * - priority: (optional) Priority level (low, medium, high, critical)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await request.json()
    const {
      discoveredKeyId,
      autoStart = false,
      priority = 'high'
    } = body

    // 3. Validate required fields
    if (!discoveredKeyId) {
      return NextResponse.json(
        { error: 'discoveredKeyId is required' },
        { status: 400 }
      )
    }

    // 4. Fetch the discovered key (shared workspace: look up by id only)
    const discoveredKey = await prisma.discoveredKey.findFirst({
      where: {
        id: discoveredKeyId
      },
      include: {
        platformRef: {
          select: { id: true, name: true, type: true }
        }
      }
    })

    if (!discoveredKey) {
      return NextResponse.json(
        { error: 'Key not found or access denied' },
        { status: 404 }
      )
    }

    // 5. Check if there's already an active workflow for this key (shared workspace)
    const existingWorkflow = await prisma.rotationWorkflow.findFirst({
      where: {
        discoveredKeyId,
        status: { in: ['pending', 'in_progress', 'paused'] },
      },
    })

    if (existingWorkflow) {
      return NextResponse.json(
        {
          error: 'This key already has an active rotation workflow',
          workflowId: existingWorkflow.id
        },
        { status: 409 }
      )
    }

    // 6. Create workflow with steps in a transaction
    const workflow = await prisma.$transaction(async (tx) => {
      // Create the workflow
      const newWorkflow = await tx.rotationWorkflow.create({
        data: {
          name: `Rotate ${discoveredKey.keyName}`,
          description: `Guided rotation workflow for ${discoveredKey.keyType} API key`,
          keyType: discoveredKey.keyType,
          keyName: discoveredKey.keyName,
          keyPreview: discoveredKey.keyPreview,
          priority,
          platformId: discoveredKey.platformId,
          discoveredKeyId,
          rotationType: 'manual',
          automationLevel: 'guided',
          estimatedDuration: getEstimatedDuration(discoveredKey.keyType),
          status: autoStart ? 'in_progress' : 'pending',
          startedAt: autoStart ? new Date() : null,
          userId: session.user.id,
          createdBy: session.user.id,
          lastModifiedBy: session.user.id,
        },
      })

      // Create workflow steps from template
      const templateSteps = await createWorkflowFromTemplate(discoveredKey.keyType)
      const createdSteps = await Promise.all(
        templateSteps.map((step, index) =>
          tx.rotationStep.create({
            data: {
              workflowId: newWorkflow.id,
              stepNumber: index + 1,
              name: step.name,
              description: step.description,
              stepType: step.stepType,
              instructions: step.instructions,
              isRequired: step.isRequired,
              isAutomated: step.isAutomated,
              validationRules: step.validationRules ? JSON.stringify(step.validationRules) : null,
              dependsOnSteps: step.dependsOnSteps || [],
              blocksSteps: step.blocksSteps || [],
            },
          })
        )
      )

      // Update workflow with total steps count
      const updatedWorkflow = await tx.rotationWorkflow.update({
        where: { id: newWorkflow.id },
        data: {
          totalSteps: createdSteps.length,
          currentStep: autoStart ? 1 : 0,
        },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' },
            select: {
              id: true,
              stepNumber: true,
              name: true,
              description: true,
              stepType: true,
              status: true,
              isRequired: true,
            },
          },
          discoveredKey: {
            select: {
              id: true,
              keyName: true,
              platform: true,
              severity: true,
              location: true,
            },
          },
          platform: {
            select: {
              id: true,
              name: true,
              type: true,
              category: true,
            },
          },
        },
      })

      return updatedWorkflow
    })

    // 7. Update discovered key status
    await prisma.discoveredKey.update({
      where: { id: discoveredKeyId },
      data: {
        status: 'in_rotation',
        userNotes: `Rotation workflow created: ${workflow.name}`,
      },
    })

    // 8. Log activity
    await prisma.activity.create({
      data: {
        action: autoStart ? 'workflow_started' : 'workflow_created',
        description: autoStart
          ? `Started rotation workflow: ${workflow.name}`
          : `Created rotation workflow: ${workflow.name}`,
        userId: session.user.id,
      },
    })

    // 9. Return success response
    return NextResponse.json({
      success: true,
      data: {
        workflow,
        autoStarted: autoStart,
      },
      message: autoStart
        ? 'Workflow created and started successfully'
        : 'Workflow created successfully',
    })

  } catch (error) {
    console.error('Error starting workflow:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
