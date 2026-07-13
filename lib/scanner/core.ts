// Core scanner logic with file system traversal and API key detection

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { EventEmitter } from 'events'
import type {
  ScanOptions,
  ScanResult,
  Finding,
  FileInfo,
  FileScanResult,
  ScanError,
  ScanProgress,
  ScannerConfig
} from './types'
import { ALL_PATTERNS } from './patterns'
import { RiskAnalyzer } from './analyzer'
import {
  getFileInfo,
  isFileReadable,
  isFileBinary,
  shouldExcludeFile,
  shouldExcludeDirectory,
  getLineContext,
  sanitizeLineContent,
  createSecureKeyHash,
  createKeyPreview,
  calculateEntropy,
  validatePath,
  chunkArray,
  formatDuration,
  MAX_FILE_SIZE,
  CONTEXT_LINES
} from './utils'

export class SecurityScanner extends EventEmitter {
  private riskAnalyzer: RiskAnalyzer
  private config: ScannerConfig
  private isScanning: boolean = false
  private shouldStop: boolean = false

  constructor(config?: Partial<ScannerConfig>) {
    super()
    this.riskAnalyzer = new RiskAnalyzer()
    this.config = {
      maxFileSize: MAX_FILE_SIZE,
      maxScanDepth: 10,
      contextLines: CONTEXT_LINES,
      entropyThreshold: 3.5,
      confidenceThreshold: 0.5,
      enableParallelScanning: false, // Start with sequential for reliability
      enableGitIntegration: true,
      enableContextAnalysis: true,
      chunkSize: 100,
      timeoutPerFile: 30000, // 30 seconds per file
      ...config
    }
  }

