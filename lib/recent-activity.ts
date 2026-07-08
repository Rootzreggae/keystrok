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

// The merged recent-activity list (activity log + relevant audit events) in
// client shape, shared by BOTH the /api/activity/recent route and the
// server-side prefetch so the two can never drift. Caller ensures auth.
export async function getRecentActivity(limit = 10, offset = 0, actionFilter?: string | null) {
  // Build where clause (shared workspace: no userId filter)
  const whereClause: { action?: string } = {}
  if (actionFilter) {
    whereClause.action = actionFilter
  }

  // Both sources in one round-trip; each fetches `limit` and the merge below
  // keeps the newest `limit` overall (the DB is remote, serial queries add up).
  const [activities, auditLogs] = await Promise.all([
    prisma.activity.findMany({
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
    }),
    prisma.auditLog.findMany({
      where: {
        eventCategory: { in: ['security', 'user_action'] } // Focus on relevant categories
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        eventType: true,
        description: true,
        createdAt: true,
        severity: true,
        resourceType: true
      }
    })
  ])

  // Combine and format activity data
  const combinedActivities = [
    ...activities.map(activity => ({
      id: activity.id,
      action: activity.action,
      description: activity.description,
      createdAt: activity.createdAt,
      emoji: activityConfig[activity.action]?.emoji || '📝'
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
      )
    }))
  ]

  // Sort combined activities by creation date and limit
  combinedActivities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return combinedActivities.slice(0, limit).map(activity => ({
    id: activity.id,
    action: activity.action,
    description: activity.description,
    createdAt: activity.createdAt.toISOString(),
    emoji: activity.emoji
  }))
}
