/**
 * Platform-Specific Workflow Utilities
 *
 * This module provides platform-specific utilities for creating and managing
 * rotation workflows for different observability platforms and services.
 */

import { prisma } from '@/lib/prisma'
import { createWorkflowFromTemplate, getEstimatedDuration } from './workflow-templates'

// ===========================
// Platform Detection
// ===========================

/**
 * Detect platform type from key format or API URL
 */
export function detectPlatformFromKey(key: string, apiUrl?: string): string {
  // Grafana patterns
  if (key.match(/^eyJ[A-Za-z0-9+/=]+$/) && apiUrl?.includes('grafana')) {
    return 'grafana'
  }

  // Datadog patterns
  if (key.match(/^[a-f0-9]{32}$/) && (apiUrl?.includes('datadog') || apiUrl?.includes('datadoghq'))) {
    return 'datadog'
  }

  // New Relic patterns
  if (key.match(/^[A-Z0-9]{40}$/) && apiUrl?.includes('newrelic')) {
    return 'newrelic'
  }

  // Dynatrace patterns
  if (key.match(/^dt0[a-z0-9]{1}[.][A-Z0-9]{24}[.][a-z0-9]{64}$/) && apiUrl?.includes('dynatrace')) {
    return 'dynatrace'
  }

  // AWS patterns
  if (key.match(/^AKIA[A-Z0-9]{16}$/)) {
    return 'aws'
  }

  // Stripe patterns
  if (key.match(/^sk_(live|test)_[A-Za-z0-9]{24,}$/)) {
    return 'stripe'
  }

  // GitHub patterns
  if (key.match(/^gh[ps]_[A-Za-z0-9]{36,}$/)) {
    return 'github'
  }

  return 'generic'
}

/**
 * Get platform-specific validation rules
 */
export function getPlatformValidationRules(platform: string): Record<string, any> {
  const rules: Record<string, Record<string, any>> = {
    grafana: {
      keyFormat: '^eyJ[A-Za-z0-9+/=]+$',
      urlRequired: true,
      testEndpoint: '/api/admin/stats',
      authHeader: 'Authorization',
      authPrefix: 'Bearer',
    },
    datadog: {
      keyFormat: '^[a-f0-9]{32}$',
      urlRequired: false,
      testEndpoint: '/api/v1/validate',
      authHeader: 'DD-API-KEY',
      authPrefix: '',
    },
    newrelic: {
      keyFormat: '^[A-Z0-9]{40}$',
      urlRequired: false,
      testEndpoint: '/v2/applications.json',
      authHeader: 'X-Api-Key',
      authPrefix: '',
    },
    dynatrace: {
      keyFormat: '^dt0[a-z0-9]{1}[.][A-Z0-9]{24}[.][a-z0-9]{64}$',
      urlRequired: true,
      testEndpoint: '/api/v1/config/clusterversion',
      authHeader: 'Authorization',
      authPrefix: 'Api-Token',
    },
    aws: {
      keyFormat: '^AKIA[A-Z0-9]{16}$',
      urlRequired: false,
      requiresSecretKey: true,
      authHeader: 'Authorization',
      authPrefix: 'AWS4-HMAC-SHA256',
    },
    stripe: {
      keyFormat: '^sk_(live|test)_[A-Za-z0-9]{24,}$',
      urlRequired: false,
      testEndpoint: '/v1/account',
      authHeader: 'Authorization',
      authPrefix: 'Bearer',
    },
    github: {
      keyFormat: '^gh[ps]_[A-Za-z0-9]{36,}$',
      urlRequired: false,
      testEndpoint: '/user',
      authHeader: 'Authorization',
      authPrefix: 'token',
    },
  }

  return rules[platform.toLowerCase()] || {}
}

// ===========================
// Workflow Creation Helpers
// ===========================

export interface CreateWorkflowFromKeyOptions {
  userId: string
  keyId?: string
  platformId?: string
  keyType: string
  keyName: string
  keyPreview?: string
  customName?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  autoStart?: boolean
  estimatedDuration?: number
}

/**
 * Create a workflow from a discovered key with platform-specific optimizations
 */
