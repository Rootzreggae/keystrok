import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { registerManualKey } from '@/lib/manual-keys'
import { REGISTER_MESSAGES } from '@/lib/scanner/classify'

// POST /api/keys/register — register a known key into the ledger by paste.
// The value lives only in this request's scope: classified in-memory,
// persisted as masked preview + salted hash. NEVER log any part of the body,
// and every error response here is a static string containing no fragment of
// the input (asserted in lib/manual-keys.test.ts).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  // Rate-limited per user because the endpoint accepts secret material.
  const rl = await checkRateLimit(`register-key:${userId}`, { limit: 10, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: REGISTER_MESSAGES.rate_limited },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  let body: { value?: unknown; name?: unknown; platform?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: REGISTER_MESSAGES.invalid, code: 'invalid' }, { status: 400 })
  }
  if (typeof body.value !== 'string') {
    return NextResponse.json({ error: REGISTER_MESSAGES.invalid, code: 'invalid' }, { status: 400 })
  }

  try {
    const result = await registerManualKey({
      value: body.value,
      name: typeof body.name === 'string' ? body.name : undefined,
      platform: typeof body.platform === 'string' ? body.platform : undefined,
      userId,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: REGISTER_MESSAGES[result.code], code: result.code, existingKeyId: result.existingKeyId },
        { status: result.code === 'duplicate' ? 409 : 400 }
      )
    }
    return NextResponse.json({ success: true, key: result.key }, { status: 201 })
  } catch {
    // Static message: a thrown error's text could carry fragments of the query.
    return NextResponse.json({ error: REGISTER_MESSAGES.failed, code: 'failed' }, { status: 500 })
  }
}
