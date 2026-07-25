// Tracked-key hash matching for scan-time linking. Server-only (node crypto);
// split from classify.ts so classification stays browser-importable. Runnable
// under node --experimental-strip-types for the test.
import { createHash } from 'crypto'

export interface TrackedKeyCandidate {
  /** DiscoveredKey id of the manually registered key. */
  keyId: string
  keyHashId: string
  hash: string
  salt: string
}

/**
 * Verify a raw scan value against tracked manual-key hashes. Same construction
 * as crypto.hashKey() and scanner createSecureKeyHash(): sha256(salt + key).
 * Returns the matching candidate or null.
 * ponytail: O(manual keys) hash per scanned secret; index candidates by key
 * prefix if a workspace ever registers hundreds.
 */
export function matchTrackedCandidate(key: string, candidates: TrackedKeyCandidate[]): TrackedKeyCandidate | null {
  for (const c of candidates) {
    if (createHash('sha256').update(c.salt + key).digest('hex') === c.hash) return c
  }
  return null
}
