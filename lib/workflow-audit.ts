/**
 * Workflow Audit Logging
 *
 * This module provides comprehensive audit logging for all workflow operations
 * to ensure security compliance and operational visibility.
 */

import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'

// ===========================
// Types and Interfaces
// ===========================

export interface AuditLogEntry {
  eventType: string
  eventCategory: 'security' | 'data_access' | 'system' | 'user_action'
  severity: 'info' | 'warning' | 'error' | 'critical'
  description: string
  details?: Record<string, any>
  resourceType?: 'workflow' | 'step' | 'key' | 'platform' | 'user'
  resourceId?: string
  userId: string
  sessionToken?: string
  ipAddress?: string
  userAgent?: string
}

export interface WorkflowAuditContext {
  workflowId: string
  workflowName: string
  keyType: string
  userId: string
  sessionToken?: string
  ipAddress?: string
  userAgent?: string
}

// ===========================
// Core Audit Logging Functions
// ===========================

/**
 * Log a workflow-related audit event
 */
export async function logWorkflowAudit(
  context: WorkflowAuditContext,
  eventType: string,
  description: string,
  options: {
    severity?: 'info' | 'warning' | 'error' | 'critical'
    category?: 'security' | 'data_access' | 'system' | 'user_action'
    details?: Record<string, any>
    resourceType?: 'workflow' | 'step' | 'key' | 'platform' | 'user'
    resourceId?: string
  } = {}
): Promise<void> {
  const {
    severity = 'info',
    category = 'user_action',
    details = {},
    resourceType = 'workflow',
    resourceId,
  } = options

  try {
    await prisma.auditLog.create({
      data: {
        eventType,
        eventCategory: category,
        severity,
        description,
        details: JSON.stringify({
          ...details,
          workflowId: context.workflowId,
          workflowName: context.workflowName,
          keyType: context.keyType,
          timestamp: new Date().toISOString(),
        }),
        resourceType,
        resourceId: resourceId || context.workflowId,
        userId: context.userId,
        sessionToken: context.sessionToken,
        ipAddress: hashIpAddress(context.ipAddress),
        userAgent: context.userAgent,
      },
    })
  } catch (error) {
    console.error('Failed to log workflow audit event:', error)
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Log a general audit event
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        eventType: entry.eventType,
        eventCategory: entry.eventCategory,
        severity: entry.severity,
        description: entry.description,
        details: entry.details ? JSON.stringify(entry.details) : null,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        userId: entry.userId,
        sessionToken: entry.sessionToken,
        ipAddress: hashIpAddress(entry.ipAddress),
        userAgent: entry.userAgent,
      },
    })
  } catch (error) {
    console.error('Failed to log audit event:', error)
  }
}

// ===========================
// Workflow-Specific Audit Events
// ===========================

/**
 * Log workflow creation
 */
export async function auditWorkflowCreated(
  context: WorkflowAuditContext,
  details: {
    priority: string
    estimatedDuration?: number
    templateUsed: string
    autoStarted: boolean
    discoveredKeyId?: string
    platformId?: string
  }
): Promise<void> {
  await logWorkflowAudit(
    context,
    'workflow_created',
    `Created rotation workflow: ${context.workflowName}`,
    {
      severity: 'info',
      category: 'user_action',
      details: {
        ...details,
        action: 'create',
      },
    }
  )
}

/**
 * Log workflow status changes
 */
export async function auditWorkflowStatusChange(
  context: WorkflowAuditContext,
  oldStatus: string,
  newStatus: string,
  reason?: string
): Promise<void> {
  const severity = newStatus === 'failed' ? 'error' : 'info'
  const category = ['failed', 'cancelled'].includes(newStatus) ? 'security' : 'user_action'

  await logWorkflowAudit(
    context,
    `workflow_status_changed`,
    `Workflow status changed from ${oldStatus} to ${newStatus}`,
    {
      severity,
      category,
      details: {
        oldStatus,
        newStatus,
        reason,
        action: 'status_change',
      },
    }
  )
}

/**
 * Log workflow step completion
 */
export async function auditStepCompleted(
  context: WorkflowAuditContext,
  stepDetails: {
    stepId: string
    stepNumber: number
    stepName: string
    stepType: string
    duration?: number
    result?: string
  }
): Promise<void> {
  await logWorkflowAudit(
    context,
    'workflow_step_completed',
    `Completed step ${stepDetails.stepNumber}: ${stepDetails.stepName}`,
    {
      severity: 'info',
      category: 'user_action',
      resourceType: 'step',
      resourceId: stepDetails.stepId,
      details: {
        ...stepDetails,
        action: 'step_complete',
      },
    }
  )
}

/**
 * Log workflow step failure
 */
