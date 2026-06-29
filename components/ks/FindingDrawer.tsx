'use client'

import { useEffect } from 'react'
import { X, Check, ArrowRight } from 'lucide-react'
import { Pill, Dot } from '@/components/ks'
import { slaDays } from '@/lib/rotation-policy'
import { platOf, SEVL, ago } from '@/lib/keys-display'

export interface Finding {
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
  isEnvFile?: boolean
}

const sevTone = (s: string) => (s === 'critical' ? 'crit' : s === 'high' ? 'high' : 'mut')

// Detail panel for a single finding: opens from a Discovery row. Reuses the
// .ks-drawer chrome (shared with the key drawer).
export function FindingDrawer({
  finding, onClose, onPromote, onDismiss, busy,
}: {
  finding: Finding | null
  onClose: () => void
  onPromote: (id: string) => void
  onDismiss: (id: string) => void
  busy?: boolean
}) {
  useEffect(() => {
    if (!finding) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finding, onClose])

  if (!finding) return null

  const f = finding
  const name = f.patternName || f.keyType
  const sla = slaDays(f.severity)
  const plat = platOf(f.platform || f.keyType)
  const where = `${f.filePath}${f.lineNumber ? `:${f.lineNumber}` : ''}`

  // Honest, data-derived rationale, no fabricated blast-radius prose.
  const why = `${name} detected${f.isEnvFile ? ' in a tracked environment file' : ` in ${f.fileName || f.filePath.split('/').pop()}`}. `
    + `Graded ${SEVL[f.severity] ?? f.severity} severity, so Keystrok recommends rotating it within ${sla} days of when it was found.`

  return (
    <>
      <div className="ks-drawer-scrim" onClick={onClose} />
      <aside className="ks-drawer">
        <div className="ks-drawer__hd">
          <button className="ks-drawer__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
          <div className="ks-drawer__name">{name}</div>
          <div className="ks-drawer__tags">
            <Pill tone={sevTone(f.severity)}><Dot sev={f.severity as 'critical'} />{SEVL[f.severity] ?? f.severity}</Pill>
            <Pill>{plat.label}</Pill>
            {f.createdAt && <Pill>found {ago(f.createdAt)} ago</Pill>}
          </div>
        </div>

        <div className="ks-drawer__body">
          <div className="ks-dsect">
            <div className="ks-dsect__l">Why this matters</div>
            <div style={{ fontSize: 12.5, color: 'var(--tx-mut)', lineHeight: 1.6 }}>{why}</div>
          </div>

          <div className="ks-dsect">
            <div className="ks-dsect__l">Where it was found</div>
            <div className="ks-code">
              <span className="ln">{f.lineNumber ?? 1}</span><span className="hit">{f.keyPreview ?? '••••'}</span>
            </div>
            <div className="ks-kv" style={{ marginTop: 12 }}><span className="k">file</span><span className="v">{where}</span></div>
            <div className="ks-kv"><span className="k">type</span><span className="v">{f.keyType}</span></div>
            {f.createdAt && <div className="ks-kv"><span className="k">found</span><span className="v">{ago(f.createdAt)} ago</span></div>}
          </div>

          <div className="ks-dsect">
            <div className="ks-dsect__l">If you promote</div>
            <div className="ks-drawer__promote">
              <ArrowRight size={14} style={{ flex: 'none', marginTop: 1, color: 'var(--a)' }} />
              <span>
                Adds <b>{name}</b> to the Keys ledger and starts its {sla}-day rotation clock from today.
                It does <b>not</b> rotate or revoke anything. Keystrok never does that on its own.
              </span>
            </div>
          </div>
        </div>

        <div className="ks-drawer__foot">
          <button className="ks-btn ks-btn--primary" style={{ flex: 1, justifyContent: 'center' }} disabled={busy} onClick={() => onPromote(f.id)}>
            <Check size={14} /> Promote to ledger
          </button>
          <button className="ks-btn" disabled={busy} onClick={() => onDismiss(f.id)}>
            <X size={14} /> Dismiss
          </button>
        </div>
      </aside>
    </>
  )
}