export async function createWorkflowFromKey(options: CreateWorkflowFromKeyOptions) {
  const {
    userId,
    keyId,
    platformId,
    keyType,
    keyName,
    keyPreview,
    customName,
    priority = 'medium',
    autoStart = false,
    estimatedDuration,
  } = options

  // Detect platform if not provided
  const detectedPlatform = keyType.toLowerCase()

  // Get platform-specific settings
  const validationRules = getPlatformValidationRules(detectedPlatform)
  const templateDuration = getEstimatedDuration(detectedPlatform)

  // Create workflow in transaction
  return await prisma.$transaction(async (tx) => {
    // Create the main workflow
    const workflow = await tx.rotationWorkflow.create({
      data: {
        name: customName || `Rotate ${keyName}`,
        description: `Guided rotation for ${detectedPlatform} API key`,
        keyType: detectedPlatform,
        keyName,
        keyPreview: keyPreview || `${keyName.slice(0, 8)}****`,
        priority,
        estimatedDuration: estimatedDuration || templateDuration,
        platformId: platformId || null,
        discoveredKeyId: keyId || null,
        rotationType: 'manual',
        automationLevel: 'guided',
        status: autoStart ? 'in_progress' : 'pending',
        startedAt: autoStart ? new Date() : null,
        userId,
        createdBy: userId,
        lastModifiedBy: userId,
      },
    })

    // Create steps from template
    const templateSteps = await createWorkflowFromTemplate(detectedPlatform)
    const createdSteps = await Promise.all(
      templateSteps.map((step, index) =>
        tx.rotationStep.create({
          data: {
            workflowId: workflow.id,
            stepNumber: index + 1,
            name: step.name,
            description: step.description,
            stepType: step.stepType,
            instructions: step.instructions,
            isRequired: step.isRequired,
            isAutomated: step.isAutomated,
            validationRules: step.validationRules ? JSON.stringify(step.validationRules) : null,
            dependsOnSteps: step.dependsOnSteps || [],
            blocksSteps: step.blocksSteps || [],
          },
        })
      )
    )

    // Update workflow with final step count
    const finalWorkflow = await tx.rotationWorkflow.update({
      where: { id: workflow.id },
      data: {
        totalSteps: createdSteps.length,
        currentStep: autoStart ? 1 : 0,
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        discoveredKey: true,
        platform: true,
      },
    })

    return finalWorkflow
  })
}

/**
 * Create a workflow from a platform configuration
 */
export async function createWorkflowFromPlatform(
  userId: string,
  platformId: string,
  options: {
    customName?: string
    priority?: 'low' | 'medium' | 'high' | 'critical'
    autoStart?: boolean
  } = {}
) {
  // Get platform details
  const platform = await prisma.platform.findFirst({
    where: { id: platformId, userId },
  })

  if (!platform) {
    throw new Error('Platform not found')
  }

  return createWorkflowFromKey({
    userId,
    platformId,
    keyType: platform.type,
    keyName: platform.name,
    keyPreview: `${platform.name} API Key`,
    customName: options.customName || `Rotate ${platform.name} Key`,
    priority: options.priority || 'medium',
    autoStart: options.autoStart || false,
  })
}

// ===========================
// Workflow Analytics
// ===========================

/**
 * Get workflow statistics for a user
 */
export async function getWorkflowStats(userId: string) {
  const [totalWorkflows, statusBreakdown, platformBreakdown, recentActivity] = await Promise.all([
    // Total workflows
    prisma.rotationWorkflow.count({
      where: { userId },
    }),

    // Status breakdown
    prisma.rotationWorkflow.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    }),

    // Platform breakdown
    prisma.rotationWorkflow.groupBy({
      by: ['keyType'],
      where: { userId },
      _count: { keyType: true },
    }),

    // Recent activity (last 30 days)
    prisma.rotationWorkflow.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ])

  // Calculate success rate
  const completedCount = statusBreakdown.find(s => s.status === 'completed')?._count.status || 0
  const failedCount = statusBreakdown.find(s => s.status === 'failed')?._count.status || 0
  const totalCompleted = completedCount + failedCount
  const successRate = totalCompleted > 0 ? (completedCount / totalCompleted) * 100 : 0

  return {
    total: totalWorkflows,
    recent: recentActivity,
    successRate: Math.round(successRate),
    byStatus: statusBreakdown.reduce((acc, item) => {
      acc[item.status] = item._count.status
      return acc
    }, {} as Record<string, number>),
    byPlatform: platformBreakdown.reduce((acc, item) => {
      acc[item.keyType] = item._count.keyType
      return acc
    }, {} as Record<string, number>),
  }
}

/**
 * Get workflow performance metrics
 */
