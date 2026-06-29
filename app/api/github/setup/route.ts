import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getInstallation } from '@/lib/github'

// GitHub redirects here after the user installs/updates the App. We capture the
// installation id and associate it with the signed-in user.
export async function GET(request: NextRequest) {
  const session = await auth()
  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3001'
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/signin', base))
  }

  const installationId = request.nextUrl.searchParams.get('installation_id')
  if (!installationId) {
    return NextResponse.redirect(new URL('/discovery-scanner?source_error=missing_installation', base))
  }

  try {
    const install = await getInstallation(installationId)
    const account = install.account as { login?: string; type?: string } | null

    await prisma.sourceConnection.upsert({
      where: { provider_installationId: { provider: 'github', installationId } },
      create: {
        userId: session.user.id,
        provider: 'github',
        installationId,
        accountLogin: account?.login ?? 'unknown',
        accountType: account?.type ?? null,
        status: 'active',
      },
      update: {
        userId: session.user.id,
        accountLogin: account?.login ?? 'unknown',
        accountType: account?.type ?? null,
        status: 'active',
      },
    })

    return NextResponse.redirect(new URL('/discovery-scanner?connected=github', base))
  } catch (error) {
    console.error('[github/setup] failed:', error)
    return NextResponse.redirect(new URL('/discovery-scanner?source_error=setup_failed', base))
  }
}
