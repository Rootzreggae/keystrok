// Loading placeholders. Shown while a query is in flight (isLoading) so a screen
// never flashes the wrong content (an empty state, or a blank) before data lands.
// Strict-fresh: we show this on a real fetch, not stale cached data.

/** A full-panel loading state, sized to roughly match what it's standing in for
 *  so the layout doesn't jump when data arrives. */
export function PanelLoading({ minHeight = 220 }: { minHeight?: number }) {
  return (
    <div className="ks-panel ks-loading" style={{ minHeight }}>
      <span className="ks-loading__spin" aria-label="Loading" />
    </div>
  )
}

/** Inline loading, for a section that already sits inside its own container. */
export function InlineLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="ks-loading ks-loading--inline">
      <span className="ks-loading__spin" /> <span className="ks-loading__lbl">{label}</span>
    </div>
  )
}
