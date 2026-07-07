// Composed activity feed for the redesigned Activity page. Rotations are threaded
// from the RotationWorkflow table (head + per-step times); the other classes are
// classified from the flat activity log. Returns day-grouped events + per-class
// counts + a 14-day density strip, all from one window so filters/export/strip
// stay in sync. See the Activity redesign spec.
// Inlined from keys-display (that module pulls in the "@/" alias, which a plain
// node test runner can't resolve; these two helpers keep this file testable).
const displayName = (name: string) => name.split(/ Key | - /)[0]
const cleanLocation = (loc?: string | null) => (loc ?? '-').replace(/\/?\S*\.keystrok\/clones\/[^/\s]+\//g, '')

export type EventClass = 'rotation' | 'liveness' | 'platform' | 'discovery'

// Line 1 is a sequence of fragments: plain (tx-mut), strong (entity, mono-semibold
// tx), or crit (a revocation/failure fragment). Handles inline crit mid-sentence.
export type Part = { s: string; k?: 'strong' | 'crit' }
export interface FeedStep { name: string; at: string | null; done: boolean; tail?: string }
export interface FeedEvent {
  id: string
  cls: EventClass
  at: string
  parts: Part[]
  detail?: string      // line 2: truncated path tail
  fullPath?: string    // full path for the title attr
  crit?: boolean       // row gets a left crit bar
  count?: number       // repeat-collapse: 2+ identical merged
  timeRange?: string   // collapsed range / liveness pair
  steps?: FeedStep[]   // workflow threading
  wfState?: string     // workflow status when not simply completed
}

export interface FeedDay { key: string; label: string; count: number; events: FeedEvent[] }
// Strip buckets split crit (revocation/failure) out of its class so danger days
// read red; discovery keeps its amber; the rest are the ink ramp.
export type StripBucket = EventClass | 'crit'
export interface StripDay { date: string; label: string; total: number; byClass: Record<StripBucket, number> }
export interface Feed {
  days: FeedDay[]
  counts: Record<'all' | EventClass, number>
  strip: StripDay[]
  windowDays: number
  total: number
}

const DAY = 86400000
const hhmm = (d: Date) => d.toISOString().slice(11, 16)
const sig = (e: FeedEvent) => e.cls + '|' + e.parts.map((p) => (p.k ?? '') + p.s).join('')

/** action -> class. Rotation actions come via workflows, so they're not re-emitted
 *  from the log; anything unclassified is dropped from the feed. */
export function classOf(action: string): EventClass | null {
  const a = (action || '').toLowerCase()
  if (a === 'liveness_checked') return 'liveness'
  if (a.startsWith('platform_')) return 'platform'
  if (/(scan|promot|dismiss|false_positive|finding|exposure|discover|key_deleted)/.test(a)) return 'discovery'
  return null
}

function pathBits(p: string): { detail?: string; fullPath?: string } {
  const clean = cleanLocation(p)
  if (!clean || clean === '-') return {}
  const tail = clean.length > 44 ? '…' + clean.slice(-42) : clean
  return { detail: tail, fullPath: clean }
}

/** Parse a flat activity row into a structured event. Unknown formats fall back to
 *  the raw description, so nothing renders blank. Returns null for unclassified. */
export function parseActivity(row: { id: string; action: string; description: string; createdAt: Date }): FeedEvent | null {
  const cls = classOf(row.action)
  if (!cls) return null
  const d = row.description || ''
  const ev = (parts: Part[], extra: Partial<FeedEvent> = {}): FeedEvent => ({ id: row.id, cls, at: row.createdAt.toISOString(), parts, ...extra })
  let m: RegExpMatchArray | null

  if (cls === 'liveness' && (m = d.match(/^Liveness check: (\d+) live, (\d+) revoked across (.+)$/))) {
    const [, live, revoked, providers] = m
    const rev = Number(revoked)
    const parts: Part[] = [{ s: `Liveness check — ${live} live, ` }]
    if (rev) { parts.push({ s: `${revoked} revoked`, k: 'crit' }, { s: ` across ${providers}` }) }
    else parts.push({ s: `0 revoked across ${providers}` })
    return ev(parts, { crit: rev > 0 })
  }
  if (cls === 'platform') {
    if ((m = d.match(/^Added (?:\w+) platform: (.+)$/)) || (m = d.match(/^Added (.+?) \(\w+\) platform/))) return ev([{ s: 'Platform ' }, { s: m[1], k: 'strong' }, { s: ' — connected' }])
    if ((m = d.match(/^Removed (?:\w+) platform: (.+)$/)) || (m = d.match(/^Removed (.+?) from platform/))) return ev([{ s: 'Platform ' }, { s: m[1], k: 'strong' }, { s: ' — removed' }])
    if ((m = d.match(/^Updated (?:\w+) platform: (.+)$/))) return ev([{ s: 'Platform ' }, { s: m[1], k: 'strong' }, { s: ' — updated' }])
    if ((m = d.match(/^Connection test for \w+ platform: (.+?),/))) return ev([{ s: 'Platform ' }, { s: m[1], k: 'strong' }, { s: ' — connection tested' }])
    return ev([{ s: d }])
  }
  // discovery
  if ((m = d.match(/^Quick scan completed: (\d+) findings in (\d+) files$/))) return ev([{ s: `Scan complete — ${m[1]} finding${m[1] === '1' ? '' : 's'} in ${m[2]} files` }])
  if ((m = d.match(/^Local scan finding promoted to inventory: (\w+) key in (.+)$/))) return ev([{ s: 'Promoted ' }, { s: m[1], k: 'strong' }, { s: ' key to inventory' }], pathBits(m[2]))
  if ((m = d.match(/^Dismissed scan finding: (\w+) in (.+)$/))) return ev([{ s: 'Dismissed ' }, { s: m[1], k: 'strong' }, { s: ' finding' }], pathBits(m[2]))
  if ((m = d.match(/^Deleted (?:\w+) key: (.+)$/))) return ev([{ s: 'Deleted ' }, { s: displayName(m[1]), k: 'strong' }, { s: ' from inventory' }])
  if (/exposure/i.test(d)) { const key = d.match(/for ([A-Z0-9_]+)/)?.[1]; return ev([{ s: 'Exposure date set' }, ...(key ? [{ s: ' for ' }, { s: displayName(key), k: 'strong' as const }] : [])]) }
  if (/false positive/i.test(d)) return ev([{ s: 'Marked a finding false positive' }])
  return ev([{ s: d }])
}

interface WfLike {
  id: string; name: string; status: string; startedAt: Date | null; completedAt: Date | null
  discoveredKey?: { keyName: string } | null
  steps: { name: string; status: string; completedAt: Date | null }[]
}

/** A rotation workflow -> one threaded event (head + nested steps with times). */
export function threadWorkflow(wf: WfLike): FeedEvent {
  const at = (wf.startedAt ?? wf.steps.find((s) => s.completedAt)?.completedAt ?? wf.completedAt ?? new Date(0)).toISOString()
  const entity = wf.discoveredKey?.keyName ? displayName(wf.discoveredKey.keyName) : displayName(wf.name)
  const done = wf.status === 'completed'
  const ordered = wf.steps.slice().sort((a, b) => (a.completedAt?.getTime() ?? Infinity) - (b.completedAt?.getTime() ?? Infinity))
  const steps: FeedStep[] = ordered.map((s, i) => ({
    name: s.name,
    at: s.completedAt ? s.completedAt.toISOString() : null,
    done: s.status === 'completed' || s.status === 'skipped',
    tail: done && i === ordered.length - 1 && s.completedAt ? 'completed' : undefined,
  }))
  const failed = wf.steps.some((s) => s.status === 'failed')
  const parts: Part[] = [{ s: 'Rotation ' }, { s: entity, k: 'strong' }, { s: `  created, ${wf.steps.length} step${wf.steps.length === 1 ? '' : 's'}` }]
  return { id: `wf-${wf.id}`, cls: 'rotation', at, parts, steps, wfState: done ? undefined : wf.status, crit: failed }
}

/** Collapse consecutive identical events (2+) into one with a count + time range.
 *  Operates on a time-desc list; threaded (step) events never collapse. */
export function collapseRepeats(events: FeedEvent[]): FeedEvent[] {
  const out: FeedEvent[] = []
  for (const e of events) {
    const prev = out[out.length - 1]
    if (prev && !prev.steps && !e.steps && sig(prev) === sig(e)) {
      prev.count = (prev.count ?? 1) + 1
      const times = [hhmm(new Date(e.at)), hhmm(new Date(prev.at)), ...(prev.timeRange ? prev.timeRange.split('–') : [])].sort()
      prev.timeRange = `${times[0]}–${times[times.length - 1]}`
    } else out.push({ ...e })
  }
  return out
}

function dayLabel(d: Date, now: Date): string {
  const midnight = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())
  const diff = Math.round((midnight(now) - midnight(d)) / DAY)
  const dm = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase()
  if (diff === 0) return `TODAY · ${dm}`
  if (diff === 1) return `YESTERDAY · ${dm}`
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()} · ${dm}`
}

export interface RawFeed { events: FeedEvent[]; counts: Record<'all' | EventClass, number>; windowDays: number }

/** Server side: parse + thread into raw, sorted, window-filtered events + the
 *  per-class window counts (which drive the rail and never change with filters). */
export function composeEvents(workflows: WfLike[], activities: { id: string; action: string; description: string; createdAt: Date }[], now: Date, windowDays = 14): RawFeed {
  const since = now.getTime() - windowDays * DAY
  const events: FeedEvent[] = []
  for (const wf of workflows) { const e = threadWorkflow(wf); if (Date.parse(e.at) >= since) events.push(e) }
  for (const a of activities) { const e = parseActivity(a); if (e && Date.parse(e.at) >= since) events.push(e) }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) // newest first
  const counts = { all: 0, rotation: 0, liveness: 0, platform: 0, discovery: 0 }
  for (const e of events) { counts.all++; counts[e.cls]++ }
  return { events, counts, windowDays }
}

const scopeHit = (e: FeedEvent, scope: string) => {
  const s = scope.toLowerCase()
  return e.parts.some((p) => p.s.toLowerCase().includes(s)) || (e.detail?.toLowerCase().includes(s) ?? false) || (e.steps?.some((st) => st.name.toLowerCase().includes(s)) ?? false)
}

/** Client side: filter (by class + key scope) -> group by day + collapse + build
 *  the density strip, all from the same set so the strip and log stay in sync. */
export function buildView(events: FeedEvent[], now: Date, opts: { cls?: EventClass | 'all'; scope?: string } = {}, windowDays = 14): { days: FeedDay[]; strip: StripDay[]; total: number } {
  const cls = opts.cls && opts.cls !== 'all' ? opts.cls : null
  const scope = (opts.scope ?? '').trim()
  const filtered = events.filter((e) => (!cls || e.cls === cls) && (!scope || scopeHit(e, scope)))

  const byDay = new Map<string, FeedEvent[]>()
  for (const e of filtered) { const k = e.at.slice(0, 10); (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e) }

  const days: FeedDay[] = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest day first
    .map(([key, evs]) => ({ key, label: dayLabel(new Date(key + 'T00:00:00Z'), now), count: evs.length, events: collapseRepeats(evs) }))

  const strip: StripDay[] = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY)
    const date = d.toISOString().slice(0, 10)
    const evs = byDay.get(date) ?? []
    const byClass: Record<StripBucket, number> = { rotation: 0, liveness: 0, platform: 0, discovery: 0, crit: 0 }
    for (const e of evs) byClass[e.crit ? 'crit' : e.cls]++
    strip.push({ date, label: d.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'UTC' }), total: evs.length, byClass })
  }
  return { days, strip, total: filtered.length }
}
