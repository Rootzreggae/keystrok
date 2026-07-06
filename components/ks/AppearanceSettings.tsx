'use client'

import { useEffect, useState } from 'react'
import { Monitor, Sun, Moon } from 'lucide-react'

type Pref = 'system' | 'light' | 'dark'

// Theme preference: match-system by default, or force light/dark. Token-only
// switch, sets data-theme on <html> (a no-flash script does the same at boot).
// Stored in localStorage (a client preference; self-host is single-workspace).
function resolve(pref: Pref): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function AppearanceSettings() {
  const [pref, setPref] = useState<Pref>('system')

  useEffect(() => {
    const saved = (localStorage.getItem('ks-theme') as Pref | null) ?? 'system'
    setPref(saved)
    // keep in sync with the OS when following system
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => { if ((localStorage.getItem('ks-theme') ?? 'system') === 'system') document.documentElement.setAttribute('data-theme', resolve('system')) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const choose = (p: Pref) => {
    setPref(p)
    if (p === 'system') localStorage.removeItem('ks-theme')
    else localStorage.setItem('ks-theme', p)
    document.documentElement.setAttribute('data-theme', resolve(p))
  }

  const opts: { p: Pref; label: string; Icon: typeof Sun }[] = [
    { p: 'system', label: 'System', Icon: Monitor },
    { p: 'light', label: 'Light', Icon: Sun },
    { p: 'dark', label: 'Dark', Icon: Moon },
  ]

  return (
    <div className="ks-panel" style={{ marginTop: 20 }}>
      <div className="ks-panel__hd">
        <span className="ks-panel__t"><Sun size={14} style={{ verticalAlign: -2, marginRight: 7 }} />Appearance</span>
        <span className="ks-panel__sub" style={{ marginLeft: 'auto' }}>dark is the default; light is an option</span>
      </div>
      <div style={{ padding: '18px 20px' }}>
        <div className="ks-seg">
          {opts.map(({ p, label, Icon }) => (
            <button key={p} className={'ks-seg__b' + (pref === p ? ' active' : '')} onClick={() => choose(p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
