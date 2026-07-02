'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Home, Key, RefreshCw, Search, ScanSearch, Server, Activity, Zap, LogOut, Clock, Menu, X, ChevronLeft, ChevronRight, ChevronUp, Users } from 'lucide-react'
import { BrandMark } from '@/components/ks'
import { CommandPalette } from '@/components/ks/CommandPalette'
import { SourceConnect, SourceConnectContext } from '@/components/ks/SourceConnect'
import { AssistantChat, AssistantConnect, AssistantContext, useAssistantProvider } from '@/components/ks/Assistant'
import { type ApiKey, urgency, ago } from '@/lib/keys-display'

const GROUPS = [
  { label: 'Daily', items: [
    { name: 'Home', href: '/dashboard', icon: Home, badge: 'home' },
    { name: 'Keys', href: '/inventory', icon: Key, badge: 'keys' },
    { name: 'Rotations', href: '/rotation-workflows', icon: RefreshCw, badge: 'rotations' },
  ]},
  { label: 'Sources', items: [
    { name: 'Discovery', href: '/discovery-scanner', icon: Search, badge: 'discovery' },
    { name: 'Platforms', href: '/platforms', icon: Server, badge: 'platforms' },
  ]},
  { label: 'System', items: [{ name: 'Activity', href: '/activity', icon: Activity, badge: null }] },
] as const

const TITLES: Record<string, string> = {
  ...Object.fromEntries(GROUPS.flatMap((g) => g.items.map((i) => [i.href, i.name]))),
  '/search': 'Search',
  '/team': 'Team',
}


