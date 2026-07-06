import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computePosture } from '@/lib/posture'

// GET /api/posture - secret-hygiene SLOs + backlog trend for the signed-in user,
// derived from the timestamps already on each discovered key.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.discoveredKey.findMany({
    where: { userId: session.user.id },
    select: { foundAt: true, exposedAt: true, rotatedAt: true, liveStatus: true, liveCheckedAt: true, status: true, severity: true },
  })
  return NextResponse.json(computePosture(keys))
}
