import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/roles'
import { runLivenessCheck } from '@/lib/liveness-runner'

// POST /api/liveness/check
// Admin-gated (decrypts and uses connected platform credentials). The work lives
// in runLivenessCheck so the scheduled cron tick can run the same pass.
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(session.user.id)
  if (denied) return denied
  const result = await runLivenessCheck({ actorId: session.user.id })
  return NextResponse.json(result)
}
