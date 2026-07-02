import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/platforms/risk-distribution - Returns risk distribution by platform
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all platforms for the instance (shared workspace)
    const platforms = await prisma.platform.findMany({
      where: {}
    })

    // If no platforms, return empty result (no more mock data!)
    if (platforms.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Get risk distribution for each platform
    const riskDistribution = await Promise.all(
      platforms.map(async (platform) => {
        // Count keys by severity for this platform
        const [high, medium, low] = await Promise.all([
          prisma.discoveredKey.count({
            where: {
              platformId: platform.id,
              severity: 'high',
              status: 'active'
            }
          }),
          prisma.discoveredKey.count({
            where: {
              platformId: platform.id,
              severity: 'medium',
              status: 'active'
            }
          }),
          prisma.discoveredKey.count({
            where: {
              platformId: platform.id,
              severity: 'low',
              status: 'active'
            }
          })
        ])

        const critical = await prisma.discoveredKey.count({
          where: {
            platformId: platform.id,
            severity: 'critical',
            status: 'active'
          }
        })

        // Combine critical with high for display
        const totalHigh = high + critical
        const total = totalHigh + medium + low

        return {
          platform: platform.name,
          high: totalHigh,
          medium: medium,
          low: low,
          total: total
        }
      })
    )

    // Sort by total keys descending
    riskDistribution.sort((a, b) => b.total - a.total)

    return NextResponse.json({
      success: true,
      data: riskDistribution
    })

  } catch (error) {
    console.error('Error fetching platform risk distribution:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}