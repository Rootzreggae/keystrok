'use client'

import { useQuery } from '@tanstack/react-query'
import { ago } from '@/lib/keys-display'

interface TLEvent { at: string; kind: string; label: string; detail?: string; tone: 'crit' | 'high' | 'ok' | 'mut'; window: boolean }
interface TLWindow { start: string; end: string | null; days: number; open: boolean; usedDuring: boolean; rotationFailed?: boolean }
interface TL { events: TLEvent[]; window: TLWindow | null }

// Vertical incident timeline for one key: the lifecycle composed as events, with
// the exposure window (at-risk -> closed) highlighted on the rail. See the
// /api/keys/[id]/timeline endpoint. Fetches on demand when the drawer opens.
export function KeyTimeline({ keyId }: { keyId: string }) {
  const { data, isLoading } = useQuery<TL>({
    queryKey: ['timeline', keyId],
    queryFn: async () => {
      const r = await fetch(`/api/keys/${keyId}/timeline`)
      if (!r.ok) throw new Error('timeline')
      return r.json()
    },
  })

  if (isLoading) return <div className="ks-tl__loading">Loading…</div>
  if (!data || data.events.length === 0) return <div className="ks-tl__loading">No events yet.</div>

  // The window bar is gone: "Rotation window" lives in the NOW section, and the
  // open/failed truth is the terminal event below. One fact, one place.
  const w = data.window
  return (
    <div className="ks-tl">
      <div className="ks-tl__list">
        {data.events.map((e, i) => (
          <div className={'ks-tl__ev' + (e.window ? ' in' : '')} key={i}>
            <span className={'ks-tl__dot ' + e.tone} aria-hidden />
            <div className="ks-tl__body">
              <div className="ks-tl__label">{e.label}</div>
              {e.detail && <div className="ks-tl__detail">{e.detail}</div>}
            </div>
            <div className="ks-tl__time">{ago(e.at)} ago</div>
          </div>
        ))}
        {w?.open && (
          <div className="ks-tl__ev in open">
            <span className="ks-tl__dot open" aria-hidden />
            <div className="ks-tl__body">
              <div className="ks-tl__label" style={{ color: 'var(--crit)' }}>{w.rotationFailed ? 'Still exposed' : 'Awaiting rotation'}</div>
              {w.rotationFailed && <div className="ks-tl__detail">rotated, but never revoked</div>}
            </div>
            <div className="ks-tl__time">now</div>
          </div>
        )}
      </div>
    </div>
  )
}
