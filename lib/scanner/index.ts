// Main scanner library exports

// Import types first for use in functions
import type {
  ScanOptions,
  ScanResult,
  Finding,
  LocalScanFindingData,
  FileScanData,
  FileInfo
} from './types'

// Import SecurityScanner class
import { SecurityScanner } from './core'

// Core scanner functionality
export { SecurityScanner, quickScan, deepScan } from './core'

// Risk analysis
export { RiskAnalyzer } from './analyzer'

// API key patterns
export {
  KEY_PATTERNS,
  OBSERVABILITY_PATTERNS,
  CONTEXT_DEPENDENT_PATTERNS,
  ALL_PATTERNS,
  calculateEntropy as patternCalculateEntropy,
  getPatternsByPlatform,
  getPatternsByType,
  getHighConfidencePatterns
} from './patterns'

// Utilities
export {
  generateSalt,
  createSecureKeyHash,
  createKeyPreview,
  calculateEntropy,
  getFileInfo,
  findGitRoot,
  getGitFileInfo,
  isFileReadable,
  isFileBinary,
  shouldExcludeFile,
  shouldExcludeDirectory,
  getLineContext,
  sanitizeLineContent,
  detectFileEncoding,
  createScanError,
  validatePath,
  chunkArray,
  formatFileSize,
  formatDuration,
  MAX_FILE_SIZE,
  MAX_LINE_LENGTH,
  CONTEXT_LINES,
  SALT_LENGTH,
  SCANNABLE_EXTENSIONS,
  EXCLUDED_DIRS,
  EXCLUDED_FILES
} from './utils'

// TypeScript types
export type {
  KeyPattern,
  ScanOptions,
  Finding,
  FileInfo,
  ScanResult,
  FileScanResult,
  ScanError,
  RiskAssessment,
  ContextAnalysis,
  KeyValidation,
  ScanProgress,
  ScannerConfig,
  ScanSessionData,
  LocalScanFindingData,
  KeyHashData,
  FileScanData
} from './types'

// Scanner configuration presets
export const SCANNER_PRESETS = {
  QUICK: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxScanDepth: 3,
    contextLines: 2,
    entropyThreshold: 3.5,
    confidenceThreshold: 0.7,
    enableParallelScanning: false,
    enableGitIntegration: false,
    enableContextAnalysis: false,
    chunkSize: 50,
    timeoutPerFile: 10000
  },

  BALANCED: {
    maxFileSize: 25 * 1024 * 1024, // 25MB
    maxScanDepth: 6,
    contextLines: 3,
    entropyThreshold: 3.0,
    confidenceThreshold: 0.6,
    enableParallelScanning: false,
    enableGitIntegration: true,
    enableContextAnalysis: true,
    chunkSize: 100,
    timeoutPerFile: 20000
  },

  THOROUGH: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxScanDepth: 10,
    contextLines: 5,
    entropyThreshold: 2.5,
    confidenceThreshold: 0.4,
    enableParallelScanning: false,
    enableGitIntegration: true,
    enableContextAnalysis: true,
    chunkSize: 200,
    timeoutPerFile: 30000
  }
} as const

// Helper function to create scanner with preset
export function createScanner(preset: keyof typeof SCANNER_PRESETS = 'BALANCED') {
  return new SecurityScanner(SCANNER_PRESETS[preset])
}

// Convenience functions for different scan types
export async function scanForSecrets(
  targetPath: string,
  options: Partial<ScanOptions> = {}
): Promise<ScanResult> {
  const scanner = createScanner('BALANCED')

  const scanOptions: ScanOptions = {
    targetPath,
    scanType: 'deep',
    includeHidden: false,
    maxDepth: 6,
    ...options
  }

  return scanner.scanDirectory(scanOptions)
}

export async function scanEnvironmentFiles(
  targetPath: string,
  options: Partial<ScanOptions> = {}
): Promise<ScanResult> {
  const scanner = createScanner('THOROUGH')

  const scanOptions: ScanOptions = {
    targetPath,
    scanType: 'targeted',
    includeHidden: true,
    fileExtensions: ['.env', '.env.local', '.env.development', '.env.production', '.env.staging', '.env.test'],
    ...options
  }

  return scanner.scanDirectory(scanOptions)
}

