import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listInstallationRepos } from '@/lib/github'

// Repos the user's GitHub connection(s) can see, for the wizard's repo picker.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Shared workspace: all connected GitHub sources are visible to any member.
  const connections = await prisma.sourceConnection.findMany({
    where: { provider: 'github', status: 'active' },
  })

  const sources = await Promise.all(
    connections.map(async (c) => {
      try {
        return { connectionId: c.id, accountLogin: c.accountLogin, repos: await listInstallationRepos(c.installationId) }
      } catch (error) {
        console.error('[github/repos] failed for', c.accountLogin, error)
        return { connectionId: c.id, accountLogin: c.accountLogin, repos: [], error: 'Could not list repositories' }
      }
    }),
  )

  return NextResponse.json({ connected: connections.length > 0, sources })
}
