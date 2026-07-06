// Alert delivery: turn the incidents we already detect into a message on a
// channel the operator chose. Fire-on-check (evaluated when a liveness check
// runs), edge-triggered dedup, recovery notifications. Telegram + generic
// webhook via thin adapters, no SDK: both are "POST JSON to an HTTPS URL".
// See Obsidian "Keystrok — Alerting (Spec)".
import { isRecentlyUsed, rotationFailed } from './liveness.ts'

export type AlertKind = 'live_and_used' | 'rotation_failed'
export type ChannelType = 'telegram' | 'webhook'

export interface AlertableKey {
  id: string
  keyName: string
  platform: string
  severity: string
  keyPreview: string | null
  liveStatus?: string | null
  liveCheckedAt?: Date | null
  lastUsedAt?: Date | null
  rotatedAt?: Date | null
}

export interface Incident { kind: AlertKind; severity: 'critical'; detail: string }

/**
 * Which alert-worthy incident (if any) a key is currently in. Pure: reuses the
 * same predicates the UI does, so alerts and the dashboard never disagree.
 * rotation_failed takes precedence (a failed rotation is the more specific state).
 */
export function incidentFor(k: AlertableKey, now: Date = new Date()): Incident | null {
  if (rotationFailed(k)) {
    return { kind: 'rotation_failed', severity: 'critical', detail: 'marked rotated, but a post-rotation check still found it live. The old credential was never revoked.' }
  }
  if (k.liveStatus === 'live' && isRecentlyUsed(k.lastUsedAt ?? null, now)) {
    return { kind: 'live_and_used', severity: 'critical', detail: 'still live on its platform and used recently. Active incident, rotate it first.' }
  }
  return null
}

/** Promoted key names are verbose ("AWS_ACCESS_KEY Key - Found in ..."); bare name. */
const bareName = (name: string) => name.split(/ Key | - /)[0]

/** Human summary line shared by every channel. */
export function summaryText(k: AlertableKey, inc: Incident, baseUrl?: string): string {
  const link = baseUrl ? ` ${baseUrl.replace(/\/$/, '')}/inventory?key=${k.id}` : ''
  return `🔴 Keystrok: ${bareName(k.keyName)} (${k.platform}) — ${inc.detail}${link}`
}

/** Recovery summary when a key leaves an alert state. */
export function recoveryText(k: AlertableKey, kind: AlertKind, baseUrl?: string): string {
  const why = kind === 'rotation_failed' ? 'rotation confirmed, key no longer live' : 'no longer live / not in use'
  const link = baseUrl ? ` ${baseUrl.replace(/\/$/, '')}/inventory?key=${k.id}` : ''
  return `✅ Keystrok: ${bareName(k.keyName)} (${k.platform}) resolved — ${why}${link}`
}

export interface ChannelConfig { channel: ChannelType; telegramToken?: string | null; telegramChatId?: string | null; webhookUrl?: string | null }

/** Map a config + a rendered message to the concrete (url, body) to POST. Null
 *  when the channel isn't fully configured. This is the whole per-vendor surface. */
export function buildRequest(cfg: ChannelConfig, text: string, incident?: Incident & { key: AlertableKey } | null):
  { url: string; body: unknown } | null {
  if (cfg.channel === 'telegram') {
    if (!cfg.telegramToken || !cfg.telegramChatId) return null
    return {
      url: `https://api.telegram.org/bot${cfg.telegramToken}/sendMessage`,
      body: { chat_id: cfg.telegramChatId, text, disable_web_page_preview: true },
    }
  }
  // webhook: dual-purpose body — Slack renders .text, a generic consumer reads .incident
  if (!cfg.webhookUrl) return null
  const body: Record<string, unknown> = { text }
  if (incident) {
    body.incident = {
      kind: incident.kind, severity: incident.severity, detail: incident.detail,
      key: { name: bareName(incident.key.keyName), platform: incident.key.platform, severity: incident.key.severity, preview: incident.key.keyPreview },
    }
  }
  return { url: cfg.webhookUrl, body }
}

/** POST a built request. Telegram's host is fixed; a webhook URL is SSRF-guarded
 *  by the caller before this runs. Non-fatal by contract: returns ok/false. */
export async function deliver(req: { url: string; body: unknown }): Promise<{ ok: boolean; msg: string }> {
  try {
    const res = await fetch(req.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body), signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { ok: false, msg: `HTTP ${res.status}` }
    return { ok: true, msg: 'delivered' }
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : 'delivery failed' }
  }
}
