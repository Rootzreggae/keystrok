import NextAuth from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { createTransport } from "nodemailer"
import { prisma } from "@/lib/prisma"
import type { Adapter } from "next-auth/adapters"
import { isAllowedEmail } from "@/lib/allowlist"
import { checkRateLimit } from "@/lib/rate-limit"
import { smtpConfig } from "@/lib/mailer"

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
  const { identifier, url, provider } = params

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
  // production, there EMAIL_SERVER_HOST (or Resend) is a real host, not a placeholder.
  if (
    process.env.NODE_ENV !== "production" &&
    (!provider.server?.host || provider.server.host === "REPLACE")
  ) {
    console.log(`\n🔑 [auth] Magic link for ${identifier}:\n${url}\n`)
    return
  }

  const { host } = new URL(url)
  const transport = createTransport(provider.server)
  const result = await transport.sendMail({
    to: identifier,
    from: provider.from,
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

  const failed = result.rejected.concat((result as any).pending ?? []).filter(Boolean)
  if (failed.length) {
    throw new Error(`Magic-link email (${failed.join(", ")}) could not be sent`)
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    EmailProvider({
      // Shared SMTP config: omits auth when no EMAIL_SERVER_USER is set, so the
      // bundled MailHog (and other open dev relays) work without credentials.
      server: smtpConfig(),
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