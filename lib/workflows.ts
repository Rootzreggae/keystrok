import { prisma } from '@/lib/prisma'

export interface WorkflowListFilters {
  status?: string | null
  platform?: string | null
  priority?: string | null
  limit?: number
  offset?: number
}

// The rotation-workflow list + status stats, shared by BOTH the /api/workflows
// route and the server-side prefetch so the two can never drift. Caller ensures auth.
export async function getWorkflowList(filters: WorkflowListFilters = {}) {
  // Build where clause (shared workspace: no userId filter)
  const where: Record<string, string> = {}
  if (filters.status) where.status = filters.status
  if (filters.platform) where.keyType = filters.platform
  if (filters.priority) where.priority = filters.priority

  // List + stats in one round-trip (remote DB, serial queries add up)
  const [workflows, stats] = await Promise.all([
    prisma.rotationWorkflow.findMany({
      where,
      include: {
        discoveredKey: {
          select: {
            id: true,
            keyName: true,
            keyPreview: true,
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
      take: filters.limit,
      skip: filters.offset,
    }),
    prisma.rotationWorkflow.groupBy({
      by: ['status'],
      where: {},
      _count: { status: true },
    }),
  ])

  const statusStats = stats.reduce((acc, stat) => {
    acc[stat.status] = stat._count.status
    return acc
  }, {} as Record<string, number>)

  return { workflows, stats: statusStats }
}
