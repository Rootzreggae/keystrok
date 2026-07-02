import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cloneUrl } from '@/lib/github'
import { runScanSession } from '@/lib/scan-runner'
import { simpleGit } from 'simple-git'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'

// Scan a repo from a connected GitHub source: shallow-clone it to a temp dir
// under the user's home, run the shared scanner on it, then delete the clone.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const fullName: string | undefined = body.fullName // e.g. "octocat/hello-world"
  if (!fullName || !/^[\w.-]+\/[\w.-]+$/.test(fullName)) {
    return NextResponse.json({ error: 'A valid repo "owner/name" is required' }, { status: 400 })
  }

  // Shared workspace: look up by id only
  const conn = await prisma.sourceConnection.findFirst({ where: { id, provider: 'github' } })
  if (!conn) return NextResponse.json({ error: 'Source connection not found' }, { status: 404 })

  // Clone target lives under ~/.keystrok/clones (inside home → passes scan-path checks).
  const scanSession = await prisma.scanSession.create({
    data: {
      name: `GitHub · ${fullName}`,
      scanType: 'quick',
      targetPath: '',
      status: 'pending',
      progress: 0,
      includeHidden: false,
      maxDepth: 6,
      fileExtensions: [],
      excludePaths: ['node_modules', '.git', 'build', 'dist'],
      keyTypes: [],
      userId,
    },
  })
  const cloneDir = path.join(os.homedir(), '.keystrok', 'clones', scanSession.id)

  // Background: clone → scan → cleanup. UI polls scan status as usual.
  setImmediate(async () => {
    try {
      await fs.mkdir(path.dirname(cloneDir), { recursive: true })
      const url = await cloneUrl(conn.installationId, fullName)
      await simpleGit().clone(url, cloneDir, ['--depth', '1', '--single-branch'])
      await prisma.scanSession.update({ where: { id: scanSession.id }, data: { targetPath: cloneDir } })
      await runScanSession(scanSession.id, userId, {
        name: scanSession.name,
        scanType: 'quick',
        targetPath: cloneDir,
        options: { source_code: true, environment_files: true, configuration_files: true, git_repositories: false, docker_files: false },
      })
    } catch (error) {
      console.error(`[sources/scan ${scanSession.id}] failed:`, error)
      await prisma.scanSession.update({
        where: { id: scanSession.id },
        data: { status: 'failed', errorMessage: error instanceof Error ? error.message : 'Clone or scan failed', completedAt: new Date() },
      }).catch(() => {})
    } finally {
      await fs.rm(cloneDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  return NextResponse.json({ success: true, sessionId: scanSession.id, repo: fullName })
}
