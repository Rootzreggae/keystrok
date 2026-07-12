import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { displayName } from '@/lib/keys-display'

// POST /api/keys/[id]/accept-break   { confirm: string }
// DELETE /api/keys/[id]/accept-break
//
// Accept-the-break: the operator acknowledges that rotating this key may cut
// off whatever unknown consumer is still using it. The typed confirm (the
// key's display name) is enforced server-side; the acceptance snapshots the
// current traffic evidence so the runbook's revoke gate can re-ask if traffic
// changes. An acceptance is a signed cost, so both directions log to Activity.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = await prisma.discoveredKey.findUnique({
    where: { id },
    select: { keyName: true, liveStatus: true, lastUsedAt: true, breakAcceptedAt: true },
  })
  if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })
  if (key.liveStatus !== 'live')
    return NextResponse.json({ error: 'Nothing to accept: the key is not live' }, { status: 400 })
  if (key.breakAcceptedAt)
    return NextResponse.json({ error: 'Break already accepted' }, { status: 409 })

  const body = await req.json().catch(() => null)
  const confirm = typeof body?.confirm === 'string' ? body.confirm.trim() : ''
  if (confirm !== displayName(key.keyName))
    return NextResponse.json({ error: 'Type the key name to confirm you have read what breaks' }, { status: 400 })

  const updated = await prisma.discoveredKey.update({
    where: { id },
    data: {
      breakAcceptedAt: new Date(),
      breakAcceptedBy: session.user.email ?? session.user.id,
      breakAcceptedLastUsedAt: key.lastUsedAt, // the evidence the operator looked at
    },
    select: { breakAcceptedAt: true, breakAcceptedBy: true, breakAcceptedLastUsedAt: true },
  })
  await prisma.activity.create({
    data: {
      action: 'break_accepted',
      description: `Accepted the break on ${key.keyName}: rotating may cut off an unknown consumer (last used ${key.lastUsedAt ? key.lastUsedAt.toISOString() : 'never observed'})`,
      userId: session.user.id,
    },
  })
  return NextResponse.json({ breakAccepted: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = await prisma.discoveredKey.findUnique({ where: { id }, select: { keyName: true, breakAcceptedAt: true } })
  if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })
  if (!key.breakAcceptedAt) return NextResponse.json({ error: 'No accepted break to remove' }, { status: 404 })

  await prisma.discoveredKey.update({
    where: { id },
    data: { breakAcceptedAt: null, breakAcceptedBy: null, breakAcceptedLastUsedAt: null },
  })
  await prisma.activity.create({
    data: {
      action: 'break_acceptance_removed',
      description: `Withdrew the accepted break on ${key.keyName}`,
      userId: session.user.id,
    },
  })
  return NextResponse.json({ ok: true })
}
