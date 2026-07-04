import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDestructiveStep } from '@/lib/rotation-policy'

// GET /api/keys/[id]/timeline
// The lifecycle of one leaked key as an ordered list of events: created,
// exposed, discovered, used, liveness-checked, rotation started, each rotation
// step, rotated. Plus the "exposure window" (from at-risk to closed) and
// whether the key was used during it, the forensic point of the whole screen.
type Tone = 'crit' | 'high' | 'ok' | 'mut'
interface TLEvent { at: string; kind: string; label: string; detail?: string; tone: Tone; window: boolean }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = await prisma.discoveredKey.findUnique({
    where: { id },
    select: {
      platformCreatedAt: true, exposedAt: true, exposedAtSource: true, foundAt: true,
      lastUsedAt: true, lastUsedSource: true, liveStatus: true, liveCheckedAt: true,
      rotatedAt: true, status: true, platform: true,
      rotationWorkflows: {
        select: { startedAt: true, completedAt: true, steps: { select: { name: true, stepType: true, status: true, completedAt: true } } },
      },
    },
  })
  if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

  const now = new Date()
  // The exposure window: at-risk since exposedAt (else discovery) until rotated (else open).
  const windowStart = key.exposedAt ?? key.foundAt
  const windowEnd = key.rotatedAt ?? null
  const inWindow = (d: Date) => d.getTime() >= windowStart.getTime() && (windowEnd ? d.getTime() <= windowEnd.getTime() : true)
  const usedDuring = !!key.lastUsedAt && inWindow(key.lastUsedAt)

  const ev: TLEvent[] = []
  const push = (at: Date | null | undefined, kind: string, label: string, tone: Tone, detail?: string) => {
    if (!at) return
    ev.push({ at: at.toISOString(), kind, label, detail, tone, window: inWindow(at) })
  }

  push(key.platformCreatedAt, 'created', 'Key created', 'mut', 'on the platform')
  push(key.exposedAt, 'exposed', 'Exposed', 'crit', key.exposedAtSource === 'git' ? 'from git history' : 'attested')
  push(key.foundAt, 'discovered', 'Discovered by Keystrok', 'high')
  push(key.lastUsedAt, 'used', usedDuring ? 'Used while exposed' : 'Last used', usedDuring ? 'crit' : 'mut',
    usedDuring ? `during the exposure window${key.lastUsedSource ? ` · ${key.lastUsedSource}` : ''}` : (key.lastUsedSource ?? undefined))
  if (key.liveCheckedAt) {
    const live = key.liveStatus === 'live'
    push(key.liveCheckedAt, 'checked', live ? 'Confirmed still live' : key.liveStatus === 'revoked' ? 'Confirmed revoked' : 'Liveness checked',
      live ? 'crit' : key.liveStatus === 'revoked' ? 'ok' : 'mut')
  }
  for (const wf of key.rotationWorkflows) {
    push(wf.startedAt, 'rotation_started', 'Rotation started', 'ok')
    for (const s of wf.steps) {
      if (!s.completedAt) continue
      const skipped = s.status === 'skipped'
      const revoke = isDestructiveStep(s)
      push(s.completedAt, 'step', s.name, revoke ? 'ok' : 'ok', skipped ? 'skipped' : revoke ? 'irreversible, old key revoked' : undefined)
    }
    push(wf.completedAt, 'rotated', 'Rotated, exposure closed', 'ok')
  }

  ev.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  const days = Math.max(0, Math.floor(((windowEnd ?? now).getTime() - windowStart.getTime()) / 86400000))
  return NextResponse.json({
    events: ev,
    window: { start: windowStart.toISOString(), end: windowEnd?.toISOString() ?? null, days, open: !windowEnd, usedDuring },
  })
}
