import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// Key detection patterns with confidence levels
export interface KeyPattern {
  name: string
  platform: string
  pattern: RegExp
  confidence: number
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export const KEY_PATTERNS: KeyPattern[] = [
  // Grafana
  {
    name: 'Grafana Service Account Token',
    platform: 'Grafana',
    pattern: /glsa_[a-zA-Z0-9]{32}_[a-zA-Z0-9]{8}/gi,
    confidence: 0.95,
    severity: 'critical'
  },
  
  // Stripe
  {
    name: 'Stripe Secret Key',
    platform: 'Stripe',
    pattern: /sk_(test|live)_[a-zA-Z0-9]{24,}/gi,
    confidence: 0.98,
    severity: 'critical'
  },
  {
    name: 'Stripe Publishable Key',
    platform: 'Stripe',
    pattern: /pk_(test|live)_[a-zA-Z0-9]{24,}/gi,
    confidence: 0.90,
    severity: 'medium'
  },
  
  // AWS
  {
    name: 'AWS Access Key ID',
    platform: 'AWS',
    pattern: /AKIA[0-9A-Z]{16}/gi,
    confidence: 0.95,
    severity: 'critical'
  },
  {
    name: 'AWS Secret Access Key',
    platform: 'AWS',
    pattern: /(?:aws.{0,20}?|secret.{0,20}?)([A-Za-z0-9/+=]{40})/gi,
    confidence: 0.70,
    severity: 'critical'
  },
  
  // GitHub
  {
    name: 'GitHub Personal Access Token',
    platform: 'GitHub',
    pattern: /ghp_[a-zA-Z0-9]{36}/gi,
    confidence: 0.98,
    severity: 'critical'
  },
  {
    name: 'GitHub OAuth Token',
    platform: 'GitHub',
    pattern: /gho_[a-zA-Z0-9]{36}/gi,
    confidence: 0.98,
    severity: 'critical'
  },
  {
    name: 'GitHub App Token',
    platform: 'GitHub',
    pattern: /ghs_[a-zA-Z0-9]{36}/gi,
    confidence: 0.98,
    severity: 'critical'
  },
  
  // Datadog
  {
    name: 'Datadog API Key',
    platform: 'Datadog',
    pattern: /[a-z0-9]{32}/gi, // Less specific, requires context
    confidence: 0.60,
    severity: 'high'
  },
  {
    name: 'Datadog Application Key',
    platform: 'Datadog',
    pattern: /[a-z0-9]{40}/gi, // Less specific, requires context
    confidence: 0.60,
    severity: 'high'
  },
  
  // Generic patterns with lower confidence
  {
    name: 'Generic API Key Pattern',
    platform: 'Generic',
    pattern: /(?:api[_-]?key|token|secret)[_-]?[=:]\s*["']?([a-zA-Z0-9_\-\.]{20,})["']?/gi,
    confidence: 0.50,
    severity: 'medium'
  },
  {
    name: 'High Entropy String (Base64-like)',
    platform: 'Generic',
    pattern: /(?:^|[^a-zA-Z0-9])([A-Za-z0-9+/]{32,}={0,2})(?:[^a-zA-Z0-9]|$)/gi,
    confidence: 0.40,
    severity: 'low'
  }
]

// File types to scan
export const SCANNABLE_EXTENSIONS = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.staging',
  '.env.test',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.config',
  '.conf',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.rb',
  '.php',
  '.go',
  '.java',
  '.sh',
  '.bash'
]

// Directories to exclude from scanning
export const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.nyc_output',
  'tmp',
  'temp',
  'logs',
  '.cache',
  'vendor',
  'target',
  'bin',
  'obj',
  'public',
  'assets'
]

