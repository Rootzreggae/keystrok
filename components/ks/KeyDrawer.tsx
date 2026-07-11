'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useAssistant } from '@/components/ks/Assistant'
import { X, RotateCw, Sparkles } from 'lucide-react'
import { Pill, Dot, LiveBadge } from '@/components/ks'
import { KeyTimeline } from '@/components/ks/KeyTimeline'
import { BlastRadius } from '@/components/ks/BlastRadius'
import { slaDays, foundAgoDays, riskStart, daysUntilDue } from '@/lib/rotation-policy'
import { type ApiKey, SEVL, displayName, urgency, cleanLocation, ago } from '@/lib/keys-display'

// Reusable key detail drawer. Pass the selected key (or null) and an onClose.
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
  const foundDate = new Date(k.created_at)
  const anchor = riskStart({ foundAt: foundDate, exposedAt: exposedAt ? new Date(exposedAt) : null })
  const hasExposure = anchor.getTime() < foundDate.getTime()
  // Recompute urgency locally from the anchor so an edit reflects immediately.
  const u = urgency({ ...k, daysUntilExpiry: daysUntilDue(anchor, k.severity) })
  const sla = slaDays(k.severity)
  const foundAgo = foundAgoDays(foundDate)
  const riskAgo = foundAgoDays(anchor)
  const today = new Date().toISOString().slice(0, 10)
  const loc = cleanLocation(k.location || k.source)
  const ln = loc.match(/:(\d+)$/)?.[1] ?? '1'

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

  return (
    <>
      <div className="ks-drawer-scrim" onClick={onClose} />
      <aside className="ks-drawer">
        <div className="ks-drawer__hd">
          <button className="ks-drawer__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
          <div className="ks-drawer__name">{displayName(k.name)}</div>
          <div className="ks-drawer__tags">
            <Pill tone={k.severity === 'critical' ? 'crit' : k.severity === 'high' ? 'high' : 'mut'}>
              <Dot sev={k.severity as 'critical'} />{SEVL[k.severity] ?? k.severity}
            </Pill>
            {k.status === 'rotated' && <Pill>rotated</Pill>}
          </div>
        </div>

        <div className="ks-drawer__body">
          <div className="ks-dsect">
            <div className="ks-dsect__l">Status</div>
            <div className="ks-kv"><span className="k">Rotation SLA</span><span className="v">{sla} days from {hasExposure ? 'exposure' : 'discovery'}</span></div>
            <div className="ks-kv"><span className="k">Found</span><span className="v">{foundAgo} days ago</span></div>
            {hasExposure && <div className="ks-kv"><span className="k">At risk</span><span className="v">{riskAgo} days ago</span></div>}
            <div className="ks-kv"><span className="k">Time left</span><span className="v" style={{ color: u.color }}>{u.txt}</span></div>
            <div className="ks-kv">
              <span className="k">Liveness</span>
              <span className="v">
                {k.live_status === 'live' || k.live_status === 'revoked'
                  ? <LiveBadge status={k.live_status} active={k.usage_active} />
                  : <span style={{ color: 'var(--tx-dim)' }}>not checked</span>}
              </span>
            </div>
            {k.last_used_at && (
              <div className="ks-kv"><span className="k">Last used</span><span className="v">{ago(k.last_used_at)} ago{k.last_used_source ? ` · ${k.last_used_source}` : ''}</span></div>
            )}
          </div>

          {k.rotation_failed && (
            <div style={{ margin: '0 0 4px', padding: '12px 14px', background: 'var(--crit-dim)', border: '1px solid var(--crit-line)', fontSize: 12.5, color: 'var(--crit)', lineHeight: 1.5 }}>
              <b>Rotation didn&apos;t stick.</b> This key is marked rotated, but a liveness check after the rotation still found it live on its platform. The old credential was never revoked, treat it as still exposed and rotate again.
            </div>
          )}

          {k.usage_active && k.last_used_at && (
            <div style={{ margin: '0 0 4px', padding: '12px 14px', background: 'var(--crit-dim)', border: '1px solid var(--crit-line)', fontSize: 12.5, color: 'var(--crit)', lineHeight: 1.5 }}>
              <b>Active incident.</b> This leaked key is still live on its platform and was used {ago(k.last_used_at)} ago. Rotate it first.
            </div>
          )}

          <div className="ks-dsect">
            <div className="ks-dsect__l">Blast radius</div>
            <BlastRadius keyId={k.id} />
          </div>

          <div className="ks-dsect">
            <div className="ks-dsect__l">Incident timeline</div>
            <KeyTimeline keyId={k.id} />
          </div>

          <div className="ks-dsect">
            <div className="ks-dsect__l">Exposure date</div>
            {!editingDate ? (
              <>
                <div className="ks-kv">
                  <span className="k">At risk since</span>
                  <span className="v">{exposedAt ? exposedAt.slice(0, 10) : 'unknown'}</span>
                </div>
                {exposedAt && (
                  <div style={{ fontSize: 11, color: 'var(--tx-dim)', marginTop: 2 }}>
                    {exposedSource === 'git' ? 'from git history' : 'you entered this'}
                  </div>
                )}
                <button className="ks-btn" style={{ marginTop: 9 }} onClick={() => { setDateDraft(exposedAt?.slice(0, 10) ?? ''); setDateErr(null); setEditingDate(true) }}>
                  {exposedAt ? 'Edit date' : 'Set exposure date'}
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="date" className="ks-input" max={today} value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="ks-btn ks-btn--primary" disabled={savingDate || !dateDraft} onClick={() => saveDate(dateDraft)}>{savingDate ? 'Saving…' : 'Save'}</button>
                  {exposedAt && <button className="ks-btn" disabled={savingDate} onClick={() => saveDate(null)}>Clear</button>}
                  <button className="ks-btn" disabled={savingDate} onClick={() => { setEditingDate(false); setDateErr(null) }}>Cancel</button>
                </div>
                {dateErr && <div style={{ color: 'var(--crit)', fontSize: 11 }}>{dateErr}</div>}
                <div style={{ fontSize: 11, color: 'var(--tx-dim)', lineHeight: 1.5 }}>
                  When did this key actually leak (a public commit, a breach)? Leave it unset if you don&apos;t know, Keystrok counts from discovery instead. A date only ever makes rotation more urgent.
                </div>
              </div>
            )}
          </div>

          <div className="ks-dsect">
            <div className="ks-dsect__l">Where it was found</div>
            <div className="ks-code"><span className="ln">{ln}</span>const KEY = <span className="hit">&quot;{k.key_preview ?? '••••'}&quot;</span></div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx-dim)', marginTop: 9, wordBreak: 'break-all' }}>{loc}</div>
          </div>

          <div className="ks-dsect">
            <div className="ks-dsect__l">Provenance</div>
            <div style={{ fontSize: 12.5, color: 'var(--tx-mut)', lineHeight: 1.6 }}>
              Rotation is anchored to when the key was at-risk: the exposure date if you set one, otherwise discovery. Keystrok never guesses a key&apos;s age.
            </div>
          </div>
        </div>

        {startError && (
          <div className="ks-drawer__err" role="alert">{startError}</div>
        )}
        <div className="ks-drawer__foot">
          <button className="ks-btn ks-btn--primary" style={{ flex: 1, justifyContent: 'center' }} onClick={startRotation} disabled={starting}>
            <RotateCw size={14} /> {starting ? 'Starting…' : k.status === 'rotated' ? 'Rotate again' : 'Start rotation'}
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
