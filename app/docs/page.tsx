import { redirect } from 'next/navigation'
import { DOC_PAGES } from './pages'

// /docs is a reading surface, not a landing: go straight to the first page.
export default function DocsIndex() {
  redirect(`/docs/${DOC_PAGES[0].slug}`)
}
