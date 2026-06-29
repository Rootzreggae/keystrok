'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Home, Key, RefreshCw, Search, Server, Activity, CornerDownLeft } from 'lucide-react'
import { Mark, Dot } from '@/components/ks'
import { type ApiKey, platOf, SEVL, displayName, urgency, needsAction } from '@/lib/keys-display'

interface Finding { id: string; filePath: string; lineNumber?: number; keyType: string; platform?: string; severity: string; patternName?: string; status: string }
interface Plat { id: string; name: string; platform_type?: string; key_count?: number }
interface Wf { id: string; status: string }

const incl = (s: string | undefined, q: string) => (s ?? '').toLowerCase().includes(q)
const isRunning = (s: string) => s === 'in_progress' || s === 'running' || s === 'active'

// Jump targets: label, route, short code tag, and a live one-line description.
// Exported so the Search page renders the same "Pages & Commands" group.
export const PAGES = [
  { label: 'Discovery', href: '/discovery-scanner', icon: Search, code: 'SCAN', desc: (c: Counts) => `${c.findings} findings to triage` },
  { label: 'Rotations', href: '/rotation-workflows', icon: RefreshCw, code: 'ROT', desc: (c: Counts) => `${c.running} running, ${c.recommended} recommended` },
  { label: 'Keys', href: '/inventory', icon: Key, code: 'LIST', desc: () => 'full inventory' },
  { label: 'Platforms', href: '/platforms', icon: Server, code: 'CFG', desc: (c: Counts) => `${c.platforms} connected` },
  { label: 'Activity', href: '/activity', icon: Activity, code: 'LOG', desc: () => 'audit log' },
  { label: 'Home', href: '/dashboard', icon: Home, code: 'HOME', desc: () => 'overview' },
] as const
export interface Counts { findings: number; running: number; recommended: number; platforms: number }

