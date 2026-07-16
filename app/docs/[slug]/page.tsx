import fs from 'fs/promises'
import path from 'path'
import { notFound } from 'next/navigation'
import { marked } from 'marked'
import { DOC_PAGES } from '../pages'

// Docs render at build time from docs/guide/*.md, so every deploy (and every
// self-hosted image) ships docs that match its own version. Content is our own
// repo-controlled markdown; no sanitizer needed between us and ourselves.

export const dynamicParams = false

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = DOC_PAGES.find((p) => p.slug === slug)
  return { title: page ? `${page.title} · Keystrok docs` : 'Keystrok docs' }
}

// In the repo, cross-page links are ./other-page.md so they work on GitHub;
// in the app they should resolve to /docs/other-page.
function rewriteMdLinks(html: string): string {
  return html.replace(/href="\.\/([a-z0-9-]+)\.md"/g, 'href="/docs/$1"')
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = DOC_PAGES.find((p) => p.slug === slug)
  if (!page) notFound()

  const md = await fs.readFile(path.join(process.cwd(), 'docs', 'guide', `${slug}.md`), 'utf8')
  const html = rewriteMdLinks(await marked.parse(md))

  return <article className="ks-docs__article" dangerouslySetInnerHTML={{ __html: html }} />
}
