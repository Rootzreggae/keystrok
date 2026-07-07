'use client'

import { useQuery } from '@tanstack/react-query'
import type { Posture } from '@/lib/posture'

// Home attention + hygiene band. Operational row first (what needs doing now),
// hygiene sub-band second (how we're trending). Replaces the old 4-cell statbar
// and the standalone hygiene strip, per the Round-1 design handoff.
// Operational counts come from the caller's keys query; hygiene fetches posture.

// A reasonable rotation-turnaround target. ponytail: hard-coded benchmark, lift
// into policy/config if teams want per-severity MTTR targets.
const MTTR_TARGET = 7

export function HomeBand({ needAction, overdue, rotating, total, onView }: {
  needAction: number; overdue: number; rotating: number; total: number; onView: () => void
}) {
  const { data } = useQuery<Posture>({
    queryKey: ['posture'],
    queryFn: async () => {
      const r = await fetch('/api/posture')
      if (!r.ok) throw new Error('posture')
      return r.json()
    },
    refetchInterval: 60000,
  })

  return (
    <div className="ks-band">
      <div className="ks-band__now">
        <button className="ks-band__cell is-attn" onClick={onView}>
          <div className="ks-band__n">{needAction}{needAction > 0 && <span className="affix">▲</span>}</div>
          <div className="ks-band__l">Needs action</div>
          {needAction > 0 && (
            <div className="ks-band__d">{overdue > 0 ? `${overdue} overdue · SLA expired` : 'in the rotation window'}</div>
          )}
          <span className="ks-band__go">view →</span>
        </button>
        <a className={'ks-band__cell' + (rotating === 0 ? ' is-zero' : '')} href="/rotation-workflows" title="Active rotation workflows">
          <div className="ks-band__n">{rotating}</div>
          <div className="ks-band__l">Rotating</div>
        </a>
        <a className="ks-band__cell" href="/inventory" title="All tracked keys">
          <div className="ks-band__n">{total}</div>
          <div className="ks-band__l">Tracked</div>
        </a>
      </div>
      {data && <HygieneBand p={data} />}
    </div>
  )
}

function HygieneBand({ p }: { p: Posture }) {
  const total = p.compliance.total
  const past = total - p.compliance.within // past-due or a failed rotation
  // Honest denominators: a fraction under 10 keys, a percentage only at ~10+.
  const slaVal = total === 0 ? '0' : total < 10 ? `${past} of ${total}` : `${Math.round((past / total) * 100)}%`
  const mttr = p.mttrDays
  const onTarget = mttr !== null && mttr <= MTTR_TARGET

  return (
    <div className="ks-band__hyg">
      <span className="ks-band__hygcap">Hygiene<br />12 weeks</span>

      <a className="ks-band__m" href="/inventory?filter=needs-action" title="See the keys past their rotation SLA">
        <div className={'v' + (past > 0 ? ' warn' : '')}>{slaVal}{past > 0 && <span className="u">▲</span>}</div>
        <div className="k">{total === 0 ? 'no open keys' : 'open keys past SLA'}</div>
      </a>

      <a className="ks-band__m" href="/rotation-workflows" title="Rotation turnaround, from completed rotations">
        <div className="v">{mttr === null ? 'n/a' : mttr}{mttr !== null && <span className="u">d to rotate</span>}</div>
        <div className="k">
          {mttr === null ? 'no rotations yet'
            : onTarget ? <><span className="ok">✓ on target</span> · ≤ {MTTR_TARGET}d</>
            : <><span className="warn">▲ over target</span> · ≤ {MTTR_TARGET}d</>}
        </div>
      </a>

      <a className="ks-band__m" href="/inventory?filter=needs-action&lens=timeline" title="See the at-risk keys accruing this exposure">
        <div className={'v' + (p.openExposureDays > 0 ? ' warn' : '')}>{p.openExposureDays}{p.openExposureDays > 0 && <span className="u">▲</span>}</div>
        <div className="k">exposure-days open · accruing</div>
      </a>

      <Trend trend={p.trend} />
    </div>
  )
}

// 12 weekly exposure-day bars on a baseline; the recent 3 weeks are highlighted.
function Trend({ trend }: { trend: Posture['trend'] }) {
  const max = Math.max(1, ...trend.map((t) => t.expDays))
  const H = 34
  return (
    <a className="ks-band__trend" href="/inventory?filter=needs-action&lens=timeline"
       title="See the at-risk keys accruing these exposure-days">
      <div className="ks-band__bars" role="img" aria-label="Exposure-days burned, last 12 weeks">
        {trend.map((t, i) => (
          <i key={t.weekEnd} className={i >= trend.length - 3 ? 'hot' : ''}
             title={`week ending ${t.weekEnd} · ${t.expDays} exposure-day${t.expDays === 1 ? '' : 's'}`}
             style={{ height: t.expDays === 0 ? 1 : Math.max(2, Math.round((t.expDays / max) * H)) }} />
        ))}
      </div>
      <div className="ks-band__trendcap">exposure-days<br />weekly · 12w →</div>
    </a>
  )
}
