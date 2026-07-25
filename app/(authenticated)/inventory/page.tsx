'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, Key, KeyRound, Clock, SlidersHorizontal, Check } from 'lucide-react'
import { Mark, Dot } from '@/components/ks'
import { KeyDrawer } from '@/components/ks/KeyDrawer'
import { KeysTimeline } from '@/components/ks/KeysTimeline'
import { RegisterKeyDrawer, type RegisteredKey } from '@/components/ks/RegisterKeyDrawer'
import { foundAgoDays, slaUsedPct } from '@/lib/rotation-policy'
import { type ApiKey, platOf, SEVL, sevColor, displayName, urgency, needsAction, cleanLocation, anchorOf } from '@/lib/keys-display'

const SEVS = ['critical', 'high', 'medium', 'low'] as const

// Liveness is its own column: never render nothing (absence is ambiguous). A
// live leaked key is the dangerous kind, so it gets the crit pill.
function livenessPill(k: ApiKey) {
  if (k.live_status === 'live') return <span className="ks-liv ks-liv--live">● LIVE</span>
  if (k.live_status === 'revoked') return <span className="ks-liv ks-liv--rev">revoked</span>
  return <span className="ks-liv ks-liv--unk">unverified</span>
}

export default function KeysScreen() {
  const params = useSearchParams()
  const [lens, setLens] = useState<'table' | 'timeline'>(params.get('lens') === 'timeline' ? 'timeline' : 'table')
  // Home's "Needs action" cell deep-links here with ?filter=needs-action; the
  // exposure-days sparkline deep-links with ?lens=timeline to explain the trend.
  const [needsOnly, setNeedsOnly] = useState(params.get('filter') === 'needs-action')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sevSet, setSevSet] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<ApiKey | null>(null)
  // The ledger's second door: register-by-paste drawer + the landed receipt
  // bar it leaves behind (server truth, not a toast).
  const [regOpen, setRegOpen] = useState(false)
  const [landed, setLanded] = useState<RegisteredKey | null>(null)
  const toggleSev = (s: string) => setSevSet((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n })

  const { data, isLoading } = useQuery<ApiKey[]>({
    queryKey: ['keys'],
    queryFn: async () => {
      const res = await fetch('/api/keys')
      if (!res.ok) throw new Error('Failed to fetch keys')
      const json = await res.json()
      return json.keys ?? json ?? []
    },
    refetchInterval: 30000,
  })

  const keys = data ?? []
  const overdueCount = keys.filter((k) => urgency(k).overdue).length
  const needsCount = keys.filter(needsAction).length
  const rows = keys
    .filter((k) => !needsOnly || needsAction(k))
    .filter((k) => !overdueOnly || urgency(k).overdue)
    .filter((k) => sevSet.size === 0 || sevSet.has((k.severity ?? '').toLowerCase()))

  const registerDrawer = (
    <RegisterKeyDrawer
      open={regOpen}
      onClose={() => setRegOpen(false)}
      onRegistered={(k) => { setLanded(k); setRegOpen(false) }}
      onViewKey={(id) => {
        setRegOpen(false)
        const k = keys.find((x) => x.id === id)
        if (k) setSelected(k)
      }}
    />
  )

  if (!isLoading && keys.length === 0) {
    return (
      <div className="ks-keys">
        <div style={{ padding: '24px 28px' }}>
          <div className="ks-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 520 }}>
          <div className="ks-empty">
            <span className="ks-empty__ico"><Key size={26} strokeWidth={1.75} /></span>
            <div className="ks-empty__t">No keys tracked yet</div>
            <div className="ks-empty__s">
              Keys arrive two ways: promoted from Discovery findings, or registered here by hand — vendor
              keys no scan will ever see. Any member can register one.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
              <a href="/discovery-scanner" className="ks-btn ks-btn--primary" style={{ textDecoration: 'none' }}>
                <Search size={14} /> Go to Discovery
              </a>
              <button className="ks-btn" onClick={() => setRegOpen(true)}>
                <KeyRound size={14} /> Register a key
              </button>
            </div>
            <div className="ks-empty__hint">registered keys are tracked since birth — same ledger, same clock</div>
          </div>
          </div>
        </div>
        {registerDrawer}
      </div>
    )
  }

  return (
    <div className="ks-keys">
      <div className="ks-keys__bar">
        <div className="ks-lens">
          {([['table', 'Table', Key], ['timeline', 'Timeline', Clock]] as const).map(([id, label, Ico]) => (
            <button key={id} className={'ks-lens__b' + (lens === id ? ' active' : '')} onClick={() => setLens(id)}>
              <Ico size={13} /> {label}
            </button>
          ))}
        </div>
        {needsCount > 0 && (
          <button
            className="ks-keys__chip"
            onClick={() => setNeedsOnly((v) => !v)}
            style={needsOnly ? { borderColor: 'var(--crit-line)', background: 'var(--crit-dim)' } : undefined}
            title="Filter to keys that need action"
          >
            <Dot sev="critical" />
            <b>{needsCount}</b> needs action
          </button>
        )}
        {overdueCount > 0 && (
          <button
            className="ks-keys__chip"
            onClick={() => setOverdueOnly((v) => !v)}
            style={overdueOnly ? { borderColor: 'var(--crit-line)', background: 'var(--crit-dim)' } : undefined}
            title="Filter to overdue"
          >
            <Dot sev="critical" />
            <b>{overdueCount}</b> overdue
          </button>
        )}
        <div className="ks-keys__filter">
          <button className="ks-btn ks-btn--sm" onClick={() => setRegOpen(true)}>
            <KeyRound size={13} /> Register a key
          </button>
          <div className="ks-fpop__wrap">
            <button className="ks-btn ks-btn--sm" onClick={() => setFilterOpen((v) => !v)}>
              <SlidersHorizontal size={13} /> Filter{sevSet.size ? ` · ${sevSet.size}` : ''}
            </button>
            {filterOpen && (
              <>
                <div className="ks-fpop__scrim" onClick={() => setFilterOpen(false)} />
                <div className="ks-fpop">
                  <div className="ks-fpop__l">Severity</div>
                  {SEVS.map((s) => (
                    <button key={s} className="ks-fpop__row" onClick={() => toggleSev(s)}>
                      <span className={'ks-fpop__check' + (sevSet.has(s) ? ' on' : '')}>{sevSet.has(s) && <Check size={11} />}</span>
                      <Dot sev={s} /> {SEVL[s] ?? s}
                    </button>
                  ))}
                  {sevSet.size > 0 && <button className="ks-fpop__clear" onClick={() => setSevSet(new Set())}>Clear filters</button>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {landed && (
        <div className="ks-reg__landed" style={{ marginTop: 14 }}>
          <span className="ok"><Check size={14} /></span>
          {displayName(landed.keyName)} registered
          <span className="mono">rotation due {new Date(landed.rotationDueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · from the server&apos;s receipt</span>
          <span className="sp" />
          <a className="lnk" href="/activity" style={{ textDecoration: 'underline' }}>View receipt in Activity</a>
          <button className="lnk" aria-label="Dismiss" onClick={() => setLanded(null)}>dismiss</button>
        </div>
      )}
      <div className="ks-keys__body">
        {lens === 'timeline' ? (
          <KeysTimeline keys={rows} onSelect={setSelected} />
        ) : (
          <div className="ks-tbl-scroll">
            <table className="ks-tbl">
              <thead>
                <tr>
                  <th>Key</th>
                  <th style={{ width: 130 }}>Platform</th>
                  <th style={{ width: 120 }}>Severity</th>
                  <th style={{ width: 130 }}>Liveness</th>
                  <th style={{ width: 120 }}>Tracked</th>
                  <th style={{ width: 120 }}>Radius</th>
                  <th style={{ width: 200 }}>Rotation window</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '28px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx-dim)' }}>No keys match the current filters.</td></tr>
                )}
                {rows.map((k) => {
                  const u = urgency(k)
                  const plat = platOf(k.platform)
                  const pct = slaUsedPct(anchorOf(k), k.severity)
                  const foundAgo = foundAgoDays(new Date(k.created_at))
                  return (
                    <tr key={k.id} className={selected?.id === k.id ? 'sel' : ''} onClick={() => setSelected(k)}>
                      {/* severity edge tick: 3px, full row height */}
                      <td style={{ boxShadow: `inset 3px 0 0 ${sevColor(k.severity)}` }}>
                        <div className="ks-tbl__name">{displayName(k.name)}</div>
                        {/* Provenance line: scanned keys show where they were found;
                            manual keys were never found anywhere — the chip says who. */}
                        {k.source === 'manual'
                          ? <div style={{ marginTop: 5 }}><span className="ks-prov">manual · you</span></div>
                          : <div className="ks-tbl__src" style={{ marginTop: 4 }}>{cleanLocation(k.location || k.source)}</div>}
                      </td>
                      <td><span className="ks-tbl__sev"><Mark>{plat.code}</Mark> {plat.label}</span></td>
                      <td><span className="ks-tbl__sev"><Dot sev={k.severity as 'critical'} />{SEVL[k.severity] ?? k.severity}</span></td>
                      <td>{livenessPill(k)}</td>
                      <td><span className="ks-tbl__u" style={{ color: 'var(--tx-mut)' }}>{k.source === 'manual' ? 'registered' : 'found'} {foundAgo}d ago</span></td>
                      {/* radius summary: what rotating touches; crit ink only for the
                          hold signal (in use with nothing mapped). Asserting lifts it. */}
                      <td>
                        <span className="ks-tbl__u" style={{ color: 'var(--tx-mut)' }}>
                          {k.radius_consumers ? `${k.radius_consumers} svc · ` : ''}
                          {k.radius_sites ?? 1} site{(k.radius_sites ?? 1) === 1 ? '' : 's'}
                          {/* pipelines are a SUBSET of sites; say so, never add them up */}
                          {k.radius_pipes ? ` (${k.radius_pipes} in pipelines)` : ''}
                          {k.usage_active && !k.radius_consumers && !k.break_accepted && <span style={{ color: 'var(--crit)' }}> · in use</span>}
                          {k.break_accepted && <span style={{ color: 'var(--high)' }}> · break accepted</span>}
                        </span>
                      </td>
                      <td>
                        {/* one urgency encoding: overdue = text only; healthy = "Nd left" + a window-used bar */}
                        {u.overdue ? (
                          <span className="ks-tbl__u" style={{ color: 'var(--crit)' }}>
                            overdue · {k.live_status === 'live' ? 'live, ' : ''}past SLA
                          </span>
                        ) : (
                          <div className="ks-tbl__win">
                            <span className="ks-tbl__u" style={{ color: 'var(--tx-mut)' }}>{u.txt}</span>
                            <div className="ks-tbl__bar"><div className="ks-tbl__barfill" style={{ width: Math.max(pct, 4) + '%', background: 'var(--med)' }} /></div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <KeyDrawer keyData={selected} onClose={() => setSelected(null)} />
      {registerDrawer}
    </div>
  )
}
