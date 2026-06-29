'use client'

import React from 'react'
import { Icon } from '@/components/ds/Icon'

type State = 'idle' | 'submitting' | 'done' | 'error'

/**
 * Invite-request form for the landing CTA. Posts to the real /api/waitlist
 * (per-IP rate-limited, sends a confirmation via the configured mailer).
 * Terminal-styled to sit in the schematic CTA's `.actions` row.
 */
export function WaitlistForm() {
  const [email, setEmail] = React.useState('')
  const [state, setState] = React.useState<State>('idle')
  const [message, setMessage] = React.useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'submitting') return
    setState('submitting')
    setMessage('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setState('done')
        setMessage('Request received. Check your inbox.')
      } else {
        setState('error')
        setMessage(data?.message || data?.error || 'Something went wrong. Try again.')
      }
    } catch {
      setState('error')
      setMessage('Network error. Try again.')
    }
  }

  if (state === 'done') {
    return (
      <span
        className="cell"
        style={{ color: 'var(--status-secure, #22c55e)', fontFamily: 'var(--mono)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <Icon name="check-circle" size={15} color="var(--status-secure, #22c55e)" /> {message}
      </span>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'inline-flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Email address"
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 13,
            color: 'var(--tx, #e6eaf0)',
            background: 'var(--bg-inner, #0a0d12)',
            border: '1px solid var(--line, #232a35)',
            borderRadius: 6,
            padding: '9px 12px',
            minWidth: 200,
            outline: 'none',
          }}
        />
        <button
          className="btn primary"
          type="submit"
          disabled={state === 'submitting'}
          style={{ whiteSpace: 'nowrap' }}
        >
          <Icon name="key" size={15} /> {state === 'submitting' ? 'Sending…' : 'Request access'}
        </button>
      </div>
      {state === 'error' && (
        <span style={{ color: 'var(--crit, #f87171)', fontFamily: 'var(--mono)', fontSize: 11 }}>{message}</span>
      )}
    </form>
  )
}

export default WaitlistForm
