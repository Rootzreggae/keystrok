import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/roles'
import { sendMail } from '@/lib/mailer'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

async function sendInviteEmail(email: string) {
  const url = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
  const signin = `${url}/auth/signin`
  await sendMail({
    to: email,
    subject: 'You have been invited to Keystrok',
    text: `You have been invited to Keystrok. Sign in with this email address at ${signin} to join. Keystrok sends a one-time magic link, no password needed.`,
    html: `<p>You have been invited to <strong>Keystrok</strong>.</p><p>Sign in with this email address to join:</p><p><a href="${signin}">${signin}</a></p><p>Keystrok sends a one-time magic link, no password needed.</p>`,
  })
}

// POST /api/team/invite  { email, role } - invite a member (admin-only).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(session.user.id)
  if (denied) return denied

  const { email: emailRaw, role: roleRaw } = await request.json().catch(() => ({}))
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
  const role = roleRaw === 'admin' ? 'admin' : 'member'
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email }, select: { removedAt: true } })
  if (existing && !existing.removedAt) {
    return NextResponse.json({ error: 'That person is already a member.' }, { status: 409 })
  }

  const invite = await prisma.invite.upsert({
    where: { email },
    create: { email, role, invitedBy: session.user.id },
    update: { role, invitedBy: session.user.id },
    select: { id: true, email: true, role: true, createdAt: true },
  })

  // Best-effort email; the invite (allowlist entry) is what actually grants access.
  const emailed = await sendInviteEmail(email).then(() => true).catch(() => false)
  return NextResponse.json({ invite, emailed })
}

// DELETE /api/team/invite  { email } - revoke a pending invite (admin-only).
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(session.user.id)
  if (denied) return denied

  const { email: emailRaw } = await request.json().catch(() => ({}))
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  await prisma.invite.deleteMany({ where: { email } })
  return NextResponse.json({ ok: true })
}
