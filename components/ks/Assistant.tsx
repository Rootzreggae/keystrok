'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Zap, Terminal, Shield, ArrowLeft, Check, CornerDownLeft, Settings2 } from 'lucide-react'

export interface AssistantProvider { type: string; label: string; model: string; baseUrl?: string | null; hasKey?: boolean }
interface Msg { role: 'user' | 'assistant'; content: string }

export const AssistantContext = createContext<{ open: () => void }>({ open: () => {} })
export const useAssistant = () => useContext(AssistantContext)

const PROVIDERS = [
  { type: 'local', name: 'Local model', meta: 'Runs on your own hardware. Key context never leaves your network.', tag: 'Private', baseDefault: 'http://localhost:11434', modelPh: 'llama3.1', needsKey: false, needsBase: true },
  { type: 'anthropic', name: 'Anthropic', meta: 'Claude Sonnet · Opus · Haiku', modelPh: 'claude-sonnet-4-6', needsKey: true, needsBase: false },
  { type: 'openai', name: 'OpenAI', meta: 'GPT-4o · o-series', modelPh: 'gpt-4o', needsKey: true, needsBase: false },
  { type: 'openai_compat', name: 'OpenAI-compatible', meta: 'Any base URL + key + model', baseDefault: '', modelPh: 'model-id', needsKey: true, needsBase: true },
] as const
type Prov = (typeof PROVIDERS)[number]

// Minimal markdown: paragraphs, **bold**, `code`, and - bullets. Enough for chat prose.
function MD({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
      part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b>
        : part.startsWith('`') ? <code key={i} className="ks-as__code">{part.slice(1, -1)}</code>
          : <span key={i}>{part}</span>)
  const blocks = text.split(/\n\n+/)
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return <ul key={i} className="ks-as__ul">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ''))}</li>)}</ul>
        }
        return <p key={i} className="ks-as__p">{lines.map((l, j) => <span key={j}>{inline(l)}{j < lines.length - 1 && <br />}</span>)}</p>
      })}
    </>
  )
}

