import { prisma } from '@/lib/prisma'

export interface FindingFilters {
  sessionId?: string | null
  severity?: string | null
  status?: string | null
  keyType?: string | null
  limit?: number
  offset?: number
}

// Scan findings (count + page) in client shape, shared by BOTH the
// /api/discovery/results route and the server-side prefetch so the two can
// never drift. Caller ensures auth and validates filter values.
export async function getFindings(filters: FindingFilters = {}) {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  // Build the where clause for filtering (shared workspace: no userId filter)
  const whereClause: Record<string, string> = {}
  if (filters.sessionId) whereClause.sessionId = filters.sessionId
  if (filters.severity) whereClause.severity = filters.severity
  if (filters.status) whereClause.status = filters.status
  if (filters.keyType) whereClause.keyType = filters.keyType

  // Count + page in one round-trip (remote DB, serial queries add up)
  const [totalCount, findings] = await Promise.all([
    prisma.localScanFinding.count({
      where: whereClause
    }),
    prisma.localScanFinding.findMany({
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
  ])

  // Transform findings to match the client shape
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

  return { totalCount, findings: transformedFindings }
}
