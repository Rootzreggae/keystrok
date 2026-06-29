# Discovery API

The Discovery API provides endpoints for scanning codebases to find exposed API keys and security vulnerabilities.

## Endpoints

### POST /api/discovery/scan

Starts a new discovery scan of the user's codebase.

#### Authentication
Requires valid NextAuth session with user ID.

#### Request Body
```typescript
{
  name: string,           // User-defined scan name
  scanType: 'quick' | 'deep' | 'full',
  options: {
    git_repositories: boolean,
    environment_files: boolean,
    configuration_files: boolean,
    docker_files: boolean,
    source_code: boolean
  },
  targetPath?: string,    // Optional specific path to scan
  keyTypes?: string[]     // Optional specific key types to look for
}
```

#### Response
```typescript
{
  success: boolean,
  sessionId?: string,
  status?: 'running',
  message: string,
  error?: string
}
```

#### Scan Types
- **quick**: Shallow scan (max depth 3, 1MB file limit)
- **deep**: Medium depth scan (max depth 8, 5MB file limit)
- **full**: Complete scan (no depth limit, 10MB file limit)

#### Security Features
- Path validation prevents directory traversal
- Restricted to user home directory and Documents folder
- System directories are blocked
- All API keys are hashed with salt for secure storage
- Background processing prevents blocking

### GET /api/discovery/scan

Retrieves user's scan sessions.

#### Query Parameters
- `status`: Filter by scan status (`pending`, `running`, `completed`, `failed`)

#### Response
```typescript
{
  success: boolean,
  data: Array<{
    id: string,
    name: string,
    scanType: string,
    status: string,
    progress: number,
    findingsCount: number,
    totalFiles: number,
    scannedFiles: number,
    createdAt: string,
    completedAt?: string,
    errorMessage?: string
  }>
}
```

### GET /api/discovery/health

Health check endpoint for the discovery service.

## Implementation Details

### Background Processing
Scans run in the background using `setImmediate()` to prevent blocking the API response. Progress is tracked in the database and can be monitored via the GET endpoint.

### Key Detection
Supports detection of:
- AWS Access Keys and Secret Keys
- Stripe API Keys (live and test)
- GitHub Personal Access Tokens
- Grafana Service Account Tokens
- Datadog API and Application Keys
- Slack Bot and User Tokens
- Google API Keys
- Generic private keys, JWTs, and bearer tokens

### Database Integration
- Creates `ScanSession` records for tracking
- Stores findings in `LocalScanFinding` table
- Uses `KeyHash` for secure deduplication
- Links to `FileScan` records for audit trail

### Error Handling
- Input validation with detailed error messages
- Path security validation
- Graceful handling of file access errors
- Comprehensive error logging without exposing secrets