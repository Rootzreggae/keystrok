// Utility functions and constants for rotation workflows

// ===========================
// Constants
// ===========================

export const WORKFLOW_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
} as const

export const WORKFLOW_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const

export const STEP_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
} as const

export const STEP_TYPES = {
  VERIFICATION: 'verification',
  BACKUP: 'backup',
  ROTATION: 'rotation',
  TESTING: 'testing',
  CLEANUP: 'cleanup',
  NOTIFICATION: 'notification',
} as const

export const ROTATION_TYPES = {
  MANUAL: 'manual',
  SEMI_AUTOMATED: 'semi_automated',
  AUTOMATED: 'automated',
} as const

export const AUTOMATION_LEVELS = {
  MANUAL: 'manual',
  GUIDED: 'guided',
  AUTOMATED: 'automated',
} as const

// ===========================
// Type Definitions
// ===========================

export type WorkflowStatus = typeof WORKFLOW_STATUSES[keyof typeof WORKFLOW_STATUSES]
export type WorkflowPriority = typeof WORKFLOW_PRIORITIES[keyof typeof WORKFLOW_PRIORITIES]
export type StepStatus = typeof STEP_STATUSES[keyof typeof STEP_STATUSES]
export type StepType = typeof STEP_TYPES[keyof typeof STEP_TYPES]
export type RotationType = typeof ROTATION_TYPES[keyof typeof ROTATION_TYPES]
export type AutomationLevel = typeof AUTOMATION_LEVELS[keyof typeof AUTOMATION_LEVELS]

// ===========================
// Utility Functions
// ===========================

/**
 * Get display text for workflow status
 */
export function getWorkflowStatusDisplay(status: WorkflowStatus): string {
  const displays: Record<WorkflowStatus, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    paused: 'Paused',
    cancelled: 'Cancelled',
  }
  return displays[status] || status
}

/**
 * Get CSS class for workflow status
 */
export function getWorkflowStatusClass(status: WorkflowStatus): string {
  const classes: Record<WorkflowStatus, string> = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    paused: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-gray-100 text-gray-800',
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

/**
 * Get display text for workflow priority
 */
export function getWorkflowPriorityDisplay(priority: WorkflowPriority): string {
  const displays: Record<WorkflowPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  }
  return displays[priority] || priority
}

/**
 * Get CSS class for workflow priority
 */
export function getWorkflowPriorityClass(priority: WorkflowPriority): string {
  const classes: Record<WorkflowPriority, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-600',
    high: 'bg-orange-100 text-orange-600',
    critical: 'bg-red-100 text-red-600',
  }
  return classes[priority] || 'bg-gray-100 text-gray-600'
}

/**
 * Get display text for step status
 */
export function getStepStatusDisplay(status: StepStatus): string {
  const displays: Record<StepStatus, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    skipped: 'Skipped',
    cancelled: 'Cancelled',
  }
  return displays[status] || status
}

/**
 * Get CSS class for step status
 */