type Item = { key: string; group: string; run: () => void; node: (sel: boolean) => React.ReactNode }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)

  useEffect(() => { if (open) { setQ(''); setSel(0) } }, [open])

  const { data: keys = [] } = useQuery<ApiKey[]>({
    queryKey: ['keys'], enabled: open,
    queryFn: async () => { const r = await fetch('/api/keys'); const j = await r.json(); return j.keys ?? j ?? [] },
  })
  const { data: platforms = [] } = useQuery<Plat[]>({
    queryKey: ['platforms'], enabled: open,
    queryFn: async () => { const r = await fetch('/api/platforms'); const j = await r.json(); return j.platforms ?? j.data?.platforms ?? j ?? [] },
  })
  const { data: findings = [] } = useQuery<Finding[]>({
    queryKey: ['findings', 'all'], enabled: open,
    queryFn: async () => { const r = await fetch('/api/discovery/results'); const j = await r.json(); return j.results?.findings ?? j.findings ?? [] },
  })
  const { data: workflows = [] } = useQuery<Wf[]>({
    queryKey: ['workflows'], enabled: open,
    queryFn: async () => { const r = await fetch('/api/workflows'); const j = await r.json(); return j.data?.workflows ?? j.workflows ?? [] },
  })

  const ql = q.trim().toLowerCase()
  const querying = ql.length > 0
  const go = (href: string) => { onClose(); router.push(href) }
  const seeAll = () => go(`/search?q=${encodeURIComponent(q.trim())}`)

  const counts: Counts = {
    findings: findings.filter((f) => f.status !== 'dismissed' && f.status !== 'resolved').length,
    running: workflows.filter((w) => isRunning(w.status)).length,
    recommended: workflows.filter((w) => w.status !== 'completed' && !isRunning(w.status)).length,
    platforms: platforms.length,
  }

  // Build the flat, ordered item list, drives both rendering and keyboard nav.
  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    if (!querying) {
      keys.filter(needsAction).slice(0, 4).forEach((k) => {
        const u = urgency(k)
        out.push({
          key: 'na-' + k.id, group: `Needs action`, run: () => go('/rotation-workflows'),
          node: (s) => (<>
            <span className="kbc__resmark"><Mark>{platOf(k.platform).code}</Mark></span>
            <div className="kbc__main">
              <div className="kbc__name">Rotate {displayName(k.name)} <Dot sev={k.severity as 'critical'} /></div>
              <div className="kbc__sub">{platOf(k.platform).label} · {SEVL[k.severity] ?? k.severity}</div>
            </div>
            <span className="kbc__meta" style={{ color: u.color }}>{u.txt}</span>
            {s && <span className="kbc__run">Start rotation <kbd className="ks-kbd"><CornerDownLeft size={11} /></kbd></span>}
          </>),
        })
      })
    } else {
      keys.filter((k) => incl(k.name, ql) || incl(k.platform, ql)).slice(0, 5).forEach((k) => {
        const u = urgency(k)
        out.push({
          key: 'k-' + k.id, group: 'Keys', run: () => go('/inventory'),
          node: (s) => (<>
            <span className="kbc__resmark"><Mark>{platOf(k.platform).code}</Mark></span>
            <div className="kbc__main">
              <div className="kbc__name">{displayName(k.name)} <Dot sev={k.severity as 'critical'} /></div>
              <div className="kbc__sub">{platOf(k.platform).label} · {SEVL[k.severity] ?? k.severity}</div>
            </div>
            <span className="kbc__meta" style={{ color: u.color }}>{u.txt}</span>
            {s && <span className="kbc__run">open <kbd className="ks-kbd"><CornerDownLeft size={11} /></kbd></span>}
          </>),
        })
      })
      findings.filter((f) => incl(f.keyType, ql) || incl(f.patternName, ql) || incl(f.filePath, ql)).slice(0, 4).forEach((f) => {
        out.push({
          key: 'f-' + f.id, group: 'Findings', run: () => go('/discovery-scanner'),
          node: () => (<>
            <span className="kbc__resmark"><Mark>{platOf(f.platform || f.keyType).code}</Mark></span>
            <div className="kbc__main">
              <div className="kbc__name">{f.patternName || f.keyType} <Dot sev={f.severity as 'critical'} /></div>
              <div className="kbc__sub">{f.filePath}{f.lineNumber ? `:${f.lineNumber}` : ''}</div>
            </div>
            <span className="kbc__tag">open finding</span>
          </>),
        })
      })
    }
    PAGES.filter((p) => !querying || incl(p.label, ql)).forEach((p) => {
      const Icon = p.icon
      out.push({
        key: 'p-' + p.href, group: querying ? 'Pages' : 'Jump to', run: () => go(p.href),
        node: () => (<>
          <span className="kbc__ico"><Icon size={14} /></span>
          <div className="kbc__main"><div className="kbc__name">{p.label}</div><div className="kbc__sub">{p.desc(counts)}</div></div>
          <span className="kbc__tag">{p.code}</span>
        </>),
      })
    })
    return out
  }, [querying, ql, keys, findings, platforms, workflows]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSel(0) }, [ql])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => Math.min(i + 1, items.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        if (querying && e.metaKey) seeAll()
        else if (items[sel]) items[sel].run()
        else if (querying) seeAll()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, sel, querying]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  // Render the flat list grouped, preserving each item's flat index for selection.
  const groups: { name: string; rows: { item: Item; idx: number }[] }[] = []
  items.forEach((item, idx) => {
    let g = groups.find((x) => x.name === item.group)
    if (!g) { g = { name: item.group, rows: [] }; groups.push(g) }
    g.rows.push({ item, idx })
  })
  const counted = new Set(['Keys', 'Findings', 'Needs action', 'Pages'])

  return (
    <div className="ks-cmd-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ks-cmd" role="dialog" aria-label="Command">
        <div className="kbc__input">
          <Search size={16} color="var(--tx-dim)" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search keys or type a command…" />
          {querying && <span className="kbc__qhint">{items.length} result{items.length === 1 ? '' : 's'} · <kbd className="ks-kbd">↵</kbd> see all</span>}
        </div>

        <div className="kbc__results">
          {querying && items.length === 0 && <div className="kbc__empty">No matches. Press ↵ to search everything.</div>}
          {groups.map((g) => (
            <div key={g.name}>
              <div className="kbc__group">{g.name}{counted.has(g.name) && <span className="n">· {g.rows.length}</span>}</div>
              {g.rows.map(({ item, idx }) => (
                <div
                  key={item.key}
                  className={'kbc__row' + (idx === sel ? ' sel' : '')}
                  onMouseMove={() => setSel(idx)}
                  onClick={item.run}
                >
                  {item.node(idx === sel)}
                </div>
              ))}
            </div>
          ))}
          {querying && (
            <div className={'kbc__seerow' + (sel === items.length ? ' sel' : '')} onClick={seeAll}>
              <Search size={14} /> Search everything for “{q.trim()}”
              <span className="ks-kbd"><CornerDownLeft size={12} /></span>
            </div>
          )}
        </div>

        <div className="kbc__foot">
          <span><kbd className="ks-kbd">↑↓</kbd> navigate</span>
          <span><kbd className="ks-kbd"><CornerDownLeft size={11} /></kbd> {querying ? 'open · ⌘↵ for all' : 'run'}</span>
          <span><kbd className="ks-kbd">esc</kbd> close</span>
          <span className="kbc__foot__note">advisory · Keystrok never rotates without you</span>
        </div>
      </div>
    </div>
  )
}
