import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronAuthorized } from '@/lib/cron-auth'
import { listInstallationRepos } from '@/lib/github'
import { createRepoScanSession, cloneAndScan, newFindingsSince, type NewFinding } from '@/lib/source-scan'
import { alertNewFindings } from '@/lib/alert-runner'

// POST /api/cron/scan — the scheduled continuous-scan pass. Separate from the
// light alert tick because cloning + scanning repos is heavy; point a slower
// cron at it (daily-ish). Re-scans every active GitHub source, surfaces new
// leaks into Discovery automatically, and fires new_finding alerts (crit/high).
// Only GitHub sources are re-scannable unattended; the local folder picker is
// browser-mediated and inherently manual. Auth: CRON_SECRET (Bearer or ?key=).

const THROTTLE_HOURS = 6 // per-source floor, so a frequent cron can't thrash the clone
const ALERT_SEVERITIES = new Set(['critical', 'high']) // avoid fatigue on low-sev noise

async function scan(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conns = await prisma.sourceConnection.findMany({ where: { provider: 'github', status: 'active' } })
  const now = Date.now()
  const floor = now - THROTTLE_HOURS * 3600_000

  let reposScanned = 0, sourcesScanned = 0, skippedThrottled = 0
  const allNew: NewFinding[] = []

  for (const conn of conns) {
    if (conn.lastScheduledScanAt && conn.lastScheduledScanAt.getTime() > floor) { skippedThrottled++; continue }
    sourcesScanned++
    let repos: { fullName: string }[] = []
    try {
      repos = await listInstallationRepos(conn.installationId)
    } catch (e) {
      console.error(`[cron/scan] list repos failed for ${conn.accountLogin}:`, e)
      continue
    }
    for (const repo of repos) {
      const since = new Date() // new = KeyHash first seen at/after this repo's scan start
      const s = await createRepoScanSession(repo.fullName, conn.userId, 'scheduled')
      await cloneAndScan(s.id, conn.installationId, repo.fullName, conn.userId) // awaited (unlike the manual route)
      reposScanned++
      const fresh = await newFindingsSince(s.id, since, repo.fullName).catch(() => [])
      allNew.push(...fresh)
    }
    await prisma.sourceConnection.update({ where: { id: conn.id }, data: { lastScheduledScanAt: new Date() } }).catch(() => {})
  }

  // Alert only on the severities worth a page; the rest still land in Discovery.
  const pageworthy = allNew.filter((f) => ALERT_SEVERITIES.has(f.severity))
  const alertsFired = await alertNewFindings(pageworthy).catch(() => 0)

  return NextResponse.json({
    ok: true, sourcesScanned, skippedThrottled, reposScanned,
    newFindings: allNew.length, pageworthy: pageworthy.length, alertsFired,
  })
}

export const POST = scan
export const GET = scan
