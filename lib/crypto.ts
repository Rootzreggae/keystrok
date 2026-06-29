import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto'

/**
 * ---------------------------------------------------------------------------
 * Reversible secret encryption (for credentials we must use later, e.g. the
 * API keys users configure for their platforms). This is DISTINCT from the
 * one-way hashing below: hashing is for scanner-discovered keys we only need
 * to deduplicate; encryption is for keys we have to send back out to a
 * platform when testing/rotating.
 *
 * Scheme: AES-256-GCM, random 12-byte IV per value, 16-byte auth tag.
 * Stored form: "enc:v1:" + base64(iv || tag || ciphertext)
 * The "v1" makes future key rotation / algorithm changes detectable.
 * ---------------------------------------------------------------------------
 */
const ENC_PREFIX = 'enc:v1:'

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32'
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Generate with: openssl rand -base64 32`
    )
  }
  return key
}

/** True if the value is already in our encrypted envelope format. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX)
}

/**
 * True if a submitted value looks like a masked/display placeholder rather than
 * a real new secret (e.g. the read paths return "glsa••••w5Ik" or "••••••••",
 * and an edit form may resubmit it unchanged). Used to avoid re-encrypting the
 * mask and clobbering the stored key.
 */
export function isMaskedSecret(value: string | null | undefined): boolean {
  if (!value) return false
  return value === '[MASKED]' || /[•]/.test(value) || /^\*+$/.test(value)
}

/**
 * Encrypt a secret for storage at rest. Idempotent: an already-encrypted value
 * is returned unchanged. Empty/blank values are passed through untouched.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext
  if (isEncrypted(plaintext)) return plaintext

  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return ENC_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

/**
 * Decrypt a stored secret. Legacy plaintext (written before encryption was
 * introduced, or not yet migrated) is returned as-is so reads never break.
 * The migration script converts those rows in place.
 */
export function decryptSecret(value: string): string {
  if (!value) return value
  if (!isEncrypted(value)) return value // legacy plaintext, tolerate

  const key = getEncryptionKey()
  const blob = Buffer.from(value.slice(ENC_PREFIX.length), 'base64')
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const ciphertext = blob.subarray(28)

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8')
}

/**
 * Securely hash an API key using SHA-256 with salt
 * This enables deduplication without storing the actual key value
 */
export function hashKey(keyValue: string): { hash: string; salt: string } {
  // Generate a unique salt for this key
  const salt = randomBytes(32).toString('hex')

  // Create hash with salt + key value
  const hash = createHash('sha256')
    .update(salt + keyValue)
    .digest('hex')

  return { hash, salt }
}

/**
 * Deterministic hash of a non-secret identifier (e.g. a finding's
 * file:line:rule:maskedPreview). Unlike hashKey(), there is NO random salt, so
 * the same identifier always yields the same hash, which is what scan
 * deduplication relies on across re-scans.
 */
export function hashIdentifier(identifier: string): string {
  return createHash('sha256').update(identifier).digest('hex')
}

/**
 * Verify if a key matches the stored hash
 */
export function verifyKeyHash(keyValue: string, storedHash: string, salt: string): boolean {
  const testHash = createHash('sha256')
    .update(salt + keyValue)
    .digest('hex')

  return testHash === storedHash
}

/**
 * Generate a masked preview of an API key for display
 * Shows first 4 and last 4 characters with asterisks in between
 */
export function maskApiKey(keyValue: string): string {
  if (!keyValue) return ''
  // Defense in depth: never reveal an encrypted envelope's contents in the UI.
  // If a raw stored (ciphertext) value ever reaches a display path, show dots
  // instead of leaking the ciphertext blob.
  if (isEncrypted(keyValue)) return '••••••••'
  if (keyValue.length <= 8) {
    return '*'.repeat(keyValue.length)
  }

  const start = keyValue.slice(0, 4)
  const end = keyValue.slice(-4)
  const middle = '*'.repeat(Math.max(keyValue.length - 8, 3))

  return `${start}${middle}${end}`
}

/**
 * Classify key format for better organization
 */
export function classifyKeyFormat(keyValue: string): string {
  // AWS Access Key ID
  if (/^AKIA[0-9A-Z]{16}$/.test(keyValue)) return 'AKIA[A-Z0-9]{16}'

  // Stripe keys
  if (/^sk_(test|live)_[0-9a-zA-Z]{24}$/.test(keyValue)) return 'sk_(test|live)_[A-Za-z0-9]{24}'
  if (/^pk_(test|live)_[0-9a-zA-Z]{24}$/.test(keyValue)) return 'pk_(test|live)_[A-Za-z0-9]{24}'

  // GitHub tokens
  if (/^ghp_[A-Za-z0-9]{36}$/.test(keyValue)) return 'ghp_[A-Za-z0-9]{36}'
  if (/^gho_[A-Za-z0-9]{36}$/.test(keyValue)) return 'gho_[A-Za-z0-9]{36}'
  if (/^ghs_[A-Za-z0-9]{36}$/.test(keyValue)) return 'ghs_[A-Za-z0-9]{36}'

  // Grafana tokens
  if (/^glsa_[A-Za-z0-9]{32}_[A-Za-z0-9]{8}$/.test(keyValue)) return 'glsa_[A-Za-z0-9]{32}_[A-Za-z0-9]{8}'
  if (/^glc_[A-Za-z0-9]{32}$/.test(keyValue)) return 'glc_[A-Za-z0-9]{32}'

  // JWT tokens
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(keyValue)) return 'JWT'

  // Generic patterns
  if (/^[A-Za-z0-9+/=]{20,}$/.test(keyValue)) return 'Base64-like'
  if (/^[A-Fa-f0-9]{32}$/.test(keyValue)) return 'Hex32'
  if (/^[A-Fa-f0-9]{40}$/.test(keyValue)) return 'Hex40'

  return 'Unknown'
}

/**
 * Estimate key type based on detected patterns
 */
export function estimateKeyType(keyValue: string, detectionPattern?: string): string {
  // Use detection pattern if provided
  if (detectionPattern) {
    if (detectionPattern.includes('AKIA')) return 'aws_access'
    if (detectionPattern.includes('sk_')) return 'stripe_secret'
    if (detectionPattern.includes('pk_')) return 'stripe_publishable'
    if (detectionPattern.includes('ghp_')) return 'github_personal'
    if (detectionPattern.includes('glsa_')) return 'grafana_service'
    if (detectionPattern.includes('datadog')) return 'datadog_api'
    if (detectionPattern.includes('slack')) return 'slack_token'
  }

  // Fallback to key format analysis
  const format = classifyKeyFormat(keyValue)
  if (format.startsWith('AKIA')) return 'aws_access'
  if (format.startsWith('sk_')) return 'stripe_secret'
  if (format.startsWith('pk_')) return 'stripe_publishable'
  if (format.startsWith('ghp_')) return 'github_personal'
  if (format.startsWith('glsa_')) return 'grafana_service'
  if (format === 'JWT') return 'jwt_token'

  return 'generic'
}