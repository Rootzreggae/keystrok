import { prisma } from '@/lib/prisma'

/**
 * Sign-up access control. Keystrok is invite-only by default: only approved
 * emails may sign in. This protects a hosted instance from unbounded
 * registration + magic-link email abuse.
 *
 * An email is allowed if ANY of:
 *   - it is listed in ALLOWED_EMAILS (comma-separated)
 *   - its domain is listed in ALLOWED_EMAIL_DOMAINS (comma-separated)
 *   - it has an approved Waitlist entry (status = "approved"), the "invite"
 *
 * Self-host escape hatch: set AUTH_OPEN_REGISTRATION=true to allow anyone to
 * register on your own instance (single-tenant operators who want open signup).
 */

function parseList(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** True when the operator has opted into open registration. */
export function isOpenRegistration(): boolean {
  return process.env.AUTH_OPEN_REGISTRATION === 'true'
}

export async function isAllowedEmail(emailRaw: string): Promise<boolean> {
  const email = (emailRaw || '').trim().toLowerCase()
  if (!email) return false

  if (isOpenRegistration()) return true

  if (parseList(process.env.ALLOWED_EMAILS).includes(email)) return true

  const domain = email.split('@')[1] || ''
  if (domain && parseList(process.env.ALLOWED_EMAIL_DOMAINS).includes(domain)) {
    return true
  }

  // Invited to the team (admin added them in the Members tab), or approved via
  // the waitlist. Fail closed if the lookup errors.
  try {
    const invite = await prisma.invite.findUnique({ where: { email }, select: { id: true } })
    if (invite) return true
    const entry = await prisma.waitlist.findUnique({
      where: { email },
      select: { status: true },
    })
    if (entry?.status === 'approved') return true
  } catch (err) {
    console.error('[allowlist] allow lookup failed:', err)
  }

  return false
}
