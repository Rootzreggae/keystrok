import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SecurityScanner } from '@/lib/scanner/core'
import { SCANNER_PRESETS } from '@/lib/scanner/index'
import { storeScanFindings } from '@/lib/scan-runner'

export const maxDuration = 60

interface InFile { relativePath: string; content: string }

// Scan file contents the browser read from a folder the user picked. The
// browser can't give us a filesystem path (security), so it gives us the files
// and we scan those, same patterns + dedup + storage as a path scan.
export async function POST(request: NextRequest) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = s.user.id

  const body = await request.json().catch(() => null)
  const files: InFile[] = Array.isArray(body?.files) ? body.files : []
  if (files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  if (files.length > 5000) return NextResponse.json({ error: 'Too many files (max 5000)' }, { status: 413 })

  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : 'Folder scan'

  const session = await prisma.scanSession.create({
    data: {
      name, scanType: 'quick', targetPath: name, status: 'running', progress: 0,
      includeHidden: false, maxDepth: 1, fileExtensions: [], excludePaths: [], keyTypes: [], userId,
    },
  })

  try {
    const scanner = new SecurityScanner(SCANNER_PRESETS.QUICK)
    const result = await scanner.scanProvidedFiles(files)
    const stored = await storeScanFindings(session.id, userId, result.findings, result.fileScans)
    await prisma.scanSession.update({
      where: { id: session.id },
      data: { status: 'completed', completedAt: new Date(), progress: 1, findingsCount: stored.length },
    })
    return NextResponse.json({ success: true, sessionId: session.id, findings: stored.length, filesScanned: files.length })
  } catch (error) {
    await prisma.scanSession.update({
      where: { id: session.id },
      data: { status: 'failed', errorMessage: error instanceof Error ? error.message : 'Scan failed', completedAt: new Date() },
    }).catch(() => {})
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Scan failed' }, { status: 500 })
  }
}
