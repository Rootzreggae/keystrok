import { NextRequest, NextResponse } from 'next/server'
import { evaluateAllAlerts } from '@/lib/alert-runner'

// POST /api/cron/tick — the scheduled monitor tick. Self-host has no cloud
// scheduler, so the operator points their own cron / systemd-timer / Vercel Cron
// at this endpoint on a cadence they choose (e.g. hourly). Authenticated by a
// shared secret, not a user session.
//
// v1 job: evaluate alerts from stored state. This is what fires time-driven
// alerts (sla_crossed: a key passed its rotation deadline) that an on-check run
// can't catch. Refreshing liveness on the tick is a separate enhancement.
//
// Setup: set CRON_SECRET, then e.g.
//   */60 * * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<instance>/api/cron/tick
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // no secret configured -> endpoint disabled, fail closed
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  // also accept ?key= for schedulers that can't set headers
  const q = req.nextUrl.searchParams.get('key') || ''
  return bearer === secret || q === secret
}

async function tick(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const alerts = await evaluateAllAlerts()
  return NextResponse.json({ ok: true, ran: 'evaluateAllAlerts', alerts })
}

export const POST = tick
// GET allowed too, so a plain uptime-style scheduler / browser check can drive it.
export const GET = tick
