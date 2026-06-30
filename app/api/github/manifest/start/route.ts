import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { githubConfigured, isOperator } from '@/lib/github'
import { randomBytes } from 'crypto'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;')

// Start the GitHub App Manifest flow: render an auto-submitting form that POSTs
// our manifest to github.com, where the operator confirms creation in one click.
// redirect_url is derived from this instance's own origin, so each self-host
// gets a correctly-scoped App with no manual env editing.
export async function GET(request: NextRequest) {
  const session = await auth()
  const origin = new URL(request.url).origin
  if (!session?.user?.id) return NextResponse.redirect(new URL('/auth/signin', origin))
  if (!(await isOperator(session.user.id))) {
    return NextResponse.redirect(new URL('/discovery-scanner?github_app=not_operator', origin))
  }
  if (await githubConfigured()) {
    return NextResponse.redirect(new URL('/api/github/install', origin))
  }

  const host = new URL(origin).host
  const manifest = {
    name: `Keystrok ${host}`.slice(0, 34), // GitHub App names cap at 34 chars
    url: origin,
    redirect_url: `${origin}/api/github/manifest/callback`,
    setup_url: `${origin}/api/github/setup`,
    setup_on_update: true,
    public: false,
    default_permissions: { contents: 'read', metadata: 'read' },
    default_events: [] as string[],
  }
  const state = randomBytes(16).toString('hex')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Setting up GitHub App…</title></head>
<body style="font-family:system-ui;background:#131519;color:#cbd5e1">
  <form id="f" action="https://github.com/settings/apps/new?state=${state}" method="post">
    <input type="hidden" name="manifest" value='${esc(JSON.stringify(manifest))}'>
  </form>
  <noscript><p>Continue to GitHub to create the app.</p><button form="f">Continue to GitHub</button></noscript>
  <script>document.getElementById('f').submit()</script>
</body></html>`
  const res = new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  res.cookies.set('gh_manifest_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' })
  return res
}
