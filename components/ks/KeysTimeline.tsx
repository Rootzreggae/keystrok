'use client'

import { useState } from 'react'
import { Mark, Dot } from '@/components/ks'
import { daysUntilDue } from '@/lib/rotation-policy'
import { type ApiKey, platOf, SEVL, displayName, urgency, anchorOf } from '@/lib/keys-display'

// Rotation horizon: keys plotted on a NOW→horizon window, one lane per severity,
// positioned by days-until-rotation. The horizon is zoomable via presets that
// snap to the rotation bands (7 / 30 / 90d), 7d to focus near-term urgency,
// 90d to see the whole lifecycle with nothing clamped. Overdue keys sit in the
// tinted band left of NOW; keys past the chosen horizon clamp to the right edge
// (label carries the true count).
const LANES = ['critical', 'high', 'medium', 'low'] as const
const PRESETS = {
  7: { max: 9, floor: -2, ticks: [1, 3, 5, 7] },
  30: { max: 35, floor: -7, ticks: [7, 14, 21, 30] },
  90: { max: 100, floor: -7, ticks: [30, 60, 90] },
} as const
type Horizon = keyof typeof PRESETS
const ROW_H = 48

export function KeysTimeline({ keys, onSelect }: { keys: ApiKey[]; onSelect: (k: ApiKey) => void }) {
  const [horizon, setHorizon] = useState<Horizon>(30)
  const cfg = PRESETS[horizon]
  const span = cfg.max - cfg.floor
  const chipDays = span * 0.18 // chip footprint in day-units, scales with zoom
  const clampDay = (d: number) => Math.max(cfg.floor, Math.min(cfg.max, d))
  const pct = (day: number) => ((clampDay(day) - cfg.floor) / span) * 100

  const lanes = LANES.map((sev) => {
    const items = keys
      .filter((k) => (k.severity ?? '').toLowerCase() === sev)
      .map((k) => ({ k, day: daysUntilDue(anchorOf(k), k.severity), row: 0 }))
      .sort((a, b) => a.day - b.day)

    const rowEnds: number[] = []
    for (const it of items) {
      const d = clampDay(it.day)
      let r = rowEnds.findIndex((end) => d >= end)
      if (r === -1) { r = rowEnds.length; rowEnds.push(0) }
      rowEnds[r] = d + chipDays
      it.row = r
    }
    return { sev, items, rows: Math.max(1, rowEnds.length) }
  })

  return (
    <div className="ks-tl">
      <div className="ks-tl__hdrow">
        <span className="ks-tl__hd">Rotation horizon · next {horizon} days</span>
        <div className="ks-tl__zoom" role="group" aria-label="Horizon range">
          {(Object.keys(PRESETS) as unknown as Horizon[]).map((h) => (
            <button key={h} className={'ks-tl__zoomb' + (horizon === h ? ' active' : '')} onClick={() => setHorizon(h)}>{h}d</button>
          ))}
        </div>
      </div>

      <div className="ks-tl__row">
        <div className="ks-tl__gutter" />
        <div className="ks-tl__track ks-tl__track--axis">
          <span className="ks-tl__now" style={{ left: pct(0) + '%' }}>NOW</span>
          {cfg.ticks.map((d) => <span key={d} className="ks-tl__tick" style={{ left: pct(d) + '%' }}>+{d}d</span>)}
        </div>
      </div>

      <div className="ks-tl__lanes">
        <div className="ks-tl__overlay">
          <div />
          <div className="ks-tl__overlaytrack">
            <span className="ks-tl__od" style={{ width: pct(0) + '%' }} />
            {cfg.ticks.map((d) => <span key={d} className="ks-tl__grid" style={{ left: pct(d) + '%' }} />)}
            <span className="ks-tl__nowline" style={{ left: pct(0) + '%' }} />
          </div>
        </div>

        {lanes.map((lane) => (
          <div className="ks-tl__row ks-tl__lane" key={lane.sev}>
            <div className="ks-tl__gutter ks-tl__lbl">
              <Dot sev={lane.sev as 'critical'} /> {SEVL[lane.sev] ?? lane.sev}
              {lane.items.length === 0 && <span className="ks-tl__empty">no keys</span>}
            </div>
            <div className="ks-tl__track" style={{ minHeight: Math.max(lane.rows * ROW_H, 92) }}>
              {lane.items.map((it) => {
                const u = urgency(it.k)
                const beyond = it.day >= horizon // at or past the horizon → flush right
                return (
                  <button
                    key={it.k.id}
                    className="ks-tl__chip"
                    data-sev={lane.sev}
                    style={beyond
                      ? { right: 6, top: it.row * ROW_H }
                      : { left: `min(${pct(it.day)}%, calc(100% - 250px))`, top: it.row * ROW_H }}
                    title={`${displayName(it.k.name)} · ${u.txt}`}
                    onClick={() => onSelect(it.k)}
                  >
                    <Mark>{platOf(it.k.platform).code}</Mark>
                    <span className="ks-tl__cname">{displayName(it.k.name)}</span>
                    <span className="ks-tl__cdays" style={{ color: u.color }}>{u.txt}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
