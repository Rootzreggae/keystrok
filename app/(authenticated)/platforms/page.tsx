import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query/server'
import { getPlatforms } from '@/lib/platforms'
import PlatformsScreen from './platforms-client'

// Per-request: the prefetch hits the DB, so never statically prerender/cache it.
export const dynamic = 'force-dynamic'

// Server component: prefetch the platform list and ship it in the HTML so the
// client mounts already-populated. No client-side fetch-on-mount = no refresh
// loader, even when the answer is the empty state. Auth is enforced by the
// (authenticated) layout.
export default async function PlatformsPage() {
  const qc = getQueryClient()
  await qc.prefetchQuery({ queryKey: ['platforms'], queryFn: getPlatforms })

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <PlatformsScreen />
    </HydrationBoundary>
  )
}
