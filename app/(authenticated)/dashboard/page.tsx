'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowRight, RotateCw, Shield, Github, Search, CheckCircle2, RefreshCw, X, Server, FileText, type LucideIcon } from 'lucide-react'
import { Mark } from '@/components/ks'
import { KeyDrawer } from '@/components/ks/KeyDrawer'
import { useSourceConnect } from '@/components/ks/SourceConnect'
import { type ApiKey, platOf, SEVL, sevColor, displayName, urgency, needsAction, ago, cleanLocation } from '@/lib/keys-display'

interface Activity { id: string; action?: string; description?: string; emoji?: string; createdAt: string }

// Map an activity action to a lucide icon (matches the render's clean iconography, not emoji).
function actIcon(action?: string): LucideIcon {
  const a = action ?? ''
  if (/scan|discover/.test(a)) return Search
  if (/promot/.test(a)) return CheckCircle2
  if (/rotat|workflow/.test(a)) return RefreshCw
  if (/false|ignor|dismiss|revok/.test(a)) return X
  if (/platform/.test(a)) return Server
  return FileText
}
interface Workflow {
  id: string
  status: string
  discoveredKey?: { keyName?: string; platform?: string }
  steps?: { stepNumber: number; name?: string; status: string }[]
}

const isRunning = (s: string) => s === 'in_progress' || s === 'running' || s === 'active'

