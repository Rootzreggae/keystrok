// The docs registry: one ordered list drives the sidebar, the routes, and the
// slug -> file mapping. Content lives in docs/guide/*.md so the same files
// read fine on GitHub; adding a page = add the .md + one line here.
export interface DocPage {
  slug: string
  title: string
}

export const DOC_PAGES: DocPage[] = [
  { slug: 'self-hosting', title: 'Self-hosting' },
  { slug: 'connecting-github', title: 'Connecting GitHub' },
  { slug: 'scanning', title: 'Scanning' },
  { slug: 'keys-and-rotation', title: 'Keys and rotation' },
  { slug: 'teams-and-roles', title: 'Teams and roles' },
  { slug: 'faq', title: 'FAQ' },
]
