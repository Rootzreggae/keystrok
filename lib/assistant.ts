// BYO AI assistant: provider adapters + metadata context. The assistant only
// ever receives key METADATA (names, severity, where-found, days-to-rotation),
// never secret values, and is instructed to stay advisory (never claim to act).
import { prisma } from '@/lib/prisma'
import { daysUntilDue, slaDays } from '@/lib/rotation-policy'
import { assertSafePlatformUrl } from '@/lib/ssrf'

export type ProviderType = 'local' | 'anthropic' | 'openai' | 'openai_compat'
export interface ProviderConfig { type: ProviderType; baseUrl?: string | null; model: string; apiKey?: string | null }
export interface ChatMessage { role: 'user' | 'assistant'; content: string }

const ANTHROPIC_VERSION = '2023-06-01'

function baseUrlFor(c: ProviderConfig): string {
  if (c.type === 'anthropic') return (c.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '')
  if (c.type === 'openai') return (c.baseUrl || 'https://api.openai.com').replace(/\/$/, '')
  return (c.baseUrl || 'http://localhost:11434').replace(/\/$/, '') // local default (Ollama-compatible)
}
const isAnthropic = (c: ProviderConfig) => c.type === 'anthropic'

// The base URL is user-supplied (BYO endpoint), so it goes through the same
// SSRF guard as platform tests before any fetch. Honors ALLOW_PRIVATE_PLATFORM_URLS
// so a self-hoster can still point at a local Ollama on a private IP.
async function safeBase(c: ProviderConfig): Promise<string> {
  const base = baseUrlFor(c)
  await assertSafePlatformUrl(base)
  return base
}

// ---- SSE line reader -------------------------------------------------------
async function* sseData(res: Response): AsyncGenerator<string> {
  if (!res.body) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (line.startsWith('data:')) yield line.slice(5).trim()
    }
  }
}

// ---- Streaming chat: yields plain text deltas ------------------------------
export async function* streamChat(c: ProviderConfig, system: string, messages: ChatMessage[]): AsyncGenerator<string> {
  const base = await safeBase(c)
  if (isAnthropic(c)) {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': c.apiKey || '', 'anthropic-version': ANTHROPIC_VERSION },
      body: JSON.stringify({ model: c.model, max_tokens: 1024, system, stream: true, messages: messages.map((m) => ({ role: m.role, content: m.content })) }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`)
    for await (const d of sseData(res)) {
      if (d === '[DONE]') break
      try {
        const j = JSON.parse(d)
        if (j.type === 'content_block_delta' && j.delta?.text) yield j.delta.text
      } catch { /* ignore keep-alives */ }
    }
    return
  }
  // OpenAI-compatible (OpenAI, local Ollama/LM-Studio, any compatible base URL)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (c.apiKey) headers['authorization'] = `Bearer ${c.apiKey}`
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({ model: c.model, stream: true, messages: [{ role: 'system', content: system }, ...messages] }),
  })
  if (!res.ok) throw new Error(`Provider ${res.status}: ${(await res.text()).slice(0, 200)}`)
  for await (const d of sseData(res)) {
    if (d === '[DONE]') break
    try {
      const j = JSON.parse(d)
      const t = j.choices?.[0]?.delta?.content
      if (t) yield t
    } catch { /* ignore */ }
  }
}

// ---- Test a provider config (cheap, validates creds + model + endpoint) -----
export async function testProvider(c: ProviderConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const base = await safeBase(c)
    if (isAnthropic(c)) {
      const res = await fetch(`${base}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': c.apiKey || '', 'anthropic-version': ANTHROPIC_VERSION },
        body: JSON.stringify({ model: c.model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
      })
      if (!res.ok) return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 160)}` }
      return { ok: true }
    }
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (c.apiKey) headers['authorization'] = `Bearer ${c.apiKey}`
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST', headers,
      body: JSON.stringify({ model: c.model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
    })
    if (!res.ok) return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 160)}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Connection failed' }
  }
}

// ---- Metadata context (no secrets) -----------------------------------------
export async function buildSystemPrompt(userId: string): Promise<string> {
  const [keys, findings, workflows] = await Promise.all([
    prisma.discoveredKey.findMany({ where: { userId, status: { not: 'false_positive' } }, orderBy: { foundAt: 'desc' }, take: 60 }),
    prisma.localScanFinding.findMany({ where: { userId, status: 'active' }, take: 60 }),
    prisma.rotationWorkflow.findMany({ where: { userId, status: { not: 'completed' } }, take: 30 }),
  ])

  const keyLines = keys.map((k) => {
    const d = daysUntilDue(k.foundAt, k.severity)
    const due = d < 0 ? `${-d}d OVERDUE` : `${d}d left`
    return `- ${k.keyName ?? 'key'} · ${k.platform ?? '?'} · ${k.severity} · rotate within ${slaDays(k.severity)}d (${due}) · found at ${k.location ?? k.source ?? '?'} · status ${k.status}`
  }).join('\n')

  const findLines = findings.map((f) => `- ${f.patternName || f.keyType} · ${f.severity} · ${f.relativePath || f.filePath}:${f.lineNumber}`).join('\n')

  return [
    'You are the Keystrok assistant, embedded in an API-key security app.',
    'STRICT RULES:',
    '- You reason over key METADATA only. You never see, request, or output secret values.',
    '- You are ADVISORY. You never rotate, revoke, or change anything. When a key needs rotating, point the user to the guided rotation flow ("Start guided rotation" in the app). Never claim you performed an action.',
    '- Rotation timing is anchored to when a key was DISCOVERED (foundAt), never a real creation/expiry date. Keystrok does not know a key\'s true age.',
    '- Be concise and specific. Reference keys by name. Rank by severity, then by rotation time remaining.',
    '',
    `TRACKED KEYS (${keys.length}):`,
    keyLines || '(none yet)',
    '',
    `OPEN FINDINGS TO TRIAGE (${findings.length}):`,
    findLines || '(none)',
    '',
    `ROTATIONS IN PROGRESS: ${workflows.length}`,
  ].join('\n')
}

// ---- Load the user's provider, decrypting the key for use ------------------
export async function loadProvider(userId: string, decrypt: (v: string) => string): Promise<ProviderConfig | null> {
  const p = await prisma.assistantProvider.findUnique({ where: { userId } })
  if (!p) return null
  return { type: p.type as ProviderType, baseUrl: p.baseUrl, model: p.model, apiKey: p.apiKeyEnc ? decrypt(p.apiKeyEnc) : null }
}
