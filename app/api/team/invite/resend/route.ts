import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/roles'
import { sendMail } from '@/lib/mailer'

// POST /api/team/invite/resend  { email } - resend an invite email (admin-only).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(session.user.id)
  if (denied) return denied

  const { email: emailRaw } = await request.json().catch(() => ({}))
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
  const invite = await prisma.invite.findUnique({ where: { email }, select: { id: true } })
  if (!invite) return NextResponse.json({ error: 'No pending invite for that email.' }, { status: 404 })

  const url = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
  const signin = `${url}/auth/signin`
  const emailed = await sendMail({
    to: email,
    subject: 'Your Keystrok invitation',
    text: `You have been invited to Keystrok. Sign in with this email address at ${signin} to join.`,
    html: `<p>You have been invited to <strong>Keystrok</strong>.</p><p>Sign in with this email address to join:</p><p><a href="${signin}">${signin}</a></p>`,
  }).then(() => true).catch(() => false)

  return NextResponse.json({ emailed })
}
