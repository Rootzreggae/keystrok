import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/roles'
import { mailStatus, invalidateMailCache, getMail } from '@/lib/mailer'
import { encryptSecret, isMaskedSecret } from '@/lib/crypto'

// Mail delivery settings. Admin-only. The saved row overrides the EMAIL_* env
// vars (env stays as the bootstrap/break-glass path). Secrets are encrypted at
// rest and never returned to the client, only has* flags.

async function payload(youEmail: string | null) {
  const row = await prisma.mailConfig.findUnique({ where: { id: 'default' } })
  const m = await getMail()
  return {
    ...(await mailStatus()),
    youEmail,
    // effective form values (saved row, or env fallback), secrets as has* flags
    effective: {
      host: m.host,
      port: m.port,
      username: m.username,
      from: m.from,
      hasPassword: !!m.password,
      hasResendKey: !!m.resendKey,
    },
    // where the From value comes from, for the per-field source tag
    fromSource: row?.from ? 'saved' : process.env.EMAIL_FROM ? 'environment' : 'default',
    config: row
      ? {
          transport: row.transport,
          host: row.host,
          port: row.port,
          username: row.username,
          from: row.from,
          hasPassword: !!row.passwordEnc,
          hasResendKey: !!row.resendKeyEnc,
        }
      : null,
  }
}

// GET /api/settings/email - status + saved form values (no secrets).
export async function GET() {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(s.user.id)
  if (denied) return denied
  return NextResponse.json(await payload(s.user.email ?? null))
}

// PUT /api/settings/email - save the instance mail config.
// Secret fields left empty keep their stored value (they are never echoed back,
// so an untouched edit form resubmits them empty). To send unauthenticated
// SMTP, clear the username: auth is omitted entirely when it is empty.
export async function PUT(req: Request) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(s.user.id)
  if (denied) return denied

  const b = await req.json().catch(() => null)
  if (!b || (b.transport !== 'smtp' && b.transport !== 'resend')) {
    return NextResponse.json({ error: 'Transport must be "smtp" or "resend".' }, { status: 400 })
  }
  const host = String(b.host ?? '').trim()
  const port = Number(b.port) || 587
  const username = String(b.username ?? '').trim()
  const from = String(b.from ?? '').trim()
  const password = String(b.password ?? '')
  const resendKey = String(b.resendKey ?? '')

  const existing = await prisma.mailConfig.findUnique({ where: { id: 'default' } })

  if (b.transport === 'smtp' && !host) {
    return NextResponse.json({ error: 'SMTP needs a host.' }, { status: 400 })
  }
  if (port < 1 || port > 65535) {
    return NextResponse.json({ error: 'Port must be between 1 and 65535.' }, { status: 400 })
  }
  if (b.transport === 'resend' && !resendKey && !existing?.resendKeyEnc) {
    return NextResponse.json({ error: 'Resend needs an API key.' }, { status: 400 })
  }

  const newSecret = (v: string) => !!v && !isMaskedSecret(v)
  const data = {
    transport: b.transport,
    host,
    port,
    username,
    from,
    ...(newSecret(password) && { passwordEnc: encryptSecret(password) }),
    ...(newSecret(resendKey) && { resendKeyEnc: encryptSecret(resendKey) }),
  }
  await prisma.mailConfig.upsert({ where: { id: 'default' }, create: { id: 'default', ...data }, update: data })
  invalidateMailCache()
  return NextResponse.json(await payload(s.user.email ?? null))
}

// DELETE /api/settings/email - remove the saved config, reverting to env vars.
export async function DELETE() {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(s.user.id)
  if (denied) return denied
  await prisma.mailConfig.deleteMany({ where: { id: 'default' } })
  invalidateMailCache()
  return NextResponse.json(await payload(s.user.email ?? null))
}
