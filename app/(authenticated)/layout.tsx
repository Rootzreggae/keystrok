import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'

import { AppShell } from '@/components/ks/AppShell'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const session = await auth()

  if (!session) {
    redirect('/auth/signin')
  }

  // isAdmin also self-heals the bootstrap (earliest user becomes admin).
  const admin = session.user?.id ? await isAdmin(session.user.id) : false

  return <AppShell email={session.user?.email} isAdmin={admin}>{children}</AppShell>
}
