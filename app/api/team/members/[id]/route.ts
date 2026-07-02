import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin, activeAdminCount } from '@/lib/roles'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/team/members/[id]  { role } - change a member's role (admin-only).
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(session.user.id)
  if (denied) return denied

  const { id } = await params
  const { role: roleRaw } = await request.json().catch(() => ({}))
  const role = roleRaw === 'admin' ? 'admin' : 'member'

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, removedAt: true } })
  if (!target || target.removedAt) return NextResponse.json({ error: 'Member not found.' }, { status: 404 })

  // Never leave the team without an admin.
  if (target.role === 'admin' && role === 'member' && (await activeAdminCount()) <= 1) {
    return NextResponse.json({ error: 'The team must keep at least one admin.' }, { status: 400 })
  }

  const updated = await prisma.user.update({ where: { id }, data: { role }, select: { id: true, role: true } })
  return NextResponse.json({ member: updated })
}

// DELETE /api/team/members/[id] - soft-remove a member (admin-only). Preserves
// their attributed data; revokes access by clearing sessions + soft-removing.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(session.user.id)
  if (denied) return denied

  const { id } = await params
  if (id === session.user.id) return NextResponse.json({ error: 'You cannot remove yourself.' }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true, removedAt: true } })
  if (!target || target.removedAt) return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
  if (target.role === 'admin' && (await activeAdminCount()) <= 1) {
    return NextResponse.json({ error: 'The team must keep at least one admin.' }, { status: 400 })
  }

  // Keep the row (and its attributed data); revoke access.
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { removedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: id } }),
  ])
  // Also drop any lingering invite for their email so they can't rejoin silently.
  const removed = await prisma.user.findUnique({ where: { id }, select: { email: true } })
  if (removed?.email) await prisma.invite.deleteMany({ where: { email: removed.email.toLowerCase() } })

  return NextResponse.json({ ok: true })
}