export async function scanConfigFiles(
  targetPath: string,
  options: Partial<ScanOptions> = {}
): Promise<ScanResult> {
  const scanner = createScanner('BALANCED')

  const scanOptions: ScanOptions = {
    targetPath,
    scanType: 'targeted',
    includeHidden: false,
    fileExtensions: ['.json', '.yaml', '.yml', '.toml', '.ini', '.config', '.conf', '.properties'],
    ...options
  }

  return scanner.scanDirectory(scanOptions)
}

export async function scanSourceCode(
  targetPath: string,
  options: Partial<ScanOptions> = {}
): Promise<ScanResult> {
  const scanner = createScanner('BALANCED')

  const scanOptions: ScanOptions = {
    targetPath,
    scanType: 'deep',
    includeHidden: false,
    fileExtensions: [
      '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
      '.py', '.pyc', '.pyw', '.pyo',
      '.rb', '.rbw',
      '.php', '.php3', '.php4', '.php5', '.phtml',
      '.go', '.mod', '.sum',
      '.java', '.class',
      '.cs', '.vb', '.fs',
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd'
    ],
    ...options
  }

  return scanner.scanDirectory(scanOptions)
}

// Platform-specific scanning functions

// Database integration helpers (to be used with Prisma)
export function convertFindingToLocalScanFindingData(
  finding: Finding,
  sessionId: string,
  userId: string,
  fileScanId?: string,
  keyHashId?: string
): LocalScanFindingData {
  return {
    sessionId,
    fileScanId,
    keyHashId,

    // Location
    filePath: finding.filePath,
    relativePath: finding.relativePath,
    fileName: finding.fileName,
    lineNumber: finding.lineNumber,
    columnStart: finding.columnStart,
    columnEnd: finding.columnEnd,

    // Content (sanitized)
    lineContent: finding.lineContent,
    beforeContext: finding.beforeContext,
    afterContext: finding.afterContext,
    keyPreview: finding.keyPreview,

    // Detection
    keyType: finding.keyType,
    detectionRule: finding.detectionRule,
    pattern: finding.detectionRule,
    patternName: finding.patternName,
    severity: finding.severity,
    confidence: finding.confidence,
    riskLevel: finding.riskLevel,
    riskFactors: finding.riskFactors,

    // Classification
    isLikelyActive: finding.isLikelyActive,
    isInComment: finding.isInComment,
    isInString: finding.isInString,
    isInEnvFile: finding.isInEnvFile,
    isBase64Encoded: finding.isBase64Encoded,
    isTestKey: finding.isTestKey,
    isExampleKey: finding.isExampleKey,

    // Validation
    isValidated: false, // Default to not validated

    userId
  }
}

export function convertFileInfoToFileScanData(
  fileInfo: FileInfo,
  sessionId: string,
  userId: string,
  scanDuration?: number,
  linesScanned?: number,
  findingsCount?: number,
  hasFindings?: boolean,
  processingError?: string
): FileScanData {
  return {
    sessionId,
    absolutePath: fileInfo.absolutePath,
    relativePath: fileInfo.relativePath,
    fileName: fileInfo.fileName,
    fileExtension: fileInfo.fileExtension || undefined,
    fileSize: BigInt(fileInfo.fileSize),
    fileHash: '', // Would need to calculate this
    lastModified: fileInfo.lastModified,
    permissions: fileInfo.permissions,

    // Git data
    isGitTracked: fileInfo.isGitTracked,
    gitCommitHash: fileInfo.gitCommitHash,
    gitBranch: fileInfo.gitBranch,
    gitLastCommit: fileInfo.gitLastCommit,
    gitAuthor: fileInfo.gitAuthor,

    // Scan results
    linesScanned: linesScanned || 0,
    findingsCount: findingsCount || 0,
    hasFindings: hasFindings || false,
    scanStartedAt: new Date(),
    scanCompletedAt: scanDuration ? new Date(Date.now() + scanDuration) : undefined,
    scanDuration,
    processingError,

    // File classification
    isEnvFile: fileInfo.isEnvFile,
    isConfigFile: fileInfo.isConfigFile,
    isCodeFile: fileInfo.isCodeFile,
    encoding: fileInfo.encoding,

    userId
  }
}