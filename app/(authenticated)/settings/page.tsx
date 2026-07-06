import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { SettingsShell } from '@/components/ks/SettingsShell'

// Instance + personal settings. Accessible to all users: Appearance is a personal
// preference (everyone). Alerts and Email delivery are admin-only, gated inside
// the shell (and at their APIs).
export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const admin = await isAdmin(session.user.id)
  return <SettingsShell isAdmin={admin} />
}
