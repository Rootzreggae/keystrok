import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPipelinePath, consumerCheck, readinessChecks, radiusSummary } from '@/lib/blast-radius'

// GET /api/keys/[id]/radius
// The blast radius of one leaked key: exposure sites (findings sharing its
// hash), the subset in deploy pipelines (classified by path, from repo scan),
// the people on the exposing commits (git history), and the honest consumer
// state (liveness + last-used evidence). Everything here is observed, never
// inferred; consumers we didn't observe read as unknown.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = await prisma.discoveredKey.findUnique({
    where: { id },
    select: {
      keyHashId: true, location: true, platform: true, foundAt: true,
      liveStatus: true, liveCheckedAt: true, lastUsedAt: true, lastUsedSource: true,
    },
  })
  if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

  const [findings, assertedConsumers] = await Promise.all([
    prisma.localScanFinding.findMany({
      where: { keyHashId: key.keyHashId },
      select: {
        relativePath: true, lineNumber: true, createdAt: true,
        fileScan: { select: { gitAuthor: true, gitLastCommit: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.assertedConsumer.findMany({
      where: { discoveredKeyId: id },
      select: { id: true, name: true, readMode: true, owner: true, assertedBy: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // Collapse multiple hits in one file to a single site (keep the first line).
  const byPath = new Map<string, { path: string; line: number | null; foundAt: Date }>()
  const authors = new Map<string, Date | null>()
  let lastScanAt: Date | null = null
  for (const f of findings) {
    if (!byPath.has(f.relativePath))
      byPath.set(f.relativePath, { path: f.relativePath, line: f.lineNumber, foundAt: f.createdAt })
    if (f.fileScan?.gitAuthor && !authors.has(f.fileScan.gitAuthor))
      authors.set(f.fileScan.gitAuthor, f.fileScan.gitLastCommit ?? null)
    if (!lastScanAt || f.createdAt > lastScanAt) lastScanAt = f.createdAt
  }
  // A key promoted without linked findings still has its own finding location.
  if (byPath.size === 0 && key.location)
    byPath.set(key.location, { path: key.location, line: null, foundAt: key.foundAt })

  const all = [...byPath.values()]
  const pipelines = all.filter((s) => isPipelinePath(s.path))
  const sites = all.filter((s) => !isPipelinePath(s.path))
  const people = [...authors.entries()].map(([name, at]) => ({
    name,
    role: 'author of the exposing commit',
    lastCommitAt: at?.toISOString() ?? null,
  }))

  const consumer = consumerCheck(key, assertedConsumers.length)
  return NextResponse.json({
    summary: radiusSummary(all.length, pipelines.length, people.length, assertedConsumers.length),
    consumer,
    consumers: assertedConsumers.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    usage: key.lastUsedAt
      ? { lastUsedAt: key.lastUsedAt.toISOString(), source: key.lastUsedSource, live: key.liveStatus === 'live' }
      : null,
    sites: sites.map((s) => ({ ...s, foundAt: s.foundAt.toISOString() })),
    pipelines: pipelines.map((s) => ({ ...s, foundAt: s.foundAt.toISOString() })),
    people,
    readiness: readinessChecks(key.platform, consumer, all.length, pipelines.length),
    freshness: {
      lastScanAt: lastScanAt?.toISOString() ?? null,
      liveCheckedAt: key.liveCheckedAt?.toISOString() ?? null,
    },
  })
}
