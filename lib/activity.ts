import { prisma } from '@/lib/prisma'
import { composeEvents } from '@/lib/activity-feed'

// The composed Activity feed (rotations threaded from workflows, other classes
// classified from the log, 14-day window). Shared by the /api/activity/feed route
// and the server-side prefetch so shapes never drift. Caller ensures auth.
export async function getActivityFeed() {
  const now = new Date()
  const since = new Date(now.getTime() - 14 * 86400000)

  const [workflows, activities] = await Promise.all([
    prisma.rotationWorkflow.findMany({
      where: { OR: [{ startedAt: { gte: since } }, { completedAt: { gte: since } }, { createdAt: { gte: since } }] },
      select: {
        id: true, name: true, status: true, startedAt: true, completedAt: true,
        discoveredKey: { select: { keyName: true } },
        steps: { select: { name: true, status: true, completedAt: true } },
      },
    }),
    prisma.activity.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, description: true, createdAt: true } }),
  ])

  return composeEvents(workflows, activities, now)
}
