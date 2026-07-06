'use client'

import { useQuery } from '@tanstack/react-query'
import type { Posture } from '@/lib/posture'

// Hygiene posture: SLO tiles + a backlog trend, both derived from the timestamps
// already on each key. The "monitor, not snapshot" view that keeps the tab open.
export function PostureStrip() {
  const { data } = useQuery<Posture>({
    queryKey: ['posture'],
    queryFn: async () => {
      const r = await fetch('/api/posture')
      if (!r.ok) throw new Error('posture')
      return r.json()
    },
    refetchInterval: 60000,
  })
  if (!data) return null

  const { compliance, mttrDays, resolvedCount, rotationsFailed, openExposureDays, trend } = data
  // Nothing tracked yet -> the statbar/empty states already cover it.
  if (compliance.total === 0 && resolvedCount === 0) return null

  const complianceTone = compliance.pct === null ? '' : compliance.pct >= 100 ? 'ok' : compliance.pct >= 50 ? 'warn' : 'crit'

  return (
    <div className="ks-posture">
      <div className="ks-posture__hd">
        <span className="ks-panel__t">Hygiene</span>
        <span className="ks-posture__sub">derived from your key history</span>
      </div>
      <div className="ks-posture__body">
        <div className="ks-posture__metrics">
          <div className="ks-posture__m">
            <div className={'ks-posture__n ' + complianceTone}>{compliance.pct === null ? '—' : `${compliance.pct}%`}</div>
            <div className="ks-posture__l">within rotation SLA</div>
            <div className="ks-posture__s">{compliance.within}/{compliance.total} open keys</div>
            {rotationsFailed > 0 && (
              <div className="ks-posture__s" style={{ color: 'var(--crit)' }}>{`${rotationsFailed} rotation${rotationsFailed > 1 ? 's' : ''} didn't stick`}</div>
            )}
          </div>
          <div className="ks-posture__m">
            <div className="ks-posture__n">{mttrDays === null ? '—' : `${mttrDays}d`}</div>
            <div className="ks-posture__l">mean time to rotate</div>
            <div className="ks-posture__s">{resolvedCount} resolved</div>
          </div>
          <div className="ks-posture__m">
            <div className={'ks-posture__n ' + (openExposureDays > 0 ? 'warn' : 'ok')}>{openExposureDays}</div>
            <div className="ks-posture__l">exposure-days open</div>
            <div className="ks-posture__s">still accruing</div>
          </div>
        </div>
        <Trend trend={trend} />
      </div>
    </div>
  )
}

// Inline SVG bars, no chart lib. Backlog of open at-risk keys per week.
function Trend({ trend }: { trend: Posture['trend'] }) {
  const max = Math.max(1, ...trend.map((t) => t.open))
  const W = 4, GAP = 4, H = 44
  const width = trend.length * (W + GAP) - GAP
  return (
    <div className="ks-posture__trend">
      <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="none" role="img" aria-label="Open at-risk keys, last 12 weeks">
        {trend.map((t, i) => {
          const h = t.open === 0 ? 1 : Math.max(2, Math.round((t.open / max) * H))
          const last = i === trend.length - 1
          return <rect key={t.weekEnd} x={i * (W + GAP)} y={H - h} width={W} height={h} rx={1} fill={last ? 'var(--high)' : 'var(--tx-dim)'} opacity={t.open === 0 ? 0.3 : 1} />
        })}
      </svg>
      <div className="ks-posture__cap">open at-risk keys · last {trend.length} weeks</div>
    </div>
  )
}