export default function HomeScreen() {
  const router = useRouter()
  const { openConnect } = useSourceConnect()
  const [selected, setSelected] = useState<ApiKey | null>(null)

  const { data: keysData } = useQuery<ApiKey[]>({
    queryKey: ['keys'],
    queryFn: async () => {
      const r = await fetch('/api/keys')
      if (!r.ok) throw new Error('keys')
      const j = await r.json()
      return j.keys ?? j ?? []
    },
    refetchInterval: 30000,
  })
  const { data: activity = [] } = useQuery<Activity[]>({
    queryKey: ['activity-recent'],
    queryFn: async () => {
      const r = await fetch('/api/activity/recent?limit=8')
      if (!r.ok) throw new Error('activity')
      const j = await r.json()
      return j.data?.activities ?? j.activities ?? j.data ?? []
    },
  })
  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: async () => {
      const r = await fetch('/api/workflows')
      if (!r.ok) throw new Error('workflows')
      const j = await r.json()
      return j.data?.workflows ?? j.workflows ?? []
    },
  })
  // Findings tell us whether the pipeline has started, so "empty ledger" isn't
  // mistaken for "first run". Shares cache with the sidebar badge + Discovery.
  const { data: findings = [] } = useQuery<unknown[]>({
    queryKey: ['findings', 'active'],
    queryFn: async () => {
      const r = await fetch('/api/discovery/results?status=active')
      if (!r.ok) throw new Error('findings')
      const j = await r.json()
      return j.results?.findings ?? j.findings ?? []
    },
    refetchInterval: 30000,
  })

  const keys = keysData ?? []
  const running = workflows.filter((w) => isRunning(w.status))
  const counts = {
    total: keys.length,
    overdue: keys.filter((k) => urgency(k).overdue).length,
    needAction: keys.filter(needsAction).length,
    rotating: running.length,
  }
  const queue = [...keys]
    .filter(needsAction)
    .sort((a, b) => urgency(a).rank - urgency(b).rank || a.daysUntilExpiry - b.daysUntilExpiry)
    .slice(0, 5)
  const inProgress = running[0]

  // Empty ledger has two distinct meanings. Don't conflate them.
  if (keysData && keys.length === 0) {
    // Findings exist but nothing promoted yet → bridge the user to triage.
    if (findings.length > 0) {
      return (
        <div className="ks-home">
          <div className="ks-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 520 }}>
            <div className="ks-empty">
              <span className="ks-empty__ico"><Search size={26} strokeWidth={1.75} /></span>
              <div className="ks-empty__t">{findings.length} finding{findings.length === 1 ? '' : 's'} to triage</div>
              <div className="ks-empty__s">
                Your last scan surfaced exposed secrets. Review them in Discovery. Promote the real ones to
                start tracking and rotating, dismiss the false positives. Promoted keys land here on the ledger.
              </div>
              <button className="ks-btn ks-btn--primary" style={{ marginTop: 18 }} onClick={() => router.push('/discovery-scanner')}>
                <Search size={14} /> Review in Discovery
              </button>
              <div className="ks-empty__hint">Nothing is tracked until you promote a finding</div>
            </div>
          </div>
        </div>
      )
    }
    // Genuinely nothing yet → first-run welcome.
    return (
      <div className="ks-home">
        <div className="ks-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 520 }}>
          <div className="ks-empty">
            <span className="ks-empty__ico"><Shield size={26} strokeWidth={1.75} /></span>
            <div className="ks-empty__t">Welcome to Keystrok</div>
            <div className="ks-empty__s">
              Keystrok finds exposed secrets in your code and walks you through rotating them, safely, on your
              schedule. Connect a source to run the first scan; anything it finds shows up here, ranked by urgency.
            </div>
            <button className="ks-btn ks-btn--primary" style={{ marginTop: 18 }} onClick={() => openConnect(1)}>
              <Github size={14} /> Connect a source
            </button>
            <div className="ks-empty__hint">Read-only · Keystrok never rotates a key on its own</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ks-home">
      <div className="ks-home__statbar">
        <div className="ks-home__statcell"><div className={'ks-stat__n' + (counts.needAction ? ' warn' : ' zero')}>{counts.needAction}</div><div className="ks-stat__l">Need action</div></div>
        <div className="ks-home__statcell"><div className={'ks-stat__n' + (counts.overdue ? ' crit' : ' zero')}>{counts.overdue}</div><div className="ks-stat__l">Overdue</div></div>
        <div className="ks-home__statcell"><div className={'ks-stat__n' + (counts.rotating ? ' active' : ' zero')}>{counts.rotating}</div><div className="ks-stat__l">Rotating</div></div>
        <div className="ks-home__statcell"><div className="ks-stat__n muted">{counts.total}</div><div className="ks-stat__l">Tracked</div></div>
      </div>

      <div className="ks-home__grid">
        {/* Needs action queue */}
        <div className="ks-panel">
          <div className="ks-panel__hd">
            <span className="ks-panel__t">Needs action</span>
            <button className="ks-btn ks-btn--ghost ks-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => router.push('/inventory')}>
              View all keys <ArrowRight size={13} />
            </button>
          </div>
          <div className="ks-aq">
            {queue.length === 0 && (
              <div style={{ padding: '28px 18px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx-dim)' }}>
                Nothing needs action. Every tracked key is inside its rotation window.
              </div>
            )}
            {queue.map((k) => {
              const u = urgency(k)
              const plat = platOf(k.platform)
              return (
                <div className="ks-aqrow" key={k.id} onClick={() => setSelected(k)}>
                  <span className="ks-aqrow__sev" style={{ background: sevColor(k.severity) }} />
                  <Mark>{plat.code}</Mark>
                  <div className="ks-aqrow__main">
                    <div className="ks-aqrow__name">{displayName(k.name)}</div>
                    <div className="ks-aqrow__meta">{plat.label} · {SEVL[k.severity] ?? k.severity} · found {ago(k.created_at)} ago</div>
                  </div>
                  <span className="ks-aqrow__u" style={{ color: u.color }}>{u.txt}</span>
                  <button
                    className="ks-btn ks-btn--sm ks-aqrow__cta"
                    onClick={(e) => { e.stopPropagation(); router.push('/rotation-workflows') }}
                  >
                    <RotateCw size={12} /> Rotate
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="ks-home__col">
          <div className="ks-panel">
            <div className="ks-panel__hd">
              <span className="ks-panel__t">In progress</span>
              {inProgress && <span className="ks-panel__sub" style={{ marginLeft: 'auto' }}>rotation</span>}
            </div>
            {inProgress ? (
              <div className="ks-rotmini">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Mark>{platOf(inProgress.discoveredKey?.platform ?? '').code}</Mark>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>
                    {displayName(inProgress.discoveredKey?.keyName ?? 'Rotation')}
                  </span>
                </div>
                <div className="ks-rotmini__steps">
                  {(inProgress.steps ?? []).map((s) => (
                    <span key={s.stepNumber} className={'ks-rotmini__seg' + (s.status === 'completed' ? ' done' : isRunning(s.status) ? ' active' : '')} />
                  ))}
                </div>
                <div className="ks-rotmini__lbl">
                  <span>{(inProgress.steps ?? []).filter((s) => s.status === 'completed').length} of {(inProgress.steps ?? []).length} done</span>
                </div>
                <button
                  className="ks-btn ks-btn--primary ks-btn--sm"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
                  onClick={() => router.push(`/rotation-workflows?workflow=${inProgress.id}`)}
                >
                  <ArrowRight size={13} /> Resume guided rotation
                </button>
              </div>
            ) : (
              <div style={{ padding: '24px 18px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx-dim)' }}>
                No rotation in progress.
              </div>
            )}
          </div>

          <div className="ks-panel">
            <div className="ks-panel__hd">
              <span className="ks-panel__t">Recent activity</span>
              <button className="ks-btn ks-btn--ghost ks-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => router.push('/activity')}>
                Log <ArrowRight size={13} />
              </button>
            </div>
            <div className="ks-mini">
              {activity.length === 0 && (
                <div style={{ padding: '24px 18px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--tx-dim)' }}>No activity yet.</div>
              )}
              {activity.slice(0, 5).map((e) => {
                const Icon = actIcon(e.action)
                return (
                  <div className="ks-minirow" key={e.id}>
                    <span className="ks-minirow__dot"><Icon size={13} strokeWidth={1.75} /></span>
                    <span className="ks-minirow__txt">{cleanLocation(e.description ?? 'Activity')}</span>
                    <span className="ks-minirow__when">{ago(e.createdAt)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <KeyDrawer keyData={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
