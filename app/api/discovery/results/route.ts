import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/discovery/results - Fetch scan results and findings
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Extract and validate query parameters
    const sessionId = searchParams.get('sessionId')
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const keyType = searchParams.get('keyType')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    // Validate and set defaults for numeric parameters
    let limit = 50
    let offset = 0

    if (limitParam) {
      const parsedLimit = parseInt(limitParam)
      if (isNaN(parsedLimit)) {
        return NextResponse.json(
          { error: 'Invalid limit parameter. Must be a number between 1 and 100' },
          { status: 400 }
        )
      }
      limit = Math.min(Math.max(parsedLimit, 1), 100)
    }

    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam)
      if (isNaN(parsedOffset)) {
        return NextResponse.json(
          { error: 'Invalid offset parameter. Must be a non-negative number' },
          { status: 400 }
        )
      }
      offset = Math.max(parsedOffset, 0)
    }

    // Validate filter values
    const validSeverities = ['critical', 'high', 'medium', 'low']
    const validStatuses = ['active', 'dismissed', 'resolved', 'false_positive', 'in_rotation']

    if (severity && !validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: 'Invalid severity. Must be one of: critical, high, medium, low' },
        { status: 400 }
      )
    }

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: active, dismissed, resolved, false_positive, in_rotation' },
        { status: 400 }
      )
    }

    // Validate sessionId if provided (shared workspace: look up by id only)
    if (sessionId) {
      const sessionExists = await prisma.scanSession.findFirst({
        where: {
          id: sessionId
        }
      })

      if (!sessionExists) {
        return NextResponse.json(
          { error: 'Scan session not found or access denied' },
          { status: 404 }
        )
      }
    }

    // Build the where clause for filtering (shared workspace: no userId filter)
    const whereClause: any = {}

    if (sessionId) whereClause.sessionId = sessionId
    if (severity) whereClause.severity = severity
    if (status) whereClause.status = status
    if (keyType) whereClause.keyType = keyType

    // Get total count for pagination
    const totalCount = await prisma.localScanFinding.count({
      where: whereClause
    })

    // Fetch findings with related data
    const findings = await prisma.localScanFinding.findMany({
      where: whereClause,
      include: {
        session: {
          select: {
            id: true,
            name: true,
            completedAt: true,
            status: true
          }
        },
        fileScan: {
          select: {
            id: true,
            fileName: true,
            fileExtension: true,
            isEnvFile: true,
            isConfigFile: true,
            isCodeFile: true
          }
        },
        keyHash: {
          select: {
            id: true,
            keyType: true,
            seenCount: true,
            isRevoked: true
          }
        }
      },
      orderBy: [
        { severity: 'asc' }, // Critical first
        { createdAt: 'desc' }
      ],
      skip: offset,
      take: limit
    })

    // Transform findings to match the required response format
    const transformedFindings = findings.map(finding => ({
      id: finding.id,
      filePath: finding.relativePath || finding.filePath,
      lineNumber: finding.lineNumber,
      keyType: finding.keyType,
      platform: finding.keyType.split('_')[0] || 'unknown', // Extract platform from keyType (e.g., 'aws' from 'aws_access')
      severity: finding.severity,
      confidence: finding.confidence,
      keyPreview: finding.keyPreview,
      status: finding.status,
      isLikelyActive: finding.isLikelyActive,
      createdAt: finding.createdAt.toISOString(),

      // Additional context
      fileName: finding.fileName,
      lineContent: finding.lineContent,
      detectionRule: finding.detectionRule,
      patternName: finding.patternName,
      riskLevel: finding.riskLevel,

      // File context
      isEnvFile: finding.isInEnvFile,
      isConfigFile: finding.fileScan?.isConfigFile || false,
      isCodeFile: finding.fileScan?.isCodeFile || false,
      isInComment: finding.isInComment,
      isTestKey: finding.isTestKey,
      isExampleKey: finding.isExampleKey,

      // Validation and deduplication info
      isValidated: finding.isValidated,
      seenCount: finding.keyHash?.seenCount || 1,
      isRevoked: finding.keyHash?.isRevoked || false
    }))

    // Get session metadata if sessionId provided
    let sessionMetadata = null
    if (sessionId) {
      sessionMetadata = await prisma.scanSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          name: true,
          completedAt: true,
          status: true,
          findingsCount: true,
          totalFiles: true,
          scannedFiles: true
        }
      })
    }

    // Calculate pagination metadata
    const hasMore = offset + limit < totalCount

    const response = {
      success: true,
      results: {
        sessionId: sessionId,
        sessionName: sessionMetadata?.name || null,
        sessionStatus: sessionMetadata?.status || null,
        completedAt: sessionMetadata?.completedAt?.toISOString() || null,
        totalFiles: sessionMetadata?.totalFiles || null,
        scannedFiles: sessionMetadata?.scannedFiles || null,
        findings: transformedFindings
      },
      pagination: {
        total: totalCount,
        limit: limit,
        offset: offset,
        hasMore: hasMore,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit)
      },
      filters: {
        sessionId,
        severity,
        status,
        keyType
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching scan results:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}