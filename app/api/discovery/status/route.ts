import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Types for query parameters
interface StatusQuery {
  sessionId?: string
  active?: boolean
}

// Response types
interface ScanStatusResponse {
  success: boolean
  currentScan: ScanStatusData | null
  recentScans?: RecentScanData[]
  error?: string
}

interface ScanStatusData {
  sessionId: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  totalFiles: number
  scannedFiles: number
  findingsCount: number
  startedAt: string
  estimatedCompletion?: string
  scanType: string
  targetPath: string
}

interface RecentScanData {
  sessionId: string
  name: string
  status: string
  completedAt: string
  findingsCount: number
}

// Helper function to estimate completion time
function estimateCompletion(
  startedAt: Date,
  progress: number,
  status: string
): string | undefined {
  if (status !== 'running' || progress <= 0) {
    return undefined
  }

  try {
    const now = new Date()
    const elapsed = now.getTime() - startedAt.getTime()
    const totalEstimated = elapsed / progress
    const remaining = totalEstimated - elapsed

    if (remaining <= 0) {
      return undefined
    }

    const completionTime = new Date(now.getTime() + remaining)
    return completionTime.toISOString()
  } catch (error) {
    return undefined
  }
}

// Helper function to validate query parameters
function parseQueryParams(searchParams: URLSearchParams): StatusQuery {
  const sessionId = searchParams.get('sessionId') || undefined
  const activeParam = searchParams.get('active')
  const active = activeParam !== null ? activeParam === 'true' : true

  return { sessionId, active }
}

