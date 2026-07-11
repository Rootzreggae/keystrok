'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Dot } from '@/components/ks'
import { ago, cleanLocation } from '@/lib/keys-display'

interface RCheck { tone: 'ok' | 'warn' | 'crit'; title: string; detail: string }
interface RSite { path: string; line: number | null; foundAt: string }
interface RConsumer { id: string; name: string; readMode: string; owner: string | null; assertedBy: string; createdAt: string }
interface Radius {
  summary: string
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

// Readiness tones map onto the existing dot severities: warn reads as high.
const TONE_SEV = { ok: 'ok', warn: 'high', crit: 'critical' } as const

// Mirrors READ_MODES in lib/blast-radius (kept inline: this file is client-side).
const MODES = [
  ['env_boot', 'env at boot', 'needs restart'],
  ['env_run', 'env per run', 'picks up the new key'],
  ['secret_store', 'secret store', 'update the store'],
] as const
const MODE_LABEL: Record<string, string> = Object.fromEntries(MODES.map(([k, l, d]) => [k, `${l} · ${d}`]))

const initials = (name: string) =>
  name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')

function SiteRow({ s, tag, warnTag }: { s: RSite; tag: string; warnTag?: boolean }) {
  return (
    <div className="ks-br__row">
      <div className="ks-br__path">
        {cleanLocation(s.path)}
        {s.line != null && <span className="ks-br__ln">:{s.line}</span>}
      </div>
      <span className={'ks-br__tag' + (warnTag ? ' ks-br__tag--warn' : '')}>{tag}</span>
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
// consumer. The evidence stays visible while deciding, the typed confirm is
// the key name (enforced server-side too), and the break lands at the revoke
// step, not now. The escape hatch maps a consumer instead; it never cancels
// by acting.
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

// The blast radius of one key, inside the key drawer: readiness verdicts up
// top, then the ledgers (consumers, pipelines, sites, people). Everything
// shown is observed or labeled as a human assertion; the consumer state says
// "unknown" out loud when it is.
export function BlastRadius({ keyId }: { keyId: string }) {
  const qc = useQueryClient()
  const [asserting, setAsserting] = useState(false)
  const [accepting, setAccepting] = useState(false)
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

  if (isLoading) return <div className="ks-tl__loading">Mapping the radius…</div>
  if (!data) return <div className="ks-tl__loading">Radius unavailable.</div>

  const hasConsumers = data.consumers.length > 0 || data.usage != null

  return (
    <div className="ks-br">
      <p className="ks-br__sum">{data.summary}</p>

      <div className="ks-br__checks">
        {data.readiness.map((c, i) => (
          <div className="ks-br__check" key={i}>
            <Dot sev={TONE_SEV[c.tone]} />
            <div>
              <div className="ks-br__ct" style={c.tone === 'crit' ? { color: 'var(--crit)' } : undefined}>{c.title}</div>
              <div className="ks-br__cd">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* The hold state's two recovery verbs: map what's using it, or sign the cost. */}
      {data.consumer.tone === 'crit' && !accepting && !asserting && (
        <div style={{ display: 'flex', gap: 8, margin: '2px 0 4px' }}>
          <button className="ks-btn ks-btn--sm" onClick={() => setAsserting(true)}>Map a consumer…</button>
          <button className="ks-btn ks-btn--sm" onClick={() => setAccepting(true)}>Accept the break…</button>
        </div>
      )}
      {accepting && <AcceptBreak keyId={keyId} data={data} onDone={refresh} onAssertInstead={() => { setAccepting(false); setAsserting(true) }} />}
      {data.breakAccepted && (
        <div className="ks-br__row">
          <div className="ks-br__who" style={{ flex: 1 }}>
            <div className="ks-br__ct">Accepted break</div>
            <div className="ks-br__cd">
              by {data.breakAccepted.by ?? 'unknown'} · {ago(data.breakAccepted.at)} ago · logged to Activity · lands at the revoke step
            </div>
          </div>
          <span className="ks-br__tag ks-br__tag--warn">break accepted</span>
          <button className="ks-br__x" title="Withdraw the acceptance" onClick={withdrawBreak}><X size={12} /></button>
        </div>
      )}

      <div className="ks-br__l">
        <span>Consumed by{hasConsumers ? '' : ' · nothing mapped'}</span>
        {!asserting && <button className="ks-br__miss" onClick={() => setAsserting(true)}>Missing something?</button>}
      </div>
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
      {asserting && <AssertForm keyId={keyId} onDone={refresh} />}

      {data.pipelines.length > 0 && (
        <>
          <div className="ks-br__l">Deploy pipelines · from repo scan</div>
          {data.pipelines.map((s) => <SiteRow key={s.path} s={s} tag="pipeline" warnTag />)}
        </>
      )}

      <div className="ks-br__l">Exposed in · from scans{data.freshness.lastScanAt ? ` · ${ago(data.freshness.lastScanAt)} ago` : ''}</div>
      {data.sites.map((s) => <SiteRow key={s.path} s={s} tag="remove after rotate" warnTag />)}
      {data.sites.length === 0 && <div className="ks-br__cd">No sites outside the pipelines above.</div>}

      {data.people.length > 0 && (
        <>
          <div className="ks-br__l">People · from git history</div>
          {data.people.map((p) => (
            <div className="ks-br__row" key={p.name}>
              <span className="ks-br__av">{initials(p.name)}</span>
              <div className="ks-br__who">
                <div className="ks-br__ct">{p.name}</div>
                <div className="ks-br__cd">{p.role}</div>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="ks-br__foot">
        Radius mapped from scans, git history, platform liveness and your assertions, labeled as such · Keystrok never rotates or revokes on its own.
      </div>
    </div>
  )
}