export async function auditStepFailed(
  context: WorkflowAuditContext,
  stepDetails: {
    stepId: string
    stepNumber: number
    stepName: string
    stepType: string
    errorMessage: string
    duration?: number
  }
): Promise<void> {
  await logWorkflowAudit(
    context,
    'workflow_step_failed',
    `Step ${stepDetails.stepNumber} failed: ${stepDetails.stepName}`,
    {
      severity: 'error',
      category: 'system',
      resourceType: 'step',
      resourceId: stepDetails.stepId,
      details: {
        ...stepDetails,
        action: 'step_fail',
      },
    }
  )
}

/**
 * Log workflow completion
 */
export async function auditWorkflowCompleted(
  context: WorkflowAuditContext,
  details: {
    totalSteps: number
    actualDuration?: number
    estimatedDuration?: number
    successfulSteps: number
    failedSteps: number
    skippedSteps: number
  }
): Promise<void> {
  const efficiency = details.estimatedDuration && details.actualDuration
    ? (details.estimatedDuration / details.actualDuration) * 100
    : null

  await logWorkflowAudit(
    context,
    'workflow_completed',
    `Successfully completed workflow: ${context.workflowName}`,
    {
      severity: 'info',
      category: 'security', // Successful key rotation is a security event
      details: {
        ...details,
        efficiency: efficiency ? Math.round(efficiency) : null,
        action: 'complete',
      },
    }
  )
}

/**
 * Log workflow deletion
 */
export async function auditWorkflowDeleted(
  context: WorkflowAuditContext,
  details: {
    status: string
    reason?: string
  }
): Promise<void> {
  await logWorkflowAudit(
    context,
    'workflow_deleted',
    `Deleted workflow: ${context.workflowName}`,
    {
      severity: 'warning',
      category: 'data_access',
      details: {
        ...details,
        action: 'delete',
      },
    }
  )
}

/**
 * Log key rotation initiation (when workflow starts affecting actual keys)
 */
export async function auditKeyRotationStarted(
  context: WorkflowAuditContext,
  keyDetails: {
    keyId?: string
    keyName: string
    platform: string
    severity?: string
    location?: string
  }
): Promise<void> {
  await logWorkflowAudit(
    context,
    'key_rotation_started',
    `Started key rotation for ${keyDetails.keyName} on ${keyDetails.platform}`,
    {
      severity: 'warning',
      category: 'security',
      resourceType: 'key',
      resourceId: keyDetails.keyId,
      details: {
        ...keyDetails,
        action: 'rotation_start',
      },
    }
  )
}

/**
 * Log successful key rotation
 */
export async function auditKeyRotationCompleted(
  context: WorkflowAuditContext,
  keyDetails: {
    keyId?: string
    keyName: string
    platform: string
    oldKeyRevoked: boolean
    newKeyActive: boolean
  }
): Promise<void> {
  await logWorkflowAudit(
    context,
    'key_rotation_completed',
    `Successfully rotated key ${keyDetails.keyName} on ${keyDetails.platform}`,
    {
      severity: 'info',
      category: 'security',
      resourceType: 'key',
      resourceId: keyDetails.keyId,
      details: {
        ...keyDetails,
        action: 'rotation_complete',
      },
    }
  )
}

// ===========================
// Workflow Performance Auditing
// ===========================

/**
 * Log workflow performance metrics
 */
export async function auditWorkflowPerformance(
  context: WorkflowAuditContext,
  metrics: {
    estimatedVsActualDuration?: {
      estimated: number
      actual: number
      variance: number
    }
    stepEfficiency?: {
      totalSteps: number
      automatedSteps: number
      manualSteps: number
      averageStepDuration: number
    }
    userInteraction?: {
      totalInteractions: number
      averageResponseTime: number
      pauseDuration?: number
    }
  }
): Promise<void> {
  await logWorkflowAudit(
    context,
    'workflow_performance_metrics',
    `Performance metrics for workflow: ${context.workflowName}`,
    {
      severity: 'info',
      category: 'system',
      details: {
        ...metrics,
        action: 'performance_tracking',
      },
    }
  )
}

// ===========================
// Security and Compliance Auditing
// ===========================

/**
 * Log security-related workflow events
 */
export async function auditSecurityEvent(
  context: WorkflowAuditContext,
  event: {
    type: 'unauthorized_access' | 'suspicious_activity' | 'policy_violation' | 'data_export'
    description: string
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    details?: Record<string, any>
  }
): Promise<void> {
  const severityMap = {
    low: 'info' as const,
    medium: 'warning' as const,
    high: 'error' as const,
    critical: 'critical' as const,
  }

  await logWorkflowAudit(
    context,
    `security_${event.type}`,
    event.description,
    {
      severity: severityMap[event.riskLevel],
      category: 'security',
      details: {
        ...event.details,
        riskLevel: event.riskLevel,
        action: 'security_event',
      },
    }
  )
}

/**
 * Log data access and export events
 */
