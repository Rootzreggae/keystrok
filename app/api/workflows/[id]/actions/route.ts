import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = Promise<{
  id: string
}>

// POST /api/workflows/[id]/actions - Execute workflow actions
export async function POST(request: NextRequest, context: { params: Params }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { action, ...actionData } = body

    // Validate workflow exists and belongs to user
    const workflow = await prisma.rotationWorkflow.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Handle different actions
    switch (action) {
      case 'start':
        return await handleStartWorkflow(workflow, session.user.id)

      case 'pause':
        return await handlePauseWorkflow(workflow, session.user.id, actionData.reason)

      case 'resume':
        return await handleResumeWorkflow(workflow, session.user.id)

      case 'cancel':
        return await handleCancelWorkflow(workflow, session.user.id, actionData.reason)

      case 'retry':
        return await handleRetryWorkflow(workflow, session.user.id)

      case 'start_step':
        return await handleStartStep(workflow, session.user.id, actionData.stepNumber)

      case 'complete_step':
        return await handleCompleteStep(workflow, session.user.id, actionData)

      case 'fail_step':
        return await handleFailStep(workflow, session.user.id, actionData)

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error executing workflow action:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

// Helper functions for different actions
async function handleStartWorkflow(workflow: any, userId: string) {
  if (workflow.status !== 'pending') {
    return NextResponse.json(
      { success: false, error: 'Workflow is not in pending state' },
      { status: 400 }
    )
  }

  const updatedWorkflow = await prisma.rotationWorkflow.update({
    where: { id: workflow.id },
    data: {
      status: 'in_progress',
      startedAt: new Date(),
      lastModifiedBy: userId,
      updatedAt: new Date(),
    },
  })

  await prisma.activity.create({
    data: {
      action: 'workflow_started',
      description: `Started workflow: ${workflow.name}`,
      userId,
    },
  })

  return NextResponse.json({
    success: true,
    data: { workflow: updatedWorkflow },
    message: 'Workflow started successfully',
  })
}

async function handlePauseWorkflow(workflow: any, userId: string, reason?: string) {
  if (!['in_progress', 'pending'].includes(workflow.status)) {
    return NextResponse.json(
      { success: false, error: 'Can only pause in-progress or pending workflows' },
      { status: 400 }
    )
  }

  const updatedWorkflow = await prisma.rotationWorkflow.update({
    where: { id: workflow.id },
    data: {
      status: 'paused',
      pausedAt: new Date(),
      errorMessage: reason || null,
      lastModifiedBy: userId,
      updatedAt: new Date(),
    },
  })

  await prisma.activity.create({
    data: {
      action: 'workflow_paused',
      description: `Paused workflow: ${workflow.name}${reason ? ` - ${reason}` : ''}`,
      userId,
    },
  })

  return NextResponse.json({
    success: true,
    data: { workflow: updatedWorkflow },
    message: 'Workflow paused successfully',
  })
}

async function handleResumeWorkflow(workflow: any, userId: string) {
  if (workflow.status !== 'paused') {
    return NextResponse.json(
      { success: false, error: 'Workflow is not paused' },
      { status: 400 }
    )
  }

  const updatedWorkflow = await prisma.rotationWorkflow.update({
    where: { id: workflow.id },
    data: {
      status: 'in_progress',
      pausedAt: null,
      errorMessage: null,
      lastModifiedBy: userId,
      updatedAt: new Date(),
    },
  })

  await prisma.activity.create({
    data: {
      action: 'workflow_resumed',
      description: `Resumed workflow: ${workflow.name}`,
      userId,
    },
  })

  return NextResponse.json({
    success: true,
    data: { workflow: updatedWorkflow },
    message: 'Workflow resumed successfully',
  })
}

async function handleCancelWorkflow(workflow: any, userId: string, reason?: string) {
  if (['completed', 'cancelled'].includes(workflow.status)) {
    return NextResponse.json(
      { success: false, error: 'Cannot cancel a completed or already cancelled workflow' },
      { status: 400 }
    )
  }

  await prisma.$transaction(async (tx) => {
    // Update workflow status
    await tx.rotationWorkflow.update({
      where: { id: workflow.id },
      data: {
        status: 'cancelled',
        errorMessage: reason || 'Workflow cancelled by user',
        lastModifiedBy: userId,
        updatedAt: new Date(),
      },
    })

    // Cancel any in-progress steps
    await tx.rotationStep.updateMany({
      where: {
        workflowId: workflow.id,
        status: 'in_progress',
      },
      data: {
        status: 'cancelled',
        errorMessage: 'Workflow was cancelled',
        updatedAt: new Date(),
      },
    })
  })

  await prisma.activity.create({
    data: {
      action: 'workflow_cancelled',
      description: `Cancelled workflow: ${workflow.name}${reason ? ` - ${reason}` : ''}`,
      userId,
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Workflow cancelled successfully',
  })
}

async function handleRetryWorkflow(workflow: any, userId: string) {
  if (workflow.status !== 'failed') {
    return NextResponse.json(
      { success: false, error: 'Only failed workflows can be retried' },
      { status: 400 }
    )
  }

  if (workflow.retryCount >= workflow.maxRetries) {
    return NextResponse.json(
      { success: false, error: 'Maximum retry attempts exceeded' },
      { status: 400 }
    )
  }

  const updatedWorkflow = await prisma.$transaction(async (tx) => {
    // Update workflow
    const updated = await tx.rotationWorkflow.update({
      where: { id: workflow.id },
      data: {
        status: 'in_progress',
        retryCount: workflow.retryCount + 1,
        errorMessage: null,
        lastModifiedBy: userId,
        updatedAt: new Date(),
      },
    })

    // Reset failed steps to pending
    await tx.rotationStep.updateMany({
      where: {
        workflowId: workflow.id,
        status: 'failed',
      },
      data: {
        status: 'pending',
        errorMessage: null,
        startedAt: null,
        updatedAt: new Date(),
      },
    })

    return updated
  })

  await prisma.activity.create({
    data: {
      action: 'workflow_retried',
      description: `Retried failed workflow: ${workflow.name} (attempt ${workflow.retryCount + 1}/${workflow.maxRetries})`,
      userId,
    },
  })

  return NextResponse.json({
    success: true,
    data: { workflow: updatedWorkflow },
    message: 'Workflow retry initiated successfully',
  })
}

async function handleStartStep(workflow: any, userId: string, stepNumber: number) {
  if (!stepNumber || stepNumber < 1 || stepNumber > workflow.totalSteps) {
    return NextResponse.json(
      { success: false, error: 'Invalid step number' },
      { status: 400 }
    )
  }

  const step = await prisma.rotationStep.findFirst({
    where: {
      workflowId: workflow.id,
      stepNumber,
    },
  })

  if (!step) {
    return NextResponse.json(
      { success: false, error: 'Step not found' },
      { status: 404 }
    )
  }

  if (step.status !== 'pending') {
    return NextResponse.json({
      success: true,
      message: 'Step already started',
      data: { step },
    })
  }

  // Check dependencies
  if (step.dependsOnSteps.length > 0) {
    const dependentSteps = await prisma.rotationStep.findMany({
      where: {
        workflowId: workflow.id,
        stepNumber: { in: step.dependsOnSteps },
      },
    })

    const incompleteDeps = dependentSteps.filter(dep => dep.status !== 'completed')
    if (incompleteDeps.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot start step: dependencies not met (steps ${incompleteDeps.map(s => s.stepNumber).join(', ')})` 
        },
        { status: 400 }
      )
    }
  }

  const updatedStep = await prisma.rotationStep.update({
    where: { id: step.id },
    data: {
      status: 'in_progress',
      startedAt: new Date(),
      updatedAt: new Date(),
    },
  })

  // Update workflow to in_progress if not already
  await prisma.rotationWorkflow.updateMany({
    where: {
      id: workflow.id,
      status: 'pending',
    },
    data: {
      status: 'in_progress',
      startedAt: new Date(),
      lastModifiedBy: userId,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({
    success: true,
    data: { step: updatedStep },
    message: 'Step started successfully',
  })
}

async function handleCompleteStep(workflow: any, userId: string, actionData: any) {
  const { stepNumber, result, output, duration } = actionData

  if (!stepNumber || stepNumber < 1 || stepNumber > workflow.totalSteps) {
    return NextResponse.json(
      { success: false, error: 'Invalid step number' },
      { status: 400 }
    )
  }

  const step = await prisma.rotationStep.findFirst({
    where: {
      workflowId: workflow.id,
      stepNumber,
    },
  })

  if (!step) {
    return NextResponse.json(
      { success: false, error: 'Step not found' },
      { status: 404 }
    )
  }

  if (step.status === 'completed') {
    return NextResponse.json({
      success: true,
      message: 'Step already completed',
      data: { step },
    })
  }

  // Check dependencies
  if (step.dependsOnSteps.length > 0) {
    const dependentSteps = await prisma.rotationStep.findMany({
      where: {
        workflowId: workflow.id,
        stepNumber: { in: step.dependsOnSteps },
      },
    })

    const incompleteDeps = dependentSteps.filter(dep => dep.status !== 'completed')
    if (incompleteDeps.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot complete step: dependencies not met (steps ${incompleteDeps.map(s => s.stepNumber).join(', ')})` 
        },
        { status: 400 }
      )
    }
  }

  const updateData: any = {
    status: 'completed',
    completedAt: new Date(),
    updatedAt: new Date(),
  }

  if (result !== undefined) {
    updateData.result = result
  }
  if (output !== undefined) {
    updateData.output = output
  }
  if (duration !== undefined) {
    updateData.duration = duration
  } else if (step.startedAt) {
    updateData.duration = Math.floor(
      (new Date().getTime() - step.startedAt.getTime()) / 1000
    )
  }

  // Update step
  const updatedStep = await prisma.rotationStep.update({
    where: { id: step.id },
    data: updateData,
  })

  // Calculate workflow progress
  const allSteps = await prisma.rotationStep.findMany({
    where: { workflowId: workflow.id },
    select: { status: true, isRequired: true },
  })

  const completedRequiredSteps = allSteps.filter(s => s.isRequired && s.status === 'completed')
  const requiredSteps = allSteps.filter(s => s.isRequired)
  const progress = requiredSteps.length > 0 ? completedRequiredSteps.length / requiredSteps.length : 1

  // Check if workflow is complete
  const isWorkflowComplete = completedRequiredSteps.length === requiredSteps.length

  // Update workflow progress and status
  const updatedWorkflow = await prisma.rotationWorkflow.update({
    where: { id: workflow.id },
    data: {
      progress,
      status: isWorkflowComplete ? 'completed' : 'in_progress',
      currentStep: stepNumber < workflow.totalSteps ? stepNumber + 1 : stepNumber,
      completedAt: isWorkflowComplete ? new Date() : null,
      lastModifiedBy: userId,
      updatedAt: new Date(),
      ...(isWorkflowComplete && workflow.startedAt ? {
        actualDuration: Math.floor(
          (new Date().getTime() - workflow.startedAt.getTime()) / (1000 * 60)
        )
      } : {}),
    },
  })

  // Log activity
  await prisma.activity.create({
    data: {
      action: 'workflow_step_completed',
      description: `Completed step ${stepNumber}: ${step.name}`,
      userId,
    },
  })

  // If workflow is complete, update discovered key status if linked
  if (isWorkflowComplete && workflow.discoveredKeyId) {
    await prisma.discoveredKey.update({
      where: { id: workflow.discoveredKeyId },
      data: { 
        status: 'rotated',
        rotatedAt: new Date(),
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: { 
      step: updatedStep,
      workflow: updatedWorkflow,
      workflowCompleted: isWorkflowComplete,
      progress: progress,
    },
    message: isWorkflowComplete ? 'Step completed and workflow finished!' : 'Step completed successfully',
  })
}

async function handleFailStep(workflow: any, userId: string, actionData: any) {
  const { stepNumber, errorMessage, output } = actionData

  if (!stepNumber || stepNumber < 1 || stepNumber > workflow.totalSteps) {
    return NextResponse.json(
      { success: false, error: 'Invalid step number' },
      { status: 400 }
    )
  }

  const step = await prisma.rotationStep.findFirst({
    where: {
      workflowId: workflow.id,
      stepNumber,
    },
  })

  if (!step) {
    return NextResponse.json(
      { success: false, error: 'Step not found' },
      { status: 404 }
    )
  }

  const updateData: any = {
    status: 'failed',
    errorMessage: errorMessage || 'Step failed',
    updatedAt: new Date(),
  }

  if (output !== undefined) {
    updateData.output = output
  }

  if (step.startedAt) {
    updateData.duration = Math.floor(
      (new Date().getTime() - step.startedAt.getTime()) / 1000
    )
  }

  // Update step
  const updatedStep = await prisma.rotationStep.update({
    where: { id: step.id },
    data: updateData,
  })

  // Update workflow to failed status
  await prisma.rotationWorkflow.update({
    where: { id: workflow.id },
    data: {
      status: 'failed',
      errorMessage: `Step ${stepNumber} failed: ${errorMessage || 'Unknown error'}`,
      lastModifiedBy: userId,
      updatedAt: new Date(),
    },
  })

  // Log activity
  await prisma.activity.create({
    data: {
      action: 'workflow_step_failed',
      description: `Step ${stepNumber} failed: ${step.name}`,
      userId,
    },
  })

  return NextResponse.json({
    success: true,
    data: { step: updatedStep },
    message: 'Step marked as failed',
  })
}