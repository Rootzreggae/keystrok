import { HydrationBoundary } from '@tanstack/react-query'
import { auth } from '@/lib/auth'
import { getQueryClient, dehydrateQueries } from '@/lib/query/server'
import { getRecentActivity } from '@/lib/recent-activity'
import { getWorkflowList } from '@/lib/workflows'
import { getPostureData } from '@/lib/posture-data'
import HomeScreen from './home-client'

// Per-request: the prefetches hit the DB, so never statically prerender/cache it.
export const dynamic = 'force-dynamic'

// Server component: prefetch the page's queries in parallel and ship them in
// the HTML so the client mounts already-populated — no refresh loader, no
// metrics flashing 0 (same pattern as platforms/activity). Auth is enforced by
// the (authenticated) layout; auth() here is a cache hit.
export default async function DashboardPage() {
  const session = await auth()
  const qc = getQueryClient()
  await Promise.all([
    qc.prefetchQuery({ queryKey: ['activity-recent'], queryFn: () => getRecentActivity(8) }),
    qc.prefetchQuery({
      queryKey: ['workflows'],
      // The API route JSON-serializes this (Dates become ISO strings); round-trip
      // here so the hydrated shape is identical to what a client fetch returns.
      queryFn: async () => JSON.parse(JSON.stringify((await getWorkflowList()).workflows)),
    }),
    session?.user?.id
      ? qc.prefetchQuery({ queryKey: ['posture'], queryFn: () => getPostureData(session.user!.id!) })
      : null,
  ])

  return (
    // Keys + active findings are hydrated by the (authenticated) layout (the
    // shell needs them everywhere); this boundary carries only the page's own.
    <HydrationBoundary state={dehydrateQueries(qc, 'activity-recent', 'workflows', 'posture')}>
      <HomeScreen />
    </HydrationBoundary>
  )
}
