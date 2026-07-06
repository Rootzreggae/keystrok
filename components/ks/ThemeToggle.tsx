'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { resolveTheme, setThemePref } from '@/lib/theme'

// Header quick-toggle: flips light<->dark (an explicit pref). Available to every
// user regardless of role. The full System/Light/Dark control lives in Settings.
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    const sync = () => setTheme(resolveTheme())
    sync()
    window.addEventListener('ks-theme', sync)
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener('change', sync)
    return () => { window.removeEventListener('ks-theme', sync); mq.removeEventListener('change', sync) }
  }, [])

  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button className="ks-top__theme" onClick={() => setThemePref(next)} title={`Switch to ${next} theme`} aria-label={`Switch to ${next} theme`}>
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}
