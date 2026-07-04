import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rotationDueAt, riskStart } from '@/lib/rotation-policy'

// POST /api/discovery/findings/[id]/promote - Promote a scan finding to inventory
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== DEBUG: Promote finding endpoint called ===')

    // Next.js 15 requires awaiting params
    const { id } = await params
    console.log('DEBUG: Finding ID:', id)

    // Step 1: Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    console.log('DEBUG: Using user ID:', userId)

    // Step 2: Test database connection
    try {
      const userCount = await prisma.user.count()
      console.log('DEBUG: Database connection successful, user count:', userCount)
    } catch (error) {
      console.error('DEBUG: Database connection failed:', error)
      return NextResponse.json(
        { success: false, error: 'Database connection failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
        { status: 500 }
      )
    }

    // Step 3: Look for the finding in LocalScanFinding table
    try {
      console.log('DEBUG: Searching for finding with ID:', id, 'and userId:', userId)

      const finding = await prisma.localScanFinding.findFirst({
        where: {
          id: id
        },
        select: {
          id: true,
          filePath: true,
          keyPreview: true,
          keyType: true,
          severity: true,
          confidence: true,
          status: true,
          detectionRule: true,
          pattern: true,
          patternName: true,
          riskLevel: true,
          isInEnvFile: true,
          isTestKey: true,
          exposedAt: true, // git-derived exposure date, carried to the key
          keyHashId: true // Include keyHashId to check if it exists
        }
      })

      console.log('DEBUG: Finding query result:', finding)

      if (!finding) {
        console.log('DEBUG: Finding not found')
        return NextResponse.json(
          { success: false, error: 'Finding not found' },
          { status: 404 }
        )
      }

      console.log('DEBUG: Found finding:', finding)

      // Derive platform from keyType (since LocalScanFinding doesn't have platform field)
      const platform = finding.keyType === 'github' ? 'github' :
                      finding.keyType === 'google' ? 'google' :
                      finding.keyType.toLowerCase()

      console.log('DEBUG: Successfully found LocalScanFinding, now promoting to DiscoveredKey')

      // ACTUAL PROMOTION LOGIC: Create a DiscoveredKey from this LocalScanFinding
      try {
        // Generate a descriptive key name
        const keyName = `${finding.keyType.toUpperCase()} API Key - ${new Date().toISOString().split('T')[0]}`

        // Map severity to status
        const statusMap: Record<string, string> = {
          'critical': 'compromised',
          'high': 'at_risk',
          'medium': 'warning',
          'low': 'monitor'
        }

        const status = statusMap[finding.severity.toLowerCase()] || 'at_risk'
        // Rotation-recommended date, anchored to when the key was at-risk: the
        // git-derived exposure date if we have one, else discovery (now).
        const anchor = riskStart({ foundAt: new Date(), exposedAt: finding.exposedAt ?? null })
        const expiresAt = rotationDueAt(anchor, finding.severity)

        // Calculate risk score (simplified version)
        const riskScore = finding.severity === 'critical' ? 90 :
                         finding.severity === 'high' ? 70 :
                         finding.severity === 'medium' ? 50 : 30

        // Handle KeyHash - create or use existing one
        let keyHashId = finding.keyHashId
        if (!keyHashId) {
          console.log('DEBUG: No KeyHash found for finding, creating a new one')
          // Create a new KeyHash since we don't have one
          const keyHash = await prisma.keyHash.create({
            data: {
              keyHash: 'promoted-' + finding.id, // Unique hash based on finding ID
              hashSalt: 'salt-' + finding.id,
              hashAlgorithm: 'SHA256_SALTED',
              keyType: finding.keyType,
              keyFormat: 'Unknown', // We don't have the actual key value
              estimatedLength: finding.keyPreview.length,
              userId: userId
            }
          })
          keyHashId = keyHash.id
          console.log('DEBUG: Created new KeyHash:', keyHashId)
        } else {
          console.log('DEBUG: Using existing KeyHash:', keyHashId)
        }

        // Create the DiscoveredKey with proper risk status
        const discoveredKey = await prisma.discoveredKey.create({
          data: {
            keyName: `${finding.keyType.toUpperCase()} Key - Found in ${finding.filePath}`,
            keyPreview: finding.keyPreview,
            keyHashId: keyHashId,
            platform: platform,
            source: 'discovery_scanner',
            location: finding.filePath,
            status: status, // Use mapped status instead of hardcoded 'active'
            severity: finding.severity,
            confidence: finding.confidence,
            riskScore: riskScore,
            detectionPattern: finding.pattern || 'manual',
            keyType: finding.keyType,
            expiresAt: expiresAt, // Use calculated expiration based on severity
            // Git-derived exposure date, if the scanner found one. A user can
            // later override it in the drawer (their entry wins, source 'user').
            exposedAt: finding.exposedAt ?? null,
            exposedAtSource: finding.exposedAt ? 'git' : null,
            environmentType: finding.isInEnvFile ? 'development' : 'unknown',
            userId: userId
          }
        })

        // Mark the finding resolved so it leaves the triage inbox.
        await prisma.localScanFinding.update({
          where: { id: finding.id },
          data: { status: 'resolved' },
        })

        // Create activity log entry
        await prisma.activity.create({
          data: {
            action: 'key_promoted',
            description: `Local scan finding promoted to inventory: ${finding.keyType} key in ${finding.filePath}`,
            userId: userId
          }
        })

        console.log('DEBUG: Successfully created DiscoveredKey:', discoveredKey.id)

        return NextResponse.json({
          success: true,
          message: `${finding.severity.toUpperCase()} key added to inventory for immediate attention`,
          urgency: finding.severity === 'critical' ? 'IMMEDIATE ROTATION REQUIRED' :
                   finding.severity === 'high' ? 'ROTATION NEEDED WITHIN 7 DAYS' :
                   'Monitor and plan rotation',
          discoveredKey: {
            id: discoveredKey.id,
            keyName: discoveredKey.keyName,
            platform: discoveredKey.platform,
            severity: discoveredKey.severity,
            status: discoveredKey.status,
            riskScore: discoveredKey.riskScore,
            location: discoveredKey.location,
            rotationDueAt: expiresAt.toISOString()
          },
          originalFinding: {
            id: finding.id,
            keyType: finding.keyType,
            filePath: finding.filePath
          }
        })

      } catch (promotionError) {
        console.error('DEBUG: Error during promotion:', promotionError)
        return NextResponse.json(
          { success: false, error: 'Failed to promote finding to inventory: ' + (promotionError instanceof Error ? promotionError.message : 'Unknown error') },
          { status: 500 }
        )
      }

    } catch (error) {
      console.error('DEBUG: Database query failed:', error)
      return NextResponse.json(
        { success: false, error: 'Database query failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('DEBUG: Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Unexpected error: ' + (error instanceof Error ? error.message : 'Unknown error')
      },
      { status: 500 }
    )
  }
}