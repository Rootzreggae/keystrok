'use client'

import { useEffect, useState } from 'react'
import { Mail, Send, Check, AlertTriangle } from 'lucide-react'
import { InlineLoading } from '@/components/ks/Loading'

interface Config { transport: string; host: string; port: number; username: string; from: string; hasPassword: boolean; hasResendKey: boolean }
interface Status {
  transport: 'resend' | 'smtp' | 'none'
  from: string
  detail: string
  catcher: boolean
  source: 'settings' | 'env'
  youEmail: string | null
  config: Config | null
}

// Mail delivery settings: status, test-send, and an editable config form.
// Saving stores a MailConfig row (secrets encrypted) that overrides the EMAIL_*
// env vars; "Revert" deletes it, falling back to env. Secret inputs are
// write-only: blank means "keep the stored value".
export function EmailSettings() {
  const [s, setS] = useState<Status | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [transport, setTransport] = useState<'smtp' | 'resend'>('smtp')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [resendKey, setResendKey] = useState('')
  const [from, setFrom] = useState('')

  const apply = (j: Status) => {
    setS(j)
    const c = j.config
    setTransport(c?.transport === 'resend' ? 'resend' : 'smtp')
    setHost(c?.host ?? '')
    setPort(String(c?.port ?? 587))
    setUsername(c?.username ?? '')
    setFrom(c?.from ?? '')
    setPassword('')
    setResendKey('')
  }

  useEffect(() => { fetch('/api/settings/email').then((r) => r.json()).then(apply).catch(() => {}) }, [])
  if (!s) return <div className="ks-panel"><InlineLoading /></div>
  const configured = s.transport !== 'none'

  const test = async () => {
    setTesting(true); setMsg(null)
    try {
      const r = await fetch('/api/settings/email/test', { method: 'POST' })
      const j = await r.json()
      setMsg({ ok: !!j.ok, text: j.ok ? (j.message || 'Sent.') : (j.error || j.message || 'Failed') })
    } finally { setTesting(false) }
  }

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const r = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transport, host, port: Number(port), username, password, resendKey, from }),
      })
      const j = await r.json()
      if (!r.ok) { setMsg({ ok: false, text: j.error || 'Could not save.' }); return }
      apply(j)
      setMsg({ ok: true, text: 'Saved. Send a test email to confirm delivery.' })
    } finally { setSaving(false) }
  }

  const revert = async () => {
    setSaving(true); setMsg(null)
    try {
      const r = await fetch('/api/settings/email', { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) { setMsg({ ok: false, text: j.error || 'Could not revert.' }); return }
      apply(j)
      setMsg({ ok: true, text: 'Reverted to the server environment settings.' })
    } finally { setSaving(false) }
  }

  const lbl = { display: 'block', marginBottom: 6 } as const
  const field = { display: 'flex', flexDirection: 'column' } as const

  return (
    <div className="ks-panel" style={{ marginTop: 20 }}>
      <div className="ks-panel__hd">
        <span className="ks-panel__t"><Mail size={14} style={{ verticalAlign: -2, marginRight: 7 }} />Email</span>
        <span className="ks-panel__sub" style={{ marginLeft: 'auto' }}>invites and magic-link sign-in</span>
      </div>

      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="ks-set__status">
          {configured && !s.catcher ? <Check size={14} color="var(--a)" /> : <AlertTriangle size={14} color="var(--high)" />}
          <span style={{ color: configured && !s.catcher ? 'var(--tx)' : 'var(--high)' }}>
            {!configured ? 'No mail configured, invites and magic links won’t send'
              : s.catcher ? `Sending via ${s.detail}, a local catcher: nothing reaches a real inbox`
              : `Sending via ${s.detail}`}
          </span>
        </div>
        <div className="ks-set__hint">
          {s.source === 'settings'
            ? 'Using the settings saved here (they override the server environment variables).'
            : 'Using the server environment variables. Saving below overrides them without a restart.'}
          {configured && <> From: <code>{s.from}</code></>}
        </div>

        {/* Transport picker */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['smtp', 'resend'] as const).map((t) => (
            <button
              key={t}
              className={'ks-btn' + (transport === t ? ' ks-btn--primary' : '')}
              aria-pressed={transport === t}
              onClick={() => { setTransport(t); setMsg(null) }}
            >
              {t === 'smtp' ? 'SMTP' : 'Resend'}
            </button>
          ))}
        </div>

        {transport === 'smtp' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 12 }}>
            <div style={field}>
              <label className="ks-invite__lbl" style={lbl}>Host</label>
              <input className="ks-input" placeholder="smtp.example.com" value={host} onChange={(e) => setHost(e.target.value)} />
            </div>
            <div style={field}>
              <label className="ks-invite__lbl" style={lbl}>Port</label>
              <input className="ks-input" inputMode="numeric" placeholder="587" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
            <div style={field}>
              <label className="ks-invite__lbl" style={lbl}>Username <span style={{ textTransform: 'none', opacity: 0.7 }}>(blank = no authentication)</span></label>
              <input className="ks-input" autoComplete="off" placeholder="user@example.com" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div style={field}>
              <label className="ks-invite__lbl" style={lbl}>Password</label>
              <input className="ks-input" type="password" autoComplete="new-password" placeholder={s.config?.hasPassword ? 'unchanged' : ''} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
        )}

        {transport === 'resend' && (
          <div style={field}>
            <label className="ks-invite__lbl" style={lbl}>API key</label>
            <input className="ks-input" type="password" autoComplete="new-password" placeholder={s.config?.hasResendKey ? 'unchanged' : 're_...'} value={resendKey} onChange={(e) => setResendKey(e.target.value)} />
          </div>
        )}

        <div style={field}>
          <label className="ks-invite__lbl" style={lbl}>From address <span style={{ textTransform: 'none', opacity: 0.7 }}>(blank = server default)</span></label>
          <input className="ks-input" placeholder="Keystrok <keys@yourdomain.com>" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>

        {msg && (
          <div className="ks-set__status" style={{ color: msg.ok ? 'var(--a)' : 'var(--crit)' }}>
            {msg.ok ? <Check size={13} /> : <AlertTriangle size={13} />}<span>{msg.text}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="ks-btn ks-btn--primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="ks-btn" onClick={test} disabled={testing || !configured} title={configured ? `Send a test to ${s.youEmail ?? 'you'}` : 'Configure mail first'}>
            <Send size={13} /> {testing ? 'Sending…' : 'Send test email'}
          </button>
          {configured && s.youEmail && <span className="ks-set__hint">test goes to {s.youEmail}</span>}
          {s.source === 'settings' && (
            <button className="ks-btn" style={{ marginLeft: 'auto' }} onClick={revert} disabled={saving} title="Delete the saved config and use the server environment variables">
              Revert to environment
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
