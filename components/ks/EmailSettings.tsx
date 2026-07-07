'use client'

import { useEffect, useState } from 'react'
import { Mail, Send, Check, AlertTriangle } from 'lucide-react'
import { InlineLoading } from '@/components/ks/Loading'

interface Status { transport: 'resend' | 'smtp' | 'none'; from: string; detail: string; youEmail: string | null }

// Mail delivery status + test-send. Read-only: mail config lives in env (infra
// secret; the bootstrap magic link needs it before any UI exists), so we surface
// status, verification, and setup instructions, not editing. See the Team banner.
export function EmailSettings() {
  const [s, setS] = useState<Status | null>(null)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { fetch('/api/settings/email').then((r) => r.json()).then(setS).catch(() => {}) }, [])
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

  return (
    <div className="ks-panel" style={{ marginTop: 20 }}>
      <div className="ks-panel__hd">
        <span className="ks-panel__t"><Mail size={14} style={{ verticalAlign: -2, marginRight: 7 }} />Email</span>
        <span className="ks-panel__sub" style={{ marginLeft: 'auto' }}>invites and magic-link sign-in</span>
      </div>

      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="ks-set__status">
          {configured ? <Check size={14} color="var(--a)" /> : <AlertTriangle size={14} color="var(--high)" />}
          <span style={{ color: configured ? 'var(--tx)' : 'var(--high)' }}>
            {configured ? `Sending via ${s.detail}` : 'No mail configured, invites and magic links won’t send'}
          </span>
        </div>
        {configured && <div className="ks-set__hint">From: <code>{s.from}</code></div>}

        {!configured && (
          <div className="ks-set__hint" style={{ lineHeight: 1.6 }}>
            Set one of these in your environment, then restart:
            <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx-2)' }}>
              <div><code>RESEND_API_KEY=…</code> (Resend), or</div>
              <div><code>EMAIL_SERVER_HOST=…</code> <code>EMAIL_SERVER_PORT=…</code> (your own SMTP)</div>
            </div>
          </div>
        )}

        {msg && (
          <div className="ks-set__status" style={{ color: msg.ok ? 'var(--a)' : 'var(--crit)' }}>
            {msg.ok ? <Check size={13} /> : <AlertTriangle size={13} />}<span>{msg.text}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="ks-btn" onClick={test} disabled={testing || !configured} title={configured ? `Send a test to ${s.youEmail ?? 'you'}` : 'Configure mail first'}>
            <Send size={13} /> {testing ? 'Sending…' : 'Send test email'}
          </button>
          {configured && s.youEmail && <span className="ks-set__hint">goes to {s.youEmail}</span>}
        </div>
      </div>
    </div>
  )
}
