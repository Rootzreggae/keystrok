'use client'

import React from 'react'
import { useSession } from 'next-auth/react'
import { LandingSchematic } from '@/components/landing/LandingSchematic'
import { initSchematicMotion } from '@/components/landing/motion'
import '@/components/landing/tokens.css'
import '@/components/landing/schematic.css'
import '@/components/landing/schematic-bp.css'

type Variant = 'lg' | 'md' | 'sm'

function calcVariant(): Variant {
  if (typeof window === 'undefined') return 'lg'
  const w = window.innerWidth
  if (w < 640) return 'sm'
  if (w < 1100) return 'md'
  return 'lg'
}

// Mobile sticky self-host bar (replaces the design's install bar).
function StickyCta() {
  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '12px 16px', background: 'rgba(12,15,20,0.95)', backdropFilter: 'blur(15px)',
        borderTop: '1px solid var(--line, #232a35)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-plex-mono), monospace', fontSize: 11, color: 'var(--ink, #7d93b8)' }}>
        Free &amp; open source
      </span>
      <a className="btn primary" href="#cta" style={{ textDecoration: 'none' }}>Self-host it</a>
    </div>
  )
}

export default function LandingPage() {
  // The landing is the public face: viewable by anyone, logged in or not. We do
  // NOT force logged-in visitors to /dashboard (that flashed the landing then
  // redirected, and on sign-out the stale session bounced through /dashboard to
  // /auth/signin). Instead the header link points logged-in users to the app.
  const { status } = useSession()
  const authed = status === 'authenticated'
  const [v, setV] = React.useState<Variant>('lg')
  const rootRef = React.useRef<HTMLDivElement>(null)

  // Resolve the real breakpoint on mount + on resize.
  React.useEffect(() => {
    const update = () => setV(calcVariant())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // (Re)arm schematic motion whenever the variant remounts the tree.
  React.useEffect(() => {
    const root = rootRef.current?.querySelector<HTMLElement>('.sch')
    initSchematicMotion(root ?? null, { scroll: true })
  }, [v])

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: 'var(--bg-deep, #0c0f14)' }}>
      <div key={v}>
        <LandingSchematic variant={v} authed={authed} />
      </div>
      {v === 'sm' && <StickyCta />}
    </div>
  )
}
