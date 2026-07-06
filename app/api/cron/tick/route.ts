import { NextRequest, NextResponse } from 'next/server'
import { runLivenessCheck } from '@/lib/liveness-runner'

// POST /api/cron/tick — the scheduled monitor tick. Self-host has no cloud
// scheduler, so the operator points their own cron / systemd-timer / Vercel Cron
// at this endpoint on a cadence they choose (e.g. hourly). Authenticated by a
// shared secret, not a user session.
//
// Job: run a full liveness pass (refresh which leaked keys are live/used from the
// connected platforms) then reconcile alerts. This makes the monitor autonomous:
// it catches a key that BECOMES live between manual checks, and fires time-driven
// alerts (sla_crossed) that an on-check run can't. No connected platform? It still
// evaluates standing incidents from stored state.
//
// Setup: set CRON_SECRET, then e.g.
//   0 * * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<instance>/api/cron/tick
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
  // Scheduled run: no actor, so no per-user activity-log entry.
  const result = await runLivenessCheck()
  return NextResponse.json({ ok: true, ...result })
}

export const POST = tick
// GET allowed too, so a plain uptime-style scheduler / browser check can drive it.
export const GET = tick
