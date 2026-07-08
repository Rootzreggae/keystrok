'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Search, Github, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { Mark, Dot } from '@/components/ks'
import { FindingDrawer } from '@/components/ks/FindingDrawer'
import { InlineLoading } from '@/components/ks/Loading'
import { useSourceConnect } from '@/components/ks/SourceConnect'
import { pickAndScanFolder } from '@/lib/folder-scan'
import { platOf, sevColor, ago, cleanLocation } from '@/lib/keys-display'

interface Finding {
  id: string
  filePath: string
  fileName?: string
  lineNumber?: number
  keyType: string
  platform?: string
  severity: string
  keyPreview?: string
  patternName?: string
  status: string
  createdAt?: string
}

const hhmmss = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB') : '')

// Two severity buckets on this page: critical, or everything-else = "attention".
const sevBucket = (f: Finding): 'critical' | 'attention' => (f.severity === 'critical' ? 'critical' : 'attention')
// Normalize every masked preview to one shape: prefix + •×8 + suffix.
const maskVal = (p?: string) => {
  if (!p) return ''
  const m = p.match(/^(.+?)[•*.]{2,}(.+)$/)
  return m ? `${m[1]}${'•'.repeat(8)}${m[2]}` : p
}
// path lives only in the group header; split so the dir truncates and the filename never does.
const splitPath = (p: string) => { const c = cleanLocation(p); const i = c.lastIndexOf('/'); return i < 0 ? { dir: '', file: c } : { dir: c.slice(0, i + 1), file: c.slice(i + 1) } }

const SOURCES = [
  { id: 'source_code', label: 'Source code', meta: 'ts · js · go · py' },
  { id: 'environment_files', label: 'Environment files', meta: '.env*' },
  { id: 'configuration_files', label: 'Config files', meta: 'yaml · toml · json' },
  { id: 'git_repositories', label: 'Git history', meta: 'committed secrets' },
  { id: 'docker_files', label: 'Docker files', meta: 'Dockerfile · compose' },
] as const

type Opts = Record<string, boolean>

