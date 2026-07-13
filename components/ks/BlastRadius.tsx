'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Dot } from '@/components/ks'
import { ago, cleanLocation } from '@/lib/keys-display'

interface RCheck { tone: 'ok' | 'warn' | 'crit'; title: string; detail: string }
interface RSite { path: string; filePath: string | null; line: number | null; foundAt: string }
interface RConsumer { id: string; name: string; readMode: string; owner: string | null; assertedBy: string; createdAt: string }
interface Radius {
  sentence: { lead: string; rest: string }
  consumer: RCheck
  consumers: RConsumer[]
  usage: { lastUsedAt: string; source: string | null; live: boolean } | null
  breakAccepted: { at: string; by: string | null; lastUsedAtSnapshot: string | null } | null
  confirmName: string
  liveStatus: string | null
  sites: RSite[]
  pipelines: RSite[]
  people: { name: string; role: string; lastCommitAt: string | null }[]
  readiness: RCheck[]
  freshness: { lastScanAt: string | null; liveCheckedAt: string | null }
}

// Mirrors READ_MODES in lib/blast-radius (kept inline: this file is client-side).
const MODES = [
  ['env_boot', 'env at boot', 'needs restart'],
  ['env_run', 'env per run', 'picks up the new key'],
  ['secret_store', 'secret store', 'update the store'],
] as const
const MODE_LABEL: Record<string, string> = Object.fromEntries(MODES.map(([k, l, d]) => [k, `${l} · ${d}`]))

function SiteRow({ s }: { s: RSite }) {
  return (
    <div className="ks-br__row">
      <div className="ks-br__path">
        {cleanLocation(s.path)}
        {s.line != null && <span className="ks-br__ln">:{s.line}</span>}
      </div>
    </div>
  )
}

