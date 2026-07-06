'use client'

// Shared client theme state, used by the header toggle and the Appearance
// setting so they stay in sync. Pref persists in localStorage; a no-flash script
// (app/layout) applies it at boot. Dispatches 'ks-theme' so both controls update.
export type ThemePref = 'system' | 'light' | 'dark'

export function getThemePref(): ThemePref {
  if (typeof window === 'undefined') return 'system'
  const p = localStorage.getItem('ks-theme')
  return p === 'light' || p === 'dark' ? p : 'system'
}

export function resolveTheme(pref: ThemePref = getThemePref()): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function setThemePref(pref: ThemePref) {
  if (pref === 'system') localStorage.removeItem('ks-theme')
  else localStorage.setItem('ks-theme', pref)
  document.documentElement.setAttribute('data-theme', resolveTheme(pref))
  window.dispatchEvent(new CustomEvent('ks-theme'))
}