export async function auditDataAccess(
  context: WorkflowAuditContext,
  access: {
    dataType: 'workflow_config' | 'step_details' | 'key_metadata' | 'audit_logs'
    action: 'view' | 'export' | 'download' | 'copy'
    recordCount?: number
    format?: string
  }
): Promise<void> {
  await logWorkflowAudit(
    context,
    'data_access',
    `Data access: ${access.action} ${access.dataType}`,
    {
      severity: access.action === 'export' ? 'warning' : 'info',
      category: 'data_access',
      details: {
        ...access,
        action: 'data_access',
      },
    }
  )
}

// ===========================
// Audit Query and Reporting
// ===========================

/**
 * Get audit logs for a specific workflow
 */
export async function getWorkflowAuditLogs(
  workflowId: string,
  userId: string,
  options: {
    startDate?: Date
    endDate?: Date
    eventTypes?: string[]
    severity?: string[]
    limit?: number
    offset?: number
  } = {}
): Promise<{
  logs: any[]
  total: number
}> {
  const where: any = {
    userId,
    details: {
      path: ['workflowId'],
      equals: workflowId,
    },
  }

  if (options.startDate || options.endDate) {
    where.createdAt = {}
    if (options.startDate) where.createdAt.gte = options.startDate
    if (options.endDate) where.createdAt.lte = options.endDate
  }

  if (options.eventTypes?.length) {
    where.eventType = { in: options.eventTypes }
  }

  if (options.severity?.length) {
    where.severity = { in: options.severity }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 100,
      skip: options.offset || 0,
      select: {
        id: true,
        eventType: true,
        eventCategory: true,
        severity: true,
        description: true,
        details: true,
        resourceType: true,
        resourceId: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return { logs, total }
}

/**
 * Get workflow security summary
 */
export async function getWorkflowSecuritySummary(
  userId: string,
  timeRange: { start: Date; end: Date }
): Promise<{
  totalEvents: number
  securityEvents: number
  failedWorkflows: number
  suspiciousActivity: number
  dataExports: number
  riskDistribution: Record<string, number>
}> {
  const securityLogs = await prisma.auditLog.findMany({
    where: {
      userId,
      eventCategory: 'security',
      createdAt: {
        gte: timeRange.start,
        lte: timeRange.end,
      },
    },
    select: {
      eventType: true,
      severity: true,
      details: true,
    },
  })

  const allLogs = await prisma.auditLog.count({
    where: {
      userId,
      createdAt: {
        gte: timeRange.start,
        lte: timeRange.end,
      },
    },
  })

  const riskDistribution = securityLogs.reduce(
    (acc, log) => {
      acc[log.severity] = (acc[log.severity] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return {
    totalEvents: allLogs,
    securityEvents: securityLogs.length,
    failedWorkflows: securityLogs.filter(log => log.eventType.includes('failed')).length,
    suspiciousActivity: securityLogs.filter(log => log.eventType.includes('suspicious')).length,
    dataExports: securityLogs.filter(log => log.eventType.includes('export')).length,
    riskDistribution,
  }
}

// ===========================
// Utility Functions
// ===========================

/**
 * Hash IP address for privacy while maintaining audit capability
 */
function hashIpAddress(ipAddress?: string): string | null {
  if (!ipAddress) return null

  // Simple hash for privacy - in production, use a proper hash function
  return crypto.createHash('sha256').update(ipAddress + process.env.NEXTAUTH_SECRET).digest('hex').substring(0, 16)
}

/**
 * Create audit context from request data
 */
export function createAuditContext(
  workflowId: string,
  workflowName: string,
  keyType: string,
  userId: string,
  request?: {
    headers?: Record<string, string>
    ip?: string
  }
): WorkflowAuditContext {
  return {
    workflowId,
    workflowName,
    keyType,
    userId,
    sessionToken: request?.headers?.['authorization']?.split(' ')[1],
    ipAddress: request?.ip || request?.headers?.['x-forwarded-for'] || request?.headers?.['x-real-ip'],
    userAgent: request?.headers?.['user-agent'],
  }
}

/**
 * Bulk log multiple audit events (for batch operations)
 */
export async function bulkLogAuditEvents(entries: AuditLogEntry[]): Promise<void> {
  if (entries.length === 0) return

  try {
    await prisma.auditLog.createMany({
      data: entries.map(entry => ({
        eventType: entry.eventType,
        eventCategory: entry.eventCategory,
        severity: entry.severity,
        description: entry.description,
        details: entry.details ? JSON.stringify(entry.details) : null,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        userId: entry.userId,
        sessionToken: entry.sessionToken,
        ipAddress: hashIpAddress(entry.ipAddress),
        userAgent: entry.userAgent,
      })),
    })
  } catch (error) {
    console.error('Failed to bulk log audit events:', error)
  }
}