import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isOperator } from '@/lib/github'
import { prisma } from '@/lib/prisma'
import { SecurityScanner } from '@/lib/scanner/core'
import { convertFindingToLocalScanFindingData, SCANNER_PRESETS } from '@/lib/scanner/index'
import type { Finding, ScanResult, ScanOptions, FileInfo, FileScanResult } from '@/lib/scanner/types'
import { hashKey, hashIdentifier, maskApiKey, estimateKeyType, classifyKeyFormat } from '@/lib/crypto'
import path from 'path'
import os from 'os'

// Types for request validation
interface ScanRequestBody {
  name: string
  scanType: 'quick' | 'deep' | 'full'
  options: {
    git_repositories: boolean
    environment_files: boolean
    configuration_files: boolean
    docker_files: boolean
    source_code: boolean
  }
  targetPath?: string
  keyTypes?: string[]
}

interface ScanResponse {
  success: boolean
  sessionId?: string
  status?: 'running'
  message: string
  error?: string
}

// Security validation helpers
function validateScanPath(targetPath: string): { isValid: boolean; normalizedPath: string; error?: string } {
  try {
    // Expand a leading ~ to the user's home directory (path.resolve won't).
    const expanded = targetPath.replace(/^~(?=$|[/\\])/, os.homedir())
    // Normalize and resolve the path
    const normalizedPath = path.resolve(expanded)

    // Security checks to prevent directory traversal and system access
    const userHome = os.homedir()
    const isInUserHome = normalizedPath.startsWith(userHome)

    // Block access to sensitive system directories
    const blockedPaths = [
      '/etc',
      '/var',
      '/usr',
      '/opt',
      '/bin',
      '/sbin',
      '/boot',
      '/dev',
      '/proc',
      '/sys',
      '/tmp',
      path.join(userHome, '.ssh'),
      path.join(userHome, '.aws'),
      path.join(userHome, '.config'),
      path.join(userHome, 'Library'),
      path.join(userHome, 'Applications')
    ]

    for (const blockedPath of blockedPaths) {
      if (normalizedPath.startsWith(blockedPath)) {
        return {
          isValid: false,
          normalizedPath,
          error: `Access to system directories is not allowed: ${blockedPath}`
        }
      }
    }

    // Require path to be in user's home directory or Documents folder
    const documentsPath = path.join(userHome, 'Documents')
    const desktopPath = path.join(userHome, 'Desktop')

    if (!isInUserHome && !normalizedPath.startsWith(documentsPath) && !normalizedPath.startsWith(desktopPath)) {
      return {
        isValid: false,
        normalizedPath,
        error: 'Scan path must be within your user directory'
      }
    }

    return { isValid: true, normalizedPath }
  } catch (error) {
    return {
      isValid: false,
      normalizedPath: targetPath,
      error: `Invalid path: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

function validateScanRequest(body: any): { isValid: boolean; data?: ScanRequestBody; errors: string[] } {
  const errors: string[] = []

  // Required fields
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push('Scan name is required and must be a non-empty string')
  }

  if (!body.scanType || !['quick', 'deep', 'full'].includes(body.scanType)) {
    errors.push('Scan type must be one of: quick, deep, full')
  }

  if (!body.options || typeof body.options !== 'object') {
    errors.push('Scan options are required')
  } else {
    const requiredOptions = ['git_repositories', 'environment_files', 'configuration_files', 'docker_files', 'source_code']
    for (const option of requiredOptions) {
      if (typeof body.options[option] !== 'boolean') {
        errors.push(`Option ${option} must be a boolean`)
      }
    }
  }

  // Optional fields validation
  if (body.targetPath && typeof body.targetPath !== 'string') {
    errors.push('Target path must be a string if provided')
  }

  if (body.keyTypes && (!Array.isArray(body.keyTypes) || !body.keyTypes.every((t: any) => typeof t === 'string'))) {
    errors.push('Key types must be an array of strings if provided')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    data: body as ScanRequestBody,
    errors: []
  }
}

// Background scan processing
async function processScanInBackground(sessionId: string, userId: string, config: ScanRequestBody) {
  try {
    console.log(`[SCAN ${sessionId}] Starting background scan processing`)

    // Update scan status to running
    await prisma.scanSession.update({
      where: { id: sessionId },
      data: { status: 'running' }
    })

    // Determine target path
    const targetPath = config.targetPath || path.join(os.homedir(), 'Documents')

    // Validate path again
    const pathValidation = validateScanPath(targetPath)
    if (!pathValidation.isValid) {
      throw new Error(pathValidation.error)
    }

    // Configure advanced scanner based on options and scan type
    let scannerPreset: keyof typeof SCANNER_PRESETS = 'BALANCED'
    switch (config.scanType) {
      case 'quick':
        scannerPreset = 'QUICK'
        break
      case 'deep':
        scannerPreset = 'BALANCED'
        break
      case 'full':
        scannerPreset = 'THOROUGH'
        break
    }

    // Create scanner with appropriate preset
    const scanner = new SecurityScanner(SCANNER_PRESETS[scannerPreset])

    // Build file extensions filter based on options
    let fileExtensions: string[] | undefined = undefined
    if (!config.options.source_code) {
      fileExtensions = ['.env', '.yml', '.yaml', '.json', '.conf', '.config', '.ini']
    } else if (config.options.source_code && !config.options.environment_files && !config.options.configuration_files) {
      // Only source code
      fileExtensions = [
        '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
        '.py', '.pyc', '.pyw', '.pyo',
        '.rb', '.rbw',
        '.php', '.php3', '.php4', '.php5', '.phtml',
        '.go', '.mod', '.sum',
        '.java', '.class',
        '.cs', '.vb', '.fs',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd'
      ]
    }

    // Build exclusion paths
    const excludePaths = ['node_modules', '.git', 'build', 'dist', '.next', 'coverage']
    if (!config.options.environment_files) {
      excludePaths.push('.env', '.env.local', '.env.production', '.env.development')
    }
    if (!config.options.docker_files) {
      excludePaths.push('Dockerfile', 'docker-compose.yml', 'docker-compose.yaml')
    }

    // Set up progress tracking
    let totalFiles = 0
    let scannedFiles = 0
    let findingsCount = 0

    // Set up progress callback
    scanner.on('progress', async (progress) => {
      totalFiles = progress.totalFiles
      scannedFiles = progress.scannedFiles
      findingsCount = progress.findingsCount

      // Update database with progress
      await prisma.scanSession.update({
        where: { id: sessionId },
        data: {
          progress: progress.progress,
          totalFiles: totalFiles,
          scannedFiles: scannedFiles,
          findingsCount: findingsCount
        }
      }).catch(err => {
        console.error(`[SCAN ${sessionId}] Failed to update progress:`, err)
      })
    })

    // Map the request scan type to the scanner's ScanOptions scan type.
    // The scanner drives behavior off the preset/maxDepth, not this field, and
    // it has no 'full' value; 'full' corresponds to the deepest 'deep' scan.
    const scannerScanType: ScanOptions['scanType'] =
      config.scanType === 'full' ? 'deep' : config.scanType

    // Prepare scan options
    const scanOptions: ScanOptions = {
      targetPath: pathValidation.normalizedPath,
      scanType: scannerScanType,
      includeHidden: false,
      maxDepth: scannerPreset === 'QUICK' ? 3 : scannerPreset === 'BALANCED' ? 6 : 10,
      fileExtensions,
      excludePaths,
      keyTypes: config.keyTypes?.length ? config.keyTypes : [
        'grafana_service_account', 'grafana_api_key',
        'datadog_api', 'datadog_app',
        'newrelic_api', 'newrelic_license',
        'aws_access_key', 'aws_secret_key',
        'stripe_secret_live', 'stripe_secret_test',
        'github_pat'
      ]
    }

    console.log(`[SCAN ${sessionId}] Starting advanced security scan with options:`, {
      targetPath: scanOptions.targetPath,
      scanType: scanOptions.scanType,
      maxDepth: scanOptions.maxDepth,
      preset: scannerPreset,
      keyTypesCount: scanOptions.keyTypes?.length || 0
    })

    const result: ScanResult = await scanner.scanDirectory(scanOptions)
    console.log(`[SCAN ${sessionId}] Scan completed successfully:`, {
      totalFiles: result.totalFiles,
      scannedFiles: result.scannedFiles,
      findingsCount: result.findings.length,
      status: result.status
    })

    // Process findings and save to database
    const processedFindings = await processScanFindings(sessionId, userId, result.findings, result.fileScans)

    // Mark scan as completed
    await prisma.scanSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        progress: 1.0,
        findingsCount: processedFindings.length
      }
    })

    console.log(`[SCAN ${sessionId}] Background processing completed successfully`)

  } catch (error) {
    console.error(`[SCAN ${sessionId}] Background processing failed:`, error)

    // Mark scan as failed
    await prisma.scanSession.update({
      where: { id: sessionId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      }
    })
  }
}

// Process scan findings and store in database
async function processScanFindings(sessionId: string, userId: string, findings: Finding[], fileScans: FileScanResult[]) {
  const processedFindings = []

  // Index per-file info by absolute path. Findings carry only flat location
  // fields (filePath/relativePath/fileName); file size, permissions, git status
  // and file classification live on the FileInfo of the per-file scan result.
  // finding.filePath equals fileInfo.absolutePath, so it's the lookup key.
  const fileInfoByPath = new Map<string, FileInfo>()
  for (const fileScan of fileScans) {
    fileInfoByPath.set(fileScan.fileInfo.absolutePath, fileScan.fileInfo)
  }

  for (const finding of findings) {
    const fileInfo = fileInfoByPath.get(finding.filePath)
    try {
      // Create a unique identifier for this finding for deduplication.
      // Deterministic hash (no salt) so the same finding hashes the same way on
      // every scan, the salted hashKey() minted a fresh hash each time, which
      // defeated dedup and duplicated findings on every re-scan.
      const findingIdentifier = `${finding.filePath}:${finding.lineNumber}:${finding.detectionRule}:${finding.keyPreview}`
      const keyHash = hashIdentifier(findingIdentifier)
      const salt = ''

      // Check if we already have this key hash (deduplication)
      let keyHashRecord = await prisma.keyHash.findUnique({
        where: { keyHash }
      })

      if (!keyHashRecord) {
        // Create new key hash record
        keyHashRecord = await prisma.keyHash.create({
          data: {
            keyHash,
            hashSalt: salt,
            keyType: finding.keyType,
            keyFormat: classifyKeyFormat(finding.keyPreview),
            estimatedLength: finding.keyPreview.length,
            userId,
            seenCount: 1
          }
        })
      } else {
        // Update existing key hash record
        await prisma.keyHash.update({
          where: { id: keyHashRecord.id },
          data: {
            lastSeenAt: new Date(),
            seenCount: { increment: 1 }
          }
        })
      }

      // Create or find existing file scan record
      let fileScan = await prisma.fileScan.findFirst({
        where: {
          sessionId,
          absolutePath: finding.filePath
        }
      })

      if (!fileScan) {
        fileScan = await prisma.fileScan.create({
          data: {
            sessionId,
            userId,
            absolutePath: finding.filePath,
            relativePath: finding.relativePath,
            fileName: finding.fileName,
            fileExtension: path.extname(finding.fileName) || null,
            fileSize: BigInt(fileInfo?.fileSize || 0),
            fileHash: 'placeholder-hash', // Would calculate actual file hash
            lastModified: fileInfo?.lastModified || new Date(),
            permissions: fileInfo?.permissions || '644',
            isGitTracked: fileInfo?.isGitTracked || false,
            linesScanned: 1,
            findingsCount: 1,
            hasFindings: true,
            scanCompletedAt: new Date(),
            isEnvFile: finding.isInEnvFile,
            isConfigFile: fileInfo?.isConfigFile || false,
            isCodeFile: fileInfo?.isCodeFile || false
          }
        })
      } else {
        // Update existing file scan with new findings count
        await prisma.fileScan.update({
          where: { id: fileScan.id },
          data: {
            findingsCount: { increment: 1 }
          }
        })
      }

      // Create local scan finding using the converter helper
      const localFindingData = convertFindingToLocalScanFindingData(
        finding,
        sessionId,
        userId,
        fileScan.id,
        keyHashRecord.id
      )

      // Reconcile against an existing finding with the same identity so a
      // re-scan refreshes it in place instead of inserting a duplicate. The
      // existing row's triage status (dismissed/promoted) is preserved, we
      // only relink it to this scan and refresh the surrounding context.
      const existing = await prisma.localScanFinding.findFirst({
        where: {
          userId,
          filePath: finding.filePath,
          lineNumber: finding.lineNumber,
          detectionRule: finding.detectionRule,
          keyPreview: finding.keyPreview,
        },
        select: { id: true },
      })

      const localFinding = existing
        ? await prisma.localScanFinding.update({
            where: { id: existing.id },
            data: {
              sessionId,
              fileScanId: fileScan.id,
              keyHashId: keyHashRecord.id,
              lineContent: finding.lineContent,
              relativePath: finding.relativePath,
            },
          })
        : await prisma.localScanFinding.create({ data: localFindingData })

      processedFindings.push(localFinding)

    } catch (error) {
      console.error(`[SCAN ${sessionId}] Failed to process finding:`, finding, error)
    }
  }

  return processedFindings
}

// GET endpoint to retrieve scan sessions
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build query conditions
    const where: any = { userId }
    if (status && ['pending', 'running', 'completed', 'failed'].includes(status)) {
      where.status = status
    }

    const scanSessions = await prisma.scanSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to recent 50 scans
      select: {
        id: true,
        name: true,
        scanType: true,
        status: true,
        progress: true,
        findingsCount: true,
        totalFiles: true,
        scannedFiles: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true
      }
    })

    return NextResponse.json({
      success: true,
      data: scanSessions
    })

  } catch (error) {
    console.error('Error fetching scan sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Main API endpoint
export async function POST(request: NextRequest): Promise<NextResponse<ScanResponse>> {
  try {
    // Authentication check
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // This scans the SERVER's filesystem (home dir), so it's operator-only.
    // A non-owner allowlisted user must not enumerate the host's files. The
    // per-user, client-supplied paths (scan-files) and GitHub clones stay open.
    if (!(await isOperator(userId))) {
      return NextResponse.json(
        { success: false, message: 'Forbidden', error: 'Only the instance operator can scan the server filesystem' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = validateScanRequest(body)

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request',
          error: validation.errors.join(', ')
        },
        { status: 400 }
      )
    }

    const scanConfig = validation.data!

    // Validate target path if provided
    const targetPath = scanConfig.targetPath || path.join(os.homedir(), 'Documents')
    const pathValidation = validateScanPath(targetPath)

    if (!pathValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid scan path',
          error: pathValidation.error
        },
        { status: 400 }
      )
    }

    // Create scan session in database
    const scanSession = await prisma.scanSession.create({
      data: {
        name: scanConfig.name.trim(),
        scanType: scanConfig.scanType,
        targetPath: pathValidation.normalizedPath,
        status: 'pending',
        progress: 0,
        includeHidden: false,
        maxDepth: scanConfig.scanType === 'quick' ? 3 : scanConfig.scanType === 'deep' ? 8 : null,
        fileExtensions: scanConfig.options.source_code ? [] : ['.env', '.yml', '.yaml', '.json'],
        excludePaths: ['node_modules', '.git', 'build', 'dist'],
        keyTypes: scanConfig.keyTypes || [],
        userId
      }
    })

    // Start background processing (non-blocking)
    setImmediate(() => {
      processScanInBackground(scanSession.id, userId, scanConfig).catch(error => {
        console.error(`[SCAN ${scanSession.id}] Failed to start background processing:`, error)
      })
    })

    // Return immediate response
    return NextResponse.json({
      success: true,
      sessionId: scanSession.id,
      status: 'running' as const,
      message: `Scan "${scanConfig.name}" started successfully. The scan is now running in the background.`
    })

  } catch (error) {
    console.error('Error starting discovery scan:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}