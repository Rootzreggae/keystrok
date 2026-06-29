'use client'

import { Suspense, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Check, Lock, RotateCw, ShieldAlert, KeyRound } from 'lucide-react'
import { Mark, Dot, Pill } from '@/components/ks'
import { platOf, SEVL, displayName } from '@/lib/keys-display'

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

const isRunning = (s: string) => s === 'in_progress' || s === 'running' || s === 'active'
const hhmm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')
const isDoneStep = (s: string) => s === 'completed' || s === 'skipped'
const isRevoke = (s: WfStep) => s.stepType === 'revoke' || /revoke|revok/i.test(s.name)
const queueState = (w: Workflow) => (w.status === 'completed' ? 'done' : isRunning(w.status) ? 'active' : 'ready')
const STATE_LABEL: Record<string, string> = { active: 'Running', ready: 'Recommended', done: 'Completed' }

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

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: async () => {
      const r = await fetch('/api/workflows')
      if (!r.ok) throw new Error('workflows')
      const j = await r.json()
      return j.data?.workflows ?? j.workflows ?? []
    },
  })

  const open = workflows.filter((w) => w.status !== 'completed')
  const activeId = selId ?? focus ?? open[0]?.id ?? workflows[0]?.id ?? null

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

  if (workflows.length === 0) {
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
  const progressSub = `step ${curStep} of ${steps.length}${started ? ` · started ${started}` : ''}`

  return (
    <div className="ks-page--wide">
      <div className="ks-rot">
        <div className="ks-rot__queue">
          <div className="ks-rot__qhd">
            <div className="ks-h">
              <span className="ks-h__t">Rotation queue</span>
              <span className="ks-h__n">· {open.length} open</span>
            </div>
          </div>
          <div className="ks-rot__qlist">
            {workflows.map((w) => {
              const st = queueState(w)
              const total = w.steps?.length ?? 0
              const done = w.steps?.filter((s) => isDoneStep(s.status)).length ?? 0
              return (
                <div key={w.id} className={'ks-qitem' + (activeId === w.id ? ' sel' : '')} onClick={() => setSelId(w.id)}>
                  <span className={'ks-qitem__state ' + st} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ks-qitem__name">{displayName(w.discoveredKey?.keyName ?? 'Rotation')}</div>
                    <div className="ks-qitem__meta">{platOf(w.discoveredKey?.platform ?? '').label} · {STATE_LABEL[st]}</div>
                    <div className="ks-qitem__meta">{done}/{total} steps</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="ks-rotmain">
          {sel && (
            <>
              <div className="ks-rotmain__hd">
                <Mark>{plat.code}</Mark>
                <div style={{ flex: 1 }}>
                  <div className="ks-rotmain__name">{displayName(sel.discoveredKey?.keyName ?? 'Rotation')}</div>
                  <div className="ks-rotmain__sub">{progressSub}</div>
                </div>
                <Pill tone={sev === 'critical' ? 'crit' : sev === 'high' ? 'high' : 'mut'}>
                  <Dot sev={sev as 'critical'} />{SEVL[sev] ?? sev}
                </Pill>
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
