import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encryptSecret } from '@/lib/crypto'

const LABELS: Record<string, string> = { local: 'Local model', anthropic: 'Anthropic', openai: 'OpenAI', openai_compat: 'OpenAI-compatible' }

export async function GET() {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const p = await prisma.assistantProvider.findUnique({ where: { userId: s.user.id } })
  if (!p) return NextResponse.json({ connected: false })
  return NextResponse.json({ connected: true, provider: { id: p.id, type: p.type, label: p.label, model: p.model, baseUrl: p.baseUrl, hasKey: !!p.apiKeyEnc } })
}

export async function POST(request: NextRequest) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { type, baseUrl, model, apiKey } = await request.json()
  if (!type || !model) return NextResponse.json({ error: 'type and model are required' }, { status: 400 })

  const label = LABELS[type] ?? type
  const update: { type: string; label: string; baseUrl: string | null; model: string; status: string; apiKeyEnc?: string } = {
    type, label, baseUrl: baseUrl || null, model, status: 'connected',
  }
  if (typeof apiKey === 'string' && apiKey.length) update.apiKeyEnc = encryptSecret(apiKey)

  const p = await prisma.assistantProvider.upsert({
    where: { userId: s.user.id },
    create: { userId: s.user.id, type, label, baseUrl: baseUrl || null, model, apiKeyEnc: apiKey ? encryptSecret(apiKey) : null, status: 'connected' },
    update,
  })
  return NextResponse.json({ connected: true, provider: { id: p.id, type: p.type, label: p.label, model: p.model } })
}

export async function DELETE() {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.assistantProvider.deleteMany({ where: { userId: s.user.id } })
  return NextResponse.json({ connected: false })
}
