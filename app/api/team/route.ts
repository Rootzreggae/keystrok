import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/roles'

// GET /api/team - members (active users) + pending invites. Admin-only.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(session.user.id)
  if (denied) return denied

  const [members, invites] = await Promise.all([
    prisma.user.findMany({
      where: { removedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true, createdAt: true },
    }),
    prisma.invite.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, email: true, role: true, createdAt: true } }),
  ])

  return NextResponse.json({
    members: members.map((m) => ({ ...m, you: m.id === session.user.id })),
    invites,
  })
}
