// Server-side alert evaluation: run after a liveness check. Edge-triggered:
// open an AlertEvent (and notify) when a key enters an incident, resolve it
// (and send a recovery) when it leaves. Deduped by an open AlertEvent per
// (keyId, kind). Non-fatal: a delivery failure never throws into the caller.
import { prisma } from './prisma.ts'
import { decryptSecret } from './crypto.ts'
import { assertSafePlatformUrl } from './ssrf.ts'
import { incidentFor, summaryText, recoveryText, buildRequest, deliver, type AlertableKey, type ChannelConfig } from './alerting.ts'

async function loadChannel(): Promise<{ cfg: ChannelConfig; baseUrl?: string } | null> {
  const c = await prisma.alertConfig.findUnique({ where: { id: 'default' } })
  if (!c || !c.enabled) return null
  const cfg: ChannelConfig = {
    channel: c.channel as ChannelConfig['channel'],
    telegramToken: c.telegramToken ? decryptSecret(c.telegramToken) : null,
    telegramChatId: c.telegramChatId,
    webhookUrl: c.webhookUrl ? decryptSecret(c.webhookUrl) : null,
  }
  return { cfg, baseUrl: process.env.NEXTAUTH_URL || undefined }
}

async function send(cfg: ChannelConfig, text: string, incidentBody?: Parameters<typeof buildRequest>[2]): Promise<{ ok: boolean; msg: string }> {
  const req = buildRequest(cfg, text, incidentBody)
  if (!req) return { ok: false, msg: 'channel not configured' }
  // webhook URLs are operator-supplied → SSRF-guard. Telegram host is fixed.
  if (cfg.channel === 'webhook') {
    try { await assertSafePlatformUrl(req.url) } catch { return { ok: false, msg: 'blocked unsafe webhook URL' } }
  }
  return deliver(req)
}

/**
 * Reconcile alert state for the given keys against their current incident status.
 * Call after liveness updates land. Returns counts for logging. Best-effort:
 * every delivery is wrapped so one bad channel can't break the check.
 */
export async function runAlerts(keys: AlertableKey[]): Promise<{ fired: number; resolved: number }> {
  const loaded = await loadChannel().catch(() => null)
  if (!loaded) return { fired: 0, resolved: 0 }
  const { cfg, baseUrl } = loaded
  const now = new Date()
  let fired = 0, resolved = 0
  let lastOk: { ok: boolean; msg: string } | null = null

  for (const k of keys) {
    const inc = incidentFor(k, now)
    // open events for this key that aren't resolved yet
    const open = await prisma.alertEvent.findMany({ where: { keyId: k.id, resolvedAt: null } })

    if (inc) {
      const already = open.find((e) => e.kind === inc.kind)
      if (!already) {
        const res = await send(cfg, summaryText(k, inc, baseUrl), { ...inc, key: k })
        lastOk = res
        await prisma.alertEvent.create({ data: { keyId: k.id, kind: inc.kind, severity: inc.severity, deliveredOk: res.ok } })
        fired++
      }
      // any open events of a *different* kind are stale → resolve silently
      for (const e of open.filter((e) => e.kind !== inc.kind)) {
        await prisma.alertEvent.update({ where: { id: e.id }, data: { resolvedAt: now } })
      }
    } else if (open.length) {
      // key left every incident state → resolve + send one recovery
      const res = await send(cfg, recoveryText(k, open[0].kind as 'live_and_used', baseUrl))
      lastOk = res
      await prisma.alertEvent.updateMany({ where: { keyId: k.id, resolvedAt: null }, data: { resolvedAt: now } })
      resolved++
    }
  }

  if (lastOk) {
    await prisma.alertConfig.update({ where: { id: 'default' }, data: { lastDeliveryOk: lastOk.ok, lastDeliveryAt: now, lastDeliveryMsg: lastOk.msg } }).catch(() => {})
  }
  return { fired, resolved }
}
