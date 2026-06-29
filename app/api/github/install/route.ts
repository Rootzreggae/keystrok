import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { githubConfigured, installUrl } from '@/lib/github'

// Kick off the GitHub App install, redirect the signed-in user to github.com.
// After they install, GitHub redirects back to /api/github/setup.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/signin', process.env.NEXTAUTH_URL ?? 'http://localhost:3001'))
  }
  if (!githubConfigured()) {
    return NextResponse.json({ error: 'GitHub App is not configured on this server.' }, { status: 503 })
  }
  return NextResponse.redirect(installUrl())
}
