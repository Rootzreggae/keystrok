// Security utilities and file system helpers for the scanner

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { promisify } from 'util'
import { exec } from 'child_process'
import type { FileInfo, ScanError } from './types'

const execAsync = promisify(exec)

// Security constants
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
export const MAX_LINE_LENGTH = 10000
export const CONTEXT_LINES = 3
export const SALT_LENGTH = 32

// File extensions to scan
export const SCANNABLE_EXTENSIONS = [
  '.env', '.env.local', '.env.development', '.env.production', '.env.staging', '.env.test',
  '.txt', '.json', '.yaml', '.yml', '.config', '.conf', '.ini', '.toml',
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.pyc', '.pyw', '.pyo',
  '.rb', '.rbw',
  '.php', '.php3', '.php4', '.php5', '.phtml',
  '.go', '.mod', '.sum',
  '.java', '.class', '.jar',
  '.cs', '.vb', '.fs',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  '.sql', '.mysql', '.pgsql',
  '.xml', '.html', '.htm', '.xhtml',
  '.properties', '.cfg', '.settings',
  '.dockerfile', '.dockerignore',
  '.gitignore', '.gitattributes',
  '.terraform', '.tf', '.tfvars',
  '.ansible', '.playbook',
  '.k8s', '.kube', '.kubernetes',
  '.md', '.mdx', '.markdown', '.rst',
  '.ipynb'
]

// Directories to exclude from scanning
export const EXCLUDED_DIRS = [
  'node_modules', '.git', '.svn', '.hg', '.bzr',
  '.next', '.nuxt', 'dist', 'build', 'out', 'target',
  'coverage', '.nyc_output', '.coverage',
  'tmp', 'temp', 'cache', '.cache',
  'logs', 'log', '.logs',
  'vendor', 'packages',
  'bin', 'obj', 'debug', 'release',
  'public', 'static', 'assets', 'media', 'uploads',
  '.vscode', '.idea', '.vs',
  '__pycache__', '.pytest_cache',
  '.gradle', '.maven',
  '.terraform', '.terragrunt-cache'
]

// File patterns to exclude
export const EXCLUDED_FILES = [
  '*.min.js', '*.min.css', '*.map',
  '*.jpg', '*.jpeg', '*.png', '*.gif', '*.svg', '*.ico',
  '*.mp4', '*.avi', '*.mov', '*.wmv', '*.flv',
  '*.mp3', '*.wav', '*.flac', '*.aac',
  '*.pdf', '*.doc', '*.docx', '*.xls', '*.xlsx', '*.ppt', '*.pptx',
  '*.zip', '*.tar', '*.gz', '*.bz2', '*.7z', '*.rar',
  '*.exe', '*.dll', '*.so', '*.dylib',
  '*.lock', 'package-lock.json', 'yarn.lock', 'composer.lock'
]

// Security functions for key handling
export function generateSalt(): string {
  return crypto.randomBytes(SALT_LENGTH).toString('hex')
}

export function createSecureKeyHash(key: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || generateSalt()
  const hash = crypto
    .createHash('sha256')
    .update(useSalt + key)
    .digest('hex')

  return { hash, salt: useSalt }
}

export function createKeyPreview(key: string): string {
  if (key.length <= 8) {
    return '***'
  }

  const start = key.substring(0, 4)
  const end = key.substring(key.length - 4)
  const middle = '*'.repeat(Math.min(8, key.length - 8))

  return `${start}${middle}${end}`
}

