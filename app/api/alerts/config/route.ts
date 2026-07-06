import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/roles'
import { encryptSecret, isMaskedSecret } from '@/lib/crypto'

// Alert config is a singleton (single-tenant instance). Secrets are returned
// masked, never in plaintext. Admin-gated: it holds delivery credentials.
const MASK = '••••••••'

export async function GET() {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(s.user.id)
  if (denied) return denied
  const c = await prisma.alertConfig.findUnique({ where: { id: 'default' } })
  return NextResponse.json({
    enabled: c?.enabled ?? false,
    channel: c?.channel ?? 'telegram',
    telegramChatId: c?.telegramChatId ?? '',
    hasTelegramToken: !!c?.telegramToken,
    telegramToken: c?.telegramToken ? MASK : '',
    hasWebhookUrl: !!c?.webhookUrl,
    webhookUrl: c?.webhookUrl ? MASK : '',
    lastDeliveryOk: c?.lastDeliveryOk ?? null,
    lastDeliveryAt: c?.lastDeliveryAt ?? null,
    lastDeliveryMsg: c?.lastDeliveryMsg ?? null,
  })
}

export async function PUT(req: NextRequest) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(s.user.id)
  if (denied) return denied

  const b = await req.json().catch(() => ({}))
  const channel = b.channel === 'webhook' ? 'webhook' : 'telegram'
  const data: Record<string, unknown> = {
    enabled: !!b.enabled,
    channel,
    telegramChatId: typeof b.telegramChatId === 'string' ? b.telegramChatId.trim() : undefined,
  }
  // A masked/empty secret means "leave unchanged"; a real value is re-encrypted.
  if (typeof b.telegramToken === 'string' && b.telegramToken && !isMaskedSecret(b.telegramToken) && b.telegramToken !== MASK) {
    data.telegramToken = encryptSecret(b.telegramToken.trim())
  }
  if (typeof b.webhookUrl === 'string' && b.webhookUrl && !isMaskedSecret(b.webhookUrl) && b.webhookUrl !== MASK) {
    data.webhookUrl = encryptSecret(b.webhookUrl.trim())
  }

  await prisma.alertConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data } as never,
    update: data,
  })
  return NextResponse.json({ ok: true })
}