export function AppShell({ email, isAdmin, children }: { email?: string | null; isAdmin?: boolean; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const qc = useQueryClient()
  const title = TITLES[pathname] ?? 'Keystrok'
  // Team management is admin-only; add it to the System group for admins.
  const groups = isAdmin
    ? GROUPS.map((g) => g.label === 'System'
        ? { label: g.label, items: [...g.items, { name: 'Team', href: '/team', icon: Users, badge: null }] }
        : { label: g.label, items: [...g.items] })
    : GROUPS
  const initial = (email?.[0] ?? 'K').toUpperCase()
  const name = (email?.split('@')[0] ?? 'signed in').replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const [cmdOpen, setCmdOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false) // mobile off-canvas
  const [collapsed, setCollapsed] = useState(false) // desktop icon-rail
  const [acctMenu, setAcctMenu] = useState(false)
  const [srcOpen, setSrcOpen] = useState(false) // connect-source wizard (global)
  const [srcStep, setSrcStep] = useState<1 | 3>(1)
  const openConnect = (step: 1 | 3 = 1) => { setSrcStep(step); setSrcOpen(true) }
  const [asstView, setAsstView] = useState<'chat' | 'connect' | null>(null) // assistant drawer (global)
  const [asstSeed, setAsstSeed] = useState<string | undefined>() // optional prefilled question
  const { data: asst } = useAssistantProvider()
  // seed may be a click event when used as an onClick; only accept real strings.
  const openAssistant = (seed?: string) => {
    setAsstSeed(typeof seed === 'string' ? seed : undefined)
    setAsstView(asst?.connected ? 'chat' : 'connect')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen((v) => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { setNavOpen(false) }, [pathname]) // close drawer on navigate

  // Returning from the GitHub install redirect (?connected=github) reopens the
  // wizard at the repositories step, wherever the user lands.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('connected') === 'github') {
      setSrcStep(3); setSrcOpen(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Badge + scan-chip data (shared cache with the pages).
  const { data: keys = [] } = useQuery<ApiKey[]>({ queryKey: ['keys'], queryFn: async () => { const r = await fetch('/api/keys'); const j = await r.json(); return j.keys ?? j ?? [] } })
  const { data: findings = [] } = useQuery<unknown[]>({ queryKey: ['findings', 'active'], queryFn: async () => { const r = await fetch('/api/discovery/results?status=active'); const j = await r.json(); return j.results?.findings ?? j.findings ?? [] } })
  const { data: workflows = [] } = useQuery<{ status: string }[]>({ queryKey: ['workflows'], queryFn: async () => { const r = await fetch('/api/workflows'); const j = await r.json(); return j.data?.workflows ?? j.workflows ?? [] } })
  const { data: platforms = [] } = useQuery<unknown[]>({ queryKey: ['platforms'], queryFn: async () => { const r = await fetch('/api/platforms'); const j = await r.json(); return j.platforms ?? j.data?.platforms ?? j ?? [] } })
  const { data: scanAt } = useQuery<string | null>({ queryKey: ['last-scan'], queryFn: async () => { const r = await fetch('/api/discovery/status'); const j = await r.json().catch(() => null); return j?.currentScan?.completedAt ?? j?.recentScans?.[0]?.completedAt ?? null } })

  const overdue = keys.filter((k) => urgency(k).overdue).length
  const openWf = workflows.filter((w) => w.status !== 'completed').length
  const badges: Record<string, { n: number; crit?: boolean } | null> = {
    home: overdue > 0 ? { n: overdue, crit: true } : null,
    keys: keys.length ? { n: keys.length } : null,
    rotations: openWf ? { n: openWf } : null,
    discovery: findings.length ? { n: findings.length, crit: true } : null,
    platforms: platforms.length ? { n: platforms.length } : null,
  }

  return (
    <SourceConnectContext.Provider value={{ openConnect }}>
    <AssistantContext.Provider value={{ open: openAssistant }}>
    <div className="kb ksapp">
      {navOpen && <div className="ks-side-scrim" onClick={() => setNavOpen(false)} />}
      <aside className={'ks-side' + (navOpen ? ' ks-side--open' : '') + (collapsed ? ' is-collapsed' : '')}>
        <div className="ks-side__brand"><BrandMark /></div>

        <nav className="ks-side__nav">
          {groups.map((group) => (
            <div className="ks-navgroup" key={group.label}>
              <div className="ks-navgroup__l">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge = item.badge ? badges[item.badge] : null
                return (
                  <Link key={item.href} href={item.href} className={active ? 'ks-nav active' : 'ks-nav'} title={item.name}>
                    <Icon strokeWidth={1.75} />
                    <span className="ks-nav__lbl">{item.name}</span>
                    {badge && <span className={'ks-nav__badge' + (badge.crit ? ' ks-nav__badge--crit' : '')}>{badge.n}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="ks-side__foot">
          {/* Assistant entry: opens chat when a model is connected, else the connect flow. */}
          <button className="ks-side__copilot" type="button" title="Assistant" onClick={() => openAssistant()}>
            <Zap className="ks-side__copilot-ico" strokeWidth={2} />
            <div>
              <div className="t">Assistant</div>
              <div className="row">
                {asst?.connected
                  ? <><span className="ks-side__copilot-dot" /><span className="mod">{asst.provider?.model}</span></>
                  : <span className="mod">Connect a model</span>}
              </div>
            </div>
          </button>

          <div className="ks-side__acctrow">
            <button className="ks-side__collapse" type="button" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <button className="ks-side__acct" type="button" onClick={() => setAcctMenu((v) => !v)}>
              <span className="av">{initial}</span>
              <span className="ks-side__acctinfo">
                <span className="ks-side__acctname">{name}</span>
                <span className="ks-side__acctmeta">{email ?? 'signed in'}</span>
              </span>
              <ChevronUp className="ks-side__acctchev" size={15} />
            </button>
          </div>

          {acctMenu && (
            <div className="ks-acctmenu">
              <button type="button" onClick={() => signOut({ callbackUrl: '/' })}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="ks-main">
        <header className="ks-top">
          <button className="ks-top__menu" onClick={() => setNavOpen(true)} aria-label="Menu">
            {navOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <span className="ks-top__title">{title}</span>
          <button className="ks-btn ks-btn--primary ks-btn--sm ks-top__find" onClick={() => router.push('/discovery-scanner')} title="Scan a source to find keys">
            <ScanSearch size={14} /> <span>Find keys</span>
          </button>
          <button className="ks-top__search" type="button" onClick={() => setCmdOpen(true)}>
            <Search />
            <span className="ph">Search keys or run a command…</span>
            <span className="ks-top__kbd">⌘K</span>
          </button>
          {scanAt && <span className="ks-top__scan"><Clock size={13} /> scan {ago(scanAt)} ago</span>}
        </header>
        <main className="ks-content">{children}</main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <SourceConnect
        open={srcOpen}
        initialStep={srcStep}
        onClose={() => setSrcOpen(false)}
        onScanStarted={() => { qc.invalidateQueries({ queryKey: ['findings'] }); router.push('/discovery-scanner') }}
      />

      <AssistantConnect
        open={asstView === 'connect'}
        onClose={() => setAsstView(null)}
        onConnected={() => { qc.invalidateQueries({ queryKey: ['assistant-provider'] }); setAsstView('chat') }}
      />
      {asst?.connected && asst.provider && (
        <AssistantChat
          open={asstView === 'chat'}
          onClose={() => setAsstView(null)}
          onManage={() => setAsstView('connect')}
          provider={asst.provider}
          keyCount={keys.length}
          seed={asstSeed}
        />
      )}
    </div>
    </AssistantContext.Provider>
    </SourceConnectContext.Provider>
  )
}
