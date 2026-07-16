'use client'

import React from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'

const REPO_URL = 'https://github.com/Rootzreggae/keystrok'

/**
 * Keystrok landing: "schematic instrument" direction, ported from the design
 * handoff (design/reference/landing-schematic). Markup, class names, and
 * data-* hooks match the design's CSS (schematic.css/-bp.css) and motion
 * (motion.ts) exactly; the COPY is rewritten to describe the real product
 * (self-hostable, MIT, encrypted at rest) rather than the
 * handoff's placeholder open-source-CLI text.
 *
 * Variant-aware: renders a tailored layout per breakpoint (lg/md/sm).
 */

type Variant = 'lg' | 'md' | 'sm'

function Ticks() {
  return (
    <>
      <span className="tick tl" /><span className="tick tr" />
      <span className="tick bl" /><span className="tick br" />
    </>
  )
}

function RunBtn() {
  return (
    <button className="sch-run" type="button" data-run="true" title="Replay sequence">
      <Icon name="chevrons-right" size={12} /> RUN
    </button>
  )
}

// Brand mark: cursor-bit cut, trailing the wordmark per brand rules.
function SchMark({ size = 15, color = 'var(--a)', style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  const mid = React.useId().replace(/:/g, '')
  return (
    <svg width={Math.round(size * 0.7)} height={size} viewBox="20 8 56 80" style={style} aria-hidden="true">
      <mask id={mid}>
        <rect x="20" y="8" width="56" height="80" fill="#fff" />
        <circle cx="48" cy="35" r="9" fill="#000" />
        <rect x="34" y="58" width="8" height="26" fill="#000" />
        <rect x="50" y="68" width="13" height="16" fill="#000" />
      </mask>
      <rect x="26" y="14" width="44" height="68" rx="4" fill={color} mask={`url(#${mid})`} />
    </svg>
  )
}

function SchBrand() {
  return (
    <span className="cell" style={{ gap: 8, textTransform: 'none' }}>
      <SchMark size={20} />
      <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.03em' }}>
        keystrok<span style={{ color: 'var(--a)' }}>_</span>
      </span>
    </span>
  )
}

function SchBar({ v, authed }: { v: Variant; authed?: boolean }) {
  const docs = <span className="cell end"><Link href="/docs">Docs</Link></span>
  const entry = authed
    ? <span className="cell end"><Icon name="arrow-right" size={14} /> <a href="/dashboard">Dashboard</a></span>
    : <span className="cell end"><Icon name="arrow-right" size={14} /> <a href="/auth/signin">Sign in</a></span>
  if (v === 'sm') {
    return (
      <header className="sch-bar sch-bar--sm" data-screen-label="C header bar">
        <div className="wrap">
          <SchBrand />
          <span className="cell fill" />
          {docs}
          {entry}
        </div>
      </header>
    )
  }
  return (
    <header className="sch-bar" data-screen-label="C header bar">
      <div className="wrap">
        <SchBrand />
        <span className="cell">Key lifecycle instrument</span>
        <span className="cell fill" />
        {docs}
        {entry}
      </div>
    </header>
  )
}

function SchHero() {
  return (
    <section className="sch-hero" data-screen-label="C hero">
      <div className="wrap">
        <h1 data-hero-h1="true">The key lifecycle, <span className="hero-ink" data-hero-outline="true">instrumented.</span></h1>
        <div className="row">
          <p className="sub">
            Find exposed API keys, see which are still <strong>live</strong>, and rotate them safely.
            Self-host it on your own database.
          </p>
          <div className="actions">
            <a className="btn primary" href={REPO_URL}><Icon name="github" size={15} /> Self-host it</a>
            <a className="btn" href="#fig-01">How it works</a>
          </div>
        </div>
      </div>
    </section>
  )
}

interface PipeStage {
  label: string
  id: string
  icon: string
  name: string
  desc: string
  fk: string
  fv: string
}

const PIPE_STAGES: PipeStage[] = [
  { label: 'STAGE 1', id: 'SCAN-01', icon: 'search', name: 'Scan', desc: 'Exposed and forgotten keys, across code and platforms.', fk: 'mode', fv: 'read-only' },
  { label: 'STAGE 2', id: 'INV-02', icon: 'layers', name: 'Inventory', desc: 'One ledger: platform, real risk, exposure.', fk: 'at rest', fv: 'encrypted' },
  { label: 'STAGE 3', id: 'VAL-03', icon: 'activity', name: 'Validate', desc: 'Which leaked keys are still live, right now.', fk: 'signal', fv: 'live / revoked' },
  { label: 'STAGE 4', id: 'ROT-04', icon: 'rotate-cw', name: 'Rotate', desc: 'Issue → roll out → revoke, in the safe order.', fk: 'order', fv: 'enforced' },
]

function PipeNode({ stage, step }: { stage: PipeStage; step: number }) {
  return (
    <div className="sch-node" data-step={step}>
      <div className="nlabel"><span>{stage.label}</span><span>{stage.id}</span></div>
      <div className="nname"><Icon name={stage.icon} size={17} />{stage.name}</div>
      <div className="ndesc">{stage.desc}</div>
      <div className="nfoot">{stage.fk}: <span className="ok">{stage.fv}</span></div>
    </div>
  )
}

function InputNode({ step }: { step: number }) {
  return (
    <div className="sch-node src" data-step={step}>
      <div className="nlabel"><span>INPUT</span></div>
      <div className="nname"><Icon name="git-branch" size={17} />Code + platforms</div>
      <div className="ndesc">Source trees, .env, AWS, Stripe, GitHub, Grafana, …</div>
    </div>
  )
}

function HArrow({ step }: { step: number }) { return <div className="sch-arrow" data-step={step} /> }
function VArrow({ step }: { step: number }) { return <div className="sch-varrow" data-step={step} /> }

function SchPipeline({ v }: { v: Variant }) {
  let body: React.ReactNode
  if (v === 'sm') {
    body = (
      <div className="sch-pipe-sm">
        <InputNode step={0} />
        <VArrow step={1} />
        <PipeNode stage={PIPE_STAGES[0]} step={2} />
        <VArrow step={3} />
        <PipeNode stage={PIPE_STAGES[1]} step={4} />
        <VArrow step={5} />
        <PipeNode stage={PIPE_STAGES[2]} step={6} />
        <VArrow step={7} />
        <PipeNode stage={PIPE_STAGES[3]} step={8} />
      </div>
    )
  } else if (v === 'md') {
    body = (
      <>
        <div className="sch-inputrail" data-step={0}>
          <span className="ann"><Icon name="git-branch" size={13} /> INPUT</span>
          <span className="rail-desc">Code + platforms: source trees, .env, AWS, Stripe, GitHub, Grafana, …</span>
        </div>
        <div className="sch-pipe-md">
          <PipeNode stage={PIPE_STAGES[0]} step={1} />
          <HArrow step={2} />
          <PipeNode stage={PIPE_STAGES[1]} step={3} />
          <HArrow step={4} />
          <PipeNode stage={PIPE_STAGES[2]} step={5} />
          <HArrow step={6} />
          <PipeNode stage={PIPE_STAGES[3]} step={7} />
        </div>
      </>
    )
  } else {
    body = (
      <div className="sch-pipe">
        <InputNode step={0} />
        <HArrow step={1} />
        <PipeNode stage={PIPE_STAGES[0]} step={2} />
        <HArrow step={3} />
        <PipeNode stage={PIPE_STAGES[1]} step={4} />
        <HArrow step={5} />
        <PipeNode stage={PIPE_STAGES[2]} step={6} />
        <HArrow step={7} />
        <PipeNode stage={PIPE_STAGES[3]} step={8} />
      </div>
    )
  }
  return (
    <section className="sch-sec" id="fig-01" data-screen-label="C fig 01 pipeline" data-fig="01">
      <div className="wrap" style={{ paddingTop: 24 }}>
        <div className="sch-figure" data-fig-seq="true">
          <Ticks />
          <div className="fig-head">
            <span className="fig">Fig. 01: System overview</span>
            {v !== 'sm' && <span className="ann">Scan → inventory → validate → rotate, end to end</span>}
            <RunBtn />
          </div>
          {body}
          <div className="fig-foot">
            <span className="ann">-- solid: stored in your Keystrok database</span>
            {v !== 'sm' && <span className="ann">- - dashed: platforms read via the credentials you connect</span>}
          </div>
        </div>
      </div>
    </section>
  )
}

interface ModSpec { k: string; val: string; ok?: boolean }
interface Mod { id: string; icon: string; name: string; desc: string; specs: ModSpec[] }

const MODS: Mod[] = [
  {
    id: 'SCAN-01', icon: 'search', name: 'Scan',
    desc: 'Exposed keys and ones past their rotation date, across code and platforms.',
    specs: [{ k: 'input', val: 'code · platforms' }, { k: 'output', val: 'findings list' }, { k: 'guarantee', val: 'read-only', ok: true }],
  },
  {
    id: 'INV-02', icon: 'layers', name: 'Inventory',
    desc: 'What keys do we have, and how exposed? Sort by platform, exposure, or risk.',
    specs: [{ k: 'input', val: 'scan findings' }, { k: 'output', val: 'one ledger' }, { k: 'guarantee', val: 'encrypted at rest', ok: true }],
  },
  {
    id: 'VAL-03', icon: 'activity', name: 'Validate',
    desc: 'Which leaked keys are still live. Dead keys drop, live ones rise.',
    specs: [{ k: 'input', val: 'ledger · platform' }, { k: 'output', val: 'live / revoked' }, { k: 'guarantee', val: 'advisory', ok: true }],
  },
  {
    id: 'ROT-04', icon: 'rotate-cw', name: 'Rotate',
    desc: 'Issue, roll out, revoke, the order that never locks you out. Every step recorded.',
    specs: [{ k: 'input', val: 'one key id' }, { k: 'output', val: 'rotated key' }, { k: 'guarantee', val: 'safe order', ok: true }],
  },
]

function SchModules({ v }: { v: Variant }) {
  return (
    <section className="sch-sec ruled" data-screen-label="C fig 02 modules" data-fig="02">
      <div className="wrap">
        <div className="sec-head" data-ink="true">
          <span className="fig">Fig. 02</span>
          <h2>Module specifications</h2>
          {v === 'lg' && <span className="ann sec-note">4 modules · no feature matrix</span>}
        </div>
        <div className={'sch-mods' + (v === 'md' ? ' sch-mods--strip' : '')}>
          {MODS.map((m) => (
            <div className="sch-mod" key={m.id}>
              <div className="m-head"><span className="m-id">{m.id}</span><span className="ann blip">stable</span></div>
              <div className="m-name"><Icon name={m.icon} size={19} />{m.name}</div>
              <div className="m-desc">{m.desc}</div>
              <div className="m-specs">
                {m.specs.map((s) => (
                  <div className="m-row" key={s.k}><span className="k">{s.k}</span><span className={'v' + (s.ok ? ' ok' : '')}>{s.val}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

interface CredStep { label: string; icon: string; name: string; desc: string; cls?: string }

const CRED_STEPS: CredStep[] = [
  { label: 'ON SAVE', icon: 'key', name: 'Encrypted', desc: 'Sealed with AES-256-GCM before it reaches the database.' },
  { label: 'AT REST', icon: 'lock', name: 'Ciphertext only', desc: 'Stored as enc:v1: blobs. Never plaintext, never logged.' },
  { label: 'IN USE', icon: 'eye', name: 'Decrypted in memory', desc: 'Unsealed only for a call. Connection tests are SSRF-guarded.' },
]

function SchCredentials({ v }: { v: Variant }) {
  const node = (i: number, step: number) => {
    const s = CRED_STEPS[i]
    return (
      <div className={'sch-node ' + (s.cls ?? '')} data-step={step}>
        <div className="nlabel"><span>{s.label}</span></div>
        <div className="nname"><Icon name={s.icon} size={15} />{s.name}</div>
        <div className="ndesc">{s.desc}</div>
      </div>
    )
  }
  return (
    <section className="sch-sec ruled" id="fig-03" data-screen-label="C fig 03 credentials" data-fig="03">
      <div className="wrap">
        <div className="sec-head" data-ink="true">
          <span className="fig">Fig. 03</span>
          <h2>Credential handling</h2>
          {v === 'lg' && <span className="ann sec-note">the part you should audit first</span>}
        </div>
        <div className="sch-figure" data-fig-seq="true">
          <Ticks />
          <div className="fig-head">
            <span className="fig">{v === 'sm' ? 'Credential lifecycle' : 'Lifecycle of a credential inside Keystrok'}</span>
            {v !== 'sm' && <span className="ann">AES-256-GCM · lib/crypto.ts</span>}
            <RunBtn />
          </div>
          {v === 'sm' ? (
            <div className="sch-pipe-sm">
              {node(0, 0)}<VArrow step={1} />{node(1, 2)}<VArrow step={3} />{node(2, 4)}
            </div>
          ) : (
            <div className="sch-cred">
              {node(0, 0)}<HArrow step={1} />{node(1, 2)}<HArrow step={3} />{node(2, 4)}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

interface SpecRow { k: string; val: string; ok?: boolean }
const DEPLOY_SPECS: SpecRow[] = [
  { k: 'Auth', val: 'passwordless magic-link' },
  { k: 'Encryption', val: 'AES-256-GCM at rest', ok: true },
  { k: 'Self-host', val: 'Docker + your Postgres', ok: true },
  { k: 'Teams', val: 'shared workspace, roles', ok: true },
  { k: 'Telemetry', val: 'none', ok: true },
  { k: 'Stack', val: 'Next.js · Postgres · Prisma' },
]

function SchDeployment({ v }: { v: Variant }) {
  return (
    <section className="sch-sec ruled" data-screen-label="C deployment" data-fig="04">
      <div className="wrap">
        <div className="sec-head" data-ink="true">
          <span className="fig">Fig. 04</span>
          <h2>Built to self-host</h2>
          {v === 'lg' && <span className="ann sec-note">Docker + your own Postgres</span>}
        </div>
        <div className="sch-sheet">
          <div>
            <p className="lede">Run it where your keys already live.</p>
            <p className="body">
              A Docker stack: app, Postgres, mail. Your infrastructure, your database. The only
              outbound calls go to the platforms you connect.
            </p>
          </div>
          <div className="sch-spec-table">
            {DEPLOY_SPECS.map((r) => (
              <div className="row" key={r.k}><span className="k">{r.k}</span><span className={'v' + (r.ok ? ' ok' : '')}>{r.val}</span></div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function SchCta() {
  return (
    <section className="sch-cta" id="cta" data-screen-label="C cta">
      <div className="wrap">
        <div>
          <h2>Put your keys under instrumentation.</h2>
          <p className="sub" style={{ color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.04em' }}>
            Free and open source. Self-host it on your own Postgres in minutes.
          </p>
        </div>
        <div className="actions">
          <a className="btn primary" href={REPO_URL}><Icon name="github" size={15} /> View on GitHub</a>
          <a className="btn" href="/auth/signin"><Icon name="arrow-right" size={14} /> Sign in</a>
        </div>
      </div>
    </section>
  )
}

function SchFooter() {
  return (
    <footer className="sch-foot" data-screen-label="C footer">
      <div className="wrap">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SchMark size={12} color="#5a6475" /><span style={{ textTransform: 'none' }}>keystrok_</span> · 2026.06 · Built by{' '}
          <a href="https://nilsongaspar.omg.lol/" target="_blank" rel="noopener noreferrer">Nilson Gaspar</a>
        </span>
        <div className="links">
          <a href="#fig-01">How it works</a><a href="#fig-03">Security</a><Link href="/docs">Docs</Link><a href="/auth/signin">Sign in</a>
        </div>
      </div>
    </footer>
  )
}

export function LandingSchematic({ variant = 'lg', authed = false }: { variant?: Variant; authed?: boolean }) {
  const v = variant
  return (
    <div className={'sch sch--' + v}>
      <SchBar v={v} authed={authed} />
      <SchHero />
      <SchPipeline v={v} />
      <SchModules v={v} />
      <SchCredentials v={v} />
      <SchDeployment v={v} />
      <SchCta />
      <SchFooter />
    </div>
  )
}

export default LandingSchematic
