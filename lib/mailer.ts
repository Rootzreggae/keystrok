import { createTransport } from 'nodemailer'
import { Resend } from 'resend'

/**
 * Unified outbound email. Self-hosters use SMTP (nodemailer), point it at any
 * mail server, including the bundled MailHog for local/dev. Hosted setups can
 * use Resend by setting RESEND_API_KEY. Both the magic-link sign-in
 * (lib/auth.ts) and the waitlist confirmation (lib/email.ts) send through here.
 *
 * Transport selection:
 *   - EMAIL_TRANSPORT=smtp|resend forces a transport.
 *   - Otherwise: Resend if RESEND_API_KEY is set, else SMTP if EMAIL_SERVER_HOST
 *     is set, else a no-op (logged) so the app still runs without mail wired up.
 */

export interface MailMessage {
  to: string
  subject: string
  html: string
  text: string
}

type Transport = 'resend' | 'smtp' | 'none'

function resendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY || undefined
}

function resolveTransport(): Transport {
  const explicit = process.env.EMAIL_TRANSPORT?.toLowerCase()
  if (explicit === 'resend' || explicit === 'smtp') return explicit
  if (resendApiKey()) return 'resend'
  if (process.env.EMAIL_SERVER_HOST) return 'smtp'
  return 'none'
}

/**
 * SMTP transport config from EMAIL_SERVER_* env. Auth is omitted entirely when
 * no user is set so unauthenticated dev servers (MailHog on :1025) work without
 * tripping nodemailer's auth flow. `secure` is true only on the implicit-TLS
 * port 465; 587/1025 use STARTTLS / plaintext.
 */
export function smtpConfig() {
  const port = Number(process.env.EMAIL_SERVER_PORT) || 587
  const user = process.env.EMAIL_SERVER_USER
  const pass = process.env.EMAIL_SERVER_PASSWORD
  return {
    host: process.env.EMAIL_SERVER_HOST,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  }
}

function defaultFrom(): string {
  return process.env.EMAIL_FROM || 'Keystrok <onboarding@resend.dev>'
}

/** Send one message. Returns true on success, false on any failure (never throws). */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  const transport = resolveTransport()
  const from = defaultFrom()

  try {
    if (transport === 'resend') {
      const key = resendApiKey()
      if (!key) {
        console.warn('[mailer] EMAIL_TRANSPORT=resend but RESEND_API_KEY is missing')
        return false
      }
      const resend = new Resend(key)
      const { error } = await resend.emails.send({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      })
      if (error) {
        console.error('[mailer] resend send failed:', error.message || error)
        return false
      }
      return true
    }

    if (transport === 'smtp') {
      if (!process.env.EMAIL_SERVER_HOST) {
        console.warn('[mailer] EMAIL_TRANSPORT=smtp but EMAIL_SERVER_HOST is missing')
        return false
      }
      const result = await createTransport(smtpConfig()).sendMail({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      })
      const failed = result.rejected.concat((result as any).pending ?? []).filter(Boolean)
      if (failed.length) {
        console.error(`[mailer] smtp could not deliver to ${failed.join(', ')}`)
        return false
      }
      return true
    }

    console.warn('[mailer] no email transport configured; skipping send')
    return false
  } catch (err) {
    console.error('[mailer] send failed:', err instanceof Error ? err.message : err)
    return false
  }
}
