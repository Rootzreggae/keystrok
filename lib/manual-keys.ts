// Manual key registration: the ledger's second door. A member pastes a known
// key once; it is classified in-memory (lib/scanner/classify), persisted only
// as masked preview + salted hash, and its rotation clock anchors to foundAt,
// which for a manual key IS registration time — rotation-policy needs no
// source branch. The raw value must never be persisted or logged.
import { prisma } from '@/lib/prisma'
import { hashKey, verifyKeyHash, classifyKeyFormat } from '@/lib/crypto'
import { riskStart, rotationDueAt } from '@/lib/rotation-policy'
import { classifyPastedKey, type TrackedKeyCandidate } from '@/lib/scanner/classify'
import { alertTrackedKeyExposed } from '@/lib/alert-runner'

// Severity → status for a key with NO exposure evidence: never 'compromised',
// that word implies exposure and a registered-at-birth key has none.
const UNEXPOSED_STATUS: Record<string, string> = { critical: 'at_risk', high: 'at_risk', medium: 'warning', low: 'monitor' }
// Once exposure evidence exists (a hash-linked finding), the same map the
// promote route uses applies.
const EXPOSED_STATUS: Record<string, string> = { critical: 'compromised', high: 'at_risk', medium: 'warning', low: 'monitor' }
const RISK_SCORE: Record<string, number> = { critical: 90, high: 70, medium: 50, low: 30 }

/**
 * Find the manually registered key an in-memory secret value belongs to, or
 * null. Only manual-source keys can ever match: scan and promote KeyHash rows
 * hold finding-identity hashes, not value hashes (see the change's design).
 * Used by duplicate-refusal at registration and by scan-time linking.
 */
export async function verifyAgainstTrackedHashes(value: string): Promise<{ id: string; keyName: string } | null> {
  const rows = await prisma.discoveredKey.findMany({
    where: { source: 'manual' },
    select: { id: true, keyName: true, keyHash: { select: { keyHash: true, hashSalt: true } } },
  })
  for (const r of rows) {
    if (verifyKeyHash(value, r.keyHash.keyHash, r.keyHash.hashSalt)) return { id: r.id, keyName: r.keyName }
  }
  return null
}

export type RegisterResult =
  | { ok: true; key: { id: string; keyName: string; keyPreview: string; platform: string; severity: string; status: string; rotationDueAt: string } }
  | { ok: false; code: 'invalid' | 'needs_platform' | 'duplicate'; existingKeyId?: string }

/**
 * Register one known key into the ledger. The value is classified in-memory;
 * what persists is a masked preview, a salted hash, and metadata. Source
 * 'manual', no exposure implied, rotation window counts from now.
 */
export async function registerManualKey(input: { value: string; name?: string; platform?: string; userId: string }): Promise<RegisterResult> {
  const cls = classifyPastedKey(input.value)
  if (!cls) return { ok: false, code: 'invalid' }
  if (!cls.recognized && !input.platform?.trim()) return { ok: false, code: 'needs_platform' }

  const existing = await verifyAgainstTrackedHashes(cls.key)
  if (existing) return { ok: false, code: 'duplicate', existingKeyId: existing.id }

  const { hash, salt } = hashKey(cls.key)
  const platform = cls.recognized ? cls.platform : input.platform!.trim()
  const keyName = input.name?.trim() || `${platform} key (registered)`
  const now = new Date()
  const dueAt = rotationDueAt(riskStart({ foundAt: now, exposedAt: null }, now), cls.severity)
  const status = UNEXPOSED_STATUS[cls.severity] || 'at_risk'

  const keyHashRow = await prisma.keyHash.create({
    data: {
      keyHash: hash,
      hashSalt: salt,
      keyType: cls.keyType,
      keyFormat: classifyKeyFormat(cls.key),
      estimatedLength: cls.key.length,
      userId: input.userId,
    },
  })
  const key = await prisma.discoveredKey.create({
    data: {
      keyName,
      keyPreview: cls.preview,
      keyHashId: keyHashRow.id,
      platform,
      source: 'manual',
      location: 'registered by paste',
      status,
      severity: cls.severity,
      confidence: cls.confidence,
      riskScore: RISK_SCORE[cls.severity] ?? 70,
      detectionPattern: cls.patternName,
      keyType: cls.keyType,
      expiresAt: dueAt,
      userId: input.userId,
    },
  })
  await prisma.activity.create({
    data: { action: 'key_registered', description: `Key registered by paste: ${keyName} (${platform})`, userId: input.userId },
  }).catch(() => {})

  return { ok: true, key: { id: key.id, keyName, keyPreview: cls.preview, platform, severity: cls.severity, status, rotationDueAt: dueAt.toISOString() } }
}

/**
 * The manual-key hashes a scan should verify raw values against, in the shape
 * the scanner's matchTrackedCandidate expects. Loaded once per scan session.
 */
export async function trackedKeyCandidates(): Promise<TrackedKeyCandidate[]> {
  const rows = await prisma.discoveredKey.findMany({
    where: { source: 'manual' },
    select: { id: true, keyHashId: true, keyHash: { select: { keyHash: true, hashSalt: true } } },
  })
  return rows.map((r) => ({ keyId: r.id, keyHashId: r.keyHashId, hash: r.keyHash.keyHash, salt: r.keyHash.hashSalt }))
}

/**
 * A scan found a secret matching a manually registered key: record it as an
 * exposure event on that key instead of a new triage finding. Earlier-is-worse
 * re-anchoring, and a human-attested exposure date is never overwritten by
 * scan evidence (human beats git beats scan). Best-effort activity + alert.
 */
export async function attachExposureToTrackedKey(opts: {
  keyId: string
  keyHashId: string
  relativePath: string
  lineNumber: number
  gitDate: Date | null
}): Promise<void> {
  const key = await prisma.discoveredKey.findUnique({
    where: { id: opts.keyId },
    select: { id: true, keyName: true, severity: true, exposedAt: true, exposedAtSource: true, userId: true },
  })
  if (!key) return

  const evidence = opts.gitDate ?? new Date()
  const data: { status: string; location: string; exposedAt?: Date; exposedAtSource?: string } = {
    status: EXPOSED_STATUS[key.severity] || 'at_risk',
    location: opts.relativePath,
  }
  if (key.exposedAtSource !== 'user' && (!key.exposedAt || evidence < key.exposedAt)) {
    data.exposedAt = evidence
    data.exposedAtSource = opts.gitDate ? 'git' : 'scan'
  }
  await prisma.discoveredKey.update({ where: { id: key.id }, data })
  await prisma.keyHash.update({
    where: { id: opts.keyHashId },
    data: { lastSeenAt: new Date(), seenCount: { increment: 1 } },
  }).catch(() => {})
  await prisma.activity.create({
    data: {
      action: 'tracked_key_exposed',
      description: `Tracked key "${key.keyName}" found exposed in ${opts.relativePath}:${opts.lineNumber}`,
      userId: key.userId,
    },
  }).catch(() => {})
  await alertTrackedKeyExposed({ id: key.id, keyName: key.keyName, severity: key.severity }, opts.relativePath).catch(() => {})
}
