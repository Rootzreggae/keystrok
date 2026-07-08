import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createWorkflowFromTemplate } from '@/lib/workflow-templates'
import { getWorkflowList } from '@/lib/workflows'

// GET /api/workflows - List all workflows for the authenticated user.
// Query + stats live in lib/workflows.ts, shared with the SSR prefetch.
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    const { workflows, stats } = await getWorkflowList({
      status: searchParams.get('status'),
      platform: searchParams.get('platform'),
      priority: searchParams.get('priority'),
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    })

    return NextResponse.json({
      success: true,
      data: {
        workflows,
        stats,
        total: workflows.length,
      },
    })

  } catch (error) {
    console.error('Error fetching workflows:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// POST /api/workflows - Create a new workflow
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      keyType,
      keyName,
      keyPreview,
      priority = 'medium',
      estimatedDuration,
      platformId,
      discoveredKeyId,
      templateType = 'custom',
    } = body

    // Validate required fields
    if (!name?.trim() || !keyType?.trim() || !keyName?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Name, key type, and key name are required' },
        { status: 400 }
      )
    }

    // Validate platform and discovered key if provided (shared workspace: look up by id only)
    if (platformId) {
      const platform = await prisma.platform.findFirst({
        where: { id: platformId },
      })
      if (!platform) {
        return NextResponse.json(
          { success: false, error: 'Platform not found' },
          { status: 404 }
        )
      }
    }

    if (discoveredKeyId) {
      const discoveredKey = await prisma.discoveredKey.findFirst({
        where: { id: discoveredKeyId },
      })
      if (!discoveredKey) {
        return NextResponse.json(
          { success: false, error: 'Discovered key not found' },
          { status: 404 }
        )
      }
    }

    // Create workflow with steps
    const workflow = await prisma.$transaction(async (tx) => {
      // Create the workflow
      const newWorkflow = await tx.rotationWorkflow.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          status: 'pending',
          keyType,
          keyName,
          keyPreview: keyPreview || keyName.slice(0, 8) + '****',
          priority,
          estimatedDuration,
          platformId: platformId || null,
          discoveredKeyId: discoveredKeyId || null,
          rotationType: 'manual',
          automationLevel: 'guided',
          userId: session.user.id,
          createdBy: session.user.id,
          lastModifiedBy: session.user.id,
        },
      })

      // Create workflow steps based on template
      const steps = await createWorkflowFromTemplate(keyType, templateType)
      const createdSteps = await Promise.all(
        steps.map((step, index) =>
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
        data: { totalSteps: createdSteps.length },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' },
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

    // Log activity
    await prisma.activity.create({
      data: {
        action: 'workflow_created',
        description: `Created new rotation workflow: ${workflow.name}`,
        userId: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: { workflow },
      message: 'Workflow created successfully',
    })

  } catch (error) {
    console.error('Error creating workflow:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

