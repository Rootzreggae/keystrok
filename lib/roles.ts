import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Roles for the single-instance team model (self-host = one instance = one team).
 * Two roles: 'admin' controls credentials/config and irreversible actions;
 * 'member' does the daily work (scan, triage, rotate up to the revoke step).
 * See the "Keystrok — Teams" spec.
 */
export type Role = 'admin' | 'member'

/**
 * The instance always has at least one admin. If none is set yet (a fresh
 * install, or an instance migrated from the pre-teams single-user model), the
 * earliest-created user is promoted. Self-healing, so there is no manual
 * backfill step and the founder never locks themselves out.
 * ponytail: cheap count on every role check; fine at self-host scale.
 */
async function ensureBootstrapAdmin(): Promise<void> {
  const admins = await prisma.user.count({ where: { role: 'admin' } })
  if (admins > 0) return
  const first = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
  if (first) await prisma.user.update({ where: { id: first.id }, data: { role: 'admin' } })
}

export async function getRole(userId: string): Promise<Role> {
  await ensureBootstrapAdmin()
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  return u?.role === 'admin' ? 'admin' : 'member'
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getRole(userId)) === 'admin'
}

/**
 * API-route guard for admin-only actions. Returns a 403 Response to return
 * early, or null when the user is an admin. Use after the auth() session check:
 *   const denied = await requireAdmin(session.user.id); if (denied) return denied
 */
export async function requireAdmin(userId: string): Promise<NextResponse | null> {
  if (await isAdmin(userId)) return null
  return NextResponse.json({ error: 'This action requires an admin role.' }, { status: 403 })
}
