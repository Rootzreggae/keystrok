# Development Scripts

## cleanup-dev.sh

**Purpose:** Fixes port 3001 conflicts and restarts the development server.

**Usage:**
```bash
# From project root
./scripts/cleanup-dev.sh

# Or from anywhere
cd ~/Documents/keystrok
./scripts/cleanup-dev.sh
```

**What it does:**
1. Finds and kills all processes using port 3001
2. Kills any orphaned Next.js processes
3. Verifies port is completely free
4. Starts a fresh development server on port 3001

**When to use:**
- You see `EADDRINUSE: address already in use :::3001` error
- Multiple Next.js processes are running
- Dev server won't start
- Port conflicts after force-quitting terminal

## Manual cleanup (if script fails)

```bash
# Find processes on port 3001
lsof -i:3001

# Kill specific PID
kill -9 <PID>

# Kill all Next.js processes
ps aux | grep -E 'next-server|node.*\.next' | grep -v grep | awk '{print $2}' | xargs kill -9

# Verify port is free
lsof -i:3001  # Should show no output

# Start dev server
npm run dev -- -p 3001
```

## Testing the server

```bash
# Test homepage (should return 200)
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3001/

# Test auth API (should return JSON)
curl http://localhost:3001/api/auth/providers

# Test protected API (should return 401)
curl http://localhost:3001/api/keys
```