// The "Missing something?" flow: assert a consumer the map missed. Lands
// immediately, labeled user-asserted, logged to Activity as the assertion.
function AssertForm({ keyId, onDone }: { keyId: string; onDone: () => void }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<string>('env_boot')
  const [owner, setOwner] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/keys/${keyId}/consumers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, readMode: mode, owner: owner || undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Could not add (${res.status})`)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add')
      setSaving(false)
    }
  }

  return (
    <div className="ks-br__form">
      <input
        className="ks-input" placeholder="Consumer name (e.g. legacy-etl-runner)" value={name} autoFocus
        onChange={(e) => setName(e.target.value)}
      />
      <div className="ks-br__segs">
        {MODES.map(([k, l]) => (
          <button key={k} className={'ks-br__seg' + (mode === k ? ' on' : '')} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      <input className="ks-input" placeholder="Owner (optional)" value={owner} onChange={(e) => setOwner(e.target.value)} />
      {err && <div style={{ color: 'var(--crit)', fontSize: 11 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="ks-btn ks-btn--primary ks-btn--sm" disabled={saving || !name.trim()} onClick={submit}>
          {saving ? 'Adding…' : 'Add to map'}
        </button>
        <button className="ks-btn ks-btn--sm" disabled={saving} onClick={onDone}>Cancel</button>
      </div>
      <div className="ks-br__cd">Added immediately · logged to Activity as your assertion · stays labeled until observed.</div>
    </div>
  )
}

// Accept-the-break: the operator signs the cost of rotating past an unknown
// consumer. Evidence stays visible while deciding; the typed confirm is the
// key name (enforced server-side); the break lands at the revoke step, not now.
function AcceptBreak({ keyId, data, onDone, onAssertInstead }: {
  keyId: string
  data: Radius
  onDone: () => void
  onAssertInstead: () => void
}) {
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/keys/${keyId}/accept-break`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || `Could not accept (${res.status})`)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not accept')
      setSaving(false)
    }
  }

  return (
    <div className="ks-br__form ks-br__form--crit">
      <div className="ks-br__ct" style={{ color: 'var(--crit)' }}>Accept the break · what you&apos;re agreeing to</div>
      <div className="ks-br__grid">
        <div><span className="k">liveness</span><span className="v">{data.liveStatus ?? 'unknown'}</span></div>
        <div><span className="k">last used</span><span className="v">{data.usage ? `${ago(data.usage.lastUsedAt)} ago` : 'never observed'}</span></div>
        <div><span className="k">from</span><span className="v">{data.usage?.source ?? 'unknown'}</span></div>
        <div><span className="k">consumers known</span><span className="v">0</span></div>
      </div>
      <div className="ks-br__cd">
        Whatever is using this key loses access when the old key is revoked · runbook revoke step, not now. If it&apos;s an attacker, breaking it is the point. The gate re-asks if traffic changes before then.
      </div>
      <input className="ks-input" placeholder={`Type ${data.confirmName} to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {err && <div style={{ color: 'var(--crit)', fontSize: 11 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="ks-btn ks-btn--sm ks-btn--crit" disabled={saving || confirm.trim() !== data.confirmName} onClick={submit}>
          {saving ? 'Accepting…' : 'Accept & continue'}
        </button>
        <button className="ks-btn ks-btn--sm" disabled={saving} onClick={onDone}>Cancel</button>
        <button className="ks-br__miss" style={{ marginLeft: 'auto' }} disabled={saving} onClick={onAssertInstead}>Map a consumer instead</button>
      </div>
    </div>
  )
}

// Two drawer sections for one key: EXPOSED IN (the evidence: masked code line,
// paths, cleanup instruction) and BLAST RADIUS (one composed sentence; the full
// ledgers and the hold verbs live behind "view full radius", except in the hold
// state, which auto-expands because accept-the-break must never hide).
export function BlastRadius({ keyId, keyPreview }: { keyId: string; keyPreview?: string }) {
  const qc = useQueryClient()
  const [asserting, setAsserting] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const { data, isLoading } = useQuery<Radius>({
    queryKey: ['radius', keyId],
    queryFn: async () => {
      const r = await fetch(`/api/keys/${keyId}/radius`)
      if (!r.ok) throw new Error('radius')
      return r.json()
    },
  })

  const refresh = () => {
    setAsserting(false)
    setAccepting(false)
    qc.invalidateQueries({ queryKey: ['radius', keyId] })
  }

  const removeConsumer = async (cid: string) => {
    await fetch(`/api/keys/${keyId}/consumers?consumerId=${cid}`, { method: 'DELETE' })
    refresh()
  }

  const withdrawBreak = async () => {
    await fetch(`/api/keys/${keyId}/accept-break`, { method: 'DELETE' })
    refresh()
  }

  if (isLoading) return <div className="ks-dsect"><div className="ks-tl__loading">Mapping the radius…</div></div>
  if (!data) return <div className="ks-dsect"><div className="ks-tl__loading">Radius unavailable.</div></div>

  const primary = data.sites[0] ?? data.pipelines[0] ?? null
  const rest = [...data.sites.slice(primary && data.sites.length ? 1 : 0), ...data.pipelines.filter((p) => p !== primary)]
  const hold = data.consumer.tone === 'crit'
  const open = expanded || hold || asserting || accepting

  return (
    <>
      <div className="ks-dsect">
        <div className="ks-dsect__lrow">
          <span className="ks-dsect__l" style={{ margin: 0 }}>Exposed in</span>
          {primary?.filePath && (
            <a className="ks-br__miss" href={`vscode://file${primary.filePath}${primary.line != null ? `:${primary.line}` : ''}`}>open file</a>
          )}
        </div>
        {primary && (
          <>
            <div className="ks-code" style={{ marginTop: 12 }}>
              {primary.line != null && <span className="ln">{primary.line}</span>}
              const KEY = <span className="hit">&quot;{keyPreview ?? '••••'}&quot;</span>
            </div>
            <div className="ks-br__meta">
              <b>{cleanLocation(primary.path)}</b>
              {data.freshness.lastScanAt ? ` · scanned ${ago(data.freshness.lastScanAt)} ago` : ''} · remove this line after rotating
            </div>
          </>
        )}
        {rest.map((s) => <SiteRow key={s.path} s={s} />)}
      </div>

      <div className="ks-dsect">
        <div className="ks-dsect__lrow">
          <span className="ks-dsect__l" style={{ margin: 0 }}>Blast radius</span>
          {!hold && (
            <button className="ks-br__miss" onClick={() => setExpanded((v) => !v)}>
              {open ? 'hide full radius' : 'view full radius'}
            </button>
          )}
        </div>
        <p className="ks-br__sentence">
          <b>{data.sentence.lead}</b>{data.sentence.rest}{' '}
          {!asserting && <button className="ks-br__miss" onClick={() => { setAsserting(true) }}>Know a consumer we missed?</button>}
        </p>

        {hold && (
          <div className="ks-br__check" style={{ margin: '10px 0' }}>
            <Dot sev="critical" />
            <div>
              <div className="ks-br__ct" style={{ color: 'var(--crit)' }}>{data.consumer.title}</div>
              <div className="ks-br__cd">{data.consumer.detail}</div>
            </div>
          </div>
        )}
        {hold && !accepting && !asserting && (
          <div style={{ display: 'flex', gap: 8, margin: '2px 0 8px' }}>
            <button className="ks-btn ks-btn--sm" onClick={() => setAsserting(true)}>Map a consumer…</button>
            <button className="ks-btn ks-btn--sm" onClick={() => setAccepting(true)}>Accept the break…</button>
          </div>
        )}
        {accepting && <AcceptBreak keyId={keyId} data={data} onDone={refresh} onAssertInstead={() => { setAccepting(false); setAsserting(true) }} />}
        {asserting && <AssertForm keyId={keyId} onDone={refresh} />}

        {data.breakAccepted && (
          <div className="ks-br__row" style={{ marginTop: 8 }}>
            <div className="ks-br__who" style={{ flex: 1 }}>
              <div className="ks-br__ct">Accepted break</div>
              <div className="ks-br__cd">
                by {data.breakAccepted.by ?? 'unknown'} · {ago(data.breakAccepted.at)} ago · lands at the revoke step
              </div>
            </div>
            <span className="ks-br__tag ks-br__tag--warn">break accepted</span>
            <button className="ks-br__x" title="Withdraw the acceptance" onClick={withdrawBreak}><X size={12} /></button>
          </div>
        )}

        {open && (
          <div style={{ marginTop: 10 }}>
            {(data.usage || data.consumers.length > 0) && <div className="ks-br__l">Consumed by</div>}
            {data.usage && (
              <div className="ks-br__row">
                <div className="ks-br__path">
                  platform usage · last used {ago(data.usage.lastUsedAt)} ago{data.usage.source ? ` · ${data.usage.source}` : ''}
                </div>
                <span className="ks-br__tag">observed</span>
              </div>
            )}
            {data.consumers.map((c) => (
              <div className="ks-br__row" key={c.id}>
                <div className="ks-br__who" style={{ flex: 1 }}>
                  <div className="ks-br__ct">{c.name}</div>
                  <div className="ks-br__cd">{MODE_LABEL[c.readMode] ?? c.readMode}{c.owner ? ` · owner: ${c.owner}` : ''}</div>
                </div>
                <span className="ks-br__tag ks-br__tag--warn">user-asserted</span>
                <button className="ks-br__x" title="Remove this assertion" onClick={() => removeConsumer(c.id)}><X size={12} /></button>
              </div>
            ))}
            {data.people.length > 0 && (
              <>
                <div className="ks-br__l">People · from git history</div>
                {data.people.map((p) => (
                  <div className="ks-br__row" key={p.name}>
                    <div className="ks-br__who">
                      <div className="ks-br__ct">{p.name}</div>
                      <div className="ks-br__cd">{p.role}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
