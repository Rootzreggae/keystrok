import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/roles'
import { isDestructiveStep } from '@/lib/rotation-policy'
import { acceptanceHolds } from '@/lib/blast-radius'

type Params = Promise<{
  id: string
  stepId: string
}>

// POST /api/workflows/[id]/steps/[stepId]/complete - Mark a workflow step as completed
export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: workflowId, stepId } = await context.params
    const body = await request.json()
    const { userNotes } = body

    // Validate workflow exists (shared workspace: look up by id only)
    const workflow = await prisma.rotationWorkflow.findFirst({
      where: {
        id: workflowId,
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

    // The irreversible step (revoke/disable/remove the old key) is admin-only;
    // any other step stays open to any signed-in member.
    if (isDestructiveStep(step)) {
      const denied = await requireAdmin(session.user.id)
      if (denied) return denied

      // Revoke gate: an accepted break was signed against a traffic snapshot.
      // If the platform has seen the key used since, the unknown consumer is
      // not the one the operator looked at; the acceptance no longer holds and
      // the gate re-asks instead of letting the revoke ride on stale evidence.
      if (workflow.discoveredKeyId) {
        const key = await prisma.discoveredKey.findUnique({
          where: { id: workflow.discoveredKeyId },
          select: { breakAcceptedAt: true, breakAcceptedLastUsedAt: true, lastUsedAt: true },
        })
        if (key?.breakAcceptedAt && !acceptanceHolds(key.breakAcceptedLastUsedAt, key.lastUsedAt)) {
          return NextResponse.json(
            {
              success: false,
              error: `Traffic changed since you accepted the break (the key was used again ${key.lastUsedAt ? key.lastUsedAt.toISOString() : ''}). Re-read the blast radius and accept again before revoking.`,
            },
            { status: 409 }
          )
        }
      }
    }

    // Validate step can be completed
    if (step.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Step is already completed' },
        { status: 400 }
      )
    }

    if (step.status === 'skipped') {
      return NextResponse.json(
        { success: false, error: 'Cannot complete a skipped step' },
        { status: 400 }
      )
    }

    // Check if all dependency steps are completed
    if (step.dependsOnSteps && step.dependsOnSteps.length > 0) {
      const dependencySteps = workflow.steps.filter(s =>
        step.dependsOnSteps!.includes(s.stepNumber)
      )
      const incompleteDependencies = dependencySteps.filter(s =>
        s.status !== 'completed' && s.status !== 'skipped'
      )

      if (incompleteDependencies.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot complete this step. Dependency steps must be completed first: ${incompleteDependencies.map(s => s.name).join(', ')}`
          },
          { status: 400 }
        )
      }
    }

    // Update step status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Mark step as completed
      const updatedStep = await tx.rotationStep.update({
        where: { id: stepId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          notes: typeof userNotes === 'string' ? userNotes : null,
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

      // If all required steps are completed, mark workflow as completed
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
        action: 'step_completed',
        description: `Completed step "${step.name}" in workflow "${workflow.name}"`,
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

    // The re-verified moment: after the revoke step (and after rotatedAt lands,
    // so the evidence counts as post-rotation for rotationFailed()), run a
    // liveness pass instead of waiting for the next scheduled check. Best-effort:
    // a failed check never undoes the completed step.
    if (isDestructiveStep(step) && workflow.discoveredKeyId) {
      try {
        const { runLivenessCheck } = await import('@/lib/liveness-runner')
        await runLivenessCheck({ actorId: session.user.id })
      } catch (e) {
        console.error('post-revoke liveness re-check failed:', e)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        step: result.updatedStep,
        workflow: result.updatedWorkflow,
      },
      message: 'Step completed successfully',
    })

  } catch (error) {
    console.error('Error completing step:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}