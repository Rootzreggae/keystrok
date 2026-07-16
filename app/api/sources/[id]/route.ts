import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/roles'
import { prisma } from '@/lib/prisma'

// Disconnect a GitHub source. Soft: status → 'revoked', which removes it from
// the repo list and the continuous-scan cron (both select on status 'active').
// Past scan sessions and findings stay — they are history, not configuration.
// Admin-only, like every other platform mutation. Honest limit: Keystrok
// cannot uninstall its GitHub App from here; the UI points at GitHub settings
// for a full revoke.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(session.user.id)
  if (denied) return denied

  const { id } = await ctx.params
  const conn = await prisma.sourceConnection.findFirst({ where: { id, status: 'active' } })
  if (!conn) return NextResponse.json({ error: 'Source connection not found' }, { status: 404 })

  await prisma.sourceConnection.update({ where: { id }, data: { status: 'revoked' } })
  return NextResponse.json({ ok: true, accountLogin: conn.accountLogin })
}
