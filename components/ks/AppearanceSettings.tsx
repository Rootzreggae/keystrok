'use client'

import { useEffect, useState } from 'react'
import { Monitor, Sun, Moon } from 'lucide-react'
import { type ThemePref, getThemePref, resolveTheme, setThemePref } from '@/lib/theme'

// Full theme control: match-system by default, or force light/dark. Shares state
// with the header toggle via lib/theme (both write the same pref + 'ks-theme' event).
export function AppearanceSettings() {
  const [pref, setPref] = useState<ThemePref>('system')

  useEffect(() => {
    setPref(getThemePref())
    const sync = () => setPref(getThemePref())
    window.addEventListener('ks-theme', sync)
    // follow the OS while on 'system'
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => { if (getThemePref() === 'system') document.documentElement.setAttribute('data-theme', resolveTheme('system')) }
    mq.addEventListener('change', onChange)
    return () => { window.removeEventListener('ks-theme', sync); mq.removeEventListener('change', onChange) }
  }, [])

  const choose = (p: ThemePref) => { setPref(p); setThemePref(p) }

  const opts: { p: ThemePref; label: string; Icon: typeof Sun }[] = [
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
