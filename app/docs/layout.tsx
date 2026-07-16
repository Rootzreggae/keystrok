import type { Metadata } from 'next'
import Link from 'next/link'
import { DocsNav } from './DocsNav'
import '@/components/landing/tokens.css'
import './docs.css'

export const metadata: Metadata = {
  title: 'Keystrok docs',
  description: 'Self-hosting, connecting GitHub, scanning, rotation, and honest answers about what Keystrok can and cannot do.',
}

// Public docs shell. Wrapped in .sch so the landing's token palette applies;
// the docs are part of the public face, so they wear the schematic skin.
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sch ks-docs">
      <header className="ks-docs__bar">
        <Link href="/" className="ks-docs__brand">keystrok<span className="ks-docs__cursor">_</span></Link>
        <span className="ks-docs__crumb">docs</span>
        <span className="ks-docs__spacer" />
        <a href="https://github.com/Rootzreggae/keystrok" className="ks-docs__barlink">GitHub</a>
        <a href="/auth/signin" className="ks-docs__barlink">Sign in</a>
      </header>
      <div className="ks-docs__body">
        <DocsNav />
        <main className="ks-docs__main">{children}</main>
      </div>
      <footer className="ks-docs__foot">
        Found a gap or a wrong claim in these docs?{' '}
        <a href="https://github.com/Rootzreggae/keystrok/issues">Open an issue</a>. We would rather fix it than defend it.
      </footer>
    </div>
  )
}
