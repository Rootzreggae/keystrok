// Clone + scan one repo from a connected GitHub source, awaitable. Extracted from
// app/api/sources/[id]/scan so both the manual route (fire-and-forget) and the
// scheduled cron (awaited, to detect new findings) share it.
import { prisma } from './prisma.ts'
import { cloneUrl } from './github.ts'
import { runScanSession } from './scan-runner.ts'
import { simpleGit } from 'simple-git'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'

/** Create a pending ScanSession for a GitHub repo scan. Returned immediately so
 *  the manual route can hand the UI a session id to poll. */
export async function createRepoScanSession(fullName: string, userId: string, scanType = 'quick') {
  return prisma.scanSession.create({
    data: {
      name: `GitHub · ${fullName}`, scanType, targetPath: '', status: 'pending', progress: 0,
      includeHidden: false, maxDepth: 6, fileExtensions: [],
      excludePaths: ['node_modules', '.git', 'build', 'dist'], keyTypes: [], userId,
    },
  })
}

/** Clone the repo to a temp dir, scan it, clean up. Awaitable; sets the session
 *  to failed on error. Safe to call inside setImmediate (manual) or awaited (cron). */
export async function cloneAndScan(sessionId: string, installationId: string, fullName: string, userId: string) {
  const cloneDir = path.join(os.homedir(), '.keystrok', 'clones', sessionId)
  try {
    await fs.mkdir(path.dirname(cloneDir), { recursive: true })
    const url = await cloneUrl(installationId, fullName)
    await simpleGit().clone(url, cloneDir, ['--depth', '1', '--single-branch'])
    await prisma.scanSession.update({ where: { id: sessionId }, data: { targetPath: cloneDir } })
    await runScanSession(sessionId, userId, {
      name: `GitHub · ${fullName}`, scanType: 'quick', targetPath: cloneDir,
      options: { source_code: true, environment_files: true, configuration_files: true, docker_files: false },
    })
  } catch (error) {
    console.error(`[source-scan ${sessionId}] failed:`, error)
    await prisma.scanSession.update({
      where: { id: sessionId },
      data: { status: 'failed', errorMessage: error instanceof Error ? error.message : 'Clone or scan failed', completedAt: new Date() },
    }).catch(() => {})
  } finally {
    await fs.rm(cloneDir, { recursive: true, force: true }).catch(() => {})
  }
}

export interface NewFinding {
  keyHashId: string
  keyType: string
  severity: string
  repository: string
  relativePath: string
}

/**
 * Findings first discovered by this scan session: their KeyHash was created at or
 * after `since` (storeScanFindings only *creates* a KeyHash for a genuinely-new
 * finding; a re-scanned or already-dismissed leak just bumps seenCount). So this
 * inherently excludes already-seen, dismissed, false-positive, and promoted keys.
 */
export async function newFindingsSince(sessionId: string, since: Date, repository: string): Promise<NewFinding[]> {
  const rows = await prisma.localScanFinding.findMany({
    where: { sessionId, status: 'active', keyHash: { firstSeenAt: { gte: since } } },
    select: { keyHashId: true, keyType: true, severity: true, relativePath: true },
  })
  return rows.map((r) => ({
    keyHashId: r.keyHashId ?? '', keyType: r.keyType,
    severity: (r.severity || 'medium').toLowerCase(), repository, relativePath: r.relativePath,
  })).filter((f) => f.keyHashId)
}
