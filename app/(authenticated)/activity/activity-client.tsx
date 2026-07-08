'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check } from 'lucide-react'
import { InlineLoading } from '@/components/ks/Loading'
import { buildView, type RawFeed, type EventClass, type FeedEvent, type FeedDay, type Part, type StripBucket } from '@/lib/activity-feed'

const CLASSES: { id: EventClass; label: string }[] = [
  { id: 'rotation', label: 'Rotations' },
  { id: 'liveness', label: 'Liveness checks' },
  { id: 'platform', label: 'Platforms' },
  { id: 'discovery', label: 'Discovery' },
]
const NONCRIT: EventClass[] = ['rotation', 'liveness', 'platform', 'discovery']
const MOSTLY: Record<StripBucket, string> = {
  rotation: 'rotations', liveness: 'liveness checks', platform: 'platform changes',
  discovery: 'discovery triage', crit: 'revocations',
}
const hm = (iso: string) => new Date(iso).toISOString().slice(11, 16)
// spec: sqrt scale, 44px strip, 2px floor
const sqh = (n: number, maxN: number) => Math.max(2, Math.round((Math.sqrt(n) / Math.sqrt(maxN)) * 44))
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

const dominant = (m: Record<StripBucket, number>, keys: StripBucket[]): StripBucket | null =>
  keys.reduce<StripBucket | null>((best, k) => (m[k] > 0 && (!best || m[k] > m[best]) ? k : best), null)

function Line({ parts }: { parts: Part[] }) {
  return <>{parts.map((p, i) => <span key={i} className={p.k === 'strong' ? 'ks-act__strong' : p.k === 'crit' ? 'ks-act__crit' : undefined}>{p.s}</span>)}</>
}

function EventRow({ e }: { e: FeedEvent }) {
  return (
    <div className={'ks-act__row' + (e.crit ? ' is-crit' : '')}>
      <span className={'ks-act__dot ks-act__dot--' + e.cls} aria-hidden />
      <div className="ks-act__body">
        <div className="ks-act__l1"><Line parts={e.parts} />{e.count && e.count > 1 ? <span className="ks-act__x">×{e.count}</span> : null}</div>
        {e.detail && <div className="ks-act__l2" title={e.fullPath}>{e.detail}</div>}
      </div>
      <span className="ks-act__time">{e.timeRange ?? hm(e.at)}</span>
    </div>
  )
}

