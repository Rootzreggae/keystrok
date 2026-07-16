'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOC_PAGES } from './pages'

// Sidebar nav; client-only for the active state, nothing else.
export function DocsNav() {
  const path = usePathname()
  return (
    <nav className="ks-docs__nav" aria-label="Documentation">
      <div className="ks-docs__navlabel">Documentation</div>
      {DOC_PAGES.map((p) => {
        const href = `/docs/${p.slug}`
        return (
          <Link key={p.slug} href={href} className={'ks-docs__navlink' + (path === href ? ' is-active' : '')}>
            {p.title}
          </Link>
        )
      })}
    </nav>
  )
}
