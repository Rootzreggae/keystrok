import { lookup } from 'dns/promises'
import { isIP } from 'net'

/**
 * SSRF protection for outbound requests to user-supplied platform URLs.
 *
 * The connection-test feature fetches a URL the user configured for their
 * platform, using their stored credential. Without validation a user could
 * point that URL at the server's own internals: cloud metadata
 * (169.254.169.254), localhost, or private network hosts, and use Keystrok
 * as a proxy. assertSafePlatformUrl() blocks those targets before any fetch.
 *
 * Self-hosting note: a single-tenant self-host operator may legitimately point
 * at internal observability hosts (their own Grafana on a private IP, etc.).
 * Set ALLOW_PRIVATE_PLATFORM_URLS=true to opt out of the private-range block.
 * Scheme validation (http/https only) is always enforced.
 */
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockedUrlError'
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
])

/** True for loopback / private / link-local / reserved IPv4 or IPv6 literals. */
function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip)

  if (family === 4) {
    const o = ip.split('.').map(Number)
    if (o[0] === 0) return true // "this" network
    if (o[0] === 10) return true // private
    if (o[0] === 127) return true // loopback
    if (o[0] === 169 && o[1] === 254) return true // link-local (incl. 169.254.169.254 metadata)
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true // private
    if (o[0] === 192 && o[1] === 168) return true // private
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true // CGNAT 100.64.0.0/10
    if (o[0] >= 224) return true // multicast / reserved
    return false
  }

  if (family === 6) {
    const ipv6 = ip.toLowerCase()
    if (ipv6 === '::1' || ipv6 === '::') return true // loopback / unspecified
    if (ipv6.startsWith('fe80')) return true // link-local
    if (ipv6.startsWith('fec0')) return true // site-local (deprecated)
    if (ipv6[0] === 'f' && (ipv6[1] === 'c' || ipv6[1] === 'd')) return true // unique-local fc00::/7
    // IPv4-mapped IPv6 (e.g. ::ffff:169.254.169.254), re-check the embedded v4.
    if (ipv6.startsWith('::ffff:')) {
      const tail = ipv6.slice('::ffff:'.length)
      if (tail.includes('.') && isIP(tail) === 4) return isPrivateAddress(tail)
    }
    return false
  }

  // Not a parseable IP literal. Treat as unsafe; callers resolve DNS first.
  return true
}

/**
 * Validate that a user-supplied URL is safe to fetch server-side. Resolves the
 * hostname and rejects if it (or any resolved address) is private/reserved.
 * Returns the parsed URL on success; throws BlockedUrlError otherwise.
 */
export async function assertSafePlatformUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BlockedUrlError('Invalid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError('Only http and https URLs are allowed')
  }

  const allowPrivate = process.env.ALLOW_PRIVATE_PLATFORM_URLS === 'true'
  if (allowPrivate) return url

  const hostname = url.hostname.replace(/^\[|\]$/g, '') // strip IPv6 brackets

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new BlockedUrlError('Target host is not allowed')
  }

  // Literal IP: check directly, no DNS.
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new BlockedUrlError('Target resolves to a private or reserved address')
    }
    return url
  }

  // Hostname: every resolved address must be public (blocks names that point
  // at internal IPs). Note: this validates at check-time; a determined
  // DNS-rebinding attacker could change the record before fetch re-resolves,
  // acceptable for this pre-launch single-tenant context, tracked as a
  // follow-up (pin the resolved IP via a custom dispatcher) if we go hosted.
  let addresses
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new BlockedUrlError('Could not resolve target host')
  }
  if (!addresses.length) {
    throw new BlockedUrlError('Could not resolve target host')
  }
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new BlockedUrlError('Target resolves to a private or reserved address')
    }
  }

  return url
}
