'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Key, Clock, SlidersHorizontal, Check } from 'lucide-react'
import { Mark, Dot } from '@/components/ks'
import { KeyDrawer } from '@/components/ks/KeyDrawer'
import { KeysTimeline } from '@/components/ks/KeysTimeline'
import { foundAgoDays, slaUsedPct } from '@/lib/rotation-policy'
import { type ApiKey, platOf, SEVL, sevColor, displayName, urgency } from '@/lib/keys-display'

const SEVS = ['critical', 'high', 'medium', 'low'] as const

export default function KeysScreen() {
  const [lens, setLens] = useState<'table' | 'timeline'>('table')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sevSet, setSevSet] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<ApiKey | null>(null)
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
  const rows = keys
    .filter((k) => !overdueOnly || urgency(k).overdue)
    .filter((k) => sevSet.size === 0 || sevSet.has((k.severity ?? '').toLowerCase()))

  if (!isLoading && keys.length === 0) {
    return (
      <div className="ks-keys">
        <div style={{ padding: '24px 28px' }}>
          <div className="ks-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 520 }}>
          <div className="ks-empty">
            <span className="ks-empty__ico"><Key size={26} strokeWidth={1.75} /></span>
            <div className="ks-empty__t">No keys tracked yet</div>
            <div className="ks-empty__s">
              The ledger fills as you promote findings from Discovery. Each promoted key starts its rotation
              clock the moment it lands here, anchored to when it was found, never a creation or expiry date.
            </div>
            <a href="/discovery-scanner" className="ks-btn ks-btn--primary" style={{ marginTop: 18, textDecoration: 'none' }}>
              <Search size={14} /> Go to Discovery
            </a>
          </div>
          </div>
        </div>
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

      <div className="ks-keys__body">
        {lens === 'timeline' ? (
          <KeysTimeline keys={rows} onSelect={setSelected} />
        ) : (
          <div className="ks-tbl-scroll">
            <table className="ks-tbl">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Key</th>
                  <th>Platform</th>
                  <th>Severity</th>
                  <th>Found</th>
                  <th>Rotation window</th>
                  <th style={{ width: 120 }}>SLA used</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '28px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx-dim)' }}>No keys match the current filters.</td></tr>
                )}
                {rows.map((k) => {
                  const u = urgency(k)
                  const plat = platOf(k.platform)
                  const pct = slaUsedPct(new Date(k.created_at), k.severity)
                  const foundAgo = foundAgoDays(new Date(k.created_at))
                  return (
                    <tr key={k.id} className={selected?.id === k.id ? 'sel' : ''} onClick={() => setSelected(k)}>
                      <td>
                        <div className="ks-tbl__name">
                          <span className="ks-aqrow__sev" style={{ background: sevColor(k.severity), height: 16 }} />
                          {displayName(k.name)}
                        </div>
                        <div className="ks-tbl__src" style={{ marginTop: 4, paddingLeft: 13 }}>{k.location || k.source || '-'}</div>
                      </td>
                      <td><span className="ks-tbl__sev"><Mark>{plat.code}</Mark> {plat.label}</span></td>
                      <td><span className="ks-tbl__sev"><Dot sev={k.severity as 'critical'} />{SEVL[k.severity] ?? k.severity}</span></td>
                      <td><span className="ks-tbl__u" style={{ color: 'var(--tx-mut)' }}>{foundAgo}d ago</span></td>
                      <td><span className="ks-tbl__u" style={{ color: u.color }}>{u.txt}</span></td>
                      <td>
                        <div className="ks-tbl__bar">
                          <div className="ks-tbl__barfill" style={{ width: pct + '%', background: u.overdue ? 'var(--crit)' : pct > 80 ? 'var(--high)' : 'var(--tx-mut)' }} />
                        </div>
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
    </div>
  )
}
