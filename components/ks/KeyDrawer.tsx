'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { X, RotateCw, Sparkles } from 'lucide-react'
import { Pill, Dot } from '@/components/ks'
import { slaDays, foundAgoDays } from '@/lib/rotation-policy'
import { type ApiKey, SEVL, displayName, urgency, cleanLocation } from '@/lib/keys-display'

// Reusable key detail drawer. Pass the selected key (or null) and an onClose.
export function KeyDrawer({ keyData, onClose }: { keyData: ApiKey | null; onClose: () => void }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  // Close on Escape.
  useEffect(() => {
    if (!keyData) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyData, onClose])

  if (!keyData) return null

  const k = keyData
  const u = urgency(k)
  const sla = slaDays(k.severity)
  const foundAgo = foundAgoDays(new Date(k.created_at))
  const loc = cleanLocation(k.location || k.source)
  const ln = loc.match(/:(\d+)$/)?.[1] ?? '1'

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
            <div className="ks-kv"><span className="k">Rotation SLA</span><span className="v">{sla} days from discovery</span></div>
            <div className="ks-kv"><span className="k">Found</span><span className="v">{foundAgo} days ago</span></div>
            <div className="ks-kv"><span className="k">Time left</span><span className="v" style={{ color: u.color }}>{u.txt}</span></div>
          </div>

          <div className="ks-dsect">
            <div className="ks-dsect__l">Where it was found</div>
            <div className="ks-code"><span className="ln">{ln}</span>const KEY = <span className="hit">&quot;{k.key_preview ?? '••••'}&quot;</span></div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tx-dim)', marginTop: 9, wordBreak: 'break-all' }}>{loc}</div>
          </div>

          <div className="ks-dsect">
            <div className="ks-dsect__l">Provenance</div>
            <div style={{ fontSize: 12.5, color: 'var(--tx-mut)', lineHeight: 1.6 }}>
              Tracked from discovery. Keystrok never sees or stores a key&apos;s true creation or expiry date.
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
          <button className="ks-btn" title="Assistant: coming soon" onClick={() => {}}>
            <Sparkles size={14} /> Ask Assistant
          </button>
        </div>
      </aside>
    </>
  )
}
