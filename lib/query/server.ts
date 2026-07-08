import { QueryClient } from '@tanstack/react-query'
import { cache } from 'react'

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