export async function getWorkflowPerformanceMetrics(userId: string, platform?: string) {
  const whereClause: any = { userId }
  if (platform) {
    whereClause.keyType = platform
  }

  const workflows = await prisma.rotationWorkflow.findMany({
    where: {
      ...whereClause,
      status: 'completed',
      estimatedDuration: { not: null },
      actualDuration: { not: null },
    },
    select: {
      estimatedDuration: true,
      actualDuration: true,
      keyType: true,
      createdAt: true,
    },
  })

  if (workflows.length === 0) {
    return {
      averageAccuracy: 0,
      totalWorkflows: 0,
      averageEstimate: 0,
      averageActual: 0,
      byPlatform: {},
    }
  }

  // Calculate accuracy metrics
  const accuracies = workflows.map(w => {
    const estimated = w.estimatedDuration!
    const actual = w.actualDuration!
    return Math.abs(estimated - actual) / estimated
  })

  const averageAccuracy = (1 - accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length) * 100

  // Platform-specific metrics
  const byPlatform = workflows.reduce((acc, workflow) => {
    const platform = workflow.keyType
    if (!acc[platform]) {
      acc[platform] = {
        count: 0,
        totalEstimated: 0,
        totalActual: 0,
        accuracies: [],
      }
    }

    acc[platform].count++
    acc[platform].totalEstimated += workflow.estimatedDuration!
    acc[platform].totalActual += workflow.actualDuration!

    const accuracy = Math.abs(workflow.estimatedDuration! - workflow.actualDuration!) / workflow.estimatedDuration!
    acc[platform].accuracies.push(1 - accuracy)

    return acc
  }, {} as Record<string, any>)

  // Calculate platform averages
  Object.keys(byPlatform).forEach(platform => {
    const data = byPlatform[platform]
    data.averageEstimated = Math.round(data.totalEstimated / data.count)
    data.averageActual = Math.round(data.totalActual / data.count)
    data.accuracy = Math.round((data.accuracies.reduce((sum: number, acc: number) => sum + acc, 0) / data.accuracies.length) * 100)

    // Clean up intermediate data
    delete data.totalEstimated
    delete data.totalActual
    delete data.accuracies
  })

  return {
    averageAccuracy: Math.round(averageAccuracy),
    totalWorkflows: workflows.length,
    averageEstimate: Math.round(workflows.reduce((sum, w) => sum + w.estimatedDuration!, 0) / workflows.length),
    averageActual: Math.round(workflows.reduce((sum, w) => sum + w.actualDuration!, 0) / workflows.length),
    byPlatform,
  }
}

// ===========================
// Platform-Specific Helpers
// ===========================

/**
 * Get next recommended rotation date based on platform best practices
 */
export function getNextRotationDate(platform: string, lastRotation?: Date): Date {
  const now = new Date()
  const recommendations: Record<string, number> = {
    grafana: 90, // 90 days
    datadog: 90, // 90 days
    newrelic: 180, // 6 months
    dynatrace: 90, // 90 days
    aws: 90, // 90 days
    stripe: 365, // 1 year (live keys)
    github: 365, // 1 year
    generic: 90, // 90 days default
  }

  const daysToAdd = recommendations[platform.toLowerCase()] || recommendations.generic
  const baseDate = lastRotation || now

  return new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
}

/**
 * Get platform-specific security recommendations
 */
export function getPlatformSecurityRecommendations(platform: string): string[] {
  const recommendations: Record<string, string[]> = {
    grafana: [
      'Use service accounts instead of admin keys when possible',
      'Set explicit expiration dates for API keys',
      'Monitor API key usage in Grafana logs',
      'Rotate keys every 90 days',
      'Use read-only keys for monitoring tools',
    ],
    datadog: [
      'Separate API keys for different environments',
      'Use application keys only when necessary',
      'Monitor key usage in Datadog audit logs',
      'Rotate keys every 90 days',
      'Use scoped API keys when available',
    ],
    newrelic: [
      'Use user-level API keys instead of account keys',
      'Monitor key usage in New Relic insights',
      'Rotate license keys every 6 months',
      'Use environment-specific keys',
      'Enable key expiration notifications',
    ],
    dynatrace: [
      'Use minimal required scopes for tokens',
      'Monitor token usage in audit logs',
      'Rotate tokens every 90 days',
      'Use environment-specific tokens',
      'Enable token expiration alerts',
    ],
    aws: [
      'Use IAM roles instead of access keys when possible',
      'Apply principle of least privilege',
      'Enable CloudTrail for API key monitoring',
      'Rotate keys every 90 days',
      'Use temporary credentials for applications',
    ],
    stripe: [
      'Use restricted API keys with minimal permissions',
      'Never use live keys in development',
      'Monitor key usage in Stripe dashboard',
      'Rotate keys annually',
      'Use webhooks instead of polling when possible',
    ],
    github: [
      'Use fine-grained personal access tokens',
      'Set minimal required scopes',
      'Monitor token usage in security log',
      'Rotate tokens annually',
      'Use GitHub Apps for organization access',
    ],
  }

  return recommendations[platform.toLowerCase()] || [
    'Follow platform-specific security guidelines',
    'Use minimal required permissions',
    'Monitor API key usage regularly',
    'Rotate keys regularly',
    'Use secure storage for API keys',
  ]
}

/**
 * Validate platform configuration before creating workflow
 */
export async function validatePlatformConfiguration(
  platform: string,
  apiKey: string,
  apiUrl?: string
): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = []
  const rules = getPlatformValidationRules(platform)

  // Validate key format
  if (rules.keyFormat && !new RegExp(rules.keyFormat).test(apiKey)) {
    errors.push(`Invalid ${platform} API key format`)
  }

  // Validate URL requirement
  if (rules.urlRequired && !apiUrl) {
    errors.push(`API URL is required for ${platform}`)
  }

  // Additional platform-specific validations
  switch (platform.toLowerCase()) {
    case 'stripe':
      if (apiKey.includes('sk_live_') && process.env.NODE_ENV !== 'production') {
        errors.push('Live Stripe keys should not be used in non-production environments')
      }
      break

    case 'aws':
      if (rules.requiresSecretKey) {
        errors.push('AWS access keys require both access key ID and secret access key')
      }
      break
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}