// GET endpoint to check scan status
export async function GET(request: NextRequest): Promise<NextResponse<ScanStatusResponse>> {
  try {
    // Authentication check
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, currentScan: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const query = parseQueryParams(searchParams)

    // Handle specific session ID query
    if (query.sessionId) {
      const scanSession = await prisma.scanSession.findFirst({
        where: {
          id: query.sessionId,
          userId // Ensure user can only access their own scans
        },
        select: {
          id: true,
          name: true,
          scanType: true,
          targetPath: true,
          status: true,
          progress: true,
          totalFiles: true,
          scannedFiles: true,
          findingsCount: true,
          createdAt: true,
          completedAt: true,
          errorMessage: true
        }
      })

      if (!scanSession) {
        return NextResponse.json(
          {
            success: false,
            currentScan: null,
            error: 'Scan session not found or access denied'
          },
          { status: 404 }
        )
      }

      const scanData: ScanStatusData = {
        sessionId: scanSession.id,
        name: scanSession.name,
        status: scanSession.status as ScanStatusData['status'],
        progress: scanSession.progress,
        totalFiles: scanSession.totalFiles,
        scannedFiles: scanSession.scannedFiles,
        findingsCount: scanSession.findingsCount,
        startedAt: scanSession.createdAt.toISOString(),
        estimatedCompletion: estimateCompletion(
          scanSession.createdAt,
          scanSession.progress,
          scanSession.status
        ),
        scanType: scanSession.scanType,
        targetPath: scanSession.targetPath
      }

      return NextResponse.json({
        success: true,
        currentScan: scanData
      })
    }

    // Handle active/recent scans query
    if (query.active) {
      // Get current active scan (most recent running or pending scan)
      const activeScan = await prisma.scanSession.findFirst({
        where: {
          userId,
          status: {
            in: ['pending', 'running']
          }
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          scanType: true,
          targetPath: true,
          status: true,
          progress: true,
          totalFiles: true,
          scannedFiles: true,
          findingsCount: true,
          createdAt: true,
          completedAt: true,
          errorMessage: true
        }
      })

      let currentScan: ScanStatusData | null = null
      if (activeScan) {
        currentScan = {
          sessionId: activeScan.id,
          name: activeScan.name,
          status: activeScan.status as ScanStatusData['status'],
          progress: activeScan.progress,
          totalFiles: activeScan.totalFiles,
          scannedFiles: activeScan.scannedFiles,
          findingsCount: activeScan.findingsCount,
          startedAt: activeScan.createdAt.toISOString(),
          estimatedCompletion: estimateCompletion(
            activeScan.createdAt,
            activeScan.progress,
            activeScan.status
          ),
          scanType: activeScan.scanType,
          targetPath: activeScan.targetPath
        }
      }

      // Get recent completed scans for context
      const recentScans = await prisma.scanSession.findMany({
        where: {
          userId,
          status: {
            in: ['completed', 'failed', 'cancelled']
          }
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          completedAt: true,
          findingsCount: true
        }
      })

      const recentScansData: RecentScanData[] = recentScans.map(scan => ({
        sessionId: scan.id,
        name: scan.name,
        status: scan.status,
        completedAt: scan.completedAt?.toISOString() || '',
        findingsCount: scan.findingsCount
      }))

      return NextResponse.json({
        success: true,
        currentScan,
        recentScans: recentScansData
      })
    }

    // Default: return all recent scans (both active and completed)
    const allRecentScans = await prisma.scanSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        scanType: true,
        targetPath: true,
        status: true,
        progress: true,
        totalFiles: true,
        scannedFiles: true,
        findingsCount: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true
      }
    })

    // Find the most recent active scan
    const activeScan = allRecentScans.find(scan =>
      scan.status === 'pending' || scan.status === 'running'
    )

    let currentScan: ScanStatusData | null = null
    if (activeScan) {
      currentScan = {
        sessionId: activeScan.id,
        name: activeScan.name,
        status: activeScan.status as ScanStatusData['status'],
        progress: activeScan.progress,
        totalFiles: activeScan.totalFiles,
        scannedFiles: activeScan.scannedFiles,
        findingsCount: activeScan.findingsCount,
        startedAt: activeScan.createdAt.toISOString(),
        estimatedCompletion: estimateCompletion(
          activeScan.createdAt,
          activeScan.progress,
          activeScan.status
        ),
        scanType: activeScan.scanType,
        targetPath: activeScan.targetPath
      }
    }

    // Recent completed scans
    const completedScans = allRecentScans
      .filter(scan => scan.status === 'completed' || scan.status === 'failed' || scan.status === 'cancelled')
      .slice(0, 5)

    const recentScansData: RecentScanData[] = completedScans.map(scan => ({
      sessionId: scan.id,
      name: scan.name,
      status: scan.status,
      completedAt: scan.completedAt?.toISOString() || '',
      findingsCount: scan.findingsCount
    }))

    return NextResponse.json({
      success: true,
      currentScan,
      recentScans: recentScansData
    })

  } catch (error) {
    console.error('Error fetching scan status:', error)
    return NextResponse.json(
      {
        success: false,
        currentScan: null,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// POST endpoint for future scan control operations (pause, cancel, etc.)
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authentication check
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()
    const { sessionId, action } = body

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    if (!action || !['cancel', 'pause', 'resume'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid action is required (cancel, pause, resume)' },
        { status: 400 }
      )
    }

    // Verify user owns the scan session
    const scanSession = await prisma.scanSession.findFirst({
      where: {
        id: sessionId,
        userId
      }
    })

    if (!scanSession) {
      return NextResponse.json(
        { success: false, error: 'Scan session not found or access denied' },
        { status: 404 }
      )
    }

    // Handle different actions
    switch (action) {
      case 'cancel':
        if (scanSession.status === 'pending' || scanSession.status === 'running') {
          await prisma.scanSession.update({
            where: { id: sessionId },
            data: {
              status: 'cancelled',
              completedAt: new Date()
            }
          })
          return NextResponse.json({
            success: true,
            message: 'Scan cancelled successfully'
          })
        } else {
          return NextResponse.json(
            { success: false, error: 'Scan cannot be cancelled in current state' },
            { status: 400 }
          )
        }

      case 'pause':
        // Pause functionality would be implemented in the future
        return NextResponse.json(
          { success: false, error: 'Pause functionality not yet implemented' },
          { status: 501 }
        )

      case 'resume':
        // Resume functionality would be implemented in the future
        return NextResponse.json(
          { success: false, error: 'Resume functionality not yet implemented' },
          { status: 501 }
        )

      default:
        return NextResponse.json(
          { success: false, error: 'Unsupported action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error controlling scan:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}