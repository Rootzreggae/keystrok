import type { NextRequest } from 'next/server'

// Shared auth for the cron endpoints. A shared secret, not a user session. Fails
// closed if CRON_SECRET is unset, so the endpoints are disabled until configured.
export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const q = req.nextUrl.searchParams.get('key') || ''
  return bearer === secret || q === secret
}
