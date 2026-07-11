'use client'

import { useQuery } from '@tanstack/react-query'
import { Dot } from '@/components/ks'
import { ago, cleanLocation } from '@/lib/keys-display'

interface RCheck { tone: 'ok' | 'warn' | 'crit'; title: string; detail: string }
interface RSite { path: string; line: number | null; foundAt: string }
interface Radius {
  summary: string
  consumer: RCheck
  sites: RSite[]
  pipelines: RSite[]
  people: { name: string; role: string; lastCommitAt: string | null }[]
  readiness: RCheck[]
  freshness: { lastScanAt: string | null; liveCheckedAt: string | null }
}

// Readiness tones map onto the existing dot severities: warn reads as high.
const TONE_SEV = { ok: 'ok', warn: 'high', crit: 'critical' } as const

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

// The blast radius of one key, inside the key drawer: readiness verdicts up
// top, then the observed ledgers (sites, pipelines, people). Everything shown
// is observed; the consumer state says "unknown" out loud when it is.
export function BlastRadius({ keyId }: { keyId: string }) {
  const { data, isLoading } = useQuery<Radius>({
    queryKey: ['radius', keyId],
    queryFn: async () => {
      const r = await fetch(`/api/keys/${keyId}/radius`)
      if (!r.ok) throw new Error('radius')
      return r.json()
    },
  })

  if (isLoading) return <div className="ks-tl__loading">Mapping the radius…</div>
  if (!data) return <div className="ks-tl__loading">Radius unavailable.</div>

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
        Radius mapped from scans, git history and platform liveness · Keystrok never rotates or revokes on its own.
      </div>
    </div>
  )
}
