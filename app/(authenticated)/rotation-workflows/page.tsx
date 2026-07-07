'use client'

import { Suspense, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Check, Lock, RotateCw, ShieldAlert, KeyRound, ChevronRight, ChevronDown } from 'lucide-react'
import { Mark, Dot, Pill } from '@/components/ks'
import { PanelLoading } from '@/components/ks/Loading'
import { platOf, SEVL, displayName, needsAction, urgency, type ApiKey } from '@/lib/keys-display'
import { isDestructiveStep } from '@/lib/rotation-policy'

interface WfStep {
  id: string
  stepNumber: number
  name: string
  description?: string
  instructions?: string | null
  stepType?: string
  status: string
  isAutomated?: boolean
}
interface WfKey { keyName?: string; platform?: string; severity?: string; location?: string }
interface Workflow {
  id: string
  status: string
  discoveredKeyId?: string
  discoveredKey?: WfKey
  steps?: { stepNumber: number; status: string }[]
}
interface WorkflowDetail {
  id: string
  status: string
  startedAt?: string | null
  discoveredKey?: WfKey
  steps?: WfStep[]
}

const hhmm =(iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')
const isDoneStep = (s: string) => s === 'completed' || s === 'skipped'
const isRevoke = (s: WfStep) => isDestructiveStep(s)

function Stepper({ workflowId, steps }: { workflowId: string; steps: WfStep[] }) {
  const qc = useQueryClient()
  const complete = useMutation({
    mutationFn: async (stepId: string) => {
      const r = await fetch(`/api/workflows/${workflowId}/steps/${stepId}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to complete step')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflow', workflowId] })
      qc.invalidateQueries({ queryKey: ['workflows'] })
    },
    onError: (e: Error) => alert(e.message),
  })

  const activeIdx = steps.findIndex((s) => !isDoneStep(s.status))

  return (
    <div className="ks-stepper">
      {steps.map((s, i) => {
        const done = isDoneStep(s.status)
        const active = i === activeIdx
        const state = done ? 'done' : active ? 'active' : 'todo'
        const revoke = isRevoke(s)
        return (
          <div className={'ks-step ' + state} key={s.id}>
            <div className="ks-step__rail">
              <span className="ks-step__num">{done ? <Check size={14} /> : s.stepNumber}</span>
              {i < steps.length - 1 && <span className="ks-step__line" />}
            </div>
            <div className="ks-step__body">
              <div className="ks-step__t">
                {s.name}
                {revoke && <Pill tone="crit">irreversible</Pill>}
              </div>

              {active && (
                <>
                  {(s.description || s.instructions) && (
                    <div className="ks-step__d">{s.description || s.instructions}</div>
                  )}
                  <div className="ks-step__actors">
                    {s.isAutomated ? (
                      <><span className="ks-actor ks-actor--sys">Keystrok</span> runs this check</>
                    ) : (
                      <>
                        <span className="ks-actor ks-actor--you">You</span> run this step
                        <span className="ks-actor ks-actor--sys" style={{ marginLeft: 4 }}>Keystrok</span> records it
                      </>
                    )}
                  </div>
                  <div className="ks-step__adv">
                    <ShieldAlert size={13} style={{ flex: 'none', marginTop: 1 }} />
                    Advisory: Keystrok recommends the order and watches traffic; it never rotates or revokes a key on its own.
                  </div>
                  {revoke && (
                    <div className="ks-gate">
                      <Lock size={15} style={{ flex: 'none', marginTop: 1, color: 'var(--crit)' }} />
                      <span><b>This revokes the old key and cannot be undone.</b> Only confirm once the replacement is verified everywhere and the old key is idle.</span>
                    </div>
                  )}
                  <div className="ks-step__cta">
                    <button className="ks-btn ks-btn--primary ks-btn--sm" disabled={complete.isPending} onClick={() => complete.mutate(s.id)}>
                      <Check size={13} /> {complete.isPending ? 'Saving…' : revoke ? 'Confirm revoke' : 'Mark step complete'}
                    </button>
                  </div>
                </>
              )}

              {!active && !done && revoke && (
                <div className="ks-step__lockhint"><Lock size={13} /> Unlocks once the prior steps confirm the old key is idle</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RotationsInner() {
  const focus = useSearchParams().get('workflow')
  const [selId, setSelId] = useState<string | null>(null)
  const [startErr, setStartErr] = useState<string | null>(null)
  const [doneOpen, setDoneOpen] = useState(false) // completed rotations are secondary; collapsed by default
  const qc = useQueryClient()

  const { data: workflows = [], isLoading: loadingWf } = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: async () => {
      const r = await fetch('/api/workflows')
      if (!r.ok) throw new Error('workflows')
      const j = await r.json()
      return j.data?.workflows ?? j.workflows ?? []
    },
  })

  const { data: keys = [], isLoading: loadingKeys } = useQuery<ApiKey[]>({
    queryKey: ['keys'],
    queryFn: async () => {
      const r = await fetch('/api/keys')
      if (!r.ok) throw new Error('keys')
      const j = await r.json()
      return Array.isArray(j) ? j : (j.data ?? j.keys ?? [])
    },
  })

  const inProgress = workflows.filter((w) => w.status !== 'completed')
  // Only an IN-PROGRESS rotation suppresses a key from the due list. A completed
  // one does not: a rotation that failed (key still live, still needs action)
  // must re-enter as due rather than reading as handled.
  const activeKeyIds = new Set(inProgress.map((w) => w.discoveredKeyId).filter(Boolean))
  const dueKeys = keys.filter((k) => needsAction(k) && !activeKeyIds.has(k.id))
  const done = workflows.filter((w) => w.status === 'completed')

  const start = useMutation({
    mutationFn: async (keyId: string) => {
      const r = await fetch('/api/workflows/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discoveredKeyId: keyId }),
      })
      const j = await r.json().catch(() => null)
      const id = j?.data?.workflow?.id ?? j?.workflow?.id
      if (!r.ok || !id) throw new Error(j?.error || 'Could not start rotation')
      return id as string
    },
    onSuccess: (id) => { setStartErr(null); qc.invalidateQueries({ queryKey: ['workflows'] }); setSelId(id) },
    onError: (e: Error) => setStartErr(e.message),
  })

  // Don't auto-open a completed rotation on load; if nothing is open we want the
  // "all caught up" state, not a stale success card. (Selecting one still works.)
  const activeId = selId ?? focus ?? inProgress[0]?.id ?? null

  const { data: detail } = useQuery<WorkflowDetail>({
    queryKey: ['workflow', activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const r = await fetch(`/api/workflows/${activeId}`)
      if (!r.ok) throw new Error('workflow')
      const j = await r.json()
      return j.workflow ?? j.data ?? j
    },
  })

  // Don't flash the "nothing to rotate" empty state while the data is still loading.
  if (loadingWf || loadingKeys) {
    return <div className="ks-home"><PanelLoading minHeight={520} /></div>
  }

  if (dueKeys.length === 0 && workflows.length === 0) {
    return (
      <div className="ks-home">
        <div className="ks-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 520 }}>
          <div className="ks-empty">
            <span className="ks-empty__ico"><RotateCw size={26} strokeWidth={1.75} /></span>
            <div className="ks-empty__t">Nothing to rotate</div>
            <div className="ks-empty__s">
              When a tracked key crosses, or nears, its rotation window, it appears here with a guided,
              step-by-step walkthrough. Keystrok never rotates a key on its own; you run each step.
            </div>
            <a href="/inventory" className="ks-btn ks-btn--primary" style={{ marginTop: 18, textDecoration: 'none' }}>
              <KeyRound size={14} /> View tracked keys
            </a>
            <div className="ks-empty__hint">Rotations are advisory · operator-gated at every step</div>
          </div>
        </div>
      </div>
    )
  }

  const sel = detail
  const plat = platOf(sel?.discoveredKey?.platform ?? '')
  const sev = sel?.discoveredKey?.severity ?? 'medium'
  const steps = (sel?.steps ?? []).slice().sort((a, b) => a.stepNumber - b.stepNumber)
  const doneCount = steps.filter((s) => isDoneStep(s.status)).length
  const curStep = sel?.status === 'completed' ? steps.length : Math.min(doneCount + 1, steps.length)
  const started = hhmm(sel?.startedAt)
  const progressSub = sel?.status === 'completed'
    ? `rotation complete · was ${SEVL[sev] ?? sev}`
    : `step ${curStep} of ${steps.length}${started ? ` · started ${started}` : ''}`

  // No rotation to walk right now: single-pane, truthful empty state. Empty is
  // not the same as done, a key past its SLA gets a prompt, never a celebration.
  if (!sel) {
    const overdueDue = dueKeys.filter((k) => urgency(k).overdue)
    const top = overdueDue[0] ?? dueKeys[0]
    const restDue = dueKeys.filter((k) => k.id !== top?.id)
    return (
      <div className="ks-page--wide">
        <div className="ks-rot3">
          {startErr && <div className="ks-drawer__err" style={{ margin: '0 0 18px' }} role="alert">{startErr}</div>}

          {top ? (
            <div className={'ks-rot3__due' + (overdueDue.length ? '' : ' soon')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cap">
                  {overdueDue.length
                    ? `▲ Queue clear · ${overdueDue.length} key${overdueDue.length > 1 ? 's' : ''} past ${overdueDue.length > 1 ? 'their' : 'its'} SLA`
                    : `Queue clear · ${dueKeys.length} due soon`}
                </div>
                <div className="nm">{displayName(top.name)}</div>
                <div className="meta">
                  {platOf(top.platform).label} · {SEVL[top.severity] ?? top.severity}
                  {top.live_status === 'live' ? ' · live' : ''} · {urgency(top).txt}
                </div>
              </div>
              <button className="ks-rot3__btn" disabled={start.isPending} onClick={() => start.mutate(top.id)}>
                <RotateCw size={13} /> {start.isPending && start.variables === top.id ? 'Starting…' : 'Start rotation'}
              </button>
            </div>
          ) : (
            <div className="ks-rot3__hero">
              <div className="ico"><Check size={22} /></div>
              <h3>All caught up</h3>
              <p>No open rotations, and every tracked key is inside its window. Finished rotations stay on the record, on their key and in Activity.</p>
              <a href="/inventory" className="ks-rot3__btn ks-rot3__btn--ghost" style={{ textDecoration: 'none' }}>
                <RotateCw size={13} /> Start a rotation
              </a>
            </div>
          )}

          {restDue.length > 0 && (
            <div className="ks-comptbl" style={{ marginTop: 16 }}>
              <div className="ks-comptbl__cap">Also due · {restDue.length}</div>
              {restDue.map((k) => (
                <div key={k.id} className="ks-comptbl__row">
                  <Mark>{platOf(k.platform).code}</Mark>
                  <span className="nm">{displayName(k.name)}</span>
                  <span className="meta">{urgency(k).txt}</span>
                  <button className="ks-btn ks-btn--sm" style={{ marginLeft: 12 }} disabled={start.isPending} onClick={() => start.mutate(k.id)}>
                    <RotateCw size={12} /> Start
                  </button>
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="ks-comptbl" style={{ marginTop: 16 }}>
              <div className="ks-comptbl__cap">Completed · {done.length}<a className="lnk" href="/activity">full history →</a></div>
              {done.map((w) => {
                const total = w.steps?.length ?? 0
                return (
                  <div key={w.id} className="ks-comptbl__row" style={{ cursor: 'pointer' }} onClick={() => setSelId(w.id)}>
                    <span className="ok"><Check size={14} /></span>
                    <span className="nm">{displayName(w.discoveredKey?.keyName ?? 'Rotation')}</span>
                    <span className="meta">{platOf(w.discoveredKey?.platform ?? '').label} · {total}/{total} steps</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ks-page--wide">
      <div className="ks-rot">
        <div className="ks-rot__queue">
          <div className="ks-rot__qhd">
            <div className="ks-h">
              <span className="ks-h__t">Rotation queue</span>
              <span className="ks-h__n">· {dueKeys.length + inProgress.length} open</span>
            </div>
          </div>
          <div className="ks-rot__qlist">
            {dueKeys.length > 0 && <div className="ks-rot__qsec">Due now · {dueKeys.length}</div>}
            {dueKeys.map((k) => (
              <div key={k.id} className="ks-qitem">
                <span className="ks-qitem__state ready" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ks-qitem__name">{displayName(k.name)}</div>
                  <div className="ks-qitem__meta">{platOf(k.platform).label} · {urgency(k).txt} · not started</div>
                </div>
                <button className="ks-btn ks-btn--sm" style={{ alignSelf: 'center' }} disabled={start.isPending} onClick={() => start.mutate(k.id)}>
                  <RotateCw size={12} /> {start.isPending && start.variables === k.id ? 'Starting…' : 'Start'}
                </button>
              </div>
            ))}

            {inProgress.length > 0 && <div className="ks-rot__qsec">In progress · {inProgress.length}</div>}
            {inProgress.map((w) => {
              const total = w.steps?.length ?? 0
              const doneN = w.steps?.filter((s) => isDoneStep(s.status)).length ?? 0
              return (
                <div key={w.id} className={'ks-qitem' + (activeId === w.id ? ' sel' : '')} onClick={() => setSelId(w.id)}>
                  <span className="ks-qitem__state active" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ks-qitem__name">{displayName(w.discoveredKey?.keyName ?? 'Rotation')}</div>
                    <div className="ks-qitem__meta">{platOf(w.discoveredKey?.platform ?? '').label} · {doneN}/{total} steps</div>
                  </div>
                </div>
              )
            })}

            {done.length > 0 && (
              <button type="button" className="ks-rot__qsec ks-rot__qsec--toggle" onClick={() => setDoneOpen((v) => !v)} aria-expanded={doneOpen}>
                {doneOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Completed · {done.length}
              </button>
            )}
            {doneOpen && done.map((w) => {
              const total = w.steps?.length ?? 0
              return (
                <div key={w.id} className={'ks-qitem' + (activeId === w.id ? ' sel' : '')} onClick={() => setSelId(w.id)}>
                  <span className="ks-qitem__state done" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ks-qitem__name">{displayName(w.discoveredKey?.keyName ?? 'Rotation')}</div>
                    <div className="ks-qitem__meta">{platOf(w.discoveredKey?.platform ?? '').label} · {total}/{total} steps</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="ks-rotmain">
          {startErr && <div className="ks-drawer__err" style={{ margin: '0 0 18px' }} role="alert">{startErr}</div>}
          {sel && (
            <>
              <div className="ks-rotmain__hd">
                <Mark>{plat.code}</Mark>
                <div style={{ flex: 1 }}>
                  <div className="ks-rotmain__name">{displayName(sel.discoveredKey?.keyName ?? 'Rotation')}</div>
                  <div className="ks-rotmain__sub">{progressSub}</div>
                </div>
                {sel.status === 'completed' ? (
                  <Pill tone="a"><Check size={12} /> Resolved</Pill>
                ) : (
                  <Pill tone={sev === 'critical' ? 'crit' : sev === 'high' ? 'high' : 'mut'}>
                    <Dot sev={sev as 'critical'} />{SEVL[sev] ?? sev}
                  </Pill>
                )}
              </div>

              {sel.status === 'completed' ? (
                <div style={{ marginTop: 22, padding: '20px 22px', background: 'var(--a-dim)', border: '1px solid var(--a-line)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <Check size={22} color="var(--a)" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--tx)' }}>Rotation complete</div>
                    <div style={{ fontSize: 12.5, color: 'var(--tx-mut)', marginTop: 6, lineHeight: 1.5 }}>
                      Every step passed: the replacement was issued, rolled out, the old key verified idle, then revoked. The exposure is closed.
                    </div>
                  </div>
                </div>
              ) : (
                <Stepper workflowId={sel.id} steps={steps} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RotationsScreen() {
  return (
    <Suspense fallback={null}>
      <RotationsInner />
    </Suspense>
  )
}
