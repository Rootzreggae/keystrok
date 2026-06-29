import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/summary - Returns a comprehensive dashboard summary
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get all keys for detailed analysis
    const discoveredKeys = await prisma.discoveredKey.findMany({
      where: {
        userId: userId,
        status: { not: 'false_positive' }
      },
      include: {
        platformRef: true
      },
      orderBy: [
        { severity: 'desc' },
        { foundAt: 'desc' }
      ]
    })

    // Get platforms
    const platforms = await prisma.platform.findMany({
      where: {
        userId: userId
      }
    })

    // Calculate key status distribution
    const keysByStatus = {
      active: discoveredKeys.filter(k => k.status === 'active').length,
      rotated: discoveredKeys.filter(k => k.status === 'rotated').length,
      revoked: discoveredKeys.filter(k => k.status === 'revoked').length,
      ignored: discoveredKeys.filter(k => k.status === 'ignored').length
    }

    // Calculate severity distribution
    const keysBySeverity = {
      critical: discoveredKeys.filter(k => k.severity === 'critical').length,
      high: discoveredKeys.filter(k => k.severity === 'high').length,
      medium: discoveredKeys.filter(k => k.severity === 'medium').length,
      low: discoveredKeys.filter(k => k.severity === 'low').length
    }

    // Calculate platform distribution
    const keysByPlatform = platforms.map(platform => {
      const platformKeys = discoveredKeys.filter(k => k.platformId === platform.id)
      return {
        platform: platform.name,
        type: platform.type,
        total: platformKeys.length,
        critical: platformKeys.filter(k => k.severity === 'critical').length,
        high: platformKeys.filter(k => k.severity === 'high').length,
        medium: platformKeys.filter(k => k.severity === 'medium').length,
        low: platformKeys.filter(k => k.severity === 'low').length
      }
    }).filter(p => p.total > 0)

    // Recent activity summary
    const recentActivity = await prisma.activity.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // Key age analysis (days since discovery)
    const now = new Date()
    const keyAgeAnalysis = discoveredKeys.map(key => {
      const daysOld = Math.floor((now.getTime() - key.foundAt.getTime()) / (1000 * 60 * 60 * 24))
      return {
        keyId: key.id,
        daysOld,
        severity: key.severity,
        status: key.status,
        hasBeenRotated: !!key.rotatedAt
      }
    })

    const summary = {
      overview: {
        totalKeys: discoveredKeys.length,
        totalPlatforms: platforms.length,
        activeKeys: keysByStatus.active,
        rotatedKeys: keysByStatus.rotated,
        criticalAlerts: keysBySeverity.critical + keysBySeverity.high
      },
      distribution: {
        byStatus: keysByStatus,
        bySeverity: keysBySeverity,
        byPlatform: keysByPlatform
      },
      insights: {
        oldestKey: keyAgeAnalysis.length > 0 
          ? Math.max(...keyAgeAnalysis.map(k => k.daysOld)) 
          : 0,
        averageKeyAge: keyAgeAnalysis.length > 0 
          ? Math.round(keyAgeAnalysis.reduce((sum, k) => sum + k.daysOld, 0) / keyAgeAnalysis.length)
          : 0,
        rotationRate: discoveredKeys.length > 0 
          ? Math.round((keysByStatus.rotated / discoveredKeys.length) * 100)
          : 0,
        unrotatedCritical: discoveredKeys.filter(k => 
          (k.severity === 'critical' || k.severity === 'high') && 
          k.status === 'active'
        ).length
      },
      activity: {
        recentCount: recentActivity.length,
        totalActivity: await prisma.activity.count({ where: { userId } })
      }
    }

    return NextResponse.json({
      success: true,
      data: summary
    })

  } catch (error) {
    console.error('Error fetching dashboard summary:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}