// Validate that a platform API key is actually live, by calling the platform's
// own validate endpoint. SSRF-guarded so a key can't be used to probe internal
// hosts. The plaintext key never leaves the server.
import { assertSafePlatformUrl, BlockedUrlError } from '@/lib/ssrf'

export interface PlatformTestConfig {
  type: string
  apiUrl?: string | null
  apiKey: string
  authHeader?: string | null
  testEndpoint?: string | null
}

export async function testPlatformConnection(c: PlatformTestConfig): Promise<{ ok: boolean; message: string }> {
  if (!c.apiKey) return { ok: false, message: 'No API key provided' }
  const type = (c.type || '').toLowerCase()

  // AWS has no unauthenticated validate endpoint (calls must be SigV4-signed),
  // so we only confirm the key format here.
  if (type === 'aws') {
    return /^AKIA[0-9A-Z]{16}$/.test(c.apiKey)
      ? { ok: true, message: 'AWS access key format is valid' }
      : { ok: false, message: 'Not a valid AWS access key id' }
  }

  let url: string
  let headers: Record<string, string>
  if (type === 'stripe') {
    url = 'https://api.stripe.com/v1/account'
    headers = { Authorization: `Bearer ${c.apiKey}` }
  } else if (type === 'github') {
    url = 'https://api.github.com/user'
    headers = { Authorization: `token ${c.apiKey}`, 'User-Agent': 'Keystrok' }
  } else {
    const base = (c.apiUrl || '').replace(/\/$/, '')
    if (!base) return { ok: false, message: 'An API URL is required for this platform' }
    url = base + (c.testEndpoint || '')
    const ah = c.authHeader || 'Authorization'
    headers = { [ah]: ah.toLowerCase() === 'authorization' ? `Bearer ${c.apiKey}` : c.apiKey }
  }

  try {
    await assertSafePlatformUrl(url)
  } catch (e) {
    if (e instanceof BlockedUrlError) return { ok: false, message: `Blocked unsafe URL: ${e.message}` }
    return { ok: false, message: 'Invalid API URL' }
  }

  try {
    const res = await fetch(url, { headers })
    if (res.ok) return { ok: true, message: 'Connection verified. The key is live' }
    if (res.status === 401 || res.status === 403) return { ok: false, message: `Key rejected (${res.status}): revoked or wrong scope` }
    return { ok: false, message: `Platform returned ${res.status}` }
  } catch {
    return { ok: false, message: 'Could not reach the platform' }
  }
}
