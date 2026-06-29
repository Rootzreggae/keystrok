# Keystrok Security Scanner

A comprehensive API key and secret detection library for the Keystrok security platform. This scanner can detect exposed API keys, tokens, and secrets across various platforms and cloud services.

## Features

- **Comprehensive Pattern Detection**: Supports AWS, Stripe, GitHub, Grafana, Datadog, and many other platforms
- **Contextual Risk Analysis**: Analyzes the context around detected keys to assess risk levels
- **Security-First Design**: Never stores plaintext keys, uses secure hashing for deduplication
- **Performance Optimized**: Efficient file traversal with configurable scanning depth and filters
- **Git Integration**: Tracks file history and git metadata for better context
- **TypeScript Support**: Fully typed for excellent developer experience

## Supported Platforms

### Cloud Providers
- **AWS**: Access Keys, Secret Keys, Session Tokens
- **Azure**: Storage Account Keys, Service Principal Secrets
- **GCP**: Service Account Keys, API Keys

### Payment Platforms
- **Stripe**: Live/Test Secret Keys, Publishable Keys, Restricted Keys

### Version Control
- **GitHub**: Personal Access Tokens, OAuth Tokens, App Tokens

### Observability Platforms
- **Grafana**: Service Account Tokens, API Keys
- **Datadog**: API Keys, Application Keys
- **New Relic**: API Keys, License Keys
- **Prometheus**: Bearer Tokens
- **Elasticsearch**: API Keys

### Communication
- **Slack**: Bot Tokens, User Tokens

### Generic Patterns
- High-entropy strings
- JWT tokens
- Base64-encoded secrets
- Environment variable patterns

## Quick Start

```typescript
import { SecurityScanner, quickScan, deepScan } from './lib/scanner'

// Quick scan for immediate results
const result = await quickScan('/path/to/your/project')
console.log(`Found ${result.findings.length} potential secrets`)

// Deep scan with full analysis
const detailedResult = await deepScan('/path/to/your/project')

// Scan specific file types
import { scanEnvironmentFiles, scanConfigFiles } from './lib/scanner'

const envResults = await scanEnvironmentFiles('/path/to/project')
const configResults = await scanConfigFiles('/path/to/project')
```

## Advanced Usage

### Custom Scanner Configuration

```typescript
import { SecurityScanner, SCANNER_PRESETS } from './lib/scanner'

const scanner = new SecurityScanner({
  maxFileSize: 25 * 1024 * 1024, // 25MB
  maxScanDepth: 5,
  contextLines: 3,
  entropyThreshold: 3.5,
  confidenceThreshold: 0.7,
  enableGitIntegration: true,
  enableContextAnalysis: true
})

const result = await scanner.scanDirectory({
  targetPath: '/path/to/scan',
  scanType: 'deep',
  includeHidden: true,
  maxDepth: 10,
  fileExtensions: ['.env', '.json', '.yaml'],
  excludePaths: ['node_modules', 'dist'],
  keyTypes: ['aws_access_key', 'stripe_secret_live'],
  minConfidence: 0.8
})
```

### Platform-Specific Scanning

```typescript
import {
  scanForAWSKeys,
  scanForStripeKeys,
  scanForGitHubKeys,
  scanForObservabilityKeys
} from './lib/scanner'

// Scan for specific platform keys
const awsKeys = await scanForAWSKeys('/path/to/project')
const stripeKeys = await scanForStripeKeys('/path/to/project')
const githubKeys = await scanForGitHubKeys('/path/to/project')
const observabilityKeys = await scanForObservabilityKeys('/path/to/project')
```

### Real-time Progress Monitoring

```typescript
import { SecurityScanner } from './lib/scanner'

const scanner = new SecurityScanner()

// Listen for scan events
scanner.on('scanStarted', ({ sessionId, options }) => {
  console.log(`Scan ${sessionId} started`)
})

scanner.on('progressUpdate', ({ progress, scannedFiles, totalFiles }) => {
  console.log(`Progress: ${(progress * 100).toFixed(1)}% (${scannedFiles}/${totalFiles})`)
})

scanner.on('fileScanned', ({ filePath, findingsCount }) => {
  if (findingsCount > 0) {
    console.log(`Found ${findingsCount} secrets in ${filePath}`)
  }
})

scanner.on('scanCompleted', ({ result }) => {
  console.log(`Scan completed: ${result.findingsCount} findings`)
})

const result = await scanner.scanDirectory({
  targetPath: '/path/to/project',
  scanType: 'deep'
})
```

