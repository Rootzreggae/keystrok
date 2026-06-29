#!/bin/bash

# Keystrok Development Port Cleanup Script
# Kills all processes on port 3001 and restarts the dev server

set -e

echo "🔍 Finding processes on port 3001..."
PIDS=$(lsof -ti:3001 2>/dev/null || echo "")

if [ -z "$PIDS" ]; then
    echo "✅ Port 3001 is already free"
else
    echo "🛑 Killing processes: $PIDS"
    kill -9 $PIDS 2>/dev/null || true
    sleep 1
    echo "✅ Port 3001 is now free"
fi

# Also kill any orphaned Next.js processes
echo "🔍 Checking for orphaned Next.js processes..."
NEXT_PIDS=$(ps aux | grep -E 'next-server|node.*\.next' | grep -v grep | awk '{print $2}' || echo "")

if [ -n "$NEXT_PIDS" ]; then
    echo "🛑 Killing Next.js processes: $NEXT_PIDS"
    echo "$NEXT_PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo "✅ All processes cleaned up"

# Verify port is free
if lsof -i:3001 >/dev/null 2>&1; then
    echo "❌ Port 3001 is still in use!"
    exit 1
fi

echo "🚀 Starting dev server on port 3001..."
cd "$(dirname "$0")/.."
npm run dev -- -p 3001