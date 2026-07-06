import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/roles'
import { AlertsSettings } from '@/components/ks/AlertsSettings'

// Instance settings, admin-only. Home for alert delivery today; the natural
// place for Assistant model config and other instance settings later.
export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  if (!(await isAdmin(session.user.id))) {
    return (
      <div className="ks-home">
        <div className="ks-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
          <div className="ks-empty">
            <div className="ks-empty__t">Admins only</div>
            <div className="ks-empty__s">Instance settings are managed by an admin.</div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="ks-home" style={{ maxWidth: 760 }}>
      <AlertsSettings />
    </div>
  )
}
