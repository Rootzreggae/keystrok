import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = Promise<{
  id: string
}>

// GET /api/workflows/[id] - Get specific workflow
export async function GET(request: NextRequest, context: { params: Params }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    const workflow = await prisma.rotationWorkflow.findFirst({
      where: {
        id,
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        discoveredKey: {
          select: {
            id: true,
            keyName: true,
            platform: true,
            status: true,
            severity: true,
            location: true,
            foundAt: true,
          },
        },
        platform: {
          select: {
            id: true,
            name: true,
            type: true,
            category: true,
            apiUrl: true,
          },
        },
      },
    })

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      workflow,
    })

  } catch (error) {
    console.error('Error fetching workflow:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

// PATCH /api/workflows/[id] - Update workflow
export async function PATCH(request: NextRequest, context: { params: Params }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()

    // Validate workflow exists (shared workspace: look up by id only)
    const existingWorkflow = await prisma.rotationWorkflow.findFirst({
      where: {
        id,
      },
    })

    if (!existingWorkflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Prevent updates to completed/cancelled workflows unless specifically allowed
    if (['completed', 'cancelled'].includes(existingWorkflow.status) && !body.allowCompletedUpdate) {
      return NextResponse.json(
        { success: false, error: 'Cannot update completed or cancelled workflow' },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: {
      lastModifiedBy: string
      updatedAt: Date
      name?: string
      description?: string | null
      priority?: string
      estimatedDuration?: number | null
      currentStep?: number
      progress?: number
      status?: string
      startedAt?: Date | null
      completedAt?: Date | null
      pausedAt?: Date | null
      errorMessage?: string | null
      actualDuration?: number
    } = {
      lastModifiedBy: session.user.id,
      updatedAt: new Date(),
    }

    // Validate and set allowed fields
    if (body.name?.trim()) {
      updateData.name = body.name.trim()
    }
    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null
    }
    if (body.priority && ['low', 'medium', 'high', 'critical'].includes(body.priority)) {
      updateData.priority = body.priority
    }
    if (body.estimatedDuration !== undefined) {
      updateData.estimatedDuration = body.estimatedDuration
    }
    if (body.currentStep !== undefined) {
      updateData.currentStep = Math.max(1, Math.min(body.currentStep, existingWorkflow.totalSteps))
    }
    if (body.progress !== undefined) {
      updateData.progress = Math.max(0, Math.min(1, body.progress))
    }

    // Handle status changes
    if (body.status) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'failed', 'paused', 'cancelled']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status' },
          { status: 400 }
        )
      }

      updateData.status = body.status

      // Set appropriate timestamps based on status
      switch (body.status) {
        case 'in_progress':
          if (!existingWorkflow.startedAt) {
            updateData.startedAt = new Date()
          }
          if (existingWorkflow.status === 'paused') {
            updateData.pausedAt = null // Resume from pause
          }
          break
        case 'completed':
          updateData.completedAt = new Date()
          updateData.progress = 1
          if (existingWorkflow.startedAt) {
            updateData.actualDuration = Math.floor(
              (new Date().getTime() - existingWorkflow.startedAt.getTime()) / (1000 * 60)
            )
          }
          break
        case 'paused':
          updateData.pausedAt = new Date()
          if (body.errorMessage) {
            updateData.errorMessage = body.errorMessage
          }
          break
        case 'failed':
          updateData.errorMessage = body.errorMessage || 'Workflow failed'
          break
        case 'cancelled':
          updateData.errorMessage = body.errorMessage || 'Workflow cancelled'
          break
      }
    }

    if (body.errorMessage !== undefined) {
      updateData.errorMessage = body.errorMessage
    }

    // Update workflow
    const updatedWorkflow = await prisma.rotationWorkflow.update({
      where: { id },
      data: updateData,
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
          select: {
            id: true,
            stepNumber: true,
            name: true,
            status: true,
            isRequired: true,
            completedAt: true,
          },
        },
      },
    })

    // Log significant status changes
    if (body.status && ['in_progress', 'completed', 'failed', 'paused', 'cancelled'].includes(body.status)) {
      await prisma.activity.create({
        data: {
          action: `workflow_${body.status}`,
          description: `Workflow ${updatedWorkflow.name} status changed to ${body.status}`,
          userId: session.user.id,
        },
      })
    }

    // Handle workflow completion side effects
    if (body.status === 'completed' && existingWorkflow.discoveredKeyId) {
      await prisma.discoveredKey.update({
        where: { id: existingWorkflow.discoveredKeyId },
        data: { 
          status: 'rotated',
          rotatedAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: { workflow: updatedWorkflow },
    })

  } catch (error) {
    console.error('Error updating workflow:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

// DELETE /api/workflows/[id] - Delete workflow
export async function DELETE(request: NextRequest, context: { params: Params }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Validate workflow exists (shared workspace: look up by id only)
    const workflow = await prisma.rotationWorkflow.findFirst({
      where: {
        id,
      },
    })

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Only allow deletion of completed, cancelled, or failed workflows
    if (!['completed', 'cancelled', 'failed'].includes(workflow.status)) {
      return NextResponse.json(
        { success: false, error: 'Can only delete completed, cancelled, or failed workflows' },
        { status: 400 }
      )
    }

    // Delete workflow (steps will be cascade deleted due to foreign key constraint)
    await prisma.rotationWorkflow.delete({
      where: { id },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        action: 'workflow_deleted',
        description: `Deleted workflow: ${workflow.name}`,
        userId: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Workflow deleted successfully',
    })

  } catch (error) {
    console.error('Error deleting workflow:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}