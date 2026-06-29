# Discovery Results API

This endpoint retrieves scan results and findings from completed discovery scans.

## Endpoint

```
GET /api/discovery/results
```

## Authentication

Requires a valid session cookie. Users can only access their own scan results.

## Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `sessionId` | string | Filter by specific scan session ID | `?sessionId=clm123...` |
| `severity` | string | Filter by severity level | `?severity=critical` |
| `status` | string | Filter by finding status | `?status=active` |
| `keyType` | string | Filter by key type | `?keyType=aws_access` |
| `limit` | number | Number of results (1-100, default: 50) | `?limit=25` |
| `offset` | number | Pagination offset (default: 0) | `?offset=100` |

### Valid Values

- **severity**: `critical`, `high`, `medium`, `low`
- **status**: `active`, `dismissed`, `resolved`, `false_positive`, `in_rotation`
- **keyType**: `aws_access`, `stripe_live`, `github_token`, etc.

## Response Format

```json
{
  "success": true,
  "results": {
    "sessionId": "clm123...",
    "sessionName": "Full System Scan",
    "sessionStatus": "completed",
    "completedAt": "2024-01-15T10:30:00Z",
    "totalFiles": 1250,
    "scannedFiles": 1250,
    "findings": [
      {
        "id": "clm456...",
        "filePath": "src/config/database.js",
        "lineNumber": 23,
        "keyType": "aws_access",
        "platform": "aws",
        "severity": "critical",
        "confidence": 0.95,
        "keyPreview": "AKIA****ABC123",
        "status": "active",
        "isLikelyActive": true,
        "createdAt": "2024-01-15T10:25:00Z",
        "fileName": "database.js",
        "lineContent": "const accessKey = 'AKIA****ABC123'; // Masked for security",
        "detectionRule": "aws_access_key_pattern",
        "patternName": "AWS Access Key ID",
        "riskLevel": "high",
        "isEnvFile": false,
        "isConfigFile": true,
        "isCodeFile": true,
        "isInComment": false,
        "isTestKey": false,
        "isExampleKey": false,
        "isValidated": true,
        "seenCount": 1,
        "isRevoked": false
      }
    ]
  },
  "pagination": {
    "total": 157,
    "limit": 50,
    "offset": 0,
    "hasMore": true,
    "page": 1,
    "totalPages": 4
  },
  "filters": {
    "sessionId": "clm123...",
    "severity": null,
    "status": null,
    "keyType": null
  }
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 400 Bad Request
```json
{
  "error": "Invalid severity. Must be one of: critical, high, medium, low"
}
```

### 404 Not Found
```json
{
  "error": "Scan session not found or access denied"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Usage Examples

### Get all findings for a user
```bash
curl -X GET "http://localhost:3001/api/discovery/results" \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json"
```

### Get critical findings only
```bash
curl -X GET "http://localhost:3001/api/discovery/results?severity=critical" \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json"
```

### Get results for specific scan session
```bash
curl -X GET "http://localhost:3001/api/discovery/results?sessionId=clm123&limit=25" \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json"
```

### Get AWS keys that are still active
```bash
curl -X GET "http://localhost:3001/api/discovery/results?keyType=aws_access&status=active" \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json"
```

## Implementation Notes

- All API keys are masked in responses for security
- The endpoint implements efficient pagination with proper indexes
- Findings are ordered by severity (critical first) then by creation date (newest first)
- Users can only access their own scan results (enforced by userId filtering)
- Session validation prevents access to unauthorized scan sessions
- Response includes rich metadata for building comprehensive UIs

## Related Models

This endpoint queries the following database models:
- `LocalScanFinding` - Main findings data
- `ScanSession` - Scan session metadata
- `FileScan` - File context information
- `KeyHash` - Deduplication and security metadata