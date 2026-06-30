import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { githubConfigured, installUrl } from '@/lib/github'

// Kick off the GitHub App install, redirect the signed-in user to github.com.
// After they install, GitHub redirects back to /api/github/setup.
export async function GET() {
  const session = await auth()
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3001'
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/signin', base))
  }
  if (!(await githubConfigured())) {
    // Not set up on this instance yet. The wizard guides operators to the
    // manifest flow; this is the defensive fallback for a direct hit.
    return NextResponse.redirect(new URL('/discovery-scanner?github_app=needed', base))
  }
  return NextResponse.redirect(await installUrl())
}