export default function DiscoveryScreen() {
  const qc = useQueryClient()
  // Coverage toggles moved to Settings per the redesign; here the defaults feed
  // the folder/path scan and the read-only Coverage summary in the rail.
  // ponytail: fixed object until Settings owns coverage; wire it through then.
  const opts: Opts = { source_code: true, environment_files: true, configuration_files: true, git_repositories: false, docker_files: false }
  const [scanning, setScanning] = useState(false)
  const [selected, setSelected] = useState<Finding | null>(null)
  const { openConnect } = useSourceConnect()
  // Where to scan. Remembered across visits; empty falls back to the server default.
  const [target, setTarget] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('ks-scan-target') ?? '' : ''))

  const fetchFindings = (status?: string) => async () => {
    const r = await fetch('/api/discovery/results' + (status ? `?status=${status}` : ''))
    if (!r.ok) throw new Error('results')
    const j = await r.json()
    return (j.results?.findings ?? j.findings ?? []) as Finding[]
  }
  const { data: inbox = [], isLoading: inboxLoading } = useQuery<Finding[]>({ queryKey: ['findings', 'active'], queryFn: fetchFindings('active'), refetchInterval: scanning ? 3000 : false })
  // Secondary: feeds only the "Recently triaged" receipts in the rail. It must
  // never gate the triage list — that coupling made the list wait on a fetch it
  // doesn't need, so a loaded header sat above a "Loading" list.
  const { data: all = [] } = useQuery<Finding[]>({ queryKey: ['findings', 'all'], queryFn: fetchFindings() })
  const triaged = all.filter((f) => f.status === 'resolved' || f.status === 'dismissed').slice(0, 6)

  // Connected GitHub repos, so any of them can be (re)scanned any time, not
  // just once during the connect wizard.
  const { data: ghData } = useQuery<{ connected: boolean; sources: { connectionId: string; repos: { fullName: string }[] }[] }>({
    queryKey: ['github-repos'],
    queryFn: async () => { const r = await fetch('/api/github/repos'); if (!r.ok) throw new Error('repos'); return r.json() },
  })
  const ghRepos = (ghData?.sources ?? []).flatMap((s) => s.repos.map((r) => ({ ...r, connectionId: s.connectionId })))

  // Poll scan status (always, while on this page) and sync the local `scanning`
  // flag to the server, so a scan started anywhere (e.g. the global connect
  // wizard) shows progress here, and findings refresh the moment it completes.
  useQuery({
    queryKey: ['scan-status'],
    refetchInterval: 2500,
    queryFn: async () => {
      const r = await fetch('/api/discovery/status?active=true')
      const j = await r.json()
      const running = !!j.currentScan && j.currentScan.status !== 'completed' && j.currentScan.status !== 'failed'
      setScanning((was) => {
        if (was && !running) qc.invalidateQueries({ queryKey: ['findings'] }) // just finished
        return running
      })
      return j
    },
  })

  const runScan = useMutation({
    mutationFn: async () => {
      const tp = target.trim()
      if (tp) localStorage.setItem('ks-scan-target', tp)
      const r = await fetch('/api/discovery/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Quick Scan - ${new Date().toLocaleString()}`, scanType: 'quick', options: opts, targetPath: tp || undefined }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to start scan')
      return r.json()
    },
    onSuccess: () => setScanning(true),
    onError: (e: Error) => alert(e.message),
  })

  const scanRepo = useMutation({
    mutationFn: async ({ connectionId, fullName }: { connectionId: string; fullName: string }) => {
      const r = await fetch(`/api/sources/${connectionId}/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName }) })
      if (!r.ok) throw new Error((await r.json()).error || 'Scan failed')
    },
    onSuccess: () => setScanning(true),
    onError: (e: Error) => alert(e.message),
  })

  // Native folder picker → scans the files the browser reads (no path typing).
  const [browsing, setBrowsing] = useState(false)
  const browseFolder = async () => {
    setBrowsing(true)
    const r = await pickAndScanFolder()
    setBrowsing(false)
    if (r.ok) qc.invalidateQueries({ queryKey: ['findings'] })
    else if (r.error) alert(r.error)
  }

  const promote = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/discovery/findings/${id}/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!r.ok) throw new Error((await r.json()).error || 'Promote failed')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['findings'] }); qc.invalidateQueries({ queryKey: ['keys'] }) },
    onError: (e: Error) => alert(e.message),
  })
  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/discovery/findings/${id}/dismiss`, { method: 'POST' })
      if (!r.ok) throw new Error((await r.json()).error || 'Dismiss failed')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['findings'] }),
    onError: (e: Error) => alert(e.message),
  })

  // Bulk triage: dismissing is the SAFE batch action (ignore-this-isn't-a-secret,
  // reversible by rescan), so it gets checkboxes + select-all. Promote stays
  // one-by-one — it writes a key into the tracked inventory, must be deliberate.
  // No bulk endpoint: fan out the single dismiss (fine at triage-queue scale).
  const [sel, setSel] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selCount = inbox.filter((f) => sel.has(f.id)).length
  const allSelected = inbox.length > 0 && selCount === inbox.length
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(inbox.map((f) => f.id)))
  const dismissMany = useMutation({
    mutationFn: async (ids: string[]) => {
      const oks = await Promise.all(ids.map((id) => fetch(`/api/discovery/findings/${id}/dismiss`, { method: 'POST' }).then((r) => r.ok).catch(() => false)))
      const failed = oks.filter((ok) => !ok).length
      if (failed) throw new Error(`${failed} of ${ids.length} could not be dismissed`)
    },
    onSuccess: (_d, ids) => { setSel(new Set()); setUndo(ids); qc.invalidateQueries({ queryKey: ['findings'] }) },
    onError: (e: Error) => { qc.invalidateQueries({ queryKey: ['findings'] }); alert(e.message) },
  })
  const bulkDismiss = () => {
    const ids = inbox.filter((f) => sel.has(f.id)).map((f) => f.id)
    if (ids.length === 0) return
    if (!confirm(`Dismiss ${ids.length} finding${ids.length === 1 ? '' : 's'} (${selCrit} critical · ${ids.length - selCrit} attention)? They move to triaged and reappear only if a rescan finds them again.`)) return
    dismissMany.mutate(ids)
  }

  // Undo the last dismissed batch. The bar auto-expires so it does not linger.
  const [undo, setUndo] = useState<string[]>([])
  useEffect(() => {
    if (undo.length === 0) return
    const t = setTimeout(() => setUndo([]), 12000)
    return () => clearTimeout(t)
  }, [undo])
  const restoreMany = useMutation({
    mutationFn: async (ids: string[]) => {
      const oks = await Promise.all(ids.map((id) => fetch(`/api/discovery/findings/${id}/restore`, { method: 'POST' }).then((r) => r.ok).catch(() => false)))
      const failed = oks.filter((ok) => !ok).length
      if (failed) throw new Error(`${failed} of ${ids.length} could not be restored`)
    },
    onSuccess: () => { setUndo([]); qc.invalidateQueries({ queryKey: ['findings'] }) },
    onError: (e: Error) => { qc.invalidateQueries({ queryKey: ['findings'] }); alert(e.message) },
  })

  // Bulk track: the new spec adds "Track N…" alongside bulk dismiss. Both are
  // deliberate (confirm restates the count + severity mix); track writes keys.
  const promoteMany = useMutation({
    mutationFn: async (ids: string[]) => {
      const oks = await Promise.all(ids.map((id) => fetch(`/api/discovery/findings/${id}/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.ok).catch(() => false)))
      const failed = oks.filter((ok) => !ok).length
      if (failed) throw new Error(`${failed} of ${ids.length} could not be tracked`)
    },
    onSuccess: () => { setSel(new Set()); qc.invalidateQueries({ queryKey: ['findings'] }); qc.invalidateQueries({ queryKey: ['keys'] }) },
    onError: (e: Error) => { qc.invalidateQueries({ queryKey: ['findings'] }); alert(e.message) },
  })

  // Severity filter + file grouping + collapse. All session-local, derived each render.
  const [filter, setFilter] = useState<'all' | 'critical' | 'attention'>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [folderOpen, setFolderOpen] = useState(false)

  const critN = inbox.filter((f) => f.severity === 'critical').length
  const attnN = inbox.length - critN
  const fileCount = new Set(inbox.map((f) => f.filePath)).size
  const lastScan = inbox.length > 0 ? (() => { const a = ago(inbox[0].createdAt ?? ''); return a === 'now' ? 'just now' : a + ' ago' })() : '—'

  const visible = filter === 'all' ? inbox : inbox.filter((f) => sevBucket(f) === filter)
  // group by file, crit-first within a group, groups ordered by (has-crit, count)
  const groups = (() => {
    const m = new Map<string, Finding[]>()
    for (const f of visible) { const a = m.get(f.filePath); a ? a.push(f) : m.set(f.filePath, [f]) }
    const arr = [...m.entries()].map(([path, fs]) => ({
      path,
      findings: [...fs].sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1)),
      crit: fs.filter((f) => f.severity === 'critical').length,
    }))
    arr.sort((a, b) => (b.crit ? 1 : 0) - (a.crit ? 1 : 0) || b.findings.length - a.findings.length)
    return arr
  })()

  const groupState = (fs: Finding[]) => { const n = fs.filter((f) => sel.has(f.id)).length; return { all: n > 0 && n === fs.length, some: n > 0 && n < fs.length } }
  const toggleGroup = (fs: Finding[]) => setSel((p) => { const n = new Set(p); const on = fs.every((f) => n.has(f.id)); fs.forEach((f) => (on ? n.delete(f.id) : n.add(f.id))); return n })
  const toggleCollapse = (path: string) => setCollapsed((p) => { const n = new Set(p); n.has(path) ? n.delete(path) : n.add(path); return n })
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.path))
  const collapseAll = () => setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.path)))

  const selFindings = inbox.filter((f) => sel.has(f.id))
  const selCrit = selFindings.filter((f) => f.severity === 'critical').length
  const selFiles = new Set(selFindings.map((f) => f.filePath)).size
  const bulkTrack = () => {
    const ids = selFindings.map((f) => f.id)
    if (!ids.length) return
    if (!confirm(`Track ${ids.length} finding${ids.length === 1 ? '' : 's'} (${selCrit} critical · ${selCount - selCrit} attention)? Each becomes a tracked key in your ledger.`)) return
    promoteMany.mutate(ids)
  }

  return (
    <div className="ks-page">
      <div className="ks-disc">
        {/* ---- MAIN: findings to triage, grouped by file ---- */}
        <div className="ks-triage">
          <div className="ks-triage__hd">
            <h2 className="ks-triage__title">Findings to triage</h2>
            {!inboxLoading && <span className="ks-triage__meta">{inbox.length} finding{inbox.length === 1 ? '' : 's'} · {fileCount} file{fileCount === 1 ? '' : 's'} · last scan {lastScan}</span>}
            <span className="ks-triage__spacer" />
            {groups.length > 0 && <button className="ks-triage__collapse" onClick={collapseAll}>{allCollapsed ? 'Expand all' : 'Collapse all'}</button>}
            {inbox.length > 0 && (
              <div className="ks-sevchips" role="tablist" aria-label="Filter by severity">
                <button role="tab" aria-selected={filter === 'all'} className={'ks-sevchip' + (filter === 'all' ? ' is-on' : '')} onClick={() => setFilter('all')}>All <em>{inbox.length}</em></button>
                <button role="tab" aria-selected={filter === 'critical'} className={'ks-sevchip' + (filter === 'critical' ? ' is-on' : '')} onClick={() => setFilter('critical')}><Dot sev="critical" /> Critical <em>{critN}</em></button>
                <button role="tab" aria-selected={filter === 'attention'} className={'ks-sevchip' + (filter === 'attention' ? ' is-on' : '')} onClick={() => setFilter('attention')}><Dot sev="medium" /> Attention <em>{attnN}</em></button>
              </div>
            )}
          </div>

          {/* selection action bar — pinned above the list, only when something is selected */}
          {selCount > 0 && (
            <div className="ks-selbar">
              <label className="ks-selbar__check" title={allSelected ? 'Clear selection' : 'Select all'}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  ref={(el) => { if (el) el.indeterminate = selCount > 0 && !allSelected }} aria-label="Select all findings" />
              </label>
              <span className="ks-selbar__n">{selCount} selected</span>
              <span className="ks-selbar__mix">across {selFiles} file{selFiles === 1 ? '' : 's'} · {selCrit} critical · {selCount - selCrit} attention</span>
              <span className="ks-triage__spacer" />
              <button className="ks-selbar__clear" onClick={() => setSel(new Set())}>clear</button>
              <button className="ks-btn ks-btn--primary ks-btn--sm" disabled={promoteMany.isPending} onClick={bulkTrack}><Check size={13} /> Track {selCount}…</button>
              <button className="ks-selbar__dismiss" disabled={dismissMany.isPending} onClick={bulkDismiss}><X size={13} /> Dismiss {selCount}…</button>
            </div>
          )}

          {undo.length > 0 && (
            <div className="ks-disc__undo">
              <span className="ks-disc__undot">Dismissed {undo.length} finding{undo.length === 1 ? '' : 's'}</span>
              <button className="ks-disc__undobtn" onClick={() => restoreMany.mutate(undo)} disabled={restoreMany.isPending}>Undo</button>
              <button className="ks-disc__undox" onClick={() => setUndo([])} aria-label="Dismiss">&times;</button>
            </div>
          )}

          <div className="ks-panel ks-triage__list">
            {inboxLoading ? (
              <InlineLoading />
            ) : inbox.length === 0 ? (
              <div className="ks-empty" style={{ padding: '48px 24px' }}>
                <span className="ks-empty__ico"><Search size={26} strokeWidth={1.75} /></span>
                <div className="ks-empty__t">{scanning ? 'Scanning…' : triaged.length > 0 ? 'Inbox clear' : 'Nothing to triage yet'}</div>
                <div className="ks-empty__s">
                  {triaged.length > 0 ? (
                    <>You have triaged everything from your last scan. New findings appear here after your next scan. Read-only, nothing is ever written.</>
                  ) : (
                    <>Keystrok finds exposed keys by scanning your code. Connect a Git source or point it at a
                    local folder to run the first scan. Read-only, nothing is ever written.</>
                  )}
                </div>
                {!scanning && triaged.length === 0 && (
                  <button className="ks-btn ks-btn--primary" style={{ marginTop: 18 }} onClick={() => openConnect(1)}>
                    <Github size={14} /> Connect a source
                  </button>
                )}
              </div>
            ) : groups.length === 0 ? (
              <div className="ks-fgroup__empty">No {filter} findings — last scan {lastScan}</div>
            ) : (
              groups.map((g) => {
                const gs = groupState(g.findings)
                const isOpen = !collapsed.has(g.path)
                const { dir, file } = splitPath(g.path)
                return (
                  <div className="ks-fgroup" key={g.path}>
                    <div className="ks-fgroup__hd">
                      <label className="ks-fgroup__pick" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={gs.all} ref={(el) => { if (el) el.indeterminate = gs.some }} onChange={() => toggleGroup(g.findings)} aria-label={`Select all in ${file}`} />
                      </label>
                      <button className="ks-fgroup__chev" onClick={() => toggleCollapse(g.path)} aria-label={isOpen ? 'Collapse' : 'Expand'} aria-expanded={isOpen}>
                        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                      <span className="ks-fgroup__path" title={g.path}><span className="ks-fgroup__dir">{dir}</span><span className="ks-fgroup__file">{file}</span></span>
                      <span className="ks-fgroup__count">· {g.findings.length}</span>
                      {g.crit > 0 && <span className="ks-fgroup__crit">· {g.crit} crit</span>}
                    </div>
                    {/* always mounted so height can animate; collapsed = grid-rows 0fr */}
                    <div className={'ks-fgroup__rows' + (isOpen ? '' : ' is-collapsed')}>
                      <div className="ks-fgroup__rowsinner">
                        {g.findings.map((f) => {
                          const plat = platOf(f.platform || f.keyType)
                          return (
                            <div className={'ks-frow' + (sel.has(f.id) ? ' is-picked' : '')} key={f.id} onClick={() => setSelected(f)}>
                              <label className="ks-frow__pick" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={sel.has(f.id)} onChange={() => toggle(f.id)} aria-label={`Select ${f.patternName || f.keyType}`} />
                              </label>
                              <span className="ks-frow__sev" style={{ background: sevColor(f.severity) }} />
                              <Mark>{plat.code}</Mark>
                              <span className="ks-frow__name">{f.patternName || f.keyType}</span>
                              <span className="ks-frow__val">{maskVal(f.keyPreview)}</span>
                              <span className="ks-frow__line">:{f.lineNumber ?? '?'}</span>
                              <div className="ks-frow__cta" onClick={(e) => e.stopPropagation()}>
                                <button className="ks-frow__track" disabled={promote.isPending} onClick={() => promote.mutate(f.id)}>Track</button>
                                <button className="ks-frow__dismiss" disabled={dismiss.isPending} onClick={() => dismiss.mutate(f.id)}>Dismiss</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ---- RAIL: control surface (sticky) ---- */}
        <div className="ks-drail">
          {/* Sources */}
          <div className="ks-panel">
            <div className="ks-panel__hd">
              <span className="ks-panel__t">Sources</span>
              <span className="ks-panel__sub">last scan {lastScan}</span>
            </div>
            {ghRepos.length > 0 && (
              <div className="ks-srcs">
                {ghRepos.map((r) => (
                  <div className="ks-src" key={r.connectionId + r.fullName}>
                    <Github size={13} className="ks-src__ico" />
                    <div className="ks-src__body">
                      <span className="ks-src__name" title={r.fullName}>{r.fullName}</span>
                      <span className="ks-src__st">re-scans automatically</span>
                    </div>
                    <button className="ks-btn ks-btn--sm" disabled={scanning || scanRepo.isPending} onClick={() => scanRepo.mutate({ connectionId: r.connectionId, fullName: r.fullName })}>
                      <Search size={12} /> Scan
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="ks-srcs__foot">
              <button className="ks-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => openConnect(1)}>
                <Github size={14} /> Connect another source
              </button>
            </div>
            <div className="ks-coverage">
              Coverage: {SOURCES.filter((s) => opts[s.id]).map((s) => s.label.toLowerCase()).join(' · ')}.{' '}
              {SOURCES.some((s) => !opts[s.id]) && <>{SOURCES.filter((s) => !opts[s.id]).map((s) => s.label.toLowerCase()).join(' and ')} off. </>}
              <a className="ks-coverage__cfg" href="/settings">Configure</a>
            </div>
          </div>

          {/* Scan a local folder — collapsed disclosure, never open by default */}
          <div className="ks-fold">
            <button className="ks-fold__hd" onClick={() => setFolderOpen((o) => !o)} aria-expanded={folderOpen}>
              <FolderOpen size={13} className="ks-fold__ico" />
              <span className="ks-fold__lbl">Scan a local folder…</span>
              {folderOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            {folderOpen && (
              <div className="ks-fold__body">
                <div className="ks-fold__note">One-off, runs when you click. Only connected sources re-scan automatically.</div>
                <button className="ks-btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} disabled={browsing || scanning} onClick={browseFolder}>
                  <FolderOpen size={14} /> {browsing ? 'Scanning folder…' : 'Browse folder…'}
                </button>
                <input
                  id="ks-scan-target"
                  className="ks-input"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !scanning) runScan.mutate() }}
                  placeholder="…or type a server path"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
                <div className="ks-fold__hint">Browse picks a folder visually (scanned in-browser) · a path scans server-side</div>
              </div>
            )}
          </div>

          {/* Recently triaged — receipts, capped */}
          {triaged.length > 0 && (
            <div className="ks-panel">
              <div className="ks-panel__hd">
                <span className="ks-panel__t">Recently triaged</span>
                <span className="ks-panel__sub">today</span>
              </div>
              {triaged.slice(0, 5).map((t) => {
                const tracked = t.status === 'resolved'
                return (
                  <div className="ks-receipt" key={t.id}>
                    <div className="ks-receipt__top">
                      <span className={'ks-receipt__chip ' + (tracked ? 'tracked' : 'dismissed')}>{tracked ? 'TRACKED' : 'DISMISSED'}</span>
                      <span className="ks-receipt__name">{t.patternName || t.keyType}</span>
                      <span className="ks-receipt__when">{hhmmss(t.createdAt)}</span>
                    </div>
                    {tracked && (
                      <div className="ks-receipt__sub">→ now tracked as <a href="/keys" className="ks-receipt__key">{t.patternName || t.keyType}</a></div>
                    )}
                  </div>
                )
              })}
              {triaged.length > 5 && <a className="ks-receipt__all" href="/activity">View all → Activity</a>}
            </div>
          )}

          <div className="ks-drail__note">Scans are read-only · keys are previewed, never stored in full</div>
        </div>
      </div>

      <FindingDrawer
        finding={selected}
        onClose={() => setSelected(null)}
        busy={promote.isPending || dismiss.isPending}
        onPromote={(id) => promote.mutate(id, { onSuccess: () => setSelected(null) })}
        onDismiss={(id) => dismiss.mutate(id, { onSuccess: () => setSelected(null) })}
      />
    </div>
  )
}
