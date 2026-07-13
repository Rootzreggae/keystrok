import type { SecurityScanner } from '@/lib/scanner/core'

// Running scanners, so a cancel can actually reach the thing doing the work.
// ponytail: module-level map, single-process only. That matches the self-host
// deployment; a multi-node deploy would need the cancel flag in the DB and a
// poll inside the scan loop.
const running = new Map<string, SecurityScanner>()

export function registerScan(sessionId: string, scanner: SecurityScanner): void {
  running.set(sessionId, scanner)
}

export function unregisterScan(sessionId: string): void {
  running.delete(sessionId)
}

/** Stop a running scan. Returns false when nothing is running under that id
 *  (already finished, or this process never owned it). */
export function cancelRunningScan(sessionId: string): boolean {
  const scanner = running.get(sessionId)
  if (!scanner) return false
  scanner.cancelScan()
  running.delete(sessionId)
  return true
}

export function isScanRunning(sessionId: string): boolean {
  return running.has(sessionId)
}
