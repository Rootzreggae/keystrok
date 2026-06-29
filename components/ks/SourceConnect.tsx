'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Github, GitBranch, Terminal, Eye, FileText, Check, ArrowRight, Search } from 'lucide-react'
import { pickAndScanFolder } from '@/lib/folder-scan'

// Global opener: any screen can start the connect wizard in place (no navigation).
// Provided by AppShell, which renders the wizard once inside the .kb shell.
export const SourceConnectContext = createContext<{ openConnect: (step?: 1 | 3) => void }>({ openConnect: () => {} })
export const useSourceConnect = () => useContext(SourceConnectContext)

type Step = 1 | 2 | 3 | 4
interface Repo { id: number; fullName: string; private: boolean; defaultBranch: string }
interface ReposResp { connected: boolean; sources: { connectionId: string; accountLogin: string; repos: Repo[]; error?: string }[] }

const STEPS: [Step, string][] = [[1, 'Provider'], [2, 'Authorize'], [3, 'Repositories'], [4, 'Done']]

// 4-step connect wizard. Steps 1-2 happen before the GitHub redirect; the user
// returns to Discovery with ?connected=github, which reopens this at step 3.
export function SourceConnect({
  open, initialStep = 1, onClose, onScanStarted,
}: {
  open: boolean
  initialStep?: Step
  onClose: () => void
  onScanStarted: () => void
}) {
  const [step, setStep] = useState<Step>(initialStep)
  const [filter, setFilter] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [scanning, setScanning] = useState(false)

  useEffect(() => { if (open) setStep(initialStep) }, [open, initialStep])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const { data: reposResp } = useQuery<ReposResp>({
    queryKey: ['github-repos'],
    enabled: open && step >= 3,
    queryFn: async () => { const r = await fetch('/api/github/repos'); if (!r.ok) throw new Error('repos'); return r.json() },
  })
  const source = reposResp?.sources?.[0]
  const repos = source?.repos ?? []
  const connectionId = source?.connectionId

  // Default-select every repo the first time the list arrives.
  useEffect(() => {
    if (step === 3 && repos.length && picked.size === 0) setPicked(new Set(repos.map((r) => r.fullName)))
  }, [step, repos]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => repos.filter((r) => r.fullName.toLowerCase().includes(filter.toLowerCase())), [repos, filter])

  if (!open) return null

  const toggle = (name: string) => setPicked((s) => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n })

  const runFirstScan = async () => {
    if (!connectionId || picked.size === 0) return
    setScanning(true)
    for (const fullName of picked) {
      await fetch(`/api/sources/${connectionId}/scan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName }),
      }).catch(() => {})
    }
    setScanning(false)
    onScanStarted()
    onClose()
  }

  return (
    <>
      <div className="ks-drawer-scrim" onClick={onClose} />
      <aside className="ks-drawer ks-wiz">
        <div className="ks-drawer__hd">
          <button className="ks-drawer__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
          <div className="ks-wiz__steps">
            {STEPS.map(([n, label], i) => (
              <span key={n} className={'ks-wiz__step' + (step === n ? ' active' : step > n ? ' done' : '')}>
                <span className="ks-wiz__sdot">{step > n ? <Check size={11} /> : n}</span>
                <span className="ks-wiz__slabel">{label}</span>
                {i < STEPS.length - 1 && <span className="ks-wiz__sline" />}
              </span>
            ))}
          </div>
        </div>

        <div className="ks-drawer__body">
          {step === 1 && (
            <div className="ks-dsect" style={{ borderBottom: 'none' }}>
              <div className="ks-wiz__title">Connect a source to scan</div>
              <div className="ks-wiz__sub">Keystrok reads your code to find exposed keys. Pick where it lives. You choose exactly which repositories next.</div>
              <button className="ks-prov sel" onClick={() => setStep(2)}>
                <span className="ks-prov__icon"><Github size={20} /></span>
                <div className="ks-prov__main"><div className="ks-prov__name">GitHub</div><div className="ks-prov__meta">github.com or Enterprise</div></div>
                <span className="ks-prov__badge ks-prov__badge--rec">Recommended</span>
              </button>
              <div className="ks-prov soon"><span className="ks-prov__icon"><GitBranch size={20} /></span><div className="ks-prov__main"><div className="ks-prov__name">GitLab</div><div className="ks-prov__meta">gitlab.com or self-managed</div></div><span className="ks-prov__badge">Soon</span></div>
              <div className="ks-prov soon"><span className="ks-prov__icon"><GitBranch size={20} /></span><div className="ks-prov__main"><div className="ks-prov__name">Bitbucket</div><div className="ks-prov__meta">Cloud workspaces</div></div><span className="ks-prov__badge">Soon</span></div>
              <button className="ks-prov" onClick={async () => {
                const r = await pickAndScanFolder()
                if (r.ok) { onScanStarted() }
                else if (r.error) alert(r.error)
                if (!r.cancelled) onClose()
              }}>
                <span className="ks-prov__icon"><Terminal size={20} /></span>
                <div className="ks-prov__main"><div className="ks-prov__name">Local folder</div><div className="ks-prov__meta">pick a folder on this machine, files scanned in your browser</div></div>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="ks-dsect" style={{ borderBottom: 'none' }}>
              <div className="ks-wiz__title">Keystrok will ask GitHub for read-only access</div>
              <div className="ks-wiz__sub">The exact permissions the Keystrok GitHub App requests. GitHub shows them again before you install. Nothing is granted until you confirm there.</div>
              <div className="ks-perm"><span className="ks-perm__icon"><Eye size={16} /></span><div className="ks-perm__main"><div className="ks-perm__name">Repository contents <span className="ks-perm__tag">read-only</span></div><div className="ks-perm__desc">Read file contents to scan for committed keys. A match is previewed, never stored in full.</div></div></div>
              <div className="ks-perm"><span className="ks-perm__icon"><FileText size={16} /></span><div className="ks-perm__main"><div className="ks-perm__name">Repository metadata <span className="ks-perm__tag">read-only</span></div><div className="ks-perm__desc">Repo names, branches, visibility, required by every GitHub App.</div></div></div>
              <div className="ks-perm-neg"><span><X size={11} /> No write access</span><span><X size={11} /> No admin / settings</span><span><X size={11} /> No issues or PRs</span></div>
              <div className="ks-wiz__note"><Github size={14} style={{ flex: 'none', marginTop: 1 }} /><span>Next, <b>on github.com</b>, you grant <b>all repositories</b> or a <b>selected set</b>. Not an org owner? GitHub sends the request to one to approve.</span></div>
            </div>
          )}

          {step === 3 && (
            <div className="ks-dsect" style={{ borderBottom: 'none' }}>
              <div className="ks-wiz__title">Choose repositories to scan</div>
              <div className="ks-wiz__sub">From the {repos.length} the GitHub App can read. Toggle any on or off, filter, or select all at once.</div>
              <div className="ks-wiz__filterrow">
                <div className="ks-wiz__filter"><Search size={14} color="var(--tx-dim)" /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" /></div>
                <button className="ks-btn ks-btn--sm" onClick={() => setPicked(new Set(repos.map((r) => r.fullName)))}>Select all {repos.length}</button>
              </div>
              {repos.length === 0 && <div style={{ padding: '20px 0', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx-dim)' }}>No repositories available on this installation yet.</div>}
              {shown.map((r) => (
                <button key={r.id} className={'ks-repo' + (picked.has(r.fullName) ? ' on' : '')} onClick={() => toggle(r.fullName)}>
                  <span className="ks-repo__check">{picked.has(r.fullName) && <Check size={12} />}</span>
                  <div className="ks-repo__main">
                    <div className="ks-repo__name">{r.fullName} {r.private && <span className="ks-repo__badge">private</span>}</div>
                    <div className="ks-repo__meta">{r.defaultBranch}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="ks-dsect" style={{ borderBottom: 'none' }}>
              <div className="ks-wiz__title">{source?.accountLogin ? `${source.accountLogin} connected` : 'GitHub connected'}</div>
              <div className="ks-wiz__sub">Keystrok can read the repositories you selected. Run the first scan to populate Discovery.</div>
              <div className="ks-wiz__check"><Check size={26} /></div>
              <div className="ks-wiz__stats">
                <div className="ks-wiz__stat"><div className="ks-wiz__statn">{picked.size}</div><div className="ks-wiz__statl">repos scanning</div></div>
                <div className="ks-wiz__stat"><div className="ks-wiz__statn">{repos.length}</div><div className="ks-wiz__statl">accessible</div></div>
                <div className="ks-wiz__stat"><div className="ks-wiz__statn">read</div><div className="ks-wiz__statl">only</div></div>
              </div>
            </div>
          )}
        </div>

        <div className="ks-drawer__foot">
          {step === 2 && (
            <button className="ks-btn ks-btn--primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { window.location.href = '/api/github/install' }}>
              <Github size={14} /> Continue on GitHub
            </button>
          )}
          {step === 3 && (
            <button className="ks-btn ks-btn--primary" style={{ flex: 1, justifyContent: 'center' }} disabled={picked.size === 0} onClick={() => setStep(4)}>
              Continue · {picked.size} selected <ArrowRight size={14} />
            </button>
          )}
          {step === 4 && (
            <button className="ks-btn ks-btn--primary" style={{ flex: 1, justifyContent: 'center' }} disabled={scanning || picked.size === 0} onClick={runFirstScan}>
              <Search size={14} /> {scanning ? 'Starting…' : `Run first scan`}
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
