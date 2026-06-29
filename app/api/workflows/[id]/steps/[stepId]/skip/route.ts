import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = Promise<{
  id: string
  stepId: string
}>

// POST /api/workflows/[id]/steps/[stepId]/skip - Skip a workflow step
export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId, stepId } = await context.params
    const body = await request.json()
    const { reason } = body

    // Validate workflow exists and belongs to user
    const workflow = await prisma.rotationWorkflow.findFirst({
      where: {
        id: workflowId,
        userId: session.user.id,
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' }
        }
      }
    })

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Find the specific step
    const step = workflow.steps.find(s => s.id === stepId)
    if (!step) {
      return NextResponse.json(
        { success: false, error: 'Step not found' },
        { status: 404 }
      )
    }

    // Validate step can be skipped
    if (step.isRequired) {
      return NextResponse.json(
        { success: false, error: 'Required steps cannot be skipped' },
        { status: 400 }
      )
    }

    if (step.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Cannot skip a completed step' },
        { status: 400 }
      )
    }

    if (step.status === 'skipped') {
      return NextResponse.json(
        { success: false, error: 'Step is already skipped' },
        { status: 400 }
      )
    }

    // Update step status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Mark step as skipped
      const updatedStep = await tx.rotationStep.update({
        where: { id: stepId },
        data: {
          status: 'skipped',
          completedAt: new Date(), // terminal timestamp; `status` marks it skipped
          notes: typeof reason === 'string' ? reason : null,
        }
      })

      // Calculate workflow progress
      const allSteps = await tx.rotationStep.findMany({
        where: { workflowId: workflowId },
        orderBy: { stepNumber: 'asc' }
      })

      const completedSteps = allSteps.filter(s => s.status === 'completed' || s.status === 'skipped')
      const progress = Math.floor((completedSteps.length / allSteps.length) * 100)

      // Find current step (first uncompleted required step)
      const nextIncompleteStep = allSteps.find(s =>
        s.status === 'pending' && s.isRequired
      )
      const currentStep = nextIncompleteStep ? nextIncompleteStep.stepNumber : allSteps.length

      // Update workflow progress
      const workflowUpdate: any = {
        progress,
        currentStep,
        lastModifiedBy: session.user.id,
        updatedAt: new Date(),
      }

      // Check if all required steps are completed (skipped optional steps don't block completion)
      const allRequiredSteps = allSteps.filter(s => s.isRequired)
      const completedRequiredSteps = allRequiredSteps.filter(s => s.status === 'completed')

      if (completedRequiredSteps.length === allRequiredSteps.length) {
        workflowUpdate.status = 'completed'
        workflowUpdate.completedAt = new Date()
        if (workflow.startedAt) {
          workflowUpdate.actualDuration = Math.floor(
            (new Date().getTime() - workflow.startedAt.getTime()) / (1000 * 60)
          )
        }
      }

      const updatedWorkflow = await tx.rotationWorkflow.update({
        where: { id: workflowId },
        data: workflowUpdate,
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' }
          }
        }
      })

      return { updatedStep, updatedWorkflow }
    })

    // Log activity
    await prisma.activity.create({
      data: {
        action: 'step_skipped',
        description: `Skipped step "${step.name}" in workflow "${workflow.name}". Reason: ${reason || 'No reason provided'}`,
        userId: session.user.id,
      },
    })

    // If workflow is now completed, handle completion side effects
    if (result.updatedWorkflow.status === 'completed') {
      await prisma.activity.create({
        data: {
          action: 'workflow_completed',
          description: `Completed rotation workflow: ${workflow.name}`,
          userId: session.user.id,
        },
      })

      // Update discovered key status if applicable
      if (workflow.discoveredKeyId) {
        await prisma.discoveredKey.update({
          where: { id: workflow.discoveredKeyId },
          data: {
            status: 'rotated',
            rotatedAt: new Date(),
            userNotes: `Key rotated via workflow: ${workflow.name}`,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        step: result.updatedStep,
        workflow: result.updatedWorkflow,
      },
      message: 'Step skipped successfully',
    })

  } catch (error) {
    console.error('Error skipping step:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}