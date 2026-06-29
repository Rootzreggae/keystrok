import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Mapping of activity actions to emojis and descriptions
const activityConfig: Record<string, { emoji: string; description?: string }> = {
  'key_discovered': { emoji: '🔍', description: 'New API key discovered' },
  'key_rotated': { emoji: '🔄', description: 'API key rotated successfully' },
  'platform_added': { emoji: '🔗', description: 'New platform configured' },
  'platform_removed': { emoji: '🗑️', description: 'Platform configuration removed' },
  'scan_started': { emoji: '🚀', description: 'Security scan initiated' },
  'scan_completed': { emoji: '✅', description: 'Security scan completed' },
  'workflow_started': { emoji: '⚙️', description: 'Rotation workflow started' },
  'workflow_completed': { emoji: '🎯', description: 'Rotation workflow completed' },
  'key_ignored': { emoji: '👁️', description: 'Key marked as ignored' },
  'key_revoked': { emoji: '❌', description: 'API key revoked' },
  'false_positive': { emoji: '❓', description: 'Marked as false positive' },
  'security_alert': { emoji: '🚨', description: 'Security alert triggered' },
  'user_login': { emoji: '🔐', description: 'User logged in' },
  'settings_updated': { emoji: '⚙️', description: 'Settings updated' },
  'export_data': { emoji: '📊', description: 'Data exported' },
  'import_data': { emoji: '📥', description: 'Data imported' }
}

// GET /api/activity/recent - Returns last 10 activity log entries
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const actionFilter = searchParams.get('action')

    // Build where clause
    const whereClause: any = {
      userId: userId
    }

    if (actionFilter) {
      whereClause.action = actionFilter
    }

    // Get recent activities from the Activity table
    const activities = await prisma.activity.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        description: true,
        createdAt: true
      }
    })

    // Also get recent audit logs for additional activity data
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        userId: userId,
        eventCategory: { in: ['security', 'user_action'] } // Focus on relevant categories
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(5, limit - activities.length), // Fill remaining slots
      select: {
        id: true,
        eventType: true,
        description: true,
        createdAt: true,
        severity: true,
        resourceType: true
      }
    })

    // Combine and format activity data
    const combinedActivities = [
      ...activities.map(activity => ({
        id: activity.id,
        action: activity.action,
        description: activity.description,
        createdAt: activity.createdAt,
        emoji: activityConfig[activity.action]?.emoji || '📝',
        source: 'activity' as const
      })),
      ...auditLogs.map(log => ({
        id: log.id,
        action: log.eventType,
        description: log.description,
        createdAt: log.createdAt,
        emoji: activityConfig[log.eventType]?.emoji || (
          log.severity === 'critical' ? '🚨' :
          log.severity === 'error' ? '❌' :
          log.severity === 'warning' ? '⚠️' :
          '📋'
        ),
        source: 'audit' as const
      }))
    ]

    // Sort combined activities by creation date and limit
    combinedActivities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const recentActivities = combinedActivities.slice(0, limit)

    // Format the response
    const formattedActivities = recentActivities.map(activity => ({
      id: activity.id,
      action: activity.action,
      description: activity.description,
      createdAt: activity.createdAt.toISOString(),
      emoji: activity.emoji
    }))

    // Get activity summary stats
    const totalActivities = await prisma.activity.count({
      where: { userId: userId }
    })

    const totalAuditLogs = await prisma.auditLog.count({
      where: { 
        userId: userId,
        eventCategory: { in: ['security', 'user_action'] }
      }
    })

    // Get activity breakdown by action type (last 7 days)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const weeklyActivityBreakdown = await prisma.activity.groupBy({
      by: ['action'],
      where: {
        userId: userId,
        createdAt: { gte: weekAgo }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedActivities,
      meta: {
        total: totalActivities + totalAuditLogs,
        limit,
        offset,
        hasMore: offset + limit < totalActivities + totalAuditLogs,
        weeklyBreakdown: weeklyActivityBreakdown.reduce((acc, item) => {
          acc[item.action] = item._count.id
          return acc
        }, {} as Record<string, number>)
      }
    })

  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}