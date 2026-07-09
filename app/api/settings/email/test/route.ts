import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/roles'
import { sendMail, mailConfigured } from '@/lib/mailer'

// POST /api/settings/email/test - send a test email to the signed-in admin, so
// they can confirm mail actually delivers (into their inbox, or Mailpit in dev).
export async function POST() {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(s.user.id)
  if (denied) return denied
  if (!(await mailConfigured())) return NextResponse.json({ ok: false, error: 'No mail transport configured' }, { status: 400 })
  const to = s.user.email
  if (!to) return NextResponse.json({ ok: false, error: 'Your account has no email address' }, { status: 400 })

  const ok = await sendMail({
    to, subject: 'Keystrok test email',
    text: 'This is a Keystrok test email. If you received it, mail delivery is working.',
    html: '<p>This is a <strong>Keystrok</strong> test email. If you received it, mail delivery is working.</p>',
  })
  return NextResponse.json({ ok, to, message: ok ? `Sent to ${to}` : 'Send failed, check the server logs' })
}