  /**
   * Main entry point for scanning a directory or file
   */
  public async scanDirectory(options: ScanOptions): Promise<ScanResult> {
    if (this.isScanning) {
      throw new Error('Scanner is already running')
    }

    this.isScanning = true
    this.shouldStop = false

    const startTime = Date.now()
    const sessionId = crypto.randomUUID()

    // Validate scan options
    const validationResult = this.validateScanOptions(options)
    if (!validationResult.isValid) {
      throw new Error(`Invalid scan options: ${validationResult.error}`)
    }

    // Initialize result object
    const result: ScanResult = {
      sessionId,
      scanOptions: options,
      findings: [],
      fileScans: [],
      totalFiles: 0,
      scannedFiles: 0,
      skippedFiles: 0,
      errorCount: 0,
      status: 'running',
      progress: 0,
      startedAt: new Date(startTime),
      errors: [],
      warnings: []
    }

    try {
      this.emit('scanStarted', { sessionId, options })

      // Discover files to scan
      const files = await this.discoverFiles(options)
      result.totalFiles = files.length

      this.emit('filesDiscovered', { sessionId, totalFiles: files.length })

      // Process files in chunks for better performance and progress reporting
      const fileChunks = chunkArray(files, this.config.chunkSize)

      for (const chunk of fileChunks) {
        if (this.shouldStop) {
          result.status = 'cancelled'
          break
        }

        await this.processFileChunk(chunk, options, result)

        // Update progress
        result.progress = result.scannedFiles / result.totalFiles
        this.emit('progressUpdate', {
          sessionId,
          progress: result.progress,
          scannedFiles: result.scannedFiles,
          totalFiles: result.totalFiles,
          findingsCount: result.findings.length
        })
      }

      // Finalize result
      if (result.status !== 'cancelled') {
        result.status = result.errorCount > 0 ? 'completed' : 'completed'
      }

      result.completedAt = new Date()
      result.duration = Date.now() - startTime

      this.emit('scanCompleted', {
        sessionId,
        result: {
          status: result.status,
          totalFiles: result.totalFiles,
          scannedFiles: result.scannedFiles,
          findingsCount: result.findings.length,
          errorCount: result.errorCount,
          duration: result.duration
        }
      })

      return result

    } catch (error) {
      result.status = 'failed'
      result.errors.push({
        type: 'processing_error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })

      this.emit('scanError', { sessionId, error })
      throw error

    } finally {
      this.isScanning = false
    }
  }

  /**
   * Scan a single file for API keys
   */
  public async scanFile(filePath: string): Promise<Finding[]> {
    try {
      // Validate file path
      const pathValidation = validatePath(filePath)
      if (!pathValidation.isValid) {
        throw new Error(pathValidation.error)
      }

      // Check if file is readable
      if (!(await isFileReadable(filePath))) {
        throw new Error('File is not readable')
      }

      // Check if file is binary
      if (await isFileBinary(filePath)) {
        return [] // Skip binary files
      }

      // Get file info
      const fileInfo = await getFileInfo(filePath)

      // Check file size
      if (fileInfo.fileSize > this.config.maxFileSize) {
        throw new Error(`File too large: ${fileInfo.fileSize} bytes`)
      }

      // Read file content
      const content = await fs.promises.readFile(filePath, 'utf-8')

      // Scan content for keys
      const findings = await this.scanContent(content, fileInfo)

      return findings

    } catch (error) {
      throw new Error(`Failed to scan file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Cancel an ongoing scan
   */
  public cancelScan(): void {
    this.shouldStop = true
    this.emit('scanCancelled')
  }

  /**
   * Get current scan status
   */
  public getStatus(): { isScanning: boolean; shouldStop: boolean } {
    return {
      isScanning: this.isScanning,
      shouldStop: this.shouldStop
    }
  }

  // Private methods

  private validateScanOptions(options: ScanOptions): { isValid: boolean; error?: string } {
    // Validate target path
    const pathValidation = validatePath(options.targetPath)
    if (!pathValidation.isValid) {
      return pathValidation
    }

    // Check if target path exists
    try {
      const stats = fs.statSync(options.targetPath)
      if (!stats.isDirectory() && !stats.isFile()) {
        return { isValid: false, error: 'Target path must be a file or directory' }
      }
    } catch {
      return { isValid: false, error: 'Target path does not exist' }
    }

    // Validate other options
    if (options.maxDepth && options.maxDepth < 0) {
      return { isValid: false, error: 'Max depth must be non-negative' }
    }

    return { isValid: true }
  }

  private async discoverFiles(options: ScanOptions): Promise<string[]> {
    const files: string[] = []

    const stats = await fs.promises.stat(options.targetPath)

    if (stats.isFile()) {
      // Single file scan
      files.push(options.targetPath)
    } else if (stats.isDirectory()) {
      // Directory scan
      await this.walkDirectory(
        options.targetPath,
        options,
        files,
        0
      )
    }

    // Coverage filters are honored here, at discovery: a toggle that is off
    // means the file is never read. Detection thresholds stay with the preset.
    const filter = { extensions: options.fileExtensions, excludeNames: options.excludePaths }
    return files.filter(file => !shouldExcludeFile(file, filter))
  }

  private async walkDirectory(
    dirPath: string,
    options: ScanOptions,
    files: string[],
    currentDepth: number
  ): Promise<void> {
    if (options.maxDepth && currentDepth > options.maxDepth) {
      return
    }

    if (this.shouldStop) {
      return
    }

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        if (this.shouldStop) break

        const fullPath = path.join(dirPath, entry.name)

        // Skip hidden files/directories if not included
        if (!options.includeHidden && entry.name.startsWith('.') && entry.name !== '.env') {
          continue
        }

        if (entry.isDirectory()) {
          // Skip excluded directories
          if (shouldExcludeDirectory(fullPath, options.targetPath)) {
            continue
          }
          // caller-excluded directory names (coverage toggles)
          if (options.excludePaths?.includes(entry.name)) {
            continue
          }

          await this.walkDirectory(fullPath, options, files, currentDepth + 1)
        } else if (entry.isFile()) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // Log error but continue scanning
      this.emit('directoryError', {
        path: dirPath,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async processFileChunk(
    files: string[],
    options: ScanOptions,
    result: ScanResult
  ): Promise<void> {
    for (const filePath of files) {
      if (this.shouldStop) break

      try {
        const fileScanResult = await this.scanSingleFile(filePath, options)
        result.fileScans.push(fileScanResult)
        result.findings.push(...fileScanResult.findings)
        result.scannedFiles++

        this.emit('fileScanned', {
          sessionId: result.sessionId,
          filePath,
          findingsCount: fileScanResult.findings.length,
          hasFindings: fileScanResult.hasFindings
        })

      } catch (error) {
        result.errorCount++
        result.skippedFiles++

        const scanError: ScanError = {
          type: 'processing_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          filePath
        }

        result.errors.push(scanError)

        this.emit('fileError', {
          sessionId: result.sessionId,
          filePath,
          error: scanError
        })
      }
    }
  }

  private async scanSingleFile(filePath: string, options: ScanOptions): Promise<FileScanResult> {
    const startTime = Date.now()

    try {
      // Get file info
      const fileInfo = await getFileInfo(filePath, options.targetPath)

      // Check if file should be scanned
      if (fileInfo.fileSize > this.config.maxFileSize) {
        throw new Error(`File too large: ${fileInfo.fileSize} bytes`)
      }

      if (await isFileBinary(filePath)) {
        return {
          fileInfo,
          findings: [],
          scanDuration: Date.now() - startTime,
          linesScanned: 0,
          hasFindings: false
        }
      }

      // Read and scan content
      const content = await fs.promises.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const findings = await this.scanContent(content, fileInfo)

      return {
        fileInfo,
        findings,
        scanDuration: Date.now() - startTime,
        linesScanned: lines.length,
        hasFindings: findings.length > 0
      }

    } catch (error) {
      return {
        fileInfo: await getFileInfo(filePath, options.targetPath),
        findings: [],
        scanDuration: Date.now() - startTime,
        linesScanned: 0,
        hasFindings: false,
        processingError: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Scan file contents provided directly (e.g. files a browser read from a
   * folder the user picked), rather than walking the filesystem. The browser
   * can't hand us an absolute path, so it hands us the files, we scan those.
   */
  public async scanProvidedFiles(files: { relativePath: string; content: string }[]): Promise<ScanResult> {
    const findings: Finding[] = []
    const fileScans: FileScanResult[] = []
    for (const f of files) {
      const ext = (f.relativePath.match(/\.[^./\\]+$/)?.[0] ?? '').toLowerCase()
      const fileInfo: FileInfo = {
        absolutePath: f.relativePath,
        relativePath: f.relativePath,
        fileName: f.relativePath.split(/[/\\]/).pop() ?? f.relativePath,
        fileExtension: ext,
        fileSize: f.content.length,
        lastModified: new Date(),
        permissions: '644',
        isGitTracked: false,
        isEnvFile: /(^|[/\\])\.env/.test(f.relativePath),
        isConfigFile: /\.(ya?ml|toml|json|conf|config|ini)$/i.test(f.relativePath),
        isCodeFile: /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|java|php|cs|sh)$/i.test(f.relativePath),
        encoding: 'utf-8',
      }
      const fileFindings = await this.scanContent(f.content, fileInfo)
      findings.push(...fileFindings)
      fileScans.push({ fileInfo, findings: fileFindings, scanDuration: 0, linesScanned: f.content.split('\n').length, hasFindings: fileFindings.length > 0 })
    }
    const now = new Date()
    return {
      sessionId: '',
      scanOptions: { targetPath: '', scanType: 'quick' } as ScanOptions,
      findings, fileScans,
      totalFiles: files.length, scannedFiles: files.length, skippedFiles: 0, errorCount: 0,
      status: 'completed', progress: 1, startedAt: now, completedAt: now, duration: 0,
      errors: [], warnings: [],
    }
  }

  private async scanContent(content: string, fileInfo: FileInfo): Promise<Finding[]> {
    const findings: Finding[] = []
    const lines = content.split('\n')

    // Filter patterns based on configuration
    const patterns = ALL_PATTERNS.filter(pattern =>
      pattern.confidence >= this.config.confidenceThreshold
    )

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]

      if (line.length > 10000) continue // Skip extremely long lines

      for (const pattern of patterns) {
        const matches = Array.from(line.matchAll(pattern.pattern))

        for (const match of matches) {
          if (this.shouldStop) return findings

          const key = match[1] || match[0]
          if (!key || key.length < 8) continue

          // Calculate entropy
          const entropy = calculateEntropy(key)

          // Skip low-entropy matches for generic patterns
          if (pattern.platform === 'Generic' && entropy < this.config.entropyThreshold) {
            continue
          }

          // Validate key format if validation function exists
          if (pattern.validationFn && !pattern.validationFn(key)) {
            continue
          }

          // Create finding
          const finding = await this.createFinding(
            key,
            pattern,
            fileInfo,
            lineIndex,
            line,
            lines,
            match.index || 0,
            entropy
          )

          // Apply risk analysis if enabled
          if (this.config.enableContextAnalysis) {
            const riskAssessment = this.riskAnalyzer.analyzeRisk(finding)
            finding.riskLevel = riskAssessment.riskLevel
            finding.riskFactors = riskAssessment.riskFactors
          }

          findings.push(finding)
        }
      }
    }

    return findings
  }

  private async createFinding(
    key: string,
    pattern: any,
    fileInfo: FileInfo,
    lineIndex: number,
    line: string,
    lines: string[],
    columnStart: number,
    entropy: number
  ): Promise<Finding> {
    // Create secure hash and preview
    const { hash: keyHash } = createSecureKeyHash(key)
    const keyPreview = createKeyPreview(key)

    // Get context lines
    const { beforeContext, afterContext } = getLineContext(lines, lineIndex, this.config.contextLines)

    // Sanitize line content (mask the key)
    const columnEnd = columnStart + key.length
    const sanitizedLine = sanitizeLineContent(line, columnStart, columnEnd)

    // Classify the finding
    const isInComment = /^\s*(\/\/|\/\*|\*|#|<!--)/.test(line.trim())
    const isInString = /['"`]/.test(line)
    const isBase64Encoded = this.isBase64Encoded(key)
    const isTestKey = this.isTestKey(key, fileInfo.fileName)
    const isExampleKey = this.isExampleKey(key, line, fileInfo.fileName)

    return {
      keyPreview,
      keyHash,
      keyType: pattern.keyType,
      platform: pattern.platform,
      patternName: pattern.name,
      detectionRule: pattern.pattern.toString(),

      filePath: fileInfo.absolutePath,
      relativePath: fileInfo.relativePath,
      fileName: fileInfo.fileName,
      lineNumber: lineIndex + 1,
      columnStart,
      columnEnd,

      lineContent: sanitizedLine,
      beforeContext,
      afterContext,

      severity: pattern.severity,
      confidence: pattern.confidence,
      riskLevel: 'medium', // Will be updated by risk analyzer
      riskFactors: [],

      isLikelyActive: !isInComment && !isTestKey && !isExampleKey,
      isInComment,
      isInString,
      isInEnvFile: fileInfo.isEnvFile,
      isBase64Encoded,
      isTestKey,
      isExampleKey,

      entropy,
      estimatedLength: key.length,
      detectedAt: new Date()
    }
  }

  private isBase64Encoded(key: string): boolean {
    try {
      return btoa(atob(key)) === key && key.length % 4 === 0
    } catch {
      return false
    }
  }

  private isTestKey(key: string, fileName: string): boolean {
    const lowerKey = key.toLowerCase()
    const lowerFileName = fileName.toLowerCase()

    const testIndicators = ['test', 'example', 'sample', 'demo', 'dummy', 'fake', 'mock']

    return testIndicators.some(indicator =>
      lowerKey.includes(indicator) || lowerFileName.includes(indicator)
    )
  }

  private isExampleKey(key: string, line: string, fileName: string): boolean {
    const lowerLine = line.toLowerCase()
    const lowerFileName = fileName.toLowerCase()

    const exampleIndicators = [
      'example', 'sample', 'placeholder', 'your_key_here',
      'replace_with', 'enter_your', 'add_your'
    ]

    return exampleIndicators.some(indicator =>
      lowerLine.includes(indicator) || lowerFileName.includes(indicator)
    )
  }
}

// Export convenience functions
export async function quickScan(targetPath: string): Promise<ScanResult> {
  const scanner = new SecurityScanner()
  return scanner.scanDirectory({
    targetPath,
    scanType: 'quick',
    includeHidden: false,
    maxDepth: 3
  })
}

export async function deepScan(targetPath: string): Promise<ScanResult> {
  const scanner = new SecurityScanner({
    enableContextAnalysis: true,
    enableGitIntegration: true
  })

  return scanner.scanDirectory({
    targetPath,
    scanType: 'deep',
    includeHidden: true,
    maxDepth: 10
  })
}