// Security functions for handling keys
export function createKeyHash(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export function createKeyPreview(key: string): string {
  if (key.length <= 8) {
    return '***'
  }
  const start = key.substring(0, 4)
  const end = key.substring(key.length - 4)
  return `${start}****${end}`
}

export function calculateEntropy(str: string): number {
  const frequency: Record<string, number> = {}
  
  for (const char of str) {
    frequency[char] = (frequency[char] || 0) + 1
  }
  
  let entropy = 0
  const length = str.length
  
  for (const count of Object.values(frequency)) {
    const probability = count / length
    entropy -= probability * Math.log2(probability)
  }
  
  return entropy
}

export interface ScanFinding {
  keyPreview: string
  keyHash: string
  keyType: string
  pattern: string
  patternName: string
  platform: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  confidence: number
  lineNumber: number
  lineContent: string
  entropy?: number
  riskLevel: string
}

export function scanContentForKeys(content: string, filePath: string): ScanFinding[] {
  const findings: ScanFinding[] = []
  const lines = content.split('\n')
  
  lines.forEach((line, index) => {
    for (const keyPattern of KEY_PATTERNS) {
      const matches = Array.from(line.matchAll(keyPattern.pattern))
      
      for (const match of matches) {
        const key = match[1] || match[0]
        if (!key || key.length < 10) continue // Skip very short matches
        
        // Calculate entropy for additional validation
        const entropy = calculateEntropy(key)
        
        // Apply additional filtering for generic patterns
        if (keyPattern.platform === 'Generic' || keyPattern.platform === 'Datadog') {
          // Require higher entropy for generic patterns
          if (entropy < 3.5) continue
          
          // Skip common false positives for generic patterns
          if (/^(test|example|sample|demo|placeholder|dummy)$/i.test(key)) continue
          if (/^[0-9]+$/.test(key)) continue // Pure numbers
          if (/^[a-zA-Z]+$/.test(key) && key.length < 32) continue // Pure letters, short
        }
        
        // Adjust confidence based on context
        let adjustedConfidence = keyPattern.confidence
        
        // Higher confidence if found in .env files
        if (filePath.includes('.env')) {
          adjustedConfidence = Math.min(1.0, adjustedConfidence + 0.1)
        }
        
        // Lower confidence for very generic patterns in non-env files
        if (keyPattern.platform === 'Generic' && !filePath.includes('.env')) {
          adjustedConfidence = Math.max(0.3, adjustedConfidence - 0.2)
        }
        
        // Determine risk level
        let riskLevel = 'medium'
        if (keyPattern.severity === 'critical' && adjustedConfidence >= 0.8) {
          riskLevel = 'critical'
        } else if (keyPattern.severity === 'high' && adjustedConfidence >= 0.7) {
          riskLevel = 'high'
        } else if (adjustedConfidence < 0.5) {
          riskLevel = 'low'
        }
        
        findings.push({
          keyPreview: createKeyPreview(key),
          keyHash: createKeyHash(key),
          keyType: keyPattern.platform.toLowerCase(),
          pattern: keyPattern.pattern.toString(),
          patternName: keyPattern.name,
          platform: keyPattern.platform,
          severity: keyPattern.severity,
          confidence: Number(adjustedConfidence.toFixed(2)),
          lineNumber: index + 1,
          lineContent: line.trim(),
          entropy: Number(entropy.toFixed(2)),
          riskLevel
        })
      }
    }
  })
  
  return findings
}

export interface FileDiscoveryResult {
  files: string[]
  totalFiles: number
  scannedPaths: string[]
  excludedPaths: string[]
}

export async function discoverFiles(
  rootPath: string, 
  options: {
    includeHidden?: boolean
    maxDepth?: number
    fileExtensions?: string[]
    excludePaths?: string[]
  } = {}
): Promise<FileDiscoveryResult> {
  const {
    includeHidden = false,
    maxDepth = 10,
    fileExtensions = SCANNABLE_EXTENSIONS,
    excludePaths = EXCLUDED_DIRS
  } = options
  
  const files: string[] = []
  const scannedPaths: string[] = []
  const excludedPaths: string[] = []
  
  async function walkDirectory(dirPath: string, currentDepth: number = 0): Promise<void> {
    if (maxDepth && currentDepth > maxDepth) return
    
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const relativePath = path.relative(rootPath, fullPath)
        
        // Skip hidden files/directories if not included
        if (!includeHidden && entry.name.startsWith('.')) {
          continue
        }
        
        // Skip excluded directories
        if (entry.isDirectory() && excludePaths.some(excluded => 
          entry.name === excluded || relativePath.includes(excluded)
        )) {
          excludedPaths.push(relativePath)
          continue
        }
        
        if (entry.isDirectory()) {
          scannedPaths.push(relativePath)
          await walkDirectory(fullPath, currentDepth + 1)
        } else if (entry.isFile()) {
          // Check if file has scannable extension
          const ext = path.extname(entry.name).toLowerCase()
          const hasNoExt = ext === '' && entry.name.includes('.env')
          
          if (fileExtensions.includes(ext) || hasNoExt) {
            files.push(fullPath)
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error)
      // Continue scanning other directories
    }
  }
  
  try {
    await walkDirectory(rootPath)
  } catch (error) {
    console.error(`Error starting directory walk:`, error)
    throw new Error('Failed to discover files')
  }
  
  return {
    files: files.sort(),
    totalFiles: files.length,
    scannedPaths: scannedPaths.sort(),
    excludedPaths: excludedPaths.sort()
  }
}

export async function scanFile(filePath: string): Promise<{
  findings: ScanFinding[]
  fileInfo: {
    path: string
    relativePath: string
    fileName: string
    size: number
    modified: Date
  }
}> {
  try {
    const stats = await fs.promises.stat(filePath)
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const findings = scanContentForKeys(content, filePath)
    
    return {
      findings,
      fileInfo: {
        path: filePath,
        relativePath: path.relative(process.cwd(), filePath),
        fileName: path.basename(filePath),
        size: stats.size,
        modified: stats.mtime
      }
    }
  } catch (error) {
    console.error(`Error scanning file ${filePath}:`, error)
    throw new Error(`Failed to scan file: ${path.basename(filePath)}`)
  }
}