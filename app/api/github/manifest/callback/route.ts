import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isOperator, saveAppConfig } from '@/lib/github'

// GitHub redirects here after the operator creates the App from our manifest.
// Exchange the one-time code for the App's credentials (incl. the private key),
// store them encrypted, then continue straight to installation.
export async function GET(request: NextRequest) {
  const session = await auth()
  const origin = new URL(request.url).origin
  const back = (status: string) => NextResponse.redirect(new URL(`/discovery-scanner?github_app=${status}`, origin))

  if (!session?.user?.id) return NextResponse.redirect(new URL('/auth/signin', origin))
  if (!(await isOperator(session.user.id))) return back('not_operator')

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const cookieState = request.cookies.get('gh_manifest_state')?.value
  if (!code) return back('error')
  if (!state || state !== cookieState) return back('state')

  try {
    const res = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
      method: 'POST',
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Keystrok' },
    })
    if (!res.ok) throw new Error(`manifest conversion failed: ${res.status}`)
    const data = (await res.json()) as { id: number; slug: string; pem: string; webhook_secret?: string; client_id?: string }
    if (!data.id || !data.slug || !data.pem) throw new Error('conversion response missing fields')

    await saveAppConfig({ appId: data.id, slug: data.slug, pem: data.pem, webhookSecret: data.webhook_secret, clientId: data.client_id })

    // App created and stored. Continue to install it on the operator's repos.
    const out = NextResponse.redirect(new URL('/api/github/install', origin))
    out.cookies.delete('gh_manifest_state')
    return out
  } catch (e) {
    console.error('[github/manifest/callback] failed:', e)
    return back('error')
  }
}
