/* Keystrok app primitives: thin React wrappers over the .ks-* classes in
 * app/styles/ks-primitives.css. Square, token-driven, per DESIGN_SYSTEM.md.
 * Only render these inside a `.kb ksapp` root so the tokens cascade. */
import * as React from 'react'

export type Severity = 'critical' | 'high' | 'medium' | 'low'
type Tone = 'crit' | 'high' | 'a' | 'mut'

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ')

export function Button({
  variant = 'default',
  sm,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost'
  sm?: boolean
}) {
  return (
    <button
      className={cx('ks-btn', variant !== 'default' && `ks-btn--${variant}`, sm && 'ks-btn--sm', className)}
      {...props}
    />
  )
}

export function Pill({ tone = 'mut', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cx('ks-pill', tone !== 'mut' && `ks-pill--${tone}`, className)}>{children}</span>
}

export function Dot({ sev }: { sev: Severity | 'ok' }) {
  return <span className={cx('ks-dot', `ks-dot--${sev}`)} aria-hidden />
}

/** Platform code cell: pass a short code (AWS, STR, GH). Never coloured. */
export function Mark({ children }: { children: React.ReactNode }) {
  return <span className="ks-mark">{children}</span>
}

/** Liveness of a leaked key, matched against a connected platform. Renders
 *  nothing when unknown/unchecked so it stays quiet by default. `active` = live
 *  AND used recently, an incident in progress, so it reads hotter. See lib/liveness. */
export function LiveBadge({ status, active, title }: { status?: string | null; active?: boolean; title?: string }) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)',
    fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', borderRadius: 2,
    padding: '0 4px', lineHeight: '15px', whiteSpace: 'nowrap',
  }
  if (status === 'live') {
    return (
      <span
        title={title ?? (active ? 'Still live, and used recently: an active incident' : 'Still live on the platform')}
        style={{ ...base, fontWeight: 700, color: 'var(--crit)', border: '1px solid var(--crit)', background: active ? 'var(--crit-dim)' : undefined }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--crit)' }} aria-hidden />{active ? 'live · active' : 'live'}
      </span>
    )
  }
  if (status === 'revoked') {
    return (
      <span title={title ?? 'Not found on the platform, likely revoked'} style={{ ...base, fontWeight: 600, color: 'var(--tx-dim)', border: '1px solid var(--tx-dim)' }}>
        revoked
      </span>
    )
  }
  return null
}

/** The Keystrok wordmark: green key glyph + "keystrok_". Single source of truth. */
export function BrandMark() {
  return (
    <span className="ks-side__logo">
      <svg width="17" height="24" viewBox="20 8 56 80" fill="none" aria-hidden>
        <mask id="ksm"><rect x="20" y="8" width="56" height="80" fill="#fff" /><circle cx="48" cy="35" r="9" fill="#000" /><rect x="34" y="58" width="8" height="26" fill="#000" /><rect x="50" y="68" width="13" height="16" fill="#000" /></mask>
        <rect x="26" y="14" width="44" height="68" rx="4" fill="#34d399" mask="url(#ksm)" />
      </svg>
      <b>keystrok<i>_</i></b>
    </span>
  )
}

/** 3px severity left-tick for key/finding rows. */
export function SeverityTick({ sev }: { sev: Severity }) {
  return <span className={cx('ks-tick', `ks-tick--${sev}`)} aria-hidden />
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ks-panel', className)} {...props} />
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="ks-kbd">{children}</kbd>
}
