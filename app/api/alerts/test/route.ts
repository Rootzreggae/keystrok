import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/roles'
import { decryptSecret } from '@/lib/crypto'
import { assertSafePlatformUrl } from '@/lib/ssrf'
import { buildRequest, deliver, type ChannelConfig } from '@/lib/alerting'

// POST /api/alerts/test - send a sample message so the operator confirms a
// channel is wired before a real incident. Uses the saved config.
export async function POST() {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(s.user.id)
  if (denied) return denied

  const c = await prisma.alertConfig.findUnique({ where: { id: 'default' } })
  if (!c) return NextResponse.json({ ok: false, error: 'Save a channel first' }, { status: 400 })
  const cfg: ChannelConfig = {
    channel: c.channel as ChannelConfig['channel'],
    telegramToken: c.telegramToken ? decryptSecret(c.telegramToken) : null,
    telegramChatId: c.telegramChatId,
    webhookUrl: c.webhookUrl ? decryptSecret(c.webhookUrl) : null,
  }
  const req = buildRequest(cfg, '✅ Keystrok test alert — your channel is wired correctly.')
  if (!req) return NextResponse.json({ ok: false, error: 'Channel is not fully configured' }, { status: 400 })
  if (cfg.channel === 'webhook') {
    try { await assertSafePlatformUrl(req.url) } catch { return NextResponse.json({ ok: false, error: 'Webhook URL blocked (unsafe host)' }, { status: 400 }) }
  }
  const res = await deliver(req)
  await prisma.alertConfig.update({ where: { id: 'default' }, data: { lastDeliveryOk: res.ok, lastDeliveryAt: new Date(), lastDeliveryMsg: res.msg } }).catch(() => {})
  return NextResponse.json({ ok: res.ok, message: res.msg })
}