export function getStepStatusClass(status: StepStatus): string {
  const classes: Record<StepStatus, string> = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    skipped: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-gray-100 text-gray-800',
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

/**
 * Get display text for step type
 */
export function getStepTypeDisplay(stepType: StepType): string {
  const displays: Record<StepType, string> = {
    verification: 'Verification',
    backup: 'Backup',
    rotation: 'Rotation',
    testing: 'Testing',
    cleanup: 'Cleanup',
    notification: 'Notification',
  }
  return displays[stepType] || stepType
}

/**
 * Get icon for step type
 */
export function getStepTypeIcon(stepType: StepType): string {
  const icons: Record<StepType, string> = {
    verification: '🔍',
    backup: '💾',
    rotation: '🔄',
    testing: '🧪',
    cleanup: '🧹',
    notification: '📧',
  }
  return icons[stepType] || '📋'
}

/**
 * Calculate workflow progress percentage
 */
export function calculateWorkflowProgress(completedSteps: number, totalSteps: number): number {
  if (totalSteps === 0) return 0
  return Math.round((completedSteps / totalSteps) * 100)
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes: number | null): string {
  if (!minutes) return 'Unknown'
  
  if (minutes < 60) {
    return `${minutes}m`
  } else if (minutes < 1440) { // Less than 24 hours
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  } else { // 24 hours or more
    const days = Math.floor(minutes / 1440)
    const remainingHours = Math.floor((minutes % 1440) / 60)
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
}

/**
 * Check if workflow can be started
 */
export function canStartWorkflow(status: WorkflowStatus): boolean {
  return status === WORKFLOW_STATUSES.PENDING
}

/**
 * Check if workflow can be paused
 */
export function canPauseWorkflow(status: WorkflowStatus): boolean {
  const pausableStatuses: WorkflowStatus[] = [WORKFLOW_STATUSES.PENDING, WORKFLOW_STATUSES.IN_PROGRESS]
  return pausableStatuses.includes(status)
}

/**
 * Check if workflow can be resumed
 */
export function canResumeWorkflow(status: WorkflowStatus): boolean {
  return status === WORKFLOW_STATUSES.PAUSED
}

/**
 * Check if workflow can be cancelled
 */
export function canCancelWorkflow(status: WorkflowStatus): boolean {
  const terminalStatuses: WorkflowStatus[] = [WORKFLOW_STATUSES.COMPLETED, WORKFLOW_STATUSES.CANCELLED]
  return !terminalStatuses.includes(status)
}

/**
 * Check if workflow can be retried
 */
export function canRetryWorkflow(status: WorkflowStatus, retryCount: number, maxRetries: number): boolean {
  return status === WORKFLOW_STATUSES.FAILED && retryCount < maxRetries
}

/**
 * Check if workflow can be deleted
 */
export function canDeleteWorkflow(status: WorkflowStatus): boolean {
  const deletableStatuses: WorkflowStatus[] = [
    WORKFLOW_STATUSES.COMPLETED,
    WORKFLOW_STATUSES.CANCELLED,
    WORKFLOW_STATUSES.FAILED,
  ]
  return deletableStatuses.includes(status)
}

/**
 * Check if step can be started
 */
export function canStartStep(
  stepStatus: StepStatus, 
  dependsOnSteps: number[], 
  completedSteps: number[]
): boolean {
  if (stepStatus !== STEP_STATUSES.PENDING) return false
  
  // Check if all dependencies are completed
  return dependsOnSteps.every(stepNumber => completedSteps.includes(stepNumber))
}

/**
 * Check if step can be completed
 */
export function canCompleteStep(
  stepStatus: StepStatus,
  dependsOnSteps: number[],
  completedSteps: number[]
): boolean {
  const completableStatuses: StepStatus[] = [STEP_STATUSES.PENDING, STEP_STATUSES.IN_PROGRESS]
  if (!completableStatuses.includes(stepStatus)) return false
  
  // Check if all dependencies are completed
  return dependsOnSteps.every(stepNumber => completedSteps.includes(stepNumber))
}

/**
 * Get next available step number for a workflow
 */
export function getNextStepNumber(existingSteps: { stepNumber: number }[]): number {
  if (existingSteps.length === 0) return 1
  
  const stepNumbers = existingSteps.map(step => step.stepNumber).sort((a, b) => a - b)
  return Math.max(...stepNumbers) + 1
}

/**
 * Validate step dependencies
 */
export function validateStepDependencies(
  steps: { stepNumber: number; dependsOnSteps: number[] }[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const stepNumbers = steps.map(step => step.stepNumber)
  
  for (const step of steps) {
    // Check if dependencies exist
    for (const depStepNumber of step.dependsOnSteps) {
      if (!stepNumbers.includes(depStepNumber)) {
        errors.push(`Step ${step.stepNumber} depends on non-existent step ${depStepNumber}`)
      }
      
      // Check for circular dependencies (basic check)
      if (depStepNumber >= step.stepNumber) {
        errors.push(`Step ${step.stepNumber} cannot depend on step ${depStepNumber} (circular or invalid dependency)`)
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Sort steps by dependency order (topological sort)
 */
export function sortStepsByDependencies(
  steps: { stepNumber: number; dependsOnSteps: number[] }[]
): { stepNumber: number; dependsOnSteps: number[] }[] {
  const visited = new Set<number>()
  const visiting = new Set<number>()
  const result: { stepNumber: number; dependsOnSteps: number[] }[] = []
  
  function visit(stepNumber: number) {
    if (visiting.has(stepNumber)) {
      throw new Error(`Circular dependency detected involving step ${stepNumber}`)
    }
    
    if (visited.has(stepNumber)) return
    
    visiting.add(stepNumber)
    
    const step = steps.find(s => s.stepNumber === stepNumber)
    if (step) {
      for (const depStepNumber of step.dependsOnSteps) {
        visit(depStepNumber)
      }
      result.push(step)
    }
    
    visiting.delete(stepNumber)
    visited.add(stepNumber)
  }
  
  for (const step of steps) {
    visit(step.stepNumber)
  }
  
  return result
}

/**
 * Generate a key preview (mask sensitive parts)
 */
export function generateKeyPreview(key: string, showLength: number = 4): string {
  if (key.length <= showLength * 2) {
    return key.replace(/./g, '*')
  }
  
  const start = key.substring(0, showLength)
  const end = key.substring(key.length - showLength)
  const middle = '*'.repeat(Math.min(8, key.length - showLength * 2))
  
  return `${start}${middle}${end}`
}

/**
 * Estimate workflow duration based on step types and complexity
 */
export function estimateWorkflowDuration(steps: { stepType: StepType; isAutomated: boolean }[]): number {
  const baseMinutes: Record<StepType, number> = {
    verification: 15,
    backup: 10,
    rotation: 30,
    testing: 20,
    cleanup: 15,
    notification: 5,
  }
  
  let totalMinutes = 0
  
  for (const step of steps) {
    let stepMinutes = baseMinutes[step.stepType] || 15
    
    // Automated steps are faster
    if (step.isAutomated) {
      stepMinutes = Math.ceil(stepMinutes * 0.3)
    }
    
    totalMinutes += stepMinutes
  }
  
  // Add 20% buffer
  return Math.ceil(totalMinutes * 1.2)
}

/**
 * Get workflow health score based on various factors
 */
export function calculateWorkflowHealthScore(workflow: {
  status: WorkflowStatus
  progress: number
  retryCount: number
  maxRetries: number
  estimatedDuration: number | null
  actualDuration: number | null
  steps: { status: StepStatus; isRequired: boolean }[]
}): { score: number; factors: string[] } {
  let score = 100
  const factors: string[] = []
  
  // Status penalties
  if (workflow.status === WORKFLOW_STATUSES.FAILED) {
    score -= 30
    factors.push('Workflow has failed')
  } else if (workflow.status === WORKFLOW_STATUSES.PAUSED) {
    score -= 10
    factors.push('Workflow is paused')
  }
  
  // Retry penalties
  if (workflow.retryCount > 0) {
    const retryPenalty = (workflow.retryCount / workflow.maxRetries) * 20
    score -= retryPenalty
    factors.push(`${workflow.retryCount} retry attempts`)
  }
  
  // Duration comparison
  if (workflow.actualDuration && workflow.estimatedDuration) {
    const durationRatio = workflow.actualDuration / workflow.estimatedDuration
    if (durationRatio > 1.5) {
      score -= 15
      factors.push('Significantly over estimated duration')
    } else if (durationRatio > 1.2) {
      score -= 8
      factors.push('Over estimated duration')
    }
  }
  
  // Step failure rate
  const failedSteps = workflow.steps.filter(step => step.status === STEP_STATUSES.FAILED)
  if (failedSteps.length > 0) {
    const failureRate = failedSteps.length / workflow.steps.length
    score -= failureRate * 25
    factors.push(`${failedSteps.length} failed steps`)
  }
  
  // Progress vs status alignment
  if (workflow.status === WORKFLOW_STATUSES.IN_PROGRESS && workflow.progress < 0.1) {
    score -= 5
    factors.push('Low progress for active workflow')
  }
  
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    factors,
  }
}