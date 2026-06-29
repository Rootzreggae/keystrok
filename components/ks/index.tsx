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