export function calculateEntropy(str: string): number {
  if (str.length === 0) return 0

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

// File system utilities
export async function getFileInfo(filePath: string, rootPath?: string): Promise<FileInfo> {
  try {
    const stats = await fs.promises.stat(filePath)
    const absolutePath = path.resolve(filePath)
    const relativePath = rootPath ? path.relative(rootPath, absolutePath) : path.basename(absolutePath)
    const fileName = path.basename(absolutePath)
    const fileExtension = path.extname(fileName).toLowerCase()

    // Calculate file hash
    const content = await fs.promises.readFile(absolutePath)
    const fileHash = crypto.createHash('sha256').update(content).digest('hex')

    // Get file permissions
    const permissions = '0' + (stats.mode & parseInt('777', 8)).toString(8)

    // Detect file type
    const isEnvFile = fileName.includes('.env') || fileName === '.env'
    const isConfigFile = ['.json', '.yaml', '.yml', '.config', '.conf', '.ini', '.toml'].includes(fileExtension)
    const isCodeFile = ['.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.php', '.go', '.java', '.cs'].includes(fileExtension)

    // Git integration (if available)
    let gitInfo: {
      isGitTracked: boolean
      gitCommitHash?: string
      gitBranch?: string
      gitLastCommit?: Date
      gitAuthor?: string
    } = {
      isGitTracked: false
    }

    try {
      const gitRoot = await findGitRoot(path.dirname(absolutePath))
      if (gitRoot) {
        gitInfo = await getGitFileInfo(absolutePath, gitRoot)
      }
    } catch {
      // Git operations are optional
    }

    return {
      absolutePath,
      relativePath,
      fileName,
      fileExtension,
      fileSize: stats.size,
      lastModified: stats.mtime,
      permissions,
      isEnvFile,
      isConfigFile,
      isCodeFile,
      encoding: 'utf-8', // Default, could be detected
      isGitTracked: gitInfo.isGitTracked,
      gitCommitHash: gitInfo.gitCommitHash,
      gitBranch: gitInfo.gitBranch,
      gitLastCommit: gitInfo.gitLastCommit,
      gitAuthor: gitInfo.gitAuthor
    }
  } catch (error) {
    throw new Error(`Failed to get file info for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function findGitRoot(startPath: string): Promise<string | null> {
  let currentPath = path.resolve(startPath)

  while (currentPath !== path.dirname(currentPath)) {
    try {
      await fs.promises.access(path.join(currentPath, '.git'))
      return currentPath
    } catch {
      currentPath = path.dirname(currentPath)
    }
  }

  return null
}

export async function getGitFileInfo(filePath: string, gitRoot: string): Promise<{
  isGitTracked: boolean
  gitCommitHash?: string
  gitBranch?: string
  gitLastCommit?: Date
  gitAuthor?: string
}> {
  const relativePath = path.relative(gitRoot, filePath)

  try {
    // Check if file is tracked
    const { stdout: lsFiles } = await execAsync(`git ls-files "${relativePath}"`, { cwd: gitRoot })
    const isGitTracked = lsFiles.trim().length > 0

    if (!isGitTracked) {
      return { isGitTracked: false }
    }

    // Get current branch
    const { stdout: branchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot })
    const gitBranch = branchOutput.trim()

    // Get current commit hash
    const { stdout: commitOutput } = await execAsync('git rev-parse HEAD', { cwd: gitRoot })
    const gitCommitHash = commitOutput.trim()

    // Get last commit for this file
    const { stdout: logOutput } = await execAsync(
      `git log -1 --format="%H|%cd|%an" --date=iso "${relativePath}"`,
      { cwd: gitRoot }
    )

    if (logOutput.trim()) {
      const [lastCommitHash, lastCommitDate, author] = logOutput.trim().split('|')
      return {
        isGitTracked: true,
        gitCommitHash,
        gitBranch,
        gitLastCommit: new Date(lastCommitDate),
        gitAuthor: author
      }
    }

    return {
      isGitTracked: true,
      gitCommitHash,
      gitBranch
    }
  } catch (error) {
    return { isGitTracked: false }
  }
}

// File scanning utilities
export async function isFileReadable(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK)
    return true
  } catch {
    return false
  }
}

export async function isFileBinary(filePath: string): Promise<boolean> {
  try {
    const buffer = await fs.promises.readFile(filePath)

    // Check for null bytes (common in binary files)
    for (let i = 0; i < Math.min(buffer.length, 512); i++) {
      if (buffer[i] === 0) {
        return true
      }
    }

    return false
  } catch {
    return true // Assume binary if we can't read it
  }
}

/**
 * Caller-supplied coverage filters, honored at file discovery (the only place
 * a scan option may change behavior without touching detection quality).
 * `extensions`: if given, the file must carry one of them (an `.env*` file
 * counts as `.env`). `excludeNames`: basenames/globs the caller wants skipped.
 */
export interface FileFilter {
  extensions?: string[]
  excludeNames?: string[]
}

export function shouldExcludeFile(filePath: string, filter?: FileFilter): boolean {
  const fileName = path.basename(filePath)
  const fileExtension = path.extname(fileName).toLowerCase()

  // Never flag Keystrok's own detection-pattern library, its regex examples
  // (sk_live_…, AKIA…, ghp_…) look like real secrets and are pure false positives.
  if (filePath.includes(`${path.sep}lib${path.sep}scanner${path.sep}`)) {
    return true
  }

  // Check excluded extensions
  if (!SCANNABLE_EXTENSIONS.includes(fileExtension) && !fileName.includes('.env')) {
    return true
  }

  // Check excluded file patterns
  for (const pattern of EXCLUDED_FILES) {
    if (minimatch(fileName, pattern)) {
      return true
    }
  }

  // Caller coverage filters: a toggle that is off must actually skip the file.
  if (filter?.extensions?.length) {
    const isEnv = fileName.includes('.env')
    const allowed = filter.extensions.includes(fileExtension) || (isEnv && filter.extensions.includes('.env'))
    if (!allowed) return true
  }
  if (filter?.excludeNames?.length) {
    for (const pattern of filter.excludeNames) {
      if (fileName === pattern || minimatch(fileName, pattern)) return true
    }
  }

  return false
}

export function shouldExcludeDirectory(dirPath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, dirPath)
  const dirName = path.basename(dirPath)

  // Check excluded directory names
  if (EXCLUDED_DIRS.includes(dirName)) {
    return true
  }

  // Check if any part of the path contains excluded directories
  const pathParts = relativePath.split(path.sep)
  return pathParts.some(part => EXCLUDED_DIRS.includes(part))
}

// Simple minimatch implementation for file patterns
function minimatch(fileName: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')

  return new RegExp(`^${regex}$`, 'i').test(fileName)
}

// Content analysis utilities
export function getLineContext(lines: string[], lineIndex: number, contextSize: number = CONTEXT_LINES): {
  beforeContext: string[]
  afterContext: string[]
} {
  const beforeStart = Math.max(0, lineIndex - contextSize)
  const afterEnd = Math.min(lines.length, lineIndex + contextSize + 1)

  const beforeContext = lines.slice(beforeStart, lineIndex)
  const afterContext = lines.slice(lineIndex + 1, afterEnd)

  return { beforeContext, afterContext }
}

export function sanitizeLineContent(line: string, keyStart: number, keyEnd: number): string {
  const before = line.substring(0, keyStart)
  const after = line.substring(keyEnd)
  const maskedKey = '*'.repeat(Math.min(keyEnd - keyStart, 8))

  return before + maskedKey + after
}

export function detectFileEncoding(filePath: string): string {
  // Simple encoding detection - could be enhanced with a library
  return 'utf-8'
}

// Error handling utilities
export function createScanError(
  type: ScanError['type'],
  message: string,
  filePath?: string,
  lineNumber?: number
): ScanError {
  return {
    type,
    message,
    filePath,
    lineNumber,
    stack: new Error().stack
  }
}

// Path validation for security
export function validatePath(inputPath: string): { isValid: boolean; error?: string } {
  try {
    const resolvedPath = path.resolve(inputPath)

    // Check for directory traversal attempts
    if (inputPath.includes('..')) {
      return { isValid: false, error: 'Path traversal detected' }
    }

    // Check for absolute path requirements
    if (!path.isAbsolute(resolvedPath)) {
      return { isValid: false, error: 'Path must be absolute' }
    }

    // Additional security checks could go here
    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      error: `Invalid path: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Performance utilities
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }

  const seconds = milliseconds / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }

  const minutes = seconds / 60
  return `${minutes.toFixed(1)}m`
}