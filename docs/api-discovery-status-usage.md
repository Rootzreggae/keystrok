# Discovery Scanner Status API Usage

## Overview
The `/api/discovery/status` endpoint provides real-time scan status checking for the Discovery Scanner frontend.

## API Endpoints

### GET /api/discovery/status

Returns current scan status and recent scan history.

#### Query Parameters

- `sessionId` (optional): Check specific scan session
- `active` (optional): Get only active/running scans (default: true)

#### Examples

```typescript
// Get current active scan and recent history
const response = await fetch('/api/discovery/status?active=true');

// Get specific scan status
const response = await fetch('/api/discovery/status?sessionId=abc123');

// Get all recent scans
const response = await fetch('/api/discovery/status');
```

#### Response Format

```typescript
{
  success: boolean,
  currentScan: {
    sessionId: string,
    name: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
    progress: number,        // 0.0 to 1.0
    totalFiles: number,
    scannedFiles: number,
    findingsCount: number,
    startedAt: string,       // ISO date
    estimatedCompletion?: string, // ISO date
    scanType: string,
    targetPath: string
  } | null,
  recentScans?: Array<{
    sessionId: string,
    name: string,
    status: string,
    completedAt: string,     // ISO date
    findingsCount: number
  }>
}
```

### POST /api/discovery/status

Control scan operations (cancel, pause, resume).

#### Request Body

```typescript
{
  sessionId: string,
  action: 'cancel' | 'pause' | 'resume'
}
```

## Frontend Integration Examples

### Using React Query for Real-time Progress

```typescript
// Poll for scan status every 3 seconds
const { data: scanStatus } = useQuery({
  queryKey: ['scan-status'],
  queryFn: async () => {
    const response = await fetch('/api/discovery/status?active=true');
    const data = await response.json();
    return data;
  },
  refetchInterval: 3000, // Poll every 3 seconds
  enabled: isScanning // Only poll when scanning
});

// Display progress
if (scanStatus?.currentScan) {
  const { progress, scannedFiles, totalFiles, estimatedCompletion } = scanStatus.currentScan;

  return (
    <div className="scan-progress">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="progress-text">
        {scannedFiles} / {totalFiles} files scanned ({Math.round(progress * 100)}%)
      </div>
      {estimatedCompletion && (
        <div className="eta">
          ETA: {new Date(estimatedCompletion).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
```

### Cancel Scan Operation

```typescript
const cancelScan = useMutation({
  mutationFn: async (sessionId: string) => {
    const response = await fetch('/api/discovery/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action: 'cancel'
      })
    });
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['scan-status']);
    setIsScanning(false);
  }
});
```

### Check Specific Scan by Session ID

```typescript
const { data: specificScan } = useQuery({
  queryKey: ['scan-detail', sessionId],
  queryFn: async () => {
    const response = await fetch(`/api/discovery/status?sessionId=${sessionId}`);
    const data = await response.json();
    return data.currentScan;
  },
  enabled: !!sessionId
});
```

## Security Features

- All endpoints require authentication via NextAuth.js
- Users can only access their own scan sessions
- Input validation for all parameters
- Proper error handling with appropriate HTTP status codes
- No sensitive information exposed in error messages

## Performance Considerations

- Lightweight queries optimized for frequent polling
- Database indexes on user ID and status fields
- Minimal response payload for real-time updates
- Efficient progress estimation algorithms

## Error Handling

- `401 Unauthorized`: User not authenticated
- `404 Not Found`: Scan session not found or not owned by user
- `400 Bad Request`: Invalid parameters
- `500 Internal Server Error`: Server-side errors