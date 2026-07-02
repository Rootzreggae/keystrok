import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/workflows/stats - Get workflow statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d' // '7d', '30d', '90d', 'all'

    // Calculate date filter based on period
    let dateFilter: any = {}
    const now = new Date()
    
    switch (period) {
      case '7d':
        dateFilter = { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }
        break
      case '30d':
        dateFilter = { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }
        break
      case '90d':
        dateFilter = { createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } }
        break
      case 'all':
        // No date filter
        break
      default:
        dateFilter = { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }
    }

    // Shared workspace: no userId filter
    const whereClause = {
      ...dateFilter,
    }

    // Get basic counts
    const totalWorkflows = await prisma.rotationWorkflow.count({
      where: whereClause,
    })

    // Get status breakdown
    const statusStats = await prisma.rotationWorkflow.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        id: true,
      },
    })

    // Get priority breakdown
    const priorityStats = await prisma.rotationWorkflow.groupBy({
      by: ['priority'],
      where: whereClause,
      _count: {
        id: true,
      },
    })

    // Get key type breakdown
    const keyTypeStats = await prisma.rotationWorkflow.groupBy({
      by: ['keyType'],
      where: whereClause,
      _count: {
        id: true,
      },
    })

    // Get rotation type breakdown
    const rotationTypeStats = await prisma.rotationWorkflow.groupBy({
      by: ['rotationType'],
      where: whereClause,
      _count: {
        id: true,
      },
    })

    // Get completion stats
    const completedWorkflows = await prisma.rotationWorkflow.count({
      where: {
        ...whereClause,
        status: 'completed',
      },
    })

    // Get average completion time for completed workflows
    const avgCompletionTime = await prisma.rotationWorkflow.aggregate({
      where: {
        ...whereClause,
        status: 'completed',
        actualDuration: { not: null },
      },
      _avg: {
        actualDuration: true,
      },
    })

    // Get workflow progress distribution
    const progressStats = await prisma.rotationWorkflow.findMany({
      where: whereClause,
      select: {
        progress: true,
        status: true,
      },
    })

    // Calculate progress distribution
    const progressDistribution = progressStats.reduce(
      (acc, workflow) => {
        if (workflow.progress === 0) acc.not_started++
        else if (workflow.progress < 0.25) acc.low_progress++
        else if (workflow.progress < 0.5) acc.medium_progress++
        else if (workflow.progress < 0.75) acc.high_progress++
        else if (workflow.progress < 1) acc.almost_complete++
        else acc.completed++
        return acc
      },
      {
        not_started: 0,
        low_progress: 0,
        medium_progress: 0,
        high_progress: 0,
        almost_complete: 0,
        completed: 0,
      }
    )

    // Get recent activity (last 10 completed workflows)
    const recentCompletions = await prisma.rotationWorkflow.findMany({
      where: {
        status: 'completed',
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        keyType: true,
        priority: true,
        completedAt: true,
        actualDuration: true,
        estimatedDuration: true,
      },
    })

    // Get step completion rates by type
    const stepStats = await prisma.rotationStep.groupBy({
      by: ['stepType', 'status'],
      where: {
        workflow: {
          ...dateFilter,
        },
      },
      _count: {
        id: true,
      },
    })

    // Process step stats
    const stepCompletionRates = stepStats.reduce((acc, stat) => {
      if (!acc[stat.stepType]) {
        acc[stat.stepType] = { total: 0, completed: 0, failed: 0, in_progress: 0, pending: 0 }
      }
      acc[stat.stepType].total += stat._count.id
      acc[stat.stepType][stat.status] = stat._count.id
      return acc
    }, {} as any)

    // Calculate completion rates
    Object.keys(stepCompletionRates).forEach(stepType => {
      const stats = stepCompletionRates[stepType]
      stats.completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
    })

    // Get time-based trends (daily counts for the period)
    const trendData = await prisma.rotationWorkflow.findMany({
      where: whereClause,
      select: {
        createdAt: true,
        status: true,
        completedAt: true,
      },
    })

    // Process trend data by day
    const dailyStats = trendData.reduce((acc, workflow) => {
      const date = workflow.createdAt.toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = { created: 0, completed: 0 }
      }
      acc[date].created++
      
      if (workflow.status === 'completed' && workflow.completedAt) {
        const completedDate = workflow.completedAt.toISOString().split('T')[0]
        if (!acc[completedDate]) {
          acc[completedDate] = { created: 0, completed: 0 }
        }
        acc[completedDate].completed++
      }
      
      return acc
    }, {} as any)

    const response = {
      success: true,
      data: {
        summary: {
          totalWorkflows,
          completedWorkflows,
          completionRate: totalWorkflows > 0 ? (completedWorkflows / totalWorkflows) * 100 : 0,
          averageCompletionTime: avgCompletionTime._avg.actualDuration,
        },
        breakdowns: {
          status: statusStats.reduce((acc, stat) => {
            acc[stat.status] = stat._count.id
            return acc
          }, {} as Record<string, number>),
          priority: priorityStats.reduce((acc, stat) => {
            acc[stat.priority] = stat._count.id
            return acc
          }, {} as Record<string, number>),
          keyType: keyTypeStats.reduce((acc, stat) => {
            acc[stat.keyType] = stat._count.id
            return acc
          }, {} as Record<string, number>),
          rotationType: rotationTypeStats.reduce((acc, stat) => {
            acc[stat.rotationType] = stat._count.id
            return acc
          }, {} as Record<string, number>),
        },
        progressDistribution,
        stepCompletionRates,
        recentCompletions,
        trends: {
          daily: dailyStats,
        },
        period,
      },
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching workflow stats:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}