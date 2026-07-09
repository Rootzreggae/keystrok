'use client'

import { useEffect, useState } from 'react'
import { Send, Bell, Check, AlertTriangle } from 'lucide-react'
import { InlineLoading } from '@/components/ks/Loading'

type Channel = 'telegram' | 'webhook' | 'email'
interface Cfg {
  enabled: boolean; channel: Channel
  telegramChatId: string; telegramToken: string; hasTelegramToken: boolean
  webhookUrl: string; hasWebhookUrl: boolean
  emailTo: string; mailReady: boolean
  lastDeliveryOk: boolean | null; lastDeliveryAt: string | null; lastDeliveryMsg: string | null
}

const MASK = '••••••••'

// Alert delivery config. Telegram is the hero channel (homelab-friendly); a
// generic webhook covers Slack/Discord/HTTP. See the Alerting spec.
export function AlertsSettings() {
  const [c, setC] = useState<Cfg | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [findingId, setFindingId] = useState(false)
  const [idMsg, setIdMsg] = useState<string | null>(null)

  useEffect(() => { fetch('/api/alerts/config').then((r) => r.json()).then(setC).catch(() => {}) }, [])
  if (!c) return <div className="ks-panel"><InlineLoading /></div>
  const set = (p: Partial<Cfg>) => setC({ ...c, ...p })

  const save = async () => {
    setSaving(true); setTestMsg(null)
    try {
      const r = await fetch('/api/alerts/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: c.enabled, channel: c.channel, telegramChatId: c.telegramChatId, emailTo: c.emailTo,
          // only send secrets the user actually typed (not the mask)
          telegramToken: c.telegramToken && c.telegramToken !== MASK ? c.telegramToken : undefined,
          webhookUrl: c.webhookUrl && c.webhookUrl !== MASK ? c.webhookUrl : undefined,
        }),
      })
      if (!r.ok) throw new Error()
      setSavedAt(Date.now())
      // re-pull so secret fields go back to masked state
      setC(await (await fetch('/api/alerts/config')).json())
    } finally { setSaving(false) }
  }

  const test = async () => {
    setTesting(true); setTestMsg(null)
    try {
      const r = await fetch('/api/alerts/test', { method: 'POST' })
      const j = await r.json()
      setTestMsg({ ok: !!j.ok, text: j.ok ? 'Sent. Check your channel.' : (j.error || j.message || 'Failed') })
    } finally { setTesting(false) }
  }

  const findChatId = async () => {
    setFindingId(true); setIdMsg(null)
    try {
      const r = await fetch('/api/alerts/telegram-chatid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: c.telegramToken && c.telegramToken !== MASK ? c.telegramToken : undefined }),
      })
      const j = await r.json()
      if (j.ok) { set({ telegramChatId: j.chatId }); setIdMsg(`Found${j.chatName ? `: ${j.chatName}` : ''}`) }
      else setIdMsg(j.error || 'Not found')
    } finally { setFindingId(false) }
  }

  return (
    <div className="ks-panel">
      <div className="ks-panel__hd">
        <span className="ks-panel__t"><Bell size={14} style={{ verticalAlign: -2, marginRight: 7 }} />Alerts</span>
        <span className="ks-panel__sub" style={{ marginLeft: 'auto' }}>get paged when a leaked key is live or a rotation fails</span>
      </div>

      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* enable */}
        <label className="ks-set__row">
          <div>
            <div className="ks-set__k">Enabled</div>
            <div className="ks-set__d">Fire when a leaked key is confirmed live-and-used, or a rotation did not stick. Evaluated on each liveness check.</div>
          </div>
          <button className={'ks-toggle' + (c.enabled ? ' on' : '')} onClick={() => set({ enabled: !c.enabled })} aria-pressed={c.enabled}><span className="ks-toggle__k" /></button>
        </label>

        {/* channel picker */}
        <div>
          <div className="ks-set__k" style={{ marginBottom: 8 }}>Channel</div>
          <div className="ks-seg">
            {(['telegram', 'webhook', 'email'] as Channel[]).map((ch) => (
              <button key={ch} className={'ks-seg__b' + (c.channel === ch ? ' active' : '')} onClick={() => set({ channel: ch })}>
                {ch === 'telegram' ? 'Telegram' : ch === 'webhook' ? 'Webhook' : 'Email'}
              </button>
            ))}
          </div>
        </div>

        {c.channel === 'telegram' ? (
          <>
            <label className="ks-set__field">
              <span>Bot token</span>
              <input className="ks-input" type="password" value={c.telegramToken} placeholder={c.hasTelegramToken ? MASK : '123456:ABC-DEF...'}
                onChange={(e) => set({ telegramToken: e.target.value })} spellCheck={false} autoCapitalize="off" />
              <span className="ks-set__hint">Create a bot with @BotFather, paste its token here.</span>
            </label>
            <label className="ks-set__field">
              <span>Chat ID</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="ks-input" value={c.telegramChatId} placeholder="e.g. 123456789" onChange={(e) => set({ telegramChatId: e.target.value })} spellCheck={false} style={{ flex: 1 }} />
                <button className="ks-btn ks-btn--sm" onClick={findChatId} disabled={findingId}>{findingId ? 'Finding…' : 'Get chat ID'}</button>
              </div>
              <span className="ks-set__hint">Send your bot any message first, then click Get chat ID.{idMsg ? ` ${idMsg}` : ''}</span>
            </label>
          </>
        ) : c.channel === 'webhook' ? (
          <label className="ks-set__field">
            <span>Webhook URL</span>
            <input className="ks-input" type="password" value={c.webhookUrl} placeholder={c.hasWebhookUrl ? MASK : 'https://hooks.slack.com/services/...'}
              onChange={(e) => set({ webhookUrl: e.target.value })} spellCheck={false} autoCapitalize="off" />
            <span className="ks-set__hint">A Slack/Discord incoming webhook, or any HTTPS endpoint. Slack renders the summary; a generic consumer also gets structured JSON.</span>
          </label>
        ) : (
          <label className="ks-set__field">
            <span>Recipients</span>
            <input className="ks-input" value={c.emailTo} placeholder="blank = every admin" onChange={(e) => set({ emailTo: e.target.value })} spellCheck={false} autoCapitalize="off" />
            <span className="ks-set__hint">Comma-separated addresses. Blank sends to every admin on this instance. Delivery uses the transport in Settings &gt; Email delivery.</span>
            {!c.mailReady && (
              <span className="ks-set__hint" style={{ color: 'var(--high)' }}>
                <AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 5 }} />
                No mail transport is configured, so email alerts cannot send. Set one up under Email delivery first.
              </span>
            )}
          </label>
        )}

        {/* last delivery */}
        {c.lastDeliveryAt && (
          <div className="ks-set__status">
            {c.lastDeliveryOk ? <Check size={13} color="var(--a)" /> : <AlertTriangle size={13} color="var(--crit)" />}
            <span>Last delivery {c.lastDeliveryOk ? 'ok' : 'failed'}{c.lastDeliveryMsg ? ` · ${c.lastDeliveryMsg}` : ''}</span>
          </div>
        )}
        {testMsg && (
          <div className="ks-set__status" style={{ color: testMsg.ok ? 'var(--a)' : 'var(--crit)' }}>
            {testMsg.ok ? <Check size={13} /> : <AlertTriangle size={13} />}<span>{testMsg.text}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="ks-btn ks-btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="ks-btn" onClick={test} disabled={testing}><Send size={13} /> {testing ? 'Sending…' : 'Send test'}</button>
          {savedAt > 0 && !saving && <span className="ks-set__hint" style={{ color: 'var(--a)' }}>Saved</span>}
        </div>
      </div>
    </div>
  )
}
