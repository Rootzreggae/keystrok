import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/roles'
import { decryptSecret } from '@/lib/crypto'

// POST /api/alerts/telegram-chatid - auto-discover the chat_id the "Uptime Kuma"
// way: after the operator messages their bot, read the latest getUpdates entry.
// Accepts a token in the body (before save) or falls back to the saved one.
export async function POST(req: NextRequest) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const denied = await requireAdmin(s.user.id)
  if (denied) return denied

  const b = await req.json().catch(() => ({}))
  let token: string | null = typeof b.token === 'string' && b.token.trim() && b.token !== '••••••••' ? b.token.trim() : null
  if (!token) {
    const c = await prisma.alertConfig.findUnique({ where: { id: 'default' } })
    token = c?.telegramToken ? decryptSecret(c.telegramToken) : null
  }
  if (!token) return NextResponse.json({ ok: false, error: 'Enter your bot token first' }, { status: 400 })

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { signal: AbortSignal.timeout(8000) })
    const json = await res.json().catch(() => null)
    if (!json?.ok) return NextResponse.json({ ok: false, error: 'Telegram rejected the token' }, { status: 400 })
    const updates: unknown[] = json.result ?? []
    // most recent message's chat id
    for (let i = updates.length - 1; i >= 0; i--) {
      const chat = (updates[i] as { message?: { chat?: { id?: number; title?: string; username?: string } } })?.message?.chat
      if (chat?.id != null) return NextResponse.json({ ok: true, chatId: String(chat.id), chatName: chat.title || chat.username || null })
    }
    return NextResponse.json({ ok: false, error: 'No messages yet. Send your bot any message, then try again.' }, { status: 404 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Could not reach Telegram' }, { status: 502 })
  }
}
