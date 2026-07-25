'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, KeyRound, Check, Minus, Clock, AlertTriangle } from 'lucide-react'
import { Dot } from '@/components/ks'
import { classifyPastedKey } from '@/lib/scanner/classify'
import { type ApiKey, SEVL, platOf, displayName, ago } from '@/lib/keys-display'

// The registered key as the server returns it (201 body). rotationDueAt is the
// server's receipt: display it verbatim, never recompute client-side.
export interface RegisteredKey {
  id: string
  keyName: string
  keyPreview: string
  platform: string
  severity: string
  status: string
  rotationDueAt: string
}

// Bullets read better than asterisks at mono sizes; display-only, what the
// server stores is the classifier's preview unchanged.
const dots = (preview: string) => preview.replace(/\*/g, '•')

// `NAME=value` pastes prefill the Name field from the env var.
const envNameOf = (raw: string) => raw.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]{2,})\s*=/)?.[1] ?? null

/**
 * Register-a-key drawer: the ledger's second door. Two steps, register →
 * confirm. Classification is client-side and live (zero network); the raw
 * value goes exactly one place, a single POST on the final confirm. All field
 * state clears when the drawer closes. Design: single-key-workflow handoff,
 * section C.
 */
export function RegisterKeyDrawer({ open, onClose, onRegistered, onViewKey }: {
  open: boolean
  onClose: () => void
  onRegistered: (key: RegisteredKey) => void
  onViewKey: (keyId: string) => void
}) {
  const qc = useQueryClient()
  const [step, setStep] = useState<1 | 2>(1)
  const [value, setValue] = useState('')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [platform, setPlatform] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dupId, setDupId] = useState<string | null>(null)
  const [retryIn, setRetryIn] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  const cls = useMemo(() => (value.trim() ? classifyPastedKey(value) : null), [value])
  const envName = useMemo(() => envNameOf(value), [value])
  const isEnvLine = envName !== null && cls !== null && cls.key !== value.trim()
  // Name resolution: explicit edit wins, then the env var name, then blank
  // (server defaults to "<platform> key (registered)").
  const effName = nameTouched ? name : (envName ?? '')
  const needsFields = cls !== null && !cls.recognized
  const canContinue = cls !== null && (cls.recognized || (effName.trim() !== '' && platform.trim() !== ''))

  // Everything clears when the drawer closes: the paste is secret material.
  useEffect(() => {
    if (open) return
    setStep(1); setValue(''); setName(''); setNameTouched(false); setPlatform('')
    setSubmitting(false); setDupId(null); setRetryIn(0); setErr(null)
  }, [open])

  // A different extracted secret is a different identity: a name typed for the
  // previous paste must not silently attach to the new one.
  useEffect(() => {
    setName('')
    setNameTouched(false)
  }, [cls?.key])

  // Close on Escape, like the key drawer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // 429 countdown; the button re-enables itself at zero.
  useEffect(() => {
    if (retryIn <= 0) return
    const t = setInterval(() => setRetryIn((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [retryIn > 0])

  if (!open) return null

  const submit = async () => {
    if (!cls || submitting || retryIn > 0) return
    setSubmitting(true)
    setErr(null)
    try {
      const res = await fetch('/api/keys/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value,
          name: effName.trim() || undefined,
          platform: cls.recognized ? undefined : platform.trim(),
        }),
      })
      const json = await res.json().catch(() => null)
      if (res.status === 201 && json?.key) {
        await qc.invalidateQueries({ queryKey: ['keys'] })
        onRegistered(json.key as RegisteredKey)
        return
      }
      if (res.status === 409) { setDupId(json?.existingKeyId ?? null); return }
      if (res.status === 429) {
        setRetryIn(Math.max(1, parseInt(res.headers.get('Retry-After') ?? '60', 10) || 60))
        return
      }
      setErr(json?.error || 'Registration failed. Nothing was stored.')
    } catch {
      setErr('Registration failed. Nothing was stored.')
    } finally {
      setSubmitting(false)
    }
  }

  // The existing key a duplicate points at, from the page's cached list (the
  // 409 body carries only the id).
  const dupKey = dupId ? (qc.getQueryData<ApiKey[]>(['keys']) ?? []).find((x) => x.id === dupId) : undefined

  const steps = (
    <div className="ks-reg__steps">
      <span className={'seg' + (step === 1 ? ' on' : ' done')}>{step > 1 ? '✓ ' : ''}register</span>
      <span className="bar" />
      <span className={'seg' + (step === 2 ? ' on' : '')}>confirm</span>
    </div>
  )
  const closeBtn = <button className="ks-drawer__close" onClick={onClose} aria-label="Close"><X size={18} /></button>

  const detect = cls === null ? (
    value.trim() !== '' && (
      <div className="ks-reg__detect">
        <div className="ks-reg__detect-hd">too short to classify</div>
        <div className="ks-reg__row"><span className="k">so far</span><span className="v">{value.trim().length} character{value.trim().length === 1 ? '' : 's'} — keys are 8 or more. Keep pasting, or check the clipboard grabbed the whole value.</span></div>
      </div>
    )
  ) : cls.recognized ? (
    <div className="ks-reg__detect">
      <div className="ks-reg__detect-hd">recognized · <b>{cls.patternName}</b><span className="r">confidence {cls.confidence >= 0.9 ? 'high' : cls.confidence >= 0.7 ? 'medium' : 'low'}</span></div>
      {isEnvLine && <div className="ks-reg__row"><span className="k">you pasted</span><span className="v">an env line — the key itself was extracted</span></div>}
      <div className="ks-reg__row"><span className="k">will register</span><span className="v"><b>{dots(cls.preview)}</b> — check this is the key you meant</span></div>
      <div className="ks-reg__row"><span className="k">platform</span><span className="v">{cls.platform} · inferred from the key format</span></div>
      <div className="ks-reg__row"><span className="k">severity</span><span className="v">{cls.severity} · rotation window set at registration</span></div>
    </div>
  ) : (
    <div className="ks-reg__detect">
      <div className="ks-reg__detect-hd">no match · <b>generic secret</b></div>
      <div className="ks-reg__row"><span className="k">will register</span><span className="v"><b>{dots(cls.preview)}</b> — check this is the key you meant</span></div>
      <div className="ks-reg__row"><span className="k">severity</span><span className="v">high — unrecognized keys get the cautious default</span></div>
    </div>
  )

  /* ── step 1 · register ── */
  if (step === 1) {
    return (
      <>
        <div className="ks-drawer-scrim" onClick={onClose} />
        <aside className="ks-reg">
          <div className="ks-reg__hd">
            {closeBtn}
            {steps}
            <div className="ks-reg__title">Register a key</div>
            <div className="ks-reg__sub">Classified as you paste — nothing is sent until you confirm.</div>
          </div>
          <div className="ks-reg__body">
            <div>
              <div className="ks-reg__lbl">Key value <span className="opt">treated like a password — never cached, never in the URL</span></div>
              <textarea
                className="ks-reg__paste"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Paste the key or the whole env line — either works."
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            {detect}
            {cls === null && value.trim() !== '' && (
              <div className="ks-reg__hint">Nothing registers below 8 characters — Continue stays off rather than tracking a fragment.</div>
            )}
            {cls !== null && cls.recognized && (
              <div>
                <div className="ks-reg__lbl">Name <span className="opt">optional</span></div>
                <input className="ks-reg__input" value={effName} onChange={(e) => { setName(e.target.value); setNameTouched(true) }} autoComplete="off" />
                <div className="ks-reg__hint">{isEnvLine ? 'Prefilled from the env line. ' : ''}Left blank, it registers as <b>&quot;{cls.platform} key (registered)&quot;</b>.</div>
              </div>
            )}
            {needsFields && (
              <>
                <div className="ks-reg__row2">
                  <div>
                    <div className="ks-reg__lbl">Name <span className="req">required</span></div>
                    <input className="ks-reg__input" value={effName} onChange={(e) => { setName(e.target.value); setNameTouched(true) }} autoComplete="off" />
                  </div>
                  <div>
                    <div className="ks-reg__lbl">Platform <span className="req">required</span></div>
                    <input className="ks-reg__input" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. Acme Partners" autoComplete="off" />
                  </div>
                </div>
                <div className="ks-reg__hint" style={{ marginTop: -6 }}>With no prefix to go on, Keystrok can&apos;t name the platform — these two fields are what rotation day will lean on.</div>
              </>
            )}
          </div>
          <div className="ks-reg__foot">
            <span className="note">{needsFields ? <>unrecognized keys register as<br />generic secrets · severity high</> : <>classified locally · no network ·<br />field clears when this closes</>}</span>
            <span className="sp" />
            <button className="ks-reg__back" onClick={onClose}>Cancel</button>
            <button
              className="ks-btn ks-btn--primary"
              style={canContinue ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
              onClick={() => canContinue && setStep(2)}
            >
              Continue
            </button>
          </div>
        </aside>
      </>
    )
  }

  /* ── step 2 · 409 duplicate: a pointer, not a dead end ── */
  if (dupId) {
    return (
      <>
        <div className="ks-drawer-scrim" onClick={onClose} />
        <aside className="ks-reg">
          <div className="ks-reg__hd">
            {closeBtn}
            {steps}
            <div className="ks-reg__title">Already tracked</div>
            <div className="ks-reg__sub">This exact value is registered — nothing was created.</div>
          </div>
          <div className="ks-reg__body">
            <div className="ks-reg__dupkey">
              <Dot sev={(dupKey?.severity ?? 'high') as 'high'} />
              <div>
                <div className="nm">{dupKey ? displayName(dupKey.name) : 'Registered key'}{dupKey?.key_preview && <span className="mask">{dots(dupKey.key_preview)}</span>}</div>
                <div className="meta">
                  {dupKey
                    ? `${platOf(dupKey.platform).label} · ${SEVL[dupKey.severity] ?? dupKey.severity} · registered ${ago(dupKey.created_at) === 'now' ? 'just now' : `${ago(dupKey.created_at)} ago`}`
                    : 'Open it to see its rotation window and provenance.'}
                </div>
              </div>
              <span className="sp" />
              <span className="ks-prov">manual · you</span>
            </div>
            <div className="ks-reg__prose">If you meant to replace it — rotated at the vendor, say — delete the old record from its drawer and register the new value; the value itself is never editable in place.</div>
          </div>
          <div className="ks-reg__foot">
            <span className="note">registering twice never duplicates</span>
            <span className="sp" />
            <button className="ks-reg__back" onClick={onClose}>Cancel</button>
            <button className="ks-btn ks-btn--primary" onClick={() => { if (dupId) onViewKey(dupId) }}>View key</button>
          </div>
        </aside>
      </>
    )
  }

  /* ── step 2 · confirm: exactly what will persist ── */
  const persistName = effName.trim() || `${cls?.recognized ? cls.platform : platform.trim()} key (registered)`
  const persistPlatform = cls?.recognized ? cls.platform : platform.trim()
  return (
    <>
      <div className="ks-drawer-scrim" onClick={onClose} />
      <aside className="ks-reg">
        <div className="ks-reg__hd">
          {closeBtn}
          {steps}
          <div className="ks-reg__title">Confirm registration</div>
        </div>
        <div className="ks-reg__body">
          {retryIn > 0 && (
            <div className="ks-reg__banner">
              <span className="ic"><Clock size={14} /></span>
              <span><b>Registering too fast — try again in {retryIn}s.</b><div className="sub">Your paste is still here; nothing was sent. The button re-enables itself.</div></span>
            </div>
          )}
          {err && (
            <div className="ks-reg__banner ks-reg__banner--err">
              <span className="ic"><AlertTriangle size={14} /></span>
              <span>{err}</span>
            </div>
          )}
          <div className="ks-reg__receipt">
            <div className="ks-reg__receipt-hd">what will persist<span className="r">and nothing else</span></div>
            <div className="ks-reg__row"><span className="k">name</span><span className="v">{persistName}</span></div>
            <div className="ks-reg__row"><span className="k">preview</span><span className="v">{cls ? dots(cls.preview) : ''}</span></div>
            <div className="ks-reg__row"><span className="k">platform</span><span className="v">{persistPlatform}</span></div>
            <div className="ks-reg__row"><span className="k">severity</span><span className="v"><Dot sev={(cls?.severity ?? 'high') as 'high'} /> {cls?.severity} · due date set by the server at registration</span></div>
          </div>
          <div className="ks-reg__receipt">
            <div className="ks-reg__receipt-hd">tracked since birth</div>
            <div className="ks-reg__rc"><span className="ic"><Check size={14} /></span><span><b>Registered, not discovered.</b> This key was never seen in a scan — its record starts clean, on your terms, with a rotation clock from day one.</span></div>
            <div className="ks-reg__rc"><span className="ic"><Check size={14} /></span><span><b>Same ledger, same clock.</b> It lands in Keys beside scanned keys, held to the window its severity sets.</span></div>
            <div className="ks-reg__rc"><span className="ic no"><Minus size={14} /></span><span><b>No editing the value.</b> Mis-pasted? Delete the record and register again — the preview above is your check.</span></div>
          </div>
        </div>
        <div className="ks-reg__foot">
          <span className="note">{retryIn > 0 ? 'limit: 10 registrations per minute' : <>the value is sent once, to register —<br />what&apos;s stored is this card, nothing more</>}</span>
          <span className="sp" />
          <button className="ks-reg__back" onClick={() => { setErr(null); setStep(1) }}>← Back</button>
          <button
            className="ks-btn ks-btn--primary"
            style={submitting || retryIn > 0 ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
            onClick={submit}
            disabled={submitting || retryIn > 0}
          >
            <KeyRound size={13} /> {submitting ? 'Registering…' : 'Register key'}
          </button>
        </div>
      </aside>
    </>
  )
}
