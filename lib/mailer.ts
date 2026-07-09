import { createTransport } from 'nodemailer'
import { Resend } from 'resend'
import { prisma } from './prisma'
import { decryptSecret } from './crypto'

/**
 * Unified outbound email. Self-hosters use SMTP (nodemailer), point it at any
 * mail server, including the bundled Mailpit for local/dev. Hosted setups can
 * use Resend. Magic-link sign-in (lib/auth.ts), team invites, and the waitlist
 * confirmation (lib/email.ts) all send through here.
 *
 * Config resolution (same precedence as GithubAppConfig):
 *   1. The MailConfig row saved in Settings > Email delivery, when present.
 *   2. Env fallback: EMAIL_TRANSPORT=smtp|resend forces a transport; otherwise
 *      Resend if RESEND_API_KEY is set, else SMTP if EMAIL_SERVER_HOST is set,
 *      else a no-op (logged) so the app still runs without mail wired up.
 *      Env remains the bootstrap path: the first magic link must send before
 *      any UI exists.
 */

export interface MailMessage {
  to: string
  subject: string
  html: string
  text: string
}

type Transport = 'resend' | 'smtp' | 'none'

export interface EffectiveMail {
  transport: Transport
  host: string
  port: number
  username: string
  password: string
  resendKey: string
  from: string
  source: 'settings' | 'env'
}

function envMail(): EffectiveMail {
  const explicit = process.env.EMAIL_TRANSPORT?.toLowerCase()
  const resendKey = process.env.RESEND_API_KEY || ''
  const host = process.env.EMAIL_SERVER_HOST || ''
  const transport: Transport =
    explicit === 'resend' || explicit === 'smtp' ? explicit
    : resendKey ? 'resend'
    : host ? 'smtp'
    : 'none'
  return {
    transport,
    host,
    port: Number(process.env.EMAIL_SERVER_PORT) || 587,
    username: process.env.EMAIL_SERVER_USER || '',
    password: process.env.EMAIL_SERVER_PASSWORD || '',
    resendKey,
    from: process.env.EMAIL_FROM || 'Keystrok <onboarding@resend.dev>',
    source: 'env',
  }
}

// ponytail: per-process cache, same trade-off as the session cache in lib/auth.
const MAIL_CACHE_TTL_MS = 30_000
let mailCache: { value: EffectiveMail; exp: number } | null = null

/** Call after saving/deleting the MailConfig row so changes apply immediately. */
export function invalidateMailCache() {
  mailCache = null
}

/** Effective mail config: the Settings row when present, env otherwise. */
export async function getMail(): Promise<EffectiveMail> {
  if (mailCache && mailCache.exp > Date.now()) return mailCache.value
  let value = envMail()
  try {
    const row = await prisma.mailConfig.findUnique({ where: { id: 'default' } })
    if (row) {
      const env = value
      value = {
        transport: row.transport === 'resend' ? 'resend' : 'smtp',
        host: row.host,
        port: row.port || 587,
        username: row.username,
        password: row.passwordEnc ? decryptSecret(row.passwordEnc) : '',
        resendKey: row.resendKeyEnc ? decryptSecret(row.resendKeyEnc) : '',
        from: row.from || env.from,
        source: 'settings',
      }
    }
  } catch {
    // table missing (pre-migration) or DB down: fall back to env
  }
  mailCache = { value, exp: Date.now() + MAIL_CACHE_TTL_MS }
  return value
}

/** Whether an outbound mail transport is wired up. False = invites/magic links
 *  are silently dropped (the 'none' no-op), so callers can warn the operator. */
export async function mailConfigured(): Promise<boolean> {
  return (await getMail()).transport !== 'none'
}

/** Human-readable mail delivery status for the Settings UI. No secrets.
 *  `catcher` = mail is going to a local dev catcher (Mailpit/MailHog), so it is
 *  "delivered" but never reaches a real inbox; callers should warn the operator. */
export async function mailStatus(): Promise<{ transport: Transport; from: string; detail: string; catcher: boolean; source: 'settings' | 'env' }> {
  const m = await getMail()
  const detail = m.transport === 'resend' ? 'Resend'
    : m.transport === 'smtp' ? `SMTP · ${m.host}:${m.port}`
    : 'not configured'
  // 1025 is the Mailpit/MailHog convention; "mailpit" is the bundled compose service.
  const catcher = m.transport === 'smtp' && (m.port === 1025 || m.host === 'mailpit')
  return { transport: m.transport, from: m.from, detail, catcher, source: m.source }
}

/**
 * SMTP transport config for nodemailer. Auth is omitted entirely when no user
 * is set so unauthenticated dev servers (Mailpit on :1025) work without
 * tripping nodemailer's auth flow. `secure` is true only on the implicit-TLS
 * port 465; 587/1025 use STARTTLS / plaintext.
 */
function smtpOptions(m: EffectiveMail) {
  return {
    host: m.host,
    port: m.port,
    secure: m.port === 465,
    auth: m.username ? { user: m.username, pass: m.password } : undefined,
  }
}

/** Send one message. Returns true on success, false on any failure (never throws). */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  const m = await getMail()

  try {
    if (m.transport === 'resend') {
      if (!m.resendKey) {
        console.warn('[mailer] resend transport selected but no API key is set')
        return false
      }
      const resend = new Resend(m.resendKey)
      const { error } = await resend.emails.send({
        from: m.from,
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

    if (m.transport === 'smtp') {
      if (!m.host) {
        console.warn('[mailer] smtp transport selected but no host is set')
        return false
      }
      const result = await createTransport(smtpOptions(m)).sendMail({
        from: m.from,
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
