import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/roles'
import { decryptSecret } from '@/lib/crypto'
import { sendAlert } from '@/lib/alert-runner'
import type { ChannelConfig } from '@/lib/alerting'

// POST /api/alerts/test - send a sample message so the operator confirms a
// channel is wired before a real incident. Uses the saved config. Delivery
// (including the webhook SSRF guard and email fan-out) lives in sendAlert.
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
    emailTo: c.emailTo,
  }
  const res = await sendAlert(cfg, '✅ Keystrok test alert — your channel is wired correctly.')
  if (!res.ok && res.msg === 'channel not configured') {
    return NextResponse.json({ ok: false, error: 'Channel is not fully configured' }, { status: 400 })
  }
  await prisma.alertConfig.update({ where: { id: 'default' }, data: { lastDeliveryOk: res.ok, lastDeliveryAt: new Date(), lastDeliveryMsg: res.msg } }).catch(() => {})
  return NextResponse.json({ ok: res.ok, message: res.msg })
}