## Risk Assessment

Each detected secret includes comprehensive risk analysis:

```typescript
interface Finding {
  // Detection details
  keyPreview: string        // Masked key for display
  keyType: string          // Platform-specific key type
  platform: string         // Platform name
  severity: 'critical' | 'high' | 'medium' | 'low'
  confidence: number       // Detection confidence (0-1)

  // Risk assessment
  riskLevel: string        // Overall risk level
  riskFactors: string[]    // Contributing risk factors

  // Context analysis
  isInEnvFile: boolean     // Found in environment file
  isInComment: boolean     // Found in code comment
  isLikelyActive: boolean  // Appears to be in use
  isTestKey: boolean       // Appears to be test data

  // Location details
  filePath: string         // Full file path
  lineNumber: number       // Line number
  lineContent: string      // Sanitized line content

  // Additional metadata
  entropy?: number         // String entropy measure
  estimatedLength: number  // Key length
  detectedAt: Date        // Detection timestamp
}
```

## Database Integration

The scanner integrates seamlessly with Prisma and PostgreSQL:

```typescript
import {
  convertFindingToLocalScanFindingData,
  convertFileInfoToFileScanData
} from './lib/scanner'

// Convert scanner results to database models
const localScanFindingData = convertFindingToLocalScanFindingData(
  finding,
  sessionId,
  userId,
  fileScanId,
  keyHashId
)

const fileScanData = convertFileInfoToFileScanData(
  fileInfo,
  sessionId,
  userId,
  scanDuration,
  linesScanned,
  findingsCount,
  hasFindings
)

// Save to database using Prisma
await prisma.localScanFinding.create({ data: localScanFindingData })
await prisma.fileScan.create({ data: fileScanData })
```

## Security Considerations

- **No Plaintext Storage**: Keys are never stored in plaintext
- **Secure Hashing**: Uses SHA-256 with unique salts for deduplication
- **Path Validation**: Prevents directory traversal attacks
- **File Size Limits**: Configurable limits prevent resource exhaustion
- **Binary File Detection**: Skips binary files automatically
- **Permission Checking**: Respects file system permissions

## Performance

- **Efficient Traversal**: Optimized directory walking with exclusion filters
- **Memory Conscious**: Streaming file processing for large files
- **Progress Tracking**: Real-time progress updates
- **Configurable Limits**: Adjustable timeouts and size limits
- **Chunked Processing**: Processes files in configurable batches

## Configuration Options

```typescript
interface ScannerConfig {
  maxFileSize: number          // Maximum file size to scan (bytes)
  maxScanDepth: number         // Maximum directory depth
  contextLines: number         // Lines of context around findings
  entropyThreshold: number     // Minimum entropy for generic patterns
  confidenceThreshold: number  // Minimum confidence for findings
  enableParallelScanning: boolean
  enableGitIntegration: boolean
  enableContextAnalysis: boolean
  chunkSize: number           // Files per processing chunk
  timeoutPerFile: number      // Timeout per file (milliseconds)
}
```

## Error Handling

The scanner provides comprehensive error handling and reporting:

```typescript
interface ScanResult {
  status: 'completed' | 'failed' | 'cancelled'
  findings: Finding[]
  errors: ScanError[]
  warnings: string[]
  // ... other fields
}

interface ScanError {
  type: 'file_access' | 'permission_denied' | 'invalid_path' | 'processing_error'
  message: string
  filePath?: string
  lineNumber?: number
}
```

## Contributing

When adding new key patterns:

1. Add to `patterns.ts` with appropriate confidence levels
2. Include validation functions where possible
3. Add platform-specific risk assessment rules
4. Update documentation and tests
5. Ensure patterns minimize false positives

## Testing

```bash
# Run TypeScript compilation check
npx tsc --noEmit --skipLibCheck lib/scanner/index.ts

# Test with example file
node test-scanner-demo.js
```