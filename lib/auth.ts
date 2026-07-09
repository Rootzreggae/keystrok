import NextAuth from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import type { Adapter } from "next-auth/adapters"
import { isAllowedEmail } from "@/lib/allowlist"
import { checkRateLimit } from "@/lib/rate-limit"
import { getMail, sendMail } from "@/lib/mailer"

// Magic-link throttle: at most 4 sign-in emails per address per 15 minutes.
// Keyed by email (the inbox we'd otherwise let someone spam, and the thing
// that burns our mail quota). Invite-only access already caps who can request
// links at all, so a per-email window is enough here.
const MAGIC_LINK_LIMIT = 4
const MAGIC_LINK_WINDOW_MS = 15 * 60 * 1000

/**
 * Send the NextAuth magic-link email, but refuse once an address has requested
 * too many links inside the window. Throwing here aborts the send; NextAuth
 * surfaces it to the user as an `EmailSignin` error. Mirrors NextAuth's default
 * nodemailer sender otherwise.
 */
async function sendVerificationRequest(params: {
  identifier: string
  url: string
  provider: any
}) {
  const { identifier, url } = params

  const rl = await checkRateLimit(`magiclink:${identifier.toLowerCase()}`, {
    limit: MAGIC_LINK_LIMIT,
    windowMs: MAGIC_LINK_WINDOW_MS,
  })
  if (!rl.allowed) {
    const mins = Math.ceil(rl.retryAfterMs / 60000)
    console.warn(`[auth] magic-link rate-limited for ${identifier} (retry in ~${mins}m)`)
    throw new Error("Too many sign-in requests. Please wait a few minutes and try again.")
  }

  // Dev convenience: with no real mail transport configured, print the magic link
  // to the server console instead of failing to send it. ponytail: never fires in
  // production, there the transport points at a real host, not a placeholder.
  const mail = await getMail()
  if (
    process.env.NODE_ENV !== "production" &&
    (mail.transport === "none" || (mail.transport === "smtp" && (!mail.host || mail.host === "REPLACE")))
  ) {
    console.log(`\n🔑 [auth] Magic link for ${identifier}:\n${url}\n`)
    return
  }

  // Send through the unified mailer, so magic links honor the Settings-saved
  // mail config (and Resend), not just the env SMTP vars.
  const ok = await sendMail({
    to: identifier,
    subject: `Sign in to Keystrok`,
    text: `Sign in to Keystrok\n\n${url}\n\nIf you did not request this, you can safely ignore this email.\n`,
    html: `<body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#0a0a0a;color:#d4d4d4;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:32px">
    <h2 style="color:#4ade80;margin:0 0 16px">Sign in to Keystrok</h2>
    <p style="margin:0 0 24px">Click the button below to sign in. This link expires in 24 hours and can only be used once.</p>
    <a href="${url}" style="display:inline-block;background:#4ade80;color:#0a0a0a;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:6px">Sign in</a>
    <p style="margin:24px 0 0;color:#666;font-size:12px">If you did not request this, you can safely ignore this email.</p>
  </div>
</body>`,
  })
  if (!ok) {
    throw new Error(`Magic-link email to ${identifier} could not be sent`)
  }
}

// Every API route calls auth(), and with database sessions each call is a
// session+user round-trip to the (remote) DB — ~100-180ms tax on every request.
// Cache the lookup briefly; sign-out and session updates invalidate their entry.
// Worst case: a revoked/removed session stays valid for SESSION_CACHE_TTL_MS.
// ponytail: per-process cache — fine while self-host means one instance; swap
// for a shared cache if the app ever runs multiple nodes.
const SESSION_CACHE_TTL_MS = 30_000
type SessionAndUser = Awaited<ReturnType<NonNullable<Adapter["getSessionAndUser"]>>>
const sessionCache = new Map<string, { value: SessionAndUser; exp: number }>()

function cachedAdapter(): Adapter {
  const base = PrismaAdapter(prisma) as Adapter
  return {
    ...base,
    async getSessionAndUser(sessionToken) {
      const hit = sessionCache.get(sessionToken)
      if (hit && hit.exp > Date.now()) return hit.value
      if (sessionCache.size > 1000) sessionCache.clear() // bound growth from junk cookies
      const value = await base.getSessionAndUser!(sessionToken)
      sessionCache.set(sessionToken, { value, exp: Date.now() + SESSION_CACHE_TTL_MS })
      return value
    },
    async updateSession(session) {
      sessionCache.delete(session.sessionToken)
      return base.updateSession!(session)
    },
    async deleteSession(sessionToken) {
      sessionCache.delete(sessionToken)
      await base.deleteSession!(sessionToken)
    },
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: cachedAdapter(),
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    EmailProvider({
      // server/from are unused: sendVerificationRequest delivers through the
      // unified mailer (lib/mailer.ts), which resolves Settings-saved config
      // with env fallback at send time.
      server: {},
      from: process.env.EMAIL_FROM,
      maxAge: 24 * 60 * 60, // 24 hours for magic links
      sendVerificationRequest,
    }),
  ],
  trustHost: true,
  callbacks: {
    async signIn({ user }) {
      // Invite-only by default: deny sign-in for non-allowlisted emails.
      // Returning false here both prevents the magic-link email from being
      // sent (on the initial request) and blocks session creation (on link
      // verification), and redirects the user to the AccessDenied error page.
      const email = user?.email
      if (!email) return false
      // A removed member cannot sign back in, even if still allowlisted.
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { removedAt: true } })
      if (existing?.removedAt) {
        console.warn(`[auth] sign-in denied (removed member): ${email}`)
        return false
      }
      const allowed = await isAllowedEmail(email)
      if (!allowed) {
        console.warn(`[auth] sign-in denied (not on allowlist): ${email}`)
      }
      return allowed
    },
    async session({ session, user }) {
      // Include user ID + role in session
      if (session.user && user) {
        session.user.id = user.id
        session.user.role = (user as { role?: string }).role === 'admin' ? 'admin' : 'member'
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Handle sign-out: redirect to landing page
      if (url.includes('/signout') || url.includes('/api/auth/signout')) {
        return baseUrl
      }

      // If URL is already the callback URL from email, redirect to dashboard
      if (url.includes('/api/auth/callback/email')) {
        return `${baseUrl}/dashboard`
      }

      // Handle sign-in: redirect to dashboard
      if (url.startsWith(baseUrl)) {
        // If it's the signin page, redirect to dashboard
        if (url.includes('/auth/signin') || url.includes('/api/auth/signin')) {
          return `${baseUrl}/dashboard`
        }
        return url
      }

      // Default: redirect to dashboard after authentication
      return `${baseUrl}/dashboard`
    },
  },
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  events: {
    // Assign a new user's role: the very first user is the admin; anyone else
    // inherits the role from their team invite (default member). Consume the
    // invite so the Members tab's pending list only shows not-yet-joined emails.
    async createUser({ user }) {
      const email = user.email?.toLowerCase()
      const totalUsers = await prisma.user.count()
      let role = 'member'
      if (totalUsers <= 1) {
        role = 'admin'
      } else if (email) {
        const invite = await prisma.invite.findUnique({ where: { email }, select: { role: true } })
        if (invite?.role === 'admin') role = 'admin'
      }
      if (role === 'admin') await prisma.user.update({ where: { id: user.id }, data: { role } })
      if (email) await prisma.invite.deleteMany({ where: { email } })
    },
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
})