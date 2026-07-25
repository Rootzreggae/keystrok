// TypeScript types and interfaces for the security scanner

export interface KeyPattern {
  name: string
  platform: string
  pattern: RegExp
  confidence: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  keyType: string
  description?: string
  examples?: string[]
  validationFn?: (key: string) => boolean
}

export interface ScanOptions {
  targetPath: string
  scanType?: 'quick' | 'deep' | 'targeted'
  includeHidden?: boolean
  maxDepth?: number
  fileExtensions?: string[]
  excludePaths?: string[]
  maxFileSize?: number
  enableContextAnalysis?: boolean
  enableGitIntegration?: boolean
}

export interface Finding {
  // Core finding information
  keyPreview: string
  keyHash: string
  keyType: string
  platform: string
  patternName: string
  detectionRule: string

  // Location information
  filePath: string
  relativePath: string
  fileName: string
  lineNumber: number
  columnStart?: number
  columnEnd?: number

  // Content context
  lineContent: string
  beforeContext: string[]
  afterContext: string[]

  // Risk assessment
  severity: 'critical' | 'high' | 'medium' | 'low'
  confidence: number
  riskLevel: string
  riskFactors: string[]

  // Classification flags
  isLikelyActive: boolean
  isInComment: boolean
  isInString: boolean
  isInEnvFile: boolean
  isBase64Encoded: boolean
  isTestKey: boolean
  isExampleKey: boolean

  // Metadata
  entropy?: number
  estimatedLength: number
  detectedAt: Date

  // Set when the raw value verified against a manually registered key's salted
  // hash (never the value itself): persistence attaches an exposure event to
  // that DiscoveredKey instead of creating a triage finding.
  linkedKeyId?: string
  linkedKeyHashId?: string
}

export interface FileInfo {
  absolutePath: string
  relativePath: string
  fileName: string
  fileExtension: string
  fileSize: number
  lastModified: Date
  permissions: string

  // Git integration
  isGitTracked: boolean
  gitCommitHash?: string
  gitBranch?: string
  gitLastCommit?: Date
  gitAuthor?: string

  // File classification
  isEnvFile: boolean
  isConfigFile: boolean
  isCodeFile: boolean
  encoding: string
}

export interface ScanResult {
  // Session information
  sessionId: string
  scanOptions: ScanOptions

  // Results
  findings: Finding[]
  fileScans: FileScanResult[]

  // Statistics
  totalFiles: number
  scannedFiles: number
  skippedFiles: number
  errorCount: number

  // Progress tracking
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  startedAt: Date
  completedAt?: Date
  duration?: number

  // Error handling
  errors: ScanError[]
  warnings: string[]
}

export interface FileScanResult {
  fileInfo: FileInfo
  findings: Finding[]
  scanDuration: number
  linesScanned: number
  hasFindings: boolean
  processingError?: string
}

export interface ScanError {
  type: 'file_access' | 'permission_denied' | 'invalid_path' | 'processing_error' | 'validation_error'
  message: string
  filePath?: string
  lineNumber?: number
  stack?: string
}

export interface RiskAssessment {
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  riskScore: number // 0-100
  riskFactors: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
  confidence: number
  recommendation: string
}

export interface ContextAnalysis {
  isInComment: boolean
  isInString: boolean
  isInTestFile: boolean
  isInExampleCode: boolean
  surroundingCode: string
  codeLanguage?: string
  variableName?: string
  assignmentContext?: string
}

export interface KeyValidation {
  isValid: boolean
  formatValid: boolean
  checksumValid?: boolean
  lengthValid: boolean
  characterSetValid: boolean
  platformSpecificValid?: boolean
  validationErrors: string[]
}

export interface ScanProgress {
  sessionId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number // 0.0 to 1.0
  currentFile?: string
  filesScanned: number
  totalFiles: number
  findingsCount: number
  elapsedTime: number
  estimatedTimeRemaining?: number
}

export interface ScannerConfig {
  maxFileSize: number // bytes
  maxScanDepth: number
  contextLines: number
  entropyThreshold: number
  confidenceThreshold: number
  enableParallelScanning: boolean
  enableGitIntegration: boolean
  enableContextAnalysis: boolean
  chunkSize: number
  timeoutPerFile: number // milliseconds
}

// Database integration types
export interface ScanSessionData {
  name: string
  scanType: 'quick' | 'deep' | 'targeted'
  targetPath: string
  includeHidden: boolean
  maxDepth?: number
  fileExtensions: string[]
  excludePaths: string[]
  userId: string
}

export interface LocalScanFindingData {
  sessionId: string
  fileScanId?: string
  keyHashId?: string

  // Location
  filePath: string
  relativePath: string
  fileName: string
  lineNumber: number
  columnStart?: number
  columnEnd?: number

  // Content (sanitized)
  lineContent: string
  beforeContext: string[]
  afterContext: string[]
  keyPreview: string

  // Detection
  keyType: string
  detectionRule: string
  pattern: string
  patternName: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  confidence: number
  riskLevel: string
  riskFactors: string[]

  // Classification
  isLikelyActive: boolean
  isInComment: boolean
  isInString: boolean
  isInEnvFile: boolean
  isBase64Encoded: boolean
  isTestKey: boolean
  isExampleKey: boolean

  // Validation
  isValidated: boolean
  validationError?: string

  userId: string
}

export interface KeyHashData {
  keyHash: string
  hashSalt: string
  hashAlgorithm: string
  keyType: string
  keyFormat: string
  estimatedLength: number
  userId: string
}

export interface FileScanData {
  sessionId: string
  absolutePath: string
  relativePath: string
  fileName: string
  fileExtension?: string
  fileSize: bigint
  fileHash: string
  lastModified: Date
  permissions: string

  // Git data
  isGitTracked: boolean
  gitCommitHash?: string
  gitBranch?: string
  gitLastCommit?: Date
  gitAuthor?: string

  // Scan results
  linesScanned: number
  findingsCount: number
  hasFindings: boolean
  scanStartedAt: Date
  scanCompletedAt?: Date
  scanDuration?: number
  processingError?: string

  // File classification
  isEnvFile: boolean
  isConfigFile: boolean
  isCodeFile: boolean
  encoding: string

  userId: string
}