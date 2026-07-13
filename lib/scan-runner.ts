// Shared scan execution: runs a SecurityScanner over a filesystem path and
// stores findings under a ScanSession. Used by the local "scan a folder" route
// and the GitHub "clone a repo and scan it" route, so both behave identically
// (same dedup, same finding storage).
import { prisma } from '@/lib/prisma'
import { registerScan, unregisterScan } from '@/lib/scan-registry'
import { SecurityScanner } from '@/lib/scanner/core'
import { convertFindingToLocalScanFindingData, SCANNER_PRESETS } from '@/lib/scanner/index'
import type { Finding, ScanResult, ScanOptions, FileInfo, FileScanResult } from '@/lib/scanner/types'
import { hashIdentifier, classifyKeyFormat } from '@/lib/crypto'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const pexec = promisify(execFile)

/**
 * Best-effort exposure date for a git-tracked finding: the commit date of the
 * line holding the secret, i.e. when it entered history (went "public"). Returns
 * null for non-git paths or any failure, so the caller falls back to discovery.
 * execFile (no shell) with an absolute pathspec, so the path can't be injected.
 * ponytail: one `git blame` per finding; fine for now, batch by file if a huge
 * repo makes scans slow. Uses last-touch of the line as a proxy for introduction.
 */
async function gitExposureDate(filePath: string, line: number): Promise<Date | null> {
  try {
    const { stdout } = await pexec(
      'git', ['blame', '-L', `${line},${line}`, '--porcelain', '--', filePath],
      { cwd: path.dirname(filePath), timeout: 5000, maxBuffer: 1 << 20 },
    )
    const m = stdout.match(/^author-time (\d+)/m)
    if (!m) return null
    const d = new Date(parseInt(m[1], 10) * 1000)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

export interface ScanRunConfig {
  name: string
  scanType: 'quick' | 'deep' | 'full'
  targetPath?: string
  options: {
    environment_files: boolean
    configuration_files: boolean
    docker_files: boolean
    source_code: boolean
  }
}

export function validateScanPath(targetPath: string): { isValid: boolean; normalizedPath: string; error?: string } {
  try {
    // Expand a leading ~ to the user's home directory (path.resolve won't).
    const expanded = targetPath.replace(/^~(?=$|[/\\])/, os.homedir())
    const normalizedPath = path.resolve(expanded)

    const userHome = os.homedir()
    const isInUserHome = normalizedPath.startsWith(userHome)

    const blockedPaths = [
      '/etc', '/var', '/usr', '/opt', '/bin', '/sbin', '/boot', '/dev', '/proc', '/sys', '/tmp',
      path.join(userHome, '.ssh'),
      path.join(userHome, '.aws'),
      path.join(userHome, '.config'),
      path.join(userHome, 'Library'),
      path.join(userHome, 'Applications'),
    ]
    for (const blockedPath of blockedPaths) {
      if (normalizedPath.startsWith(blockedPath)) {
        return { isValid: false, normalizedPath, error: `Access to system directories is not allowed: ${blockedPath}` }
      }
    }

    const documentsPath = path.join(userHome, 'Documents')
    const desktopPath = path.join(userHome, 'Desktop')
    if (!isInUserHome && !normalizedPath.startsWith(documentsPath) && !normalizedPath.startsWith(desktopPath)) {
      return { isValid: false, normalizedPath, error: 'Scan path must be within your user directory' }
    }

    return { isValid: true, normalizedPath }
  } catch (error) {
    return { isValid: false, normalizedPath: targetPath, error: `Invalid path: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// Run a scan for an already-created ScanSession. Marks it running → completed/failed.
export async function runScanSession(sessionId: string, userId: string, config: ScanRunConfig) {
  try {
    await prisma.scanSession.update({ where: { id: sessionId }, data: { status: 'running' } })

    const targetPath = config.targetPath || path.join(os.homedir(), 'Documents')
    const pathValidation = validateScanPath(targetPath)
    if (!pathValidation.isValid) throw new Error(pathValidation.error)

    let scannerPreset: keyof typeof SCANNER_PRESETS = 'BALANCED'
    if (config.scanType === 'quick') scannerPreset = 'QUICK'
    else if (config.scanType === 'full') scannerPreset = 'THOROUGH'

    const scanner = new SecurityScanner(SCANNER_PRESETS[scannerPreset])

    let fileExtensions: string[] | undefined = undefined
    if (!config.options.source_code) {
      fileExtensions = ['.env', '.yml', '.yaml', '.json', '.conf', '.config', '.ini']
    } else if (config.options.source_code && !config.options.environment_files && !config.options.configuration_files) {
      fileExtensions = [
        '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
        '.py', '.pyc', '.pyw', '.pyo', '.rb', '.rbw',
        '.php', '.php3', '.php4', '.php5', '.phtml',
        '.go', '.mod', '.sum', '.java', '.class',
        '.cs', '.vb', '.fs', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
      ]
    }

    const excludePaths = ['node_modules', '.git', 'build', 'dist', '.next', 'coverage']
    if (!config.options.environment_files) excludePaths.push('.env', '.env.local', '.env.production', '.env.development')
    if (!config.options.docker_files) excludePaths.push('Dockerfile', 'docker-compose.yml', 'docker-compose.yaml')

    scanner.on('progressUpdate', async (progress) => {
      await prisma.scanSession.update({
        where: { id: sessionId },
        data: {
          progress: progress.progress,
          totalFiles: progress.totalFiles,
          scannedFiles: progress.scannedFiles,
          findingsCount: progress.findingsCount,
        },
      }).catch(() => {})
    })

    const scannerScanType: ScanOptions['scanType'] = config.scanType === 'full' ? 'deep' : config.scanType
    const scanOptions: ScanOptions = {
      targetPath: pathValidation.normalizedPath,
      scanType: scannerScanType,
      includeHidden: false,
      maxDepth: scannerPreset === 'QUICK' ? 3 : scannerPreset === 'BALANCED' ? 6 : 10,
      fileExtensions,
      excludePaths,
    }

    registerScan(sessionId, scanner)
    let result: ScanResult
    try {
      result = await scanner.scanDirectory(scanOptions)
    } finally {
      unregisterScan(sessionId)
    }

    // A cancelled scan settles as cancelled; completion must never overwrite it.
    if (result.status === 'cancelled') {
      await prisma.scanSession.update({
        where: { id: sessionId },
        data: { status: 'cancelled', completedAt: new Date() },
      }).catch(() => {})
      return { ok: false as const, error: 'Scan cancelled' }
    }

    const stored = await storeScanFindings(sessionId, userId, result.findings, result.fileScans)

    // Findings that failed to store are disclosed, never silently dropped.
    const dropped = result.findings.length - stored.length
    await prisma.scanSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        progress: 1.0,
        findingsCount: stored.length,
        errorMessage: dropped > 0 ? `${dropped} finding${dropped === 1 ? '' : 's'} could not be stored` : null,
      },
    })
    return { ok: true as const, findings: stored.length }
  } catch (error) {
    await prisma.scanSession.update({
      where: { id: sessionId },
      data: { status: 'failed', errorMessage: error instanceof Error ? error.message : 'Unknown error', completedAt: new Date() },
    }).catch(() => {})
    return { ok: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Store findings under the session, reconciling against existing findings so a
// re-scan refreshes in place (deterministic identity hash) and preserves triage.
export async function storeScanFindings(sessionId: string, userId: string, findings: Finding[], fileScans: FileScanResult[]) {
  const processedFindings = []

  const fileInfoByPath = new Map<string, FileInfo>()
  for (const fileScan of fileScans) fileInfoByPath.set(fileScan.fileInfo.absolutePath, fileScan.fileInfo)

  for (const finding of findings) {
    const fileInfo = fileInfoByPath.get(finding.filePath)
    try {
      const findingIdentifier = `${finding.filePath}:${finding.lineNumber}:${finding.detectionRule}:${finding.keyPreview}`
      const keyHash = hashIdentifier(findingIdentifier)
      const salt = ''

      let keyHashRecord = await prisma.keyHash.findUnique({ where: { keyHash } })
      if (!keyHashRecord) {
        keyHashRecord = await prisma.keyHash.create({
          data: {
            keyHash, hashSalt: salt, keyType: finding.keyType,
            keyFormat: classifyKeyFormat(finding.keyPreview),
            estimatedLength: finding.keyPreview.length, userId, seenCount: 1,
          },
        })
      } else {
        await prisma.keyHash.update({ where: { id: keyHashRecord.id }, data: { lastSeenAt: new Date(), seenCount: { increment: 1 } } })
      }

      let fileScan = await prisma.fileScan.findFirst({ where: { sessionId, absolutePath: finding.filePath } })
      if (!fileScan) {
        fileScan = await prisma.fileScan.create({
          data: {
            sessionId, userId,
            absolutePath: finding.filePath,
            relativePath: finding.relativePath,
            fileName: finding.fileName,
            fileExtension: path.extname(finding.fileName) || null,
            fileSize: BigInt(fileInfo?.fileSize || 0),
            fileHash: 'placeholder-hash',
            lastModified: fileInfo?.lastModified || new Date(),
            permissions: fileInfo?.permissions || '644',
            isGitTracked: fileInfo?.isGitTracked || false,
            linesScanned: 1, findingsCount: 1, hasFindings: true, scanCompletedAt: new Date(),
            isEnvFile: finding.isInEnvFile,
            isConfigFile: fileInfo?.isConfigFile || false,
            isCodeFile: fileInfo?.isCodeFile || false,
          },
        })
      } else {
        await prisma.fileScan.update({ where: { id: fileScan.id }, data: { findingsCount: { increment: 1 } } })
      }

      const localFindingData = convertFindingToLocalScanFindingData(finding, sessionId, userId, fileScan.id, keyHashRecord.id)

      // Git-tracked findings carry their real exposure date (commit of the line).
      const exposedAt = fileInfo?.isGitTracked ? await gitExposureDate(finding.filePath, finding.lineNumber) : null

      const existing = await prisma.localScanFinding.findFirst({
        where: { userId, filePath: finding.filePath, lineNumber: finding.lineNumber, detectionRule: finding.detectionRule, keyPreview: finding.keyPreview },
        select: { id: true },
      })
      const localFinding = existing
        ? await prisma.localScanFinding.update({
            where: { id: existing.id },
            data: { sessionId, fileScanId: fileScan.id, keyHashId: keyHashRecord.id, lineContent: finding.lineContent, relativePath: finding.relativePath, exposedAt },
          })
        : await prisma.localScanFinding.create({ data: { ...localFindingData, exposedAt } })

      processedFindings.push(localFinding)
    } catch (error) {
      console.error(`[SCAN ${sessionId}] Failed to process finding:`, finding, error)
    }
  }

  return processedFindings
}
