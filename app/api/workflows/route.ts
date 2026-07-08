import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createWorkflowFromTemplate, getWorkflowTemplates } from '@/lib/workflow-templates'

// GET /api/workflows - List all workflows for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const platform = searchParams.get('platform')
    const priority = searchParams.get('priority')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    // Build where clause (shared workspace: no userId filter)
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (platform) {
      where.keyType = platform
    }

    if (priority) {
      where.priority = priority
    }

    // Query workflows with pagination
    const workflows = await prisma.rotationWorkflow.findMany({
      where,
      include: {
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
        steps: {
          // Full step shape so the rotations view renders entirely from this one
          // list call — no per-workflow detail round-trip (that waterfall was the
          // spinner-in-the-detail-pane on refresh). These 4 extra fields are the
          // only gap the old /workflows/[id] detail query filled.
          select: {
            id: true,
            stepNumber: true,
            name: true,
            status: true,
            isRequired: true,
            completedAt: true,
            description: true,
            instructions: true,
            isAutomated: true,
            stepType: true,
          },
          orderBy: { stepNumber: 'asc' },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit ? parseInt(limit) : undefined,
      skip: offset ? parseInt(offset) : undefined,
    })

    // Get summary statistics
    const stats = await prisma.rotationWorkflow.groupBy({
      by: ['status'],
      where: {},
      _count: { status: true },
    })

    const statusStats = stats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      data: {
        workflows,
        stats: statusStats,
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

