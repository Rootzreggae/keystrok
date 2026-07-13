import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { decryptSecret } from '@/lib/crypto'
import { loadProvider, buildSystemPrompt, streamChat, type ChatMessage } from '@/lib/assistant'

export const dynamic = 'force-dynamic'

// Streaming chat: proxies to the user's BYO provider with a metadata-only
// system context. Streams plain-text deltas; the client appends them live.
export async function POST(request: NextRequest) {
  const s = await auth()
  if (!s?.user?.id) return new Response('Unauthorized', { status: 401 })

  const { messages, model } = await request.json()
  if (!Array.isArray(messages)) return new Response('messages[] required', { status: 400 })

  const cfg = await loadProvider(s.user.id, decryptSecret)
  if (!cfg) return new Response('No assistant model connected', { status: 409 })
  if (typeof model === 'string' && model) cfg.model = model

  const system = await buildSystemPrompt()
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamChat(cfg, system, messages as ChatMessage[])) {
          controller.enqueue(encoder.encode(delta))
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n_[error: ${e instanceof Error ? e.message : 'request failed'}]_`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache, no-transform' } })
}
