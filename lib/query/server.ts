import { QueryClient, dehydrate } from '@tanstack/react-query'
import { cache } from 'react'

// Dehydrate only the queries whose key starts with one of `roots`. The request
// QueryClient is shared between the (authenticated) layout and the page, so an
// unfiltered dehydrate() in a page would re-serialize the layout's shell
// queries (keys, findings) and ship the same data in the HTML twice. Every
// boundary declares what it owns instead.
export function dehydrateQueries(qc: QueryClient, ...roots: string[]) {
  const set = new Set(roots)
  return dehydrate(qc, { shouldDehydrateQuery: (q) => set.has(String(q.queryKey[0])) })
}

// Per-request server QueryClient for prefetch + dehydrate. `cache` scopes one
// instance to a single request so concurrent users never share cache state.
// staleTime matches the client (app/providers.tsx) so hydrated data isn't
// considered stale on mount — that's what prevents an immediate client refetch
// (and the loader flash) right after the server already had the data.
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: { queries: { staleTime: 60 * 1000 } },
    }),
)