// Rotation thread: head row + nested steps. Ditto times — a step whose minute
// matches the previous step's renders an empty time cell (spec §5).
function ThreadRow({ e }: { e: FeedEvent }) {
  let prev = ''
  return (
    <div className="ks-act__thread">
      <div className={'ks-act__row' + (e.crit ? ' is-crit' : '')}>
        <span className="ks-act__dot ks-act__dot--rotation" aria-hidden />
        <div className="ks-act__body"><div className="ks-act__l1"><Line parts={e.parts} /></div></div>
        <span className="ks-act__time">{hm(e.at)}{e.wfState ? ` · ${e.wfState.replace(/_/g, ' ')}` : ''}</span>
      </div>
      <div className="ks-act__steps">
        {e.steps!.map((s, i) => {
          const t = s.at ? hm(s.at) : ''
          const shown = s.done ? (t && t !== prev ? t : '') : 'pending'
          if (t) prev = t
          return (
            <div className={'ks-act__step' + (s.done ? '' : ' pending')} key={i}>
              <span className="ks-act__steptick">{s.done ? <Check size={11} /> : '○'}</span>
              <span className="ks-act__stepname">{s.name}</span>
              <span className="ks-act__steptime">{shown}{s.done && s.tail ? `${shown ? ' · ' : ''}${s.tail}` : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Bulk operation: one row (verb + counts + optional reason), expandable per-key-type breakdown.
function OpRow({ e, open, onToggle }: { e: FeedEvent; open: boolean; onToggle: () => void }) {
  const op = e.op!
  return (
    <div className="ks-act__op">
      <button className="ks-act__row" onClick={onToggle} aria-expanded={open}>
        <span className="ks-act__dot ks-act__dot--discovery" aria-hidden />
        <div className="ks-act__body">
          <div className="ks-act__l1">
            <span className="ks-act__opn">{op.verb} {plural(op.findings, 'finding')}</span>
            {` across ${plural(op.files, 'file')}`}
            {op.reason ? <span className="ks-act__reason"> · reason: {op.reason}</span> : null}
          </div>
        </div>
        <span className="ks-act__time">{hm(e.at)}</span>
        <span className="ks-act__chev" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="ks-act__opitems">
          {op.items.map((it) => (
            <div className="ks-act__opitem" key={it.keyType}>
              <span className="ks-act__opnm">{it.keyType}</span>
              {it.count > 1 && <span className="ks-act__x">×{it.count}</span>}
              {it.detail && <span className="ks-act__oppth" title={it.fullPath}>{it.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Day header right slot: open days show the operation count when grouping
// compressed something; collapsed days show the one-phrase highlight instead.
const dayMeta = (d: FeedDay, open: boolean) =>
  plural(d.count, 'event') +
  (!open && d.highlight ? ` · ${d.highlight}` : d.ops < d.count ? ` · ${plural(d.ops, 'operation')}` : '')

export default function ActivityScreen() {
  const [cls, setCls] = useState<'all' | EventClass>('all')
  const [scope, setScope] = useState('')
  const [selDay, setSelDay] = useState<string | null>(null)
  const [openOps, setOpenOps] = useState<Set<string>>(new Set())
  const [dayOpen, setDayOpen] = useState<Record<string, boolean>>({})
  const now = useMemo(() => new Date(), [])

  // Hydrated from the server prefetch (./page.tsx), so this is populated on mount.
  const { data, isLoading } = useQuery<RawFeed>({
    queryKey: ['activity-feed'],
    queryFn: async () => { const r = await fetch('/api/activity/feed'); if (!r.ok) throw new Error('feed'); return r.json() },
  })

  const view = useMemo(() => (data ? buildView(data.events, now, { cls, scope }) : null), [data, cls, scope, now])
  const counts = data?.counts ?? { all: 0, rotation: 0, liveness: 0, platform: 0, discovery: 0 }
  const stripMax = Math.max(1, ...(view?.strip.map((d) => d.total) ?? [1]))
  const opsTotal = view?.days.reduce((n, d) => n + d.ops, 0) ?? 0

  // Reading line for the selected day (replaces the old persistent tooltip).
  const selStrip = selDay ? view?.strip.find((d) => d.date === selDay) : undefined
  const selFeedDay = selDay ? view?.days.find((d) => d.key === selDay) : undefined
  const selDom = selStrip ? dominant(selStrip.byClass, ['rotation', 'liveness', 'platform', 'discovery', 'crit']) : null
  const readTail = !selStrip ? '' : selStrip.total === 0 ? ' · no events'
    : ` · ${plural(selStrip.total, 'event')}` +
      (selFeedDay ? ` · ${plural(selFeedDay.ops, 'operation')}` : '') +
      (selDom ? ` · mostly ${MOSTLY[selDom]}` : '')

  const jumpTo = (date: string) => {
    if (selDay === date) { setSelDay(null); return }
    setSelDay(date)
    setDayOpen((m) => ({ ...m, [date]: true }))
    requestAnimationFrame(() => document.getElementById('day-' + date)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const toggleOp = (id: string) => setOpenOps((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const exportLog = () => {
    const rows = view?.days.flatMap((d) => d.events) ?? []
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'keystrok-activity.json'; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="ks-railpage ks-actpage">
      {/* content well + full-height chrome rail — same grammar as Settings */}
      <div className="ks-railpage__content ks-act__main">
          {/* meta row — the page title lives in the top bar only */}
          <div className="ks-act__hd">
            <span className="ks-act__meta">{plural(view?.total ?? 0, 'event')} · {plural(opsTotal, 'operation')} · last {data?.windowDays ?? 14} days</span>
            <button className="ks-btn ks-btn--sm" onClick={exportLog} disabled={!view?.total}><Copy size={13} /> Export</button>
          </div>

          {isLoading || !view ? (
            <div className="ks-panel"><InlineLoading /></div>
          ) : (
            <>
              {/* density strip (scrubber, not a chart) */}
              <div className="ks-panel ks-act__strip">
                <div className="ks-act__striphd">
                  <span className="ks-act__striplbl">Last {data?.windowDays ?? 14} days</span>
                  {selStrip
                    ? <span className="ks-act__read"><b>{new Date(selStrip.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</b>{readTail}</span>
                    : <span className="ks-act__read">click a day to jump</span>}
                </div>
                <div className="ks-act__cols">
                  {view.strip.map((d) => {
                    const domClass = dominant(d.byClass, NONCRIT)
                    const critH = d.byClass.crit > 0 ? 3 : 0
                    const h = d.total > 0 ? sqh(d.total, stripMax) : 2
                    const segs = (['rotation', 'liveness', 'platform', 'discovery', 'crit'] as const).filter((k) => d.byClass[k] > 0)
                    const tip = `${d.date.slice(5)} · ${plural(d.total, 'event')}` + segs.map((k) => ` · ${d.byClass[k]} ${k === 'crit' ? 'revocation' : k}`).join('')
                    return (
                      <button
                        key={d.date}
                        className={'ks-act__col' + (selDay === d.date ? ' sel' : '')}
                        onClick={() => jumpTo(d.date)}
                        title={selDay === d.date ? undefined : tip}
                        aria-pressed={selDay === d.date}
                      >
                        {d.total === 0
                          ? <span className="ks-act__seg ks-act__seg--none" style={{ height: 2 }} />
                          : domClass
                            ? <>
                                <span className={'ks-act__seg ks-act__seg--' + domClass} style={{ height: h - critH }} />
                                {critH > 0 && <span className="ks-act__seg ks-act__seg--crit" style={{ height: critH }} />}
                              </>
                            : <span className="ks-act__seg ks-act__seg--crit" style={{ height: h }} />}
                      </button>
                    )
                  })}
                </div>
                <div className="ks-act__xrow">
                  {view.strip.map((d) => <span key={d.date} className={selDay === d.date ? 'sel' : ''}>{d.label}</span>)}
                </div>
              </div>

              {/* log */}
              <div className="ks-panel ks-act__log">
                {view.days.length === 0 ? (
                  <div className="ks-act__none">no {cls === 'all' ? '' : cls + ' '}events in this window</div>
                ) : (
                  view.days.map((day, i) => {
                    const open = dayOpen[day.key] ?? i < 3
                    return (
                      <div className="ks-act__daysec" key={day.key}>
                        <button
                          className={'ks-act__day' + (selDay === day.key ? ' sel' : '')}
                          id={'day-' + day.key}
                          onClick={() => setDayOpen((m) => ({ ...m, [day.key]: !open }))}
                          aria-expanded={open}
                        >
                          <span className="ks-act__chev" aria-hidden>{open ? '▴' : '▾'}</span>
                          <span className="ks-act__dayl">{day.label}</span>
                          <span className="ks-act__dayn">{dayMeta(day, open)}</span>
                        </button>
                        {open && day.events.map((e) =>
                          e.op ? <OpRow key={e.id} e={e} open={openOps.has(e.id)} onToggle={() => toggleOp(e.id)} />
                          : e.steps && e.steps.length > 0 ? <ThreadRow key={e.id} e={e} />
                          : <EventRow key={e.id} e={e} />
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

      {/* filter rail on the RIGHT — full-height chrome; the inner content is sticky */}
      <nav className="ks-railpage__rail">
        <div className="ks-railpage__railinner">
            <div className="ks-set__railgroup">
              <div className="ks-set__raill">Event class</div>
              <button className={'ks-set__railitem ks-act__filt' + (cls === 'all' ? ' active' : '')} onClick={() => setCls('all')}>
                <span className="ks-act__dot ks-act__dot--all" /> All events <span className="ks-act__cnt">{counts.all}</span>
              </button>
              {CLASSES.map((c) => (
                <button key={c.id} className={'ks-set__railitem ks-act__filt' + (cls === c.id ? ' active' : '')} onClick={() => setCls(c.id)}>
                  <span className={'ks-act__dot ks-act__dot--' + c.id} /> {c.label} <span className="ks-act__cnt">{counts[c.id]}</span>
                </button>
              ))}
            </div>
            <div className="ks-set__railgroup">
              <div className="ks-set__raill">Scope</div>
              <input className="ks-input ks-act__scope" placeholder="filter by key…" value={scope} onChange={(e) => setScope(e.target.value)} spellCheck={false} />
            </div>
          </div>
      </nav>
    </div>
  )
}
