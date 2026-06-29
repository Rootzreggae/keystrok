import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

import { AppShell } from '@/components/ks/AppShell'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const session = await auth()

  if (!session) {
    redirect('/auth/signin')
  }

  return <AppShell email={session.user?.email}>{children}</AppShell>
}
