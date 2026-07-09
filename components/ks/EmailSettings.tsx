'use client'

import { useEffect, useState } from 'react'
import { Send, Check, AlertTriangle } from 'lucide-react'
import { InlineLoading } from '@/components/ks/Loading'

interface Effective { host: string; port: number; username: string; from: string; hasPassword: boolean; hasResendKey: boolean }
interface Status {
  transport: 'resend' | 'smtp' | 'none'
  from: string
  detail: string
  catcher: boolean
  source: 'settings' | 'env'
  youEmail: string | null
  effective: Effective
  fromSource: 'saved' | 'environment' | 'default'
}

// Email delivery v2 (design/mock: email-delivery content column). Status header
// with source chip and amber catcher state, per-field source tags, write-only
// secrets, Revert appears only when a saved MailConfig row exists.
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
    setTransport(j.transport === 'resend' ? 'resend' : 'smtp')
    setHost(j.effective.host)
    setPort(String(j.effective.port || 587))
    setUsername(j.effective.username)
    setFrom(j.fromSource === 'default' ? '' : j.effective.from)
    setPassword('')
    setResendKey('')
  }

  useEffect(() => { fetch('/api/settings/email').then((r) => r.json()).then(apply).catch(() => {}) }, [])
  if (!s) return <div className="ks-panel"><InlineLoading /></div>
  const configured = s.transport !== 'none'
  const saved = s.source === 'settings'
  const srcTag = saved ? 'saved' : 'environment'

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
      setMsg({ ok: true, text: 'Reverted. The server environment variables apply again.' })
    } finally { setSaving(false) }
  }

  const secretTag = (has: boolean) =>
    has ? (saved ? 'set · never shown' : 'set in environment · never shown') : 'not set'

  return (
    <div>
      <div className="ks-mail__title">
        <h2>Email delivery</h2>
        <span className="ks-mail__meta">invites, magic-link sign-in and email alerts</span>
      </div>

      <div className="ks-mail__card">

        {/* status header: healthy / catcher (amber) / not configured (amber) */}
        <div className={'ks-mail__status' + (!configured || s.catcher ? ' ks-mail__status--amber' : '')}>
          <span className="ks-mail__dot" />
          <div className="ks-mail__stbd">
            {!configured ? (
              <>
                <div className="ks-mail__l1">Not configured</div>
                <div className="ks-mail__l2">invites and magic links won&apos;t send until a transport is set below</div>
              </>
            ) : s.catcher ? (
              <>
                <div className="ks-mail__l1">Catcher active <span className="ks-mail__ep">· {s.detail.replace('SMTP · ', '')}</span></div>
                <div className="ks-mail__l2">messages are captured locally and delivered to no one. Fix the host below or revert.</div>
              </>
            ) : (
              <>
                <div className="ks-mail__l1">Sending via {s.transport === 'resend' ? 'Resend' : 'SMTP'} {s.transport === 'smtp' && <span className="ks-mail__ep">· {s.detail.replace('SMTP · ', '')}</span>}</div>
                <div className="ks-mail__l2">from {s.from}</div>
              </>
            )}
          </div>
          {s.catcher && <span className="ks-mail__chip ks-mail__chip--amber">catching</span>}
          <span className="ks-mail__chip">source: {saved ? 'saved settings' : 'environment'}</span>
        </div>

        <div className="ks-mail__bd">

          <div className="ks-mail__provider">
            <div style={{ flex: 1 }}>
              <div className="ks-mail__provt">Provider</div>
              <div className="ks-mail__provd">
                {saved
                  ? 'Running on settings saved here. Revert clears them; environment variables apply again.'
                  : 'Running on server environment variables. Saving stores an override, no restart needed.'}
              </div>
            </div>
            <div className="ks-mail__seg">
              {(['smtp', 'resend'] as const).map((t) => (
                <button key={t} className={transport === t ? 'on' : ''} aria-pressed={transport === t} onClick={() => { setTransport(t); setMsg(null) }}>
                  {t === 'smtp' ? 'SMTP' : 'Resend'}
                </button>
              ))}
            </div>
          </div>

          {transport === 'smtp' && (
            <>
              <div className="ks-mail__row ks-mail__row--hostport">
                <div className="ks-mail__field">
                  <div className="ks-mail__lblrow"><span className="ks-mail__lbl">Host</span><span className="ks-mail__src">{srcTag}</span></div>
                  <input className="ks-mail__input" placeholder="smtp.example.com" value={host} onChange={(e) => setHost(e.target.value)} />
                </div>
                <div className="ks-mail__field">
                  <div className="ks-mail__lblrow"><span className="ks-mail__lbl">Port</span><span className="ks-mail__src">{srcTag}</span></div>
                  <input className="ks-mail__input" inputMode="numeric" placeholder="587" value={port} onChange={(e) => setPort(e.target.value)} />
                </div>
              </div>

              <div className="ks-mail__row">
                <div className="ks-mail__field">
                  <div className="ks-mail__lblrow"><span className="ks-mail__lbl">Username</span><span className="ks-mail__src">{srcTag}</span></div>
                  <input className="ks-mail__input" autoComplete="off" placeholder="user@example.com" value={username} onChange={(e) => setUsername(e.target.value)} />
                  <span className="ks-mail__hint">Blank = no authentication.</span>
                </div>
                <div className="ks-mail__field">
                  <div className="ks-mail__lblrow"><span className="ks-mail__lbl">Password</span><span className="ks-mail__src">{secretTag(s.effective.hasPassword)}</span></div>
                  <input className="ks-mail__input" type="password" autoComplete="new-password" placeholder={s.effective.hasPassword ? 'unchanged' : ''} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <span className="ks-mail__hint">Write-only. Blank keeps it, typing replaces it.</span>
                </div>
              </div>
            </>
          )}

          {transport === 'resend' && (
            <div className="ks-mail__field">
              <div className="ks-mail__lblrow"><span className="ks-mail__lbl">API key</span><span className="ks-mail__src">{secretTag(s.effective.hasResendKey)}</span></div>
              <input className="ks-mail__input" type="password" autoComplete="new-password" placeholder={s.effective.hasResendKey ? 'unchanged' : 're_...'} value={resendKey} onChange={(e) => setResendKey(e.target.value)} />
              <span className="ks-mail__hint">Write-only. Blank keeps it, typing replaces it.</span>
            </div>
          )}

          <div className="ks-mail__field">
            <div className="ks-mail__lblrow"><span className="ks-mail__lbl">From address</span><span className="ks-mail__src">{s.fromSource}</span></div>
            <input className="ks-mail__input" placeholder="Keystrok <keys@yourdomain.com>" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="ks-mail__hint">Blank = server default.</span>
          </div>

          {msg && (
            <div className="ks-set__status" role="alert" style={{ color: msg.ok ? 'var(--a)' : 'var(--crit)' }}>
              {msg.ok ? <Check size={13} /> : <AlertTriangle size={13} />}<span>{msg.text}</span>
            </div>
          )}

          <div className="ks-mail__foot">
            <button className="ks-btn ks-btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="ks-btn" onClick={test} disabled={testing || !configured} title={configured ? `Send a test to ${s.youEmail ?? 'you'}` : 'Configure mail first'}>
              <Send size={13} /> {testing ? 'Sending…' : 'Send test email'}
            </button>
            {configured && s.youEmail && <span className="ks-mail__note">test goes to {s.youEmail}</span>}
            <span className="ks-mail__sp" />
            {saved
              ? <button className="ks-btn" onClick={revert} disabled={saving} title="Delete the saved config and use the server environment variables">Revert to environment</button>
              : <span className="ks-mail__revnote">no saved config, nothing to revert</span>}
          </div>

        </div>
      </div>
    </div>
  )
}
