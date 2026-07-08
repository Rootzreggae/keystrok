import { redirect } from 'next/navigation'
import { HydrationBoundary } from '@tanstack/react-query'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { getQueryClient, dehydrateQueries } from '@/lib/query/server'
import { getKeys } from '@/lib/keys'
import { getFindings } from '@/lib/findings'

import { AppShell } from '@/components/ks/AppShell'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const session = await auth()

  if (!session) {
    redirect('/auth/signin')
  }

  const qc = getQueryClient()
  const [admin] = await Promise.all([
    // isAdmin also self-heals the bootstrap (earliest user becomes admin).
    session.user?.id ? isAdmin(session.user.id) : false,
    qc.prefetchQuery({ queryKey: ['keys'], queryFn: getKeys }),
    qc.prefetchQuery({
      queryKey: ['findings', 'active'],
      queryFn: async () => (await getFindings({ status: 'active' })).findings,
    }),
  ])

  return (
    // The shell's own queries (sidebar badges read keys + active findings).
    // AppShell commits before any page segment streams in, so hydrating these
    // at page level is too late — its effects would fire against an empty cache
    // and refetch. The layout is the only boundary in the same flush as AppShell.
    <HydrationBoundary state={dehydrateQueries(qc, 'keys', 'findings')}>
      <AppShell email={session.user?.email} isAdmin={admin}>{children}</AppShell>
    </HydrationBoundary>
  )
}
