import { prisma } from '@/lib/prisma'

/**
 * DB-backed fixed-window rate limiting.
 *
 * One row per key in the `rate_limits` table. A key namespaces an action and
 * its subject, e.g. `magiclink:email@example.com` or `waitlist:ip:1.2.3.4`.
 * Within a window of `windowMs`, the first `limit` requests are allowed; the
 * rest are denied until the window rolls over.
 *
 * This is a fixed-window counter (not a sliding window): simple, cheap, and
 * good enough to blunt abuse of the magic-link and waitlist endpoints. It runs
 * in a transaction so concurrent requests on the same key don't lose updates.
 * It fails OPEN: if the DB lookup throws, we allow the request rather than
 * locking legitimate users out of auth because of a transient DB blip.
 */

export interface RateLimitResult {
  allowed: boolean
  /** Requests remaining in the current window (0 when blocked). */
  remaining: number
  /** Milliseconds until the window resets (0 when allowed with headroom). */
  retryAfterMs: number
  limit: number
}

export interface RateLimitOptions {
  /** Max requests permitted per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export async function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions
): Promise<RateLimitResult> {
  const now = Date.now()

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimit.findUnique({ where: { key } })

      const windowExpired =
        !existing || existing.windowStart.getTime() + windowMs <= now

      if (windowExpired) {
        // Open a fresh window. Upsert covers both "no row" and "stale row".
        const windowStart = new Date(now)
        const expiresAt = new Date(now + windowMs)
        await tx.rateLimit.upsert({
          where: { key },
          create: { key, count: 1, windowStart, expiresAt },
          update: { count: 1, windowStart, expiresAt },
        })
        return { allowed: true, remaining: limit - 1, retryAfterMs: 0, limit }
      }

      const resetMs = existing.windowStart.getTime() + windowMs - now

      if (existing.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterMs: resetMs, limit }
      }

      await tx.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      })
      return {
        allowed: true,
        remaining: limit - existing.count - 1,
        retryAfterMs: 0,
        limit,
      }
    })
  } catch (err) {
    // Fail open: never block auth/signup because the limiter's DB call failed.
    console.error('[rate-limit] check failed, allowing request:', err)
    return { allowed: true, remaining: limit, retryAfterMs: 0, limit }
  }
}

/**
 * Best-effort client IP from a request's forwarding headers. Returns 'unknown'
 * when nothing usable is present (so all such callers share one bucket rather
 * than bypassing the limit). Trust this only as far as your proxy chain is
 * trustworthy, behind Netlify/Vercel the left-most XFF entry is the client.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
