import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/discovery/findings/[id]/dismiss - Dismiss a finding (false positive / not a secret)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const finding = await prisma.localScanFinding.findFirst({ where: { id, userId } })
    if (!finding) {
      return NextResponse.json({ success: false, error: 'Finding not found' }, { status: 404 })
    }

    await prisma.localScanFinding.update({ where: { id }, data: { status: 'dismissed' } })
    await prisma.activity.create({
      data: {
        action: 'false_positive',
        description: `Dismissed scan finding: ${finding.keyType} in ${finding.filePath}`,
        userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
