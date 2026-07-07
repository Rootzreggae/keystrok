import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { composeEvents } from '@/lib/activity-feed'

// GET /api/activity/feed - the composed Activity feed: rotations threaded from
// the workflow table, other classes classified from the activity log, grouped by
// day with per-class counts and a 14-day density strip. Shared workspace.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  return NextResponse.json(composeEvents(workflows, activities, now))
}