// ---- Connect drawer --------------------------------------------------------
export function AssistantConnect({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const [sel, setSel] = useState<Prov | null>(null)
  const [base, setBase] = useState('')
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'fail'; error?: string }>({ state: 'idle' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setSel(null); setTest({ state: 'idle' }) } }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null

  const pick = (p: Prov) => { setSel(p); setBase(('baseDefault' in p ? p.baseDefault : '') || ''); setKey(''); setModel(''); setTest({ state: 'idle' }) }
  const cfg = () => ({ type: sel!.type, baseUrl: sel!.needsBase ? base : undefined, model, apiKey: sel!.needsKey ? key : undefined })
  const ready = !!model && (!sel?.needsKey || !!key) && (!sel?.needsBase || !!base)

  const runTest = async () => {
    setTest({ state: 'testing' })
    const r = await fetch('/api/assistant/provider/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg()) }).then((r) => r.json()).catch(() => ({ ok: false, error: 'request failed' }))
    setTest(r.ok ? { state: 'ok' } : { state: 'fail', error: r.error })
  }
  const connect = async () => {
    setSaving(true)
    await fetch('/api/assistant/provider', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg()) }).catch(() => {})
    setSaving(false)
    onConnected()
  }

  return (
    <>
      <div className="ks-drawer-scrim" onClick={onClose} />
      <aside className="ks-drawer ks-as-connect">
        <div className="ks-drawer__hd">
          <button className="ks-drawer__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
          <div className="ks-as__title"><Zap size={15} /> {sel ? <>Connect {sel.name}</> : <>Connect your AI</>}</div>
          <div className="ks-as__sub">bring your own model</div>
        </div>
        <div className="ks-drawer__body" style={{ padding: '18px 22px' }}>
          {!sel ? (
            <>
              <div className="ks-wiz__note" style={{ marginTop: 0, marginBottom: 18 }}>
                <Shield size={14} style={{ flex: 'none', marginTop: 1 }} />
                <span>The assistant reasons over key <b>metadata</b>: names, severity, where each was found. It <b>never</b> sees the secret values. You choose which model runs on.</span>
              </div>
              <div className="ks-as__grouplbl">Run it privately · recommended for self-hosted</div>
              {PROVIDERS.filter((p) => p.type === 'local').map((p) => (
                <button key={p.type} className="ks-prov sel" onClick={() => pick(p)}>
                  <span className="ks-prov__icon"><Terminal size={20} /></span>
                  <div className="ks-prov__main"><div className="ks-prov__name">{p.name}</div><div className="ks-prov__meta">{p.meta}</div></div>
                  <span className="ks-prov__badge ks-prov__badge--rec">Private</span>
                </button>
              ))}
              <div className="ks-as__grouplbl">Hosted APIs</div>
              {PROVIDERS.filter((p) => p.type !== 'local').map((p) => (
                <button key={p.type} className="ks-prov" onClick={() => pick(p)}>
                  <span className="ks-prov__icon"><Zap size={18} /></span>
                  <div className="ks-prov__main"><div className="ks-prov__name">{p.name}</div><div className="ks-prov__meta">{p.meta}</div></div>
                </button>
              ))}
            </>
          ) : (
            <>
              <button className="ks-as__back" onClick={() => setSel(null)}><ArrowLeft size={14} /> All providers</button>
              {sel.needsBase && (
                <label className="ks-as__field"><span>Base URL</span>
                  <input className="ks-input" value={base} onChange={(e) => { setBase(e.target.value); setTest({ state: 'idle' }) }} placeholder="http://localhost:11434" spellCheck={false} autoCapitalize="off" />
                </label>
              )}
              {sel.needsKey && (
                <label className="ks-as__field"><span>API key</span>
                  <input className="ks-input" type="password" value={key} onChange={(e) => { setKey(e.target.value); setTest({ state: 'idle' }) }} placeholder="stored encrypted at rest" spellCheck={false} autoCapitalize="off" />
                </label>
              )}
              <label className="ks-as__field"><span>Model</span>
                <input className="ks-input" value={model} onChange={(e) => { setModel(e.target.value); setTest({ state: 'idle' }) }} placeholder={sel.modelPh} spellCheck={false} autoCapitalize="off" />
              </label>
              {test.state === 'fail' && <div className="ks-as__testmsg fail">Test failed · {test.error}</div>}
              {test.state === 'ok' && <div className="ks-as__testmsg ok"><Check size={13} /> Connection OK</div>}
            </>
          )}
        </div>
        {sel && (
          <div className="ks-drawer__foot">
            <button className="ks-btn" disabled={!ready || test.state === 'testing'} onClick={runTest}>{test.state === 'testing' ? 'Testing…' : 'Test'}</button>
            <button className="ks-btn ks-btn--primary" style={{ flex: 1, justifyContent: 'center' }} disabled={test.state !== 'ok' || saving} onClick={connect}>
              <Check size={14} /> {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

// ---- Chat drawer -----------------------------------------------------------
const SUGGESTIONS = ['What needs rotating first?', 'Anything overdue?', 'What did the last scan find?']

export function AssistantChat({ open, onClose, onManage, provider, keyCount }: { open: boolean; onClose: () => void; onManage: () => void; provider: AssistantProvider; keyCount: number }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight }) }, [messages])
  if (!open) return null

  const send = async (text: string) => {
    if (!text.trim() || streaming) return
    const base = [...messages, { role: 'user' as const, content: text.trim() }]
    setMessages([...base, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)
    try {
      const res = await fetch('/api/assistant/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: base, model: provider.model }) })
      if (!res.ok || !res.body) { throw new Error(res.status === 409 ? 'No model connected' : `Error ${res.status}`) }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: acc }; return c })
      }
    } catch (e) {
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: `_[${e instanceof Error ? e.message : 'request failed'}]_` }; return c })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <>
      <div className="ks-drawer-scrim" onClick={onClose} />
      <aside className="ks-drawer ks-as-chat">
        <div className="ks-drawer__hd ks-as__chathd">
          <button className="ks-drawer__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
          <div className="ks-as__title"><Zap size={15} /> Assistant</div>
          <div className="ks-as__sub">{keyCount} keys · {provider.label}</div>
          <button className="ks-as__manage" title="Change model" onClick={onManage}><Settings2 size={14} /> {provider.model}</button>
        </div>

        <div className="ks-drawer__body ks-as__body" ref={bodyRef}>
          <div className="ks-as__advisory">
            <Shield size={13} style={{ flex: 'none', marginTop: 1 }} />
            <span><b>Advisory · runs on your model.</b> Reasons over key metadata, never the secret values, and never rotates or revokes on its own.</span>
          </div>
          {messages.length === 0 && (
            <div className="ks-as__suggest">
              {SUGGESTIONS.map((s) => <button key={s} className="ks-as__chip" onClick={() => send(s)}>{s}</button>)}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={'ks-as__msg ks-as__msg--' + m.role}>
              {m.role === 'assistant' ? (m.content ? <MD text={m.content} /> : <span className="ks-as__typing">…</span>) : m.content}
            </div>
          ))}
        </div>

        <div className="ks-as__inputbar">
          <input
            className="ks-as__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Ask about your keys…"
            disabled={streaming}
            autoFocus
          />
          <button className="ks-as__send" disabled={!input.trim() || streaming} onClick={() => send(input)} aria-label="Send"><CornerDownLeft size={15} /></button>
        </div>
      </aside>
    </>
  )
}

// Convenience query hook for the sidebar card + AppShell host.
export function useAssistantProvider() {
  return useQuery<{ connected: boolean; provider?: AssistantProvider }>({
    queryKey: ['assistant-provider'],
    queryFn: async () => { const r = await fetch('/api/assistant/provider'); if (!r.ok) throw new Error('provider'); return r.json() },
  })
}
