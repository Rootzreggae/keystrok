import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { githubConfigured, isOperator } from '@/lib/github'

// Whether this instance has a GitHub App configured, and whether the caller is
// the operator (allowed to set one up). Drives the connect wizard's step 2.
export async function GET() {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ configured: false, isOperator: false }, { status: 401 })
  const [configured, operator] = await Promise.all([githubConfigured(), isOperator(s.user.id)])
  return NextResponse.json({ configured, isOperator: operator })
}
