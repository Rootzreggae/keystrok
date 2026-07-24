// The pure half of manual key registration: classify a pasted secret with the
// same detection patterns Discovery uses, and verify raw scan values against
// tracked manual-key hashes. No prisma import and .ts-extension relative
// imports only, so the test can run it standalone
// (node --experimental-strip-types lib/manual-keys.test.ts).
import { createHash } from 'crypto'
import { ALL_PATTERNS, calculateEntropy } from './patterns.ts'
import { maskApiKey } from '../crypto.ts'

export interface PasteClassification {
  /** True when a platform-specific pattern matched; Generic matches don't count. */
  recognized: boolean
  /** The extracted secret itself (regex submatch, not the whole paste). Lives
   *  in memory only — hash and mask it, never persist or log it. */
  key: string
  keyType: string
  platform: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  confidence: number
  preview: string
  patternName: string
}

// Static registration error messages, keyed by failure code. Never interpolate
// any part of the pasted value into these (asserted by manual-keys.test.ts).
export const REGISTER_MESSAGES = {
  invalid: 'Paste one API key or secret of at least 8 characters.',
  needs_platform: 'No known key pattern matched. Give it a name and platform to track it as a generic secret.',
  duplicate: 'This secret is already tracked as a manually registered key.',
  rate_limited: 'Too many registration attempts. Wait a minute and try again.',
  failed: 'Registration failed. Nothing was stored.',
} as const

/**
 * Classify a pasted value by running the scanner's patterns over it as one
 * synthetic line. The extraction mirrors the scanner's per-line loop
 * (submatch-or-whole, length and validation gates), so the key registered here
 * hashes to the same value a later scan would extract — that identity is what
 * makes scan-time linking work. Returns null when the paste can't be a secret.
 */
export function classifyPastedKey(raw: string): PasteClassification | null {
  const value = raw.trim()
  if (value.length < 8) return null

  let best: (typeof ALL_PATTERNS)[number] | null = null
  let bestKey = ''
  for (const pattern of ALL_PATTERNS) {
    const flags = pattern.pattern.flags.includes('g') ? pattern.pattern.flags : pattern.pattern.flags + 'g'
    for (const match of value.matchAll(new RegExp(pattern.pattern.source, flags))) {
      const key = match[1] || match[0]
      if (!key || key.length < 8) continue
      if (pattern.platform === 'Generic' && calculateEntropy(key) < 3.5) continue
      if (pattern.validationFn && !pattern.validationFn(key)) continue
      if (!best || pattern.confidence > best.confidence) {
        best = pattern
        bestKey = key
      }
      break
    }
  }

  if (best && best.platform !== 'Generic') {
    return {
      recognized: true,
      key: bestKey,
      keyType: best.keyType,
      platform: best.platform,
      severity: best.severity,
      confidence: best.confidence,
      preview: maskApiKey(bestKey),
      patternName: best.name,
    }
  }

  // Unrecognized (or only a Generic pattern matched): the member explicitly
  // asked to track this, so accept it as a generic secret — the route requires
  // a user-supplied platform and name for these. Unknown severity reads as
  // high, matching rotation-policy's fallback band.
  return {
    recognized: false,
    key: value,
    keyType: 'generic',
    platform: '',
    severity: 'high',
    confidence: 0.3,
    preview: maskApiKey(value),
    patternName: 'manual',
  }
}

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
