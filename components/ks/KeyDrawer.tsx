'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useAssistant } from '@/components/ks/Assistant'
import { X, RotateCw, Sparkles } from 'lucide-react'
import { Pill, Dot, Mark, LiveBadge } from '@/components/ks'
import { KeyTimeline } from '@/components/ks/KeyTimeline'
import { BlastRadius } from '@/components/ks/BlastRadius'
import { slaDays, foundAgoDays, riskStart, daysUntilDue } from '@/lib/rotation-policy'
import { type ApiKey, SEVL, platOf, displayName, urgency, ago } from '@/lib/keys-display'

// Reusable key detail drawer. One question per section: what's true NOW,
// where is it EXPOSED, what does rotating touch (BLAST RADIUS), WHAT HAPPENED.
// One banner max: the worst truth wins, everything else is a quiet row.
export function KeyDrawer({ keyData, onClose }: { keyData: ApiKey | null; onClose: () => void }) {
  const router = useRouter()
  const qc = useQueryClient()
  const { open: openAssistant } = useAssistant()
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  // Exposure date is edited locally so the drawer updates instantly; the list
  // refetches on save. Seeded from the key and re-synced when a new key opens.
  const [exposedAt, setExposedAt] = useState<string | null>(keyData?.exposed_at ?? null)
  const [exposedSource, setExposedSource] = useState<string | null>(keyData?.exposed_at_source ?? null)
  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft, setDateDraft] = useState('')
  const [savingDate, setSavingDate] = useState(false)
  const [dateErr, setDateErr] = useState<string | null>(null)

  // Close on Escape.
  useEffect(() => {
    if (!keyData) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyData, onClose])

  // Re-sync local exposure state when a different key is opened.
  useEffect(() => {
    setExposedAt(keyData?.exposed_at ?? null)
    setExposedSource(keyData?.exposed_at_source ?? null)
    setEditingDate(false)
    setDateErr(null)
  }, [keyData?.id, keyData?.exposed_at, keyData?.exposed_at_source])

  if (!keyData) return null

  const k = keyData
  const plat = platOf(k.platform)
  const foundDate = new Date(k.created_at)
  const anchor = riskStart({ foundAt: foundDate, exposedAt: exposedAt ? new Date(exposedAt) : null })
  const hasExposure = anchor.getTime() < foundDate.getTime()
  // Recompute urgency locally from the anchor so an edit reflects immediately.
  const dl = daysUntilDue(anchor, k.severity)
  const u = urgency({ ...k, daysUntilExpiry: dl })
  const sla = slaDays(k.severity)
  const foundAgo = foundAgoDays(foundDate)
  const today = new Date().toISOString().slice(0, 10)
  const rotated = k.status === 'rotated' && !k.rotation_failed

  const saveDate = async (value: string | null) => {
    setSavingDate(true)
    setDateErr(null)
    try {
      const res = await fetch(`/api/keys/${k.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exposedAt: value }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Could not save (${res.status})`)
      setExposedAt(data.exposed_at)
      setExposedSource(data.exposed_at_source)
      setEditingDate(false)
      await qc.invalidateQueries({ queryKey: ['keys'] })
    } catch (e) {
      setDateErr(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSavingDate(false)
    }
  }

  const startRotation = async () => {
    setStarting(true)
    setStartError(null)
    try {
      const res = await fetch('/api/workflows/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discoveredKeyId: k.id }),
      })
      const data = await res.json().catch(() => null)
      const wfId = data?.data?.workflow?.id ?? data?.workflow?.id
      // Only navigate once we actually have a workflow; never fake success.
      if (!res.ok || !wfId) throw new Error(data?.error || `Could not start rotation (${res.status})`)
      // The workflows list is cached (1min staleTime); refetch so the queue shows the new one.
      await qc.invalidateQueries({ queryKey: ['workflows'] })
      router.push(`/rotation-workflows?workflow=${wfId}`)
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Could not start rotation')
      setStarting(false)
    }
  }

  // The rotation window row: one number, colored by state.
  const windowCell = rotated
    ? { txt: u.txt, color: 'var(--ok)' }
    : dl < 0
      ? { txt: `closed ${-dl} day${dl === -1 ? '' : 's'} ago`, color: 'var(--crit)' }
      : { txt: `${dl} day${dl === 1 ? '' : 's'} left`, color: u.color }

  return (
    <>
      <div className="ks-drawer-scrim" onClick={onClose} />
      <aside className="ks-drawer">
        <div className="ks-drawer__hd">
          <button className="ks-drawer__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
          <div className="ks-drawer__name">{displayName(k.name)}</div>
          <div className="ks-drawer__chips">
            <Mark>{plat.code}</Mark>
            {k.key_preview && <span className="ks-drawer__preview" style={{ marginTop: 0 }}>{k.key_preview}</span>}
            <Pill tone={k.severity === 'critical' ? 'crit' : k.severity === 'high' ? 'high' : 'mut'}>
              <Dot sev={k.severity as 'critical'} />{SEVL[k.severity] ?? k.severity}
            </Pill>
            {rotated && <Pill>rotated</Pill>}
          </div>
        </div>

        <div className="ks-drawer__body">
          {/* One banner max, worst truth first: a failed rotation outranks an
              active incident (it reads "handled" while still exposed). */}
          {k.rotation_failed ? (
            <div className="ks-drawer__banner">
              <div className="ks-drawer__bannert">Rotated, but never revoked · still exposed</div>
              A liveness check after the rotation found the old credential <b>still live on {plat.label}</b>.
              Treat it as exposed: rotate again, and revoke this time.
            </div>
          ) : k.usage_active && k.last_used_at ? (
            <div className="ks-drawer__banner">
              <div className="ks-drawer__bannert">Live and in use · active incident</div>
              This leaked key answers on {plat.label} and was used {ago(k.last_used_at)} ago. Rotate it first.
            </div>
          ) : null}

          <div className="ks-dsect">
            <div className="ks-dsect__l">Now</div>
            <div className="ks-kv">
              <span className="k">Liveness</span>
              <span className="v">
                {k.live_status === 'live' || k.live_status === 'revoked'
                  ? <><LiveBadge status={k.live_status} active={k.usage_active} />{k.live_checked_at && <span style={{ color: 'var(--tx-dim)' }}> · checked {ago(k.live_checked_at)} ago</span>}</>
                  : <span style={{ color: 'var(--tx-dim)' }}>not checked</span>}
              </span>
            </div>
            <div className="ks-kv"><span className="k">Rotation window</span><span className="v" style={{ color: windowCell.color }}>{windowCell.txt}</span></div>
            <div className="ks-kv"><span className="k">Found</span><span className="v">{foundAgo} days ago</span></div>
            {k.last_used_at && (
              <div className="ks-kv"><span className="k">Last used</span><span className="v">{ago(k.last_used_at)} ago{k.last_used_source ? ` · ${k.last_used_source}` : ''}</span></div>
            )}
            <div className="ks-kv">
              <span className="k">At risk since</span>
              <span className="v">
                {exposedAt ? exposedAt.slice(0, 10) : 'unknown'}
                {exposedAt && <span style={{ color: 'var(--tx-dim)' }}> · {exposedSource === 'git' ? 'git' : 'you'}</span>}
                {!editingDate && (
                  <button className="ks-br__miss" style={{ marginLeft: 8 }} onClick={() => { setDateDraft(exposedAt?.slice(0, 10) ?? ''); setDateErr(null); setEditingDate(true) }}>
                    {exposedAt ? 'edit' : 'set'}
                  </button>
                )}
              </span>
            </div>
            {editingDate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                <input type="date" className="ks-input" max={today} value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="ks-btn ks-btn--primary ks-btn--sm" disabled={savingDate || !dateDraft} onClick={() => saveDate(dateDraft)}>{savingDate ? 'Saving…' : 'Save'}</button>
                  {exposedAt && <button className="ks-btn ks-btn--sm" disabled={savingDate} onClick={() => saveDate(null)}>Clear</button>}
                  <button className="ks-btn ks-btn--sm" disabled={savingDate} onClick={() => { setEditingDate(false); setDateErr(null) }}>Cancel</button>
                </div>
                {dateErr && <div style={{ color: 'var(--crit)', fontSize: 11 }}>{dateErr}</div>}
                <div style={{ fontSize: 11, color: 'var(--tx-dim)', lineHeight: 1.5 }}>
                  When did this key actually leak (a public commit, a breach)? Leave it unset if you don&apos;t know, Keystrok counts from discovery instead. A date only ever makes rotation more urgent.
                </div>
              </div>
            )}
            <div className="ks-drawer__note">
              window: {sla} days from {hasExposure ? 'exposure' : 'discovery'} · Keystrok never sees a key&apos;s true creation or expiry date.
            </div>
          </div>

          <BlastRadius keyId={k.id} keyPreview={k.key_preview} />

          <div className="ks-dsect">
            <div className="ks-dsect__lrow">
              <span className="ks-dsect__l" style={{ margin: 0 }}>What happened</span>
              <a className="ks-br__miss" href="/rotation-workflows">runbook &amp; receipts</a>
            </div>
            <div style={{ marginTop: 12 }}>
              <KeyTimeline keyId={k.id} />
            </div>
          </div>
        </div>

        {startError && (
          <div className="ks-drawer__err" role="alert">{startError}</div>
        )}
        <div className="ks-drawer__advisory">Advisory · Keystrok never rotates or revokes on its own.</div>
        <div className="ks-drawer__foot">
          <button className="ks-btn ks-btn--primary" style={{ flex: 1, justifyContent: 'center' }} onClick={startRotation} disabled={starting}>
            <RotateCw size={14} /> {starting ? 'Starting…' : k.rotation_failed ? 'Rotate again & revoke old key' : rotated ? 'Rotate again' : 'Start rotation'}
          </button>
          <button
            className="ks-btn"
            title="Ask the assistant about this key"
            onClick={() => {
              onClose()
              openAssistant(`What should I do about the ${displayName(k.name)} key? It's ${SEVL[k.severity] ?? k.severity} severity and ${u.txt}.`)
            }}
          >
            <Sparkles size={14} /> Ask Assistant
          </button>
        </div>
      </aside>
    </>
  )
}
