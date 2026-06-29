import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

const readdir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)
const stat = promisify(fs.stat)

// Comprehensive API key patterns for multiple platforms
export const API_KEY_PATTERNS = {
  aws: {
    accessKey: {
      pattern: /AKIA[0-9A-Z]{16}/g,
      name: 'AWS Access Key ID',
      confidence: 0.95,
      severity: 'critical'
    },
    secretKey: {
      pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)[\s=:'"]*([A-Za-z0-9/+=]{40})/g,
      name: 'AWS Secret Access Key',
      confidence: 0.90,
      severity: 'critical'
    },
    sessionToken: {
      pattern: /(?:aws_session_token|AWS_SESSION_TOKEN)[\s=:'"]*([A-Za-z0-9/+=]{16,})/g,
      name: 'AWS Session Token',
      confidence: 0.85,
      severity: 'high'
    }
  },
  stripe: {
    publishableKey: {
      pattern: /pk_(test|live)_[0-9a-zA-Z]{24}/g,
      name: 'Stripe Publishable Key',
      confidence: 0.98,
      severity: 'medium'
    },
    secretKey: {
      pattern: /sk_(test|live)_[0-9a-zA-Z]{24}/g,
      name: 'Stripe Secret Key',
      confidence: 0.98,
      severity: 'critical'
    },
    restrictedKey: {
      pattern: /rk_(test|live)_[0-9a-zA-Z]{24}/g,
      name: 'Stripe Restricted Key',
      confidence: 0.98,
      severity: 'high'
    }
  },
  github: {
    personalAccessToken: {
      pattern: /ghp_[A-Za-z0-9]{36}/g,
      name: 'GitHub Personal Access Token',
      confidence: 0.97,
      severity: 'critical'
    },
    oauthToken: {
      pattern: /gho_[A-Za-z0-9]{36}/g,
      name: 'GitHub OAuth Token',
      confidence: 0.97,
      severity: 'high'
    },
    appToken: {
      pattern: /ghs_[A-Za-z0-9]{36}/g,
      name: 'GitHub App Token',
      confidence: 0.97,
      severity: 'high'
    },
    refreshToken: {
      pattern: /ghr_[A-Za-z0-9]{36}/g,
      name: 'GitHub Refresh Token',
      confidence: 0.97,
      severity: 'high'
    }
  },
  grafana: {
    serviceToken: {
      pattern: /glsa_[A-Za-z0-9]{32}_[A-Za-z0-9]{8}/g,
      name: 'Grafana Service Account Token',
      confidence: 0.99,
      severity: 'critical'
    },
    apiKey: {
      pattern: /eyJrIjoi[A-Za-z0-9+/=]+/g,
      name: 'Grafana API Key (JWT)',
      confidence: 0.75,
      severity: 'high'
    },
    cloudToken: {
      pattern: /glc_[A-Za-z0-9]{32}/g,
      name: 'Grafana Cloud Token',
      confidence: 0.95,
      severity: 'critical'
    }
  },
  datadog: {
    apiKey: {
      pattern: /(?:datadog_api_key|DD_API_KEY)[\s=:'"]*([a-f0-9]{32})/gi,
      name: 'Datadog API Key',
      confidence: 0.80,
      severity: 'critical'
    },
    appKey: {
      pattern: /(?:datadog_app_key|DD_APP_KEY)[\s=:'"]*([a-f0-9]{40})/gi,
      name: 'Datadog Application Key',
      confidence: 0.85,
      severity: 'high'
    }
  },
  slack: {
    botToken: {
      pattern: /xoxb-[0-9]{11,13}-[0-9]{11,13}-[A-Za-z0-9]{24}/g,
      name: 'Slack Bot Token',
      confidence: 0.95,
      severity: 'high'
    },
    userToken: {
      pattern: /xoxp-[0-9]{11,13}-[0-9]{11,13}-[0-9]{11,13}-[A-Za-z0-9]{32}/g,
      name: 'Slack User Token',
      confidence: 0.95,
      severity: 'critical'
    },
    webhookUrl: {
      pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{9}\/[A-Z0-9]{9}\/[A-Za-z0-9]{24}/g,
      name: 'Slack Webhook URL',
      confidence: 0.90,
      severity: 'medium'
    }
  },
  google: {
    apiKey: {
      pattern: /AIza[0-9A-Za-z_-]{35}/g,
      name: 'Google API Key',
      confidence: 0.90,
      severity: 'high'
    },
    serviceAccount: {
      pattern: /"type":\s*"service_account"/g,
      name: 'Google Service Account JSON',
      confidence: 0.70,
      severity: 'critical'
    }
  },
  generic: {
    privateKey: {
      pattern: /-----BEGIN (RSA |DSA |EC |OPENSSH |)PRIVATE KEY-----/g,
      name: 'Private Key',
      confidence: 0.99,
      severity: 'critical'
    },
    jwt: {
      pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
      name: 'JSON Web Token (JWT)',
      confidence: 0.70,
      severity: 'medium'
    },
    bearer: {
      pattern: /(?:bearer|Bearer)\s+([A-Za-z0-9_-]{20,})/g,
      name: 'Bearer Token',
      confidence: 0.60,
      severity: 'medium'
    },
    basicAuth: {
      pattern: /(?:basic|Basic)\s+([A-Za-z0-9+/=]{20,})/g,
      name: 'Basic Authentication',
      confidence: 0.65,
      severity: 'high'
    }
  }
}

// File patterns that commonly contain sensitive data
export const SENSITIVE_FILE_PATTERNS = [
  '**/.env*',
  '**/config/**/*.{yml,yaml,json,ini,conf}',
  '**/secrets/**/*',
  '**/*.pem',
  '**/*.key',
  '**/*.p12',
  '**/*.pfx',
  '**/.aws/**/*',
  '**/.ssh/**/*',
  '**/docker-compose*.yml',
  '**/Dockerfile*',
  '**/*.tf',
  '**/*.tfvars',
  '**/helm/**/*.{yml,yaml}',
  '**/k8s/**/*.{yml,yaml}',
  '**/kubernetes/**/*.{yml,yaml}'
]

// Directories to exclude from scanning
export const DEFAULT_EXCLUDE_PATHS = [
  'node_modules',
  '.git/objects',
  '.git/refs',
  '.git/logs',
  'build',
  'dist',
  'target',
  'bin',
  '.next',
  '.nuxt',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'venv',
  '.venv',
  'env',
  '.env',
  'vendor'
]

export interface ScanConfig {
  targetPath: string
  scanType: 'quick' | 'deep' | 'git-history'
  includeHidden: boolean
  maxDepth?: number
  fileExtensions: string[]
  excludePaths: string[]
  maxFileSize: number // in bytes
}

export interface ScanProgress {
  totalFiles: number
  scannedFiles: number
  findingsCount: number
  currentFile: string
  progress: number
}

export interface ScanFinding {
  filePath: string
  relativePath: string
  fileName: string
  lineNumber: number
  lineContent: string
  keyPreview: string
  keyType: string
  pattern: string
  patternName: string
  severity: string
  confidence: number
  riskLevel: string
  fileSize: bigint
  fileModified: Date
  gitTracked: boolean
  gitCommit?: string
}

export class LocalFileScanner {
  private config: ScanConfig
  private onProgress?: (progress: ScanProgress) => void
  private cancelled = false

  constructor(config: ScanConfig, onProgress?: (progress: ScanProgress) => void) {
    this.config = config
    this.onProgress = onProgress
  }

  cancel() {
    this.cancelled = true
  }

  async scan(): Promise<ScanFinding[]> {
    console.log('[SCANNER] Starting scan, config:', this.config)
    this.cancelled = false
    const findings: ScanFinding[] = []
    
    try {
      // Get list of files to scan
      console.log('[SCANNER] Getting files to scan from:', this.config.targetPath)
      const filesToScan = await this.getFilesToScan()
      console.log('[SCANNER] Found files to scan:', filesToScan.length)
      
      const progress: ScanProgress = {
        totalFiles: filesToScan.length,
        scannedFiles: 0,
        findingsCount: 0,
        currentFile: '',
        progress: 0
      }

      // Scan each file
      console.log('[SCANNER] Starting file scanning loop')
      for (const filePath of filesToScan) {
        if (this.cancelled) break

        progress.currentFile = path.basename(filePath)
        console.log(`[SCANNER] Scanning file ${progress.scannedFiles + 1}/${progress.totalFiles}: ${filePath}`)
        this.onProgress?.(progress)

        try {
          const fileFindings = await this.scanFile(filePath)
          findings.push(...fileFindings)
          progress.findingsCount = findings.length
          console.log(`[SCANNER] File scan completed: ${filePath}, findings: ${fileFindings.length}`)
        } catch (error) {
          console.warn(`[SCANNER] Failed to scan ${filePath}:`, error)
          console.warn('[SCANNER] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined
          })
        }

        progress.scannedFiles++
        progress.progress = progress.scannedFiles / progress.totalFiles
        this.onProgress?.(progress)
      }

      console.log('[SCANNER] Scan completed successfully, total findings:', findings.length)
      return findings
    } catch (error) {
      console.error('[SCANNER] Scan failed:', error)
      console.error('[SCANNER] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      })
      throw error
    }
  }

  private async getFilesToScan(): Promise<string[]> {
    console.log('[SCANNER] getFilesToScan started')
    const files: string[] = []
    
    const traverseDirectory = async (dirPath: string, currentDepth = 0) => {
      if (this.cancelled) return
      if (this.config.maxDepth && currentDepth > this.config.maxDepth) {
        console.log(`[SCANNER] Skipping ${dirPath} - max depth reached (${currentDepth})`)
        return
      }

      try {
        console.log(`[SCANNER] Reading directory: ${dirPath} (depth: ${currentDepth})`)
        const items = await readdir(dirPath, { withFileTypes: true })
        console.log(`[SCANNER] Found ${items.length} items in ${dirPath}`)

        for (const item of items) {
          if (this.cancelled) return

          const itemPath = path.join(dirPath, item.name)
          const relativePath = path.relative(this.config.targetPath, itemPath)

          // Skip if excluded
          if (this.shouldExclude(relativePath, item.name)) continue

          if (item.isDirectory()) {
            await traverseDirectory(itemPath, currentDepth + 1)
          } else if (item.isFile()) {
            // Check file extension filter
            if (this.config.fileExtensions.length > 0) {
              const ext = path.extname(item.name).toLowerCase()
              if (!this.config.fileExtensions.includes(ext)) continue
            }

            // Check file size
            try {
              const stats = await stat(itemPath)
              if (stats.size > this.config.maxFileSize) continue
            } catch {
              continue
            }

            files.push(itemPath)
          }
        }
      } catch (error) {
        console.warn(`[SCANNER] Failed to read directory ${dirPath}:`, error)
        console.warn('[SCANNER] Directory read error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined
        })
      }
    }

    await traverseDirectory(this.config.targetPath)
    console.log(`[SCANNER] getFilesToScan completed, found ${files.length} files`)
    return files
  }

  private shouldExclude(relativePath: string, fileName: string): boolean {
    // Skip hidden files unless explicitly included
    if (!this.config.includeHidden && fileName.startsWith('.')) {
      return true
    }

    // Check exclude patterns
    for (const excludePath of this.config.excludePaths) {
      if (relativePath.includes(excludePath) || fileName === excludePath) {
        return true
      }
    }

    return false
  }

  private async scanFile(filePath: string): Promise<ScanFinding[]> {
    console.log(`[SCANNER] scanFile started: ${filePath}`)
    const findings: ScanFinding[] = []
    
    try {
      console.log(`[SCANNER] Reading file content: ${filePath}`)
      const content = await readFile(filePath, 'utf8')
      console.log(`[SCANNER] File content read, length: ${content.length} characters`)
      
      const lines = content.split('\n')
      console.log(`[SCANNER] File split into ${lines.length} lines`)
      
      const stats = await stat(filePath)
      const relativePath = path.relative(this.config.targetPath, filePath)
      const fileName = path.basename(filePath)
      console.log(`[SCANNER] File stats obtained: ${fileName}, size: ${stats.size} bytes`)

      // Check if file is tracked by git
      let gitTracked = false
      try {
        // Simple check - more robust git integration could be added
        gitTracked = !relativePath.includes('.git/')
      } catch {
        gitTracked = false
      }

      // Scan each line for patterns
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]
        const lineNumber = lineIndex + 1

        // Test against all patterns
        for (const [platform, patterns] of Object.entries(API_KEY_PATTERNS)) {
          for (const [patternType, patternConfig] of Object.entries(patterns)) {
            const regex = new RegExp(patternConfig.pattern.source, patternConfig.pattern.flags)
            const matches = line.match(regex)

            if (matches) {
              for (const match of matches) {
                const keyPreview = this.maskKey(match)
                const riskLevel = this.calculateRiskLevel(
                  patternConfig.severity,
                  patternConfig.confidence,
                  fileName,
                  relativePath
                )

                findings.push({
                  filePath,
                  relativePath,
                  fileName,
                  lineNumber,
                  lineContent: line.trim(),
                  keyPreview,
                  keyType: platform,
                  pattern: patternConfig.pattern.source,
                  patternName: patternConfig.name,
                  severity: patternConfig.severity,
                  confidence: patternConfig.confidence,
                  riskLevel,
                  fileSize: BigInt(stats.size),
                  fileModified: stats.mtime,
                  gitTracked
                })
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`[SCANNER] scanFile error for ${filePath}:`, error)
      console.log('[SCANNER] scanFile error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        code: (error as any)?.code
      })
      
      // Skip binary files or files that can't be read as text
      if (error instanceof Error && error.message.includes('invalid UTF-8')) {
        console.log(`[SCANNER] Skipping binary file: ${filePath}`)
        return []
      }
      throw error
    }

    return findings
  }

  private maskKey(key: string): string {
    if (key.length <= 8) return '***'
    const start = key.slice(0, 4)
    const end = key.slice(-4)
    const middle = '*'.repeat(Math.max(key.length - 8, 3))
    return `${start}${middle}${end}`
  }

  private calculateRiskLevel(
    severity: string,
    confidence: number,
    fileName: string,
    relativePath: string
  ): string {
    let riskScore = 0

    // Base risk from severity
    switch (severity) {
      case 'critical': riskScore += 4; break
      case 'high': riskScore += 3; break
      case 'medium': riskScore += 2; break
      case 'low': riskScore += 1; break
    }

    // Confidence multiplier
    riskScore *= confidence

    // File location risk factors
    if (relativePath.includes('.env')) riskScore += 1
    if (relativePath.includes('config')) riskScore += 0.5
    if (relativePath.includes('secret')) riskScore += 1
    if (fileName.includes('prod') || fileName.includes('production')) riskScore += 0.5
    if (relativePath.includes('public') || relativePath.includes('www')) riskScore -= 0.5

    // Final risk level
    if (riskScore >= 4.5) return 'critical'
    if (riskScore >= 3.5) return 'high'
    if (riskScore >= 2.0) return 'medium'
    return 'low'
  }
}

export function getDefaultScanConfig(targetPath: string): ScanConfig {
  return {
    targetPath,
    scanType: 'quick',
    includeHidden: false,
    maxDepth: 10,
    fileExtensions: [],
    excludePaths: DEFAULT_EXCLUDE_PATHS,
    maxFileSize: 10 * 1024 * 1024 // 10MB
  }
}