import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { READ_MODES } from '@/lib/blast-radius'

// POST /api/keys/[id]/consumers   { name, readMode, owner? }
// DELETE /api/keys/[id]/consumers?consumerId=...
//
// User-asserted consumers of a leaked key: the "Missing something?" flow on the
// blast radius. Assertions are provenance, not truth; they stay labeled in the
// UI. Any authenticated member may assert or remove one (entering evidence is
// triage, like setting an exposure date). Both directions log to Activity so
// the assertion is auditable.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const readMode = typeof body?.readMode === 'string' ? body.readMode : ''
  const owner = typeof body?.owner === 'string' && body.owner.trim() ? body.owner.trim().slice(0, 120) : null
  if (!name) return NextResponse.json({ error: 'Consumer name is required' }, { status: 400 })
  if (!(readMode in READ_MODES)) return NextResponse.json({ error: 'Invalid readMode' }, { status: 400 })

  const key = await prisma.discoveredKey.findUnique({ where: { id }, select: { id: true, keyName: true } })
  if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

  try {
    const consumer = await prisma.assertedConsumer.create({
      data: { discoveredKeyId: id, name, readMode, owner, assertedBy: session.user.email ?? session.user.id },
    })
    await prisma.activity.create({
      data: {
        action: 'consumer_asserted',
        description: `Asserted consumer "${name}" (${READ_MODES[readMode]}) on ${key.keyName}`,
        userId: session.user.id,
      },
    })
    return NextResponse.json({ consumer }, { status: 201 })
  } catch (e: unknown) {
    // unique(discoveredKeyId, name): the same consumer asserted twice
    if (typeof e === 'object' && e && 'code' in e && (e as { code?: string }).code === 'P2002')
      return NextResponse.json({ error: 'That consumer is already on the map' }, { status: 409 })
    throw e
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const consumerId = req.nextUrl.searchParams.get('consumerId')
  if (!consumerId) return NextResponse.json({ error: 'Missing consumerId' }, { status: 400 })

  // Scoped delete: the consumer must belong to this key.
  const consumer = await prisma.assertedConsumer.findFirst({
    where: { id: consumerId, discoveredKeyId: id },
    select: { id: true, name: true, discoveredKey: { select: { keyName: true } } },
  })
  if (!consumer) return NextResponse.json({ error: 'Consumer not found' }, { status: 404 })

  await prisma.assertedConsumer.delete({ where: { id: consumer.id } })
  await prisma.activity.create({
    data: {
      action: 'consumer_assertion_removed',
      description: `Removed asserted consumer "${consumer.name}" from ${consumer.discoveredKey.keyName}`,
      userId: session.user.id,
    },
  })
  return NextResponse.json({ ok: true })
}
