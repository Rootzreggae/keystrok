import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createRepoScanSession, cloneAndScan } from '@/lib/source-scan'

// Scan a repo from a connected GitHub source: shallow-clone it to a temp dir,
// run the shared scanner, then delete the clone. Fire-and-forget; UI polls status.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const fullName: string | undefined = body.fullName // e.g. "octocat/hello-world"
  if (!fullName || !/^[\w.-]+\/[\w.-]+$/.test(fullName)) {
    return NextResponse.json({ error: 'A valid repo "owner/name" is required' }, { status: 400 })
  }

  const conn = await prisma.sourceConnection.findFirst({ where: { id, provider: 'github' } })
  if (!conn) return NextResponse.json({ error: 'Source connection not found' }, { status: 404 })

  const scanSession = await createRepoScanSession(fullName, userId)
  // Background: clone → scan → cleanup. UI polls scan status as usual.
  setImmediate(() => cloneAndScan(scanSession.id, conn.installationId, fullName, userId))

  return NextResponse.json({ success: true, sessionId: scanSession.id, repo: fullName })
}
