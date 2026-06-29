import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/stats - Returns current percentages and metrics
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get total keys discovered
    const totalKeysDiscovered = await prisma.discoveredKey.count({
      where: {
        userId: userId,
        status: { not: 'false_positive' } // Exclude false positives
      }
    })

    // Get platforms configured
    const platformsConfigured = await prisma.platform.count({
      where: {
        userId: userId
      }
    })

    // Get critical alerts (high and critical severity keys that are active)
    const criticalAlerts = await prisma.discoveredKey.count({
      where: {
        userId: userId,
        severity: { in: ['critical', 'high'] },
        status: 'active'
      }
    })

    // Calculate security score based on various factors
    const activeHighRiskKeys = await prisma.discoveredKey.count({
      where: {
        userId: userId,
        severity: { in: ['critical', 'high'] },
        status: 'active'
      }
    })

    const rotatedKeys = await prisma.discoveredKey.count({
      where: {
        userId: userId,
        status: 'rotated'
      }
    })

    const ignoredKeys = await prisma.discoveredKey.count({
      where: {
        userId: userId,
        status: 'ignored'
      }
    })

    // Security score algorithm:
    // Start with 100, subtract points for security issues
    let securityScore = 100

    // Subtract 20 points for each active critical key
    const criticalKeys = await prisma.discoveredKey.count({
      where: {
        userId: userId,
        severity: 'critical',
        status: 'active'
      }
    })
    securityScore -= criticalKeys * 20

    // Subtract 10 points for each active high severity key
    const highSeverityKeys = await prisma.discoveredKey.count({
      where: {
        userId: userId,
        severity: 'high',
        status: 'active'
      }
    })
    securityScore -= highSeverityKeys * 10

    // Subtract 5 points for each active medium severity key
    const mediumSeverityKeys = await prisma.discoveredKey.count({
      where: {
        userId: userId,
        severity: 'medium',
        status: 'active'
      }
    })
    securityScore -= mediumSeverityKeys * 5

    // Add bonus points for good practices
    if (rotatedKeys > 0) securityScore += Math.min(10, rotatedKeys * 2) // Max 10 bonus points
    if (platformsConfigured > 0) securityScore += Math.min(5, platformsConfigured) // Max 5 bonus points

    // Ensure score stays within bounds
    securityScore = Math.max(0, Math.min(100, securityScore))

    const stats = {
      securityScore,
      totalKeysDiscovered,
      platformsConfigured,
      criticalAlerts
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}