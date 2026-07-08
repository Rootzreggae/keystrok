import { HydrationBoundary } from '@tanstack/react-query'
import { getQueryClient, dehydrateQueries } from '@/lib/query/server'
import { getActivityFeed } from '@/lib/activity'
import ActivityScreen from './activity-client'

// Per-request: the prefetch hits the DB, so never statically prerender/cache it.
export const dynamic = 'force-dynamic'

// Server component: prefetch the composed feed and ship it in the HTML so the
// client mounts already-populated — no refresh loader (same pattern as
// platforms). Auth is enforced by the (authenticated) layout.
export default async function ActivityPage() {
  const qc = getQueryClient()
  await qc.prefetchQuery({ queryKey: ['activity-feed'], queryFn: getActivityFeed })

  return (
    <HydrationBoundary state={dehydrateQueries(qc, 'activity-feed')}>
      <ActivityScreen />
    </HydrationBoundary>
  )
}
