'use client'

import { useEffect, useState } from 'react'
import { type ThemePref, getThemePref, resolveTheme, setThemePref } from '@/lib/theme'

// Appearance v2 (design/app-refinements/explorations/appearance-v2.html).
// Ships the two rows that earned it: Theme and Open-on. The parked rows
// (density, clock/timezone, motion, secret reveal) live in the mock and get
// built when real usage friction asks for them.
// All prefs are per-browser (localStorage), matching the theme mechanism.

type OpenOn = 'home' | 'keys'
const OPEN_ON_KEY = 'ks-open-on' // read by app/auth/signin (first page after sign-in)

export function AppearanceSettings() {
  const [pref, setPref] = useState<ThemePref>('system')
  const [openOn, setOpenOn] = useState<OpenOn>('home')

  useEffect(() => {
    setPref(getThemePref())
    setOpenOn(localStorage.getItem(OPEN_ON_KEY) === 'keys' ? 'keys' : 'home')
    const sync = () => setPref(getThemePref())
    window.addEventListener('ks-theme', sync)
    // follow the OS while on 'system'
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => { if (getThemePref() === 'system') document.documentElement.setAttribute('data-theme', resolveTheme('system')) }
    mq.addEventListener('change', onChange)
    return () => { window.removeEventListener('ks-theme', sync); mq.removeEventListener('change', onChange) }
  }, [])

  const chooseTheme = (p: ThemePref) => { setPref(p); setThemePref(p) }
  const chooseOpenOn = (v: OpenOn) => { setOpenOn(v); localStorage.setItem(OPEN_ON_KEY, v) }

  const seg = <T extends string>(value: T, options: [T, string][], choose: (v: T) => void) => (
    <div className="ks-set__seg">
      {options.map(([v, label]) => (
        <button key={v} className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => choose(v)}>{label}</button>
      ))}
    </div>
  )

  return (
    <div>
      <div className="ks-set__title">
        <h2>Appearance</h2>
        <span className="ks-set__titlemeta">applies to this browser</span>
      </div>

      <div className="ks-prefcard">
        <div className="ks-prefcard__hd"><span className="ks-prefcard__t">Rendering</span></div>
        <div className="ks-prefcard__bd">
          <div className="ks-pref">
            <div className="ks-pref__txt">
              <div className="ks-pref__t">Theme</div>
              <div className="ks-pref__d">System follows your OS setting.</div>
            </div>
            {seg(pref, [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], chooseTheme)}
          </div>
        </div>
      </div>

      <div className="ks-prefcard">
        <div className="ks-prefcard__hd"><span className="ks-prefcard__t">Behavior</span></div>
        <div className="ks-prefcard__bd">
          <div className="ks-pref">
            <div className="ks-pref__txt">
              <div className="ks-pref__t">Open Keystrok on</div>
              <div className="ks-pref__d">First page after sign-in.</div>
            </div>
            {seg(openOn, [['home', 'Home'], ['keys', 'Keys']], chooseOpenOn)}
          </div>
        </div>
      </div>
    </div>
  )
}
