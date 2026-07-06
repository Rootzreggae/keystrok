import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/roles'
import { mailStatus } from '@/lib/mailer'

// GET /api/settings/email - mail delivery status for the Settings UI. Admin-only.
// Read-only: mail config lives in env (infra secret, and the bootstrap magic link
// needs it before any UI exists), so we surface status + test, not editing.
export async function GET() {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(s.user.id)
  if (denied) return denied
  return NextResponse.json({ ...mailStatus(), youEmail: s.user.email ?? null })
}
