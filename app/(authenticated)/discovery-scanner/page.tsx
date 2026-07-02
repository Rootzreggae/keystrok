'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Search, Github, FolderOpen } from 'lucide-react'
import { Mark, Dot, Pill } from '@/components/ks'
import { FindingDrawer } from '@/components/ks/FindingDrawer'
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
  const [opts, setOpts] = useState<Opts>({
    source_code: true, environment_files: true, configuration_files: true, git_repositories: false, docker_files: false,
  })
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
  const { data: inbox = [] } = useQuery<Finding[]>({ queryKey: ['findings', 'active'], queryFn: fetchFindings('active'), refetchInterval: scanning ? 3000 : false })
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

  return (
    <div className="ks-page">
      <div className="ks-disc">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Findings to triage */}
          <div className="ks-panel">
            <div className="ks-panel__hd">
              <span className="ks-panel__t">Findings to triage</span>
              {inbox.length > 0 && (() => { const a = ago(inbox[0].createdAt ?? ''); return <span className="ks-panel__sub">· last scan {a === 'now' ? 'just now' : a + ' ago'}</span> })()}
              {inbox.length > 0 && <Pill tone="crit" className="ks-disc__count">{inbox.length} new</Pill>}
            </div>
            {inbox.length === 0 ? (
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
            ) : (
              inbox.map((f) => {
                const plat = platOf(f.platform || f.keyType)
                return (
                  <div className="ks-finding ks-finding--click" key={f.id} onClick={() => setSelected(f)}>
                    <span className="ks-finding__sev" style={{ background: sevColor(f.severity) }} />
                    <div className="ks-finding__main">
                      <div className="ks-finding__name"><Mark>{plat.code}</Mark> {f.patternName || f.keyType} <Dot sev={f.severity as 'critical'} /></div>
                      <div className="ks-finding__line">detected in {f.fileName || f.filePath.split('/').pop()}</div>
                      <div className="ks-finding__src">{cleanLocation(f.filePath)}:{f.lineNumber ?? '?'} · <span style={{ color: 'var(--tx-mut)' }}>{f.keyPreview}</span></div>
                    </div>
                    <div className="ks-finding__cta" onClick={(e) => e.stopPropagation()}>
                      <button className="ks-btn ks-btn--primary ks-btn--sm" disabled={promote.isPending} onClick={() => promote.mutate(f.id)}><Check size={13} /> Promote</button>
                      <button className="ks-btn ks-btn--sm" disabled={dismiss.isPending} onClick={() => dismiss.mutate(f.id)}><X size={13} /> Dismiss</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Recently triaged */}
          {triaged.length > 0 && (
            <div className="ks-panel">
              <div className="ks-panel__hd">
                <span className="ks-panel__t">Recently triaged</span>
                <span className="ks-panel__sub">· today</span>
              </div>
              {triaged.map((t) => (
                <div className="ks-triaged" key={t.id}>
                  <span className={'ks-triaged__verb ' + (t.status === 'resolved' ? 'promoted' : 'dismissed')}>
                    {t.status === 'resolved' ? 'promoted' : 'dismissed'}
                  </span>
                  <span className="ks-triaged__name">{t.patternName || t.keyType}</span>
                  <span className="ks-triaged__path">{cleanLocation(t.filePath)}</span>
                  <span className="ks-triaged__when">{hhmmss(t.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scan instrument */}
        <div className="ks-panel">
          <div className="ks-panel__hd"><span className="ks-panel__t">Scan instrument</span></div>

          {ghRepos.length > 0 && (
            <div className="ks-scanrepos">
              <div className="ks-scanrepos__l">Connected repositories · {ghRepos.length}</div>
              {ghRepos.map((r) => (
                <div className="ks-scanrepo" key={r.connectionId + r.fullName}>
                  <Github size={13} className="ks-scanrepo__ico" />
                  <span className="ks-scanrepo__name" title={r.fullName}>{r.fullName}</span>
                  <button className="ks-btn ks-btn--sm" disabled={scanning || scanRepo.isPending} onClick={() => scanRepo.mutate({ connectionId: r.connectionId, fullName: r.fullName })}>
                    <Search size={12} /> Scan
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="ks-scansource">
            <button className="ks-btn ks-btn--primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => openConnect(1)}>
              <Github size={14} /> {ghRepos.length > 0 ? 'Connect another source' : 'Connect a source'}
            </button>
            <div className="ks-scansource__or">or scan a local folder</div>
          </div>
          <div className="ks-scantarget">
            <label className="ks-scantarget__lbl">Scan a folder</label>
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
            <div className="ks-scantarget__hint">Browse picks a folder visually (files scanned in-browser) · a path scans server-side</div>
          </div>
          <div className="ks-scan">
            {SOURCES.map((s) => (
              <div className="ks-scanrow" key={s.id}>
                <div className="ks-scanrow__main">
                  <div className="ks-scanrow__lbl">{s.label}</div>
                  <div className="ks-scanrow__meta">{s.meta}</div>
                </div>
                <button
                  className={'ks-toggle' + (opts[s.id] ? ' on' : '')}
                  aria-pressed={opts[s.id]}
                  onClick={() => setOpts((o) => ({ ...o, [s.id]: !o[s.id] }))}
                >
                  <span className="ks-toggle__k" />
                </button>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, borderTop: '1px solid var(--div)' }}>
            <button className="ks-btn ks-btn--primary" style={{ width: '100%', justifyContent: 'center' }} disabled={scanning || runScan.isPending} onClick={() => runScan.mutate()}>
              <Search size={14} /> {scanning ? 'Scanning…' : 'Run scan now'}
            </button>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--tx-dim)', marginTop: 10, lineHeight: 1.6, textAlign: 'center' }}>
              Scans read-only · keys are previewed, never stored in full
            </div>
          </div>
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
