'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { discoverFiles, scanFile, ScanFinding } from '@/lib/scanner'
import { revalidatePath } from 'next/cache'
import path from 'path'

/**
 * Resolve the current user's ID from the session, or throw. Use the session's
 * stable user id directly, never look users up by email, which could map two
 * accounts onto one record and leak scan data across users.
 */
async function requireUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user.id
}

export interface QuickScanResult {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  platform: string
  keyPreview: string
  filePath?: string
  lineNumber?: number
  confidence?: number
  riskLevel?: string
}

export interface ScanSessionInfo {
  id: string
  name: string
  status: string
  progress: number
  totalFiles: number
  scannedFiles: number
  findingsCount: number
  createdAt: Date
  completedAt?: Date
}

// Quick scan of common configuration files
export async function runQuickScan(): Promise<QuickScanResult[]> {
  const userId = await requireUserId()

  try {
    // Create a scan session
    const scanSession = await prisma.scanSession.create({
      data: {
        name: 'Quick Scan',
        scanType: 'quick',
        targetPath: process.cwd(),
        status: 'running',
        userId,
        includeHidden: false,
        maxDepth: 3,
        excludePaths: ['node_modules', '.git', '.next', 'dist', 'build']
      }
    })

    // Discover .env files and other config files in project root and immediate subdirs
    const discoveryResult = await discoverFiles(process.cwd(), {
      includeHidden: false,
      maxDepth: 3,
      fileExtensions: ['.env', '.env.local', '.env.development', '.env.production', '.txt', '.json', '.yaml', '.yml'],
      excludePaths: ['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'logs']
    })

    // Update scan session with file counts
    await prisma.scanSession.update({
      where: { id: scanSession.id },
      data: {
        totalFiles: discoveryResult.totalFiles,
        progress: 0.1 // Discovery completed
      }
    })

    const results: QuickScanResult[] = []
    let scannedFiles = 0

    // Scan each discovered file
    for (const filePath of discoveryResult.files) {
      try {
        const scanResult = await scanFile(filePath)
        scannedFiles++

        // Store findings in database
        for (const finding of scanResult.findings) {
          const localFinding = await prisma.localScanFinding.create({
            data: {
              sessionId: scanSession.id,
              filePath: scanResult.fileInfo.path,
              relativePath: scanResult.fileInfo.relativePath,
              fileName: scanResult.fileInfo.fileName,
              lineNumber: finding.lineNumber,
              lineContent: finding.lineContent,
              keyPreview: finding.keyPreview,
              keyType: finding.keyType,
              pattern: finding.pattern,
              patternName: finding.patternName,
              severity: finding.severity,
              confidence: finding.confidence,
              riskLevel: finding.riskLevel,
              detectionRule: finding.patternName,
              userId
            }
          })

          results.push({
            id: localFinding.id,
            severity: finding.severity,
            platform: finding.platform,
            keyPreview: finding.keyPreview,
            filePath: scanResult.fileInfo.relativePath,
            lineNumber: finding.lineNumber,
            confidence: finding.confidence,
            riskLevel: finding.riskLevel
          })
        }

        // Update progress
        const progress = Math.min(0.9, 0.1 + (scannedFiles / discoveryResult.totalFiles) * 0.8)
        await prisma.scanSession.update({
          where: { id: scanSession.id },
          data: {
            scannedFiles,
            progress
          }
        })

      } catch (error) {
        console.error(`Error scanning file ${filePath}:`, error)
        // Continue with other files
      }
    }

    // Complete the scan session
    await prisma.scanSession.update({
      where: { id: scanSession.id },
      data: {
        status: 'completed',
        progress: 1.0,
        scannedFiles,
        findingsCount: results.length,
        completedAt: new Date()
      }
    })

    // Create activity log
    await prisma.activity.create({
      data: {
        action: 'quick_scan_completed',
        description: `Quick scan completed: ${results.length} findings in ${scannedFiles} files`,
        userId
      }
    })

    revalidatePath('/discovery-scanner')
    return results

  } catch (error) {
    console.error('Quick scan failed:', error)
    throw new Error('Scan failed. Please try again.')
  }
}

// Get recent scan sessions
export async function getScanSessions(): Promise<ScanSessionInfo[]> {
  const userId = await requireUserId()

  const sessions = await prisma.scanSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  return sessions.map(s => ({
    id: s.id,
    name: s.name,
    status: s.status,
    progress: s.progress,
    totalFiles: s.totalFiles,
    scannedFiles: s.scannedFiles,
    findingsCount: s.findingsCount,
    createdAt: s.createdAt,
    completedAt: s.completedAt ?? undefined
  }))
}

// Get findings for a specific scan session
export async function getScanFindings(sessionId: string) {
  const userId = await requireUserId()

  const findings = await prisma.localScanFinding.findMany({
    where: { 
      sessionId,
      userId 
    },
    orderBy: [
      { severity: 'desc' },
      { confidence: 'desc' },
      { createdAt: 'desc' }
    ]
  })

  return findings.map(f => ({
    id: f.id,
    filePath: f.relativePath,
    fileName: f.fileName,
    lineNumber: f.lineNumber,
    keyPreview: f.keyPreview,
    keyType: f.keyType,
    patternName: f.patternName,
    severity: f.severity,
    confidence: f.confidence,
    riskLevel: f.riskLevel,
    status: f.status,
    notes: f.notes,
    createdAt: f.createdAt
  }))
}

// Update finding status (mark as fixed, ignored, etc.)
export async function updateFindingStatus(
  findingId: string, 
  status: 'active' | 'fixed' | 'ignored' | 'false_positive',
  notes?: string
) {
  const userId = await requireUserId()

  await prisma.localScanFinding.update({
    where: { 
      id: findingId,
      userId // Ensure user owns this finding
    },
    data: {
      status,
      notes,
      fixedAt: status === 'fixed' ? new Date() : null
    }
  })

  // Create activity log
  await prisma.activity.create({
    data: {
      action: 'finding_status_updated',
      description: `Scan finding marked as ${status}${notes ? ` with notes: ${notes}` : ''}`,
      userId
    }
  })

  revalidatePath('/discovery-scanner')
}

// Run a deep scan of the entire project
export async function runDeepScan(targetPath?: string): Promise<{ sessionId: string }> {
  const userId = await requireUserId()

  const scanPath = targetPath || process.cwd()

  // Create a scan session
  const scanSession = await prisma.scanSession.create({
    data: {
      name: 'Deep Scan',
      scanType: 'deep',
      targetPath: scanPath,
      status: 'pending',
      userId,
      includeHidden: true,
      maxDepth: null, // No depth limit for deep scan
      excludePaths: ['node_modules', '.git', 'vendor', 'target', 'bin', 'obj']
    }
  })

  // TODO: Implement background processing for deep scans
  // For now, return the session ID so the UI can show it's pending
  
  return { sessionId: scanSession.id }
}