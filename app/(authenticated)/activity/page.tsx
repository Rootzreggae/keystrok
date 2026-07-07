'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check } from 'lucide-react'
import { InlineLoading } from '@/components/ks/Loading'
import { buildView, type RawFeed, type EventClass, type FeedEvent, type Part } from '@/lib/activity-feed'

const CLASSES: { id: EventClass; label: string }[] = [
  { id: 'rotation', label: 'Rotations' },
  { id: 'liveness', label: 'Liveness checks' },
  { id: 'platform', label: 'Platforms' },
  { id: 'discovery', label: 'Discovery' },
]
const CLASS_NAME: Record<EventClass, string> = { rotation: 'rotation', liveness: 'liveness', platform: 'platform', discovery: 'discovery' }
const hm = (iso: string) => new Date(iso).toISOString().slice(11, 16)

function Line({ parts }: { parts: Part[] }) {
  return <>{parts.map((p, i) => <span key={i} className={p.k === 'strong' ? 'ks-act__strong' : p.k === 'crit' ? 'ks-act__crit' : undefined}>{p.s}</span>)}</>
}

function Row({ e }: { e: FeedEvent }) {
  return (
    <div className={'ks-act__row' + (e.crit ? ' is-crit' : '')}>
      <span className={'ks-act__dot ks-act__dot--' + CLASS_NAME[e.cls]} aria-hidden />
      <div className="ks-act__body">
        <div className="ks-act__l1"><Line parts={e.parts} />{e.count && e.count > 1 ? <span className="ks-act__x">×{e.count}</span> : null}</div>
        {e.detail && <div className="ks-act__l2" title={e.fullPath}>{e.detail}</div>}
        {e.steps && e.steps.length > 0 && (
          <div className="ks-act__steps">
            {e.steps.map((s, i) => (
              <div className="ks-act__step" key={i}>
                <span className="ks-act__stepchk">{s.done ? <Check size={12} /> : null}</span>
                <span className="ks-act__stepname">{s.name}</span>
                <span className="ks-act__steptime">{s.at ? hm(s.at) : '—'}{s.tail ? ` · ${s.tail}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <span className="ks-act__time">{e.timeRange ?? hm(e.at)}{e.wfState ? ` · ${e.wfState}` : ''}</span>
    </div>
  )
}

export default function ActivityScreen() {
  const [cls, setCls] = useState<'all' | EventClass>('all')
  const [scope, setScope] = useState('')
  const [selDay, setSelDay] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])

  const { data, isLoading } = useQuery<RawFeed>({
    queryKey: ['activity-feed'],
    queryFn: async () => { const r = await fetch('/api/activity/feed'); if (!r.ok) throw new Error('feed'); return r.json() },
  })

  const view = useMemo(() => (data ? buildView(data.events, now, { cls, scope }) : null), [data, cls, scope, now])
  const counts = data?.counts ?? { all: 0, rotation: 0, liveness: 0, platform: 0, discovery: 0 }
  const stripMax = Math.max(1, ...(view?.strip.map((d) => d.total) ?? [1]))

  const jumpTo = (date: string) => {
    setSelDay(date)
    document.getElementById('day-' + date)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const exportLog = () => {
    const rows = view?.days.flatMap((d) => d.events) ?? []
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'keystrok-activity.json'; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="ks-set">
      {/* filter rail — reuses the Settings rail primitive */}
      <nav className="ks-set__rail">
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
      </nav>

      {/* main column */}
      <div className="ks-set__content ks-act">
        <div className="ks-act__hd">
          <div className="ks-act__title">
            <h2>Activity</h2>
            <span className="ks-act__meta">{view?.total ?? 0} events · last {data?.windowDays ?? 14} days</span>
          </div>
          <button className="ks-btn ks-btn--sm" onClick={exportLog} disabled={!view?.total}><Copy size={13} /> Export</button>
        </div>

        {isLoading || !view ? (
          <div className="ks-panel"><InlineLoading /></div>
        ) : (
          <>
            {/* density strip (scrubber) */}
            <div className="ks-panel ks-act__strip">
              <div className="ks-act__striphd"><span>Last {data?.windowDays ?? 14} days</span><span className="ks-act__striphint">click a day to jump</span></div>
              <div className="ks-act__stripbody">
                {view.strip.map((d) => {
                  const segs = (['rotation', 'liveness', 'platform', 'discovery', 'crit'] as const).filter((k) => d.byClass[k] > 0)
                  const tip = `${d.date.slice(5)} · ${d.total} event${d.total === 1 ? '' : 's'}` + segs.map((k) => ` · ${d.byClass[k]} ${k === 'crit' ? 'revocation' : k}`).join('')
                  return (
                    <button key={d.date} className={'ks-act__col' + (selDay === d.date ? ' sel' : '')} onClick={() => jumpTo(d.date)} title={tip}>
                      <span className="ks-act__bar">
                        {segs.map((k) => <span key={k} className={'ks-act__seg ks-act__seg--' + k} style={{ height: `${(d.byClass[k] / stripMax) * 100}%` }} />)}
                      </span>
                      <span className="ks-act__collbl">{d.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* log */}
            <div className="ks-panel ks-act__log">
              {view.days.length === 0 ? (
                <div className="ks-act__none">no {cls === 'all' ? '' : cls + ' '}events in this window</div>
              ) : (
                view.days.map((day) => (
                  <div key={day.key}>
                    <div className={'ks-act__divider' + (selDay === day.key ? ' sel' : '')} id={'day-' + day.key}>
                      <span>{day.label}</span><span className="ks-act__dividercnt">{day.count} event{day.count === 1 ? '' : 's'}</span>
                    </div>
                    {day.events.map((e) => <Row key={e.id} e={e} />)}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
