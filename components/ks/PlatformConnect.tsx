'use client'

import { useEffect, useState } from 'react'
import { X, Server, ArrowLeft, Check } from 'lucide-react'
import { Mark } from '@/components/ks'

const PRESETS = [
  { type: 'datadog', name: 'Datadog', meta: 'Observability', code: 'DD', apiUrl: 'https://api.datadoghq.com', authType: 'api-key', authHeader: 'DD-API-KEY', testEndpoint: '/api/v1/validate', keyPh: 'your Datadog API key', fixedUrl: false },
  { type: 'grafana', name: 'Grafana', meta: 'Observability', code: 'GRF', apiUrl: 'https://your-stack.grafana.net', authType: 'bearer', authHeader: 'Authorization', testEndpoint: '/api/org', keyPh: 'glsa_…', fixedUrl: false },
  { type: 'stripe', name: 'Stripe', meta: 'Payments', code: 'STR', apiUrl: 'https://api.stripe.com', authType: 'bearer', authHeader: 'Authorization', testEndpoint: '/v1/charges', keyPh: 'sk_live_…', fixedUrl: true },
  { type: 'github', name: 'GitHub', meta: 'Development', code: 'GH', apiUrl: 'https://api.github.com', authType: 'bearer', authHeader: 'Authorization', testEndpoint: '/user', keyPh: 'ghp_…', fixedUrl: true },
  { type: 'custom', name: 'Custom / other', meta: 'Any API URL + key', code: 'API', apiUrl: '', authType: 'bearer', authHeader: 'Authorization', testEndpoint: '', keyPh: 'your API key', fixedUrl: false },
] as const
type Preset = (typeof PRESETS)[number]

// Connect an observability/service platform: pick → config → test the key is
// live → connect. The key is stored encrypted and only ever used to validate.
export function PlatformConnect({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const [sel, setSel] = useState<Preset | null>(null)
  const [name, setName] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [key, setKey] = useState('')
  const [appKey, setAppKey] = useState('') // 2nd credential for platforms that list keys (Datadog)
  const [test, setTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'fail'; message?: string }>({ state: 'idle' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setSel(null); setTest({ state: 'idle' }) } }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null

  const pick = (p: Preset) => { setSel(p); setName(p.type === 'custom' ? '' : p.name); setApiUrl(p.apiUrl); setKey(''); setAppKey(''); setTest({ state: 'idle' }) }
  const needsAppKey = sel?.type === 'datadog' // Datadog needs an application key to list keys for liveness
  const ready = !!sel && !!name && !!key && !!apiUrl
  const cfg = () => ({ type: sel!.type, apiUrl, apiKey: key, authHeader: sel!.authHeader, testEndpoint: sel!.testEndpoint })

  const runTest = async () => {
    setTest({ state: 'testing' })
    const r = await fetch('/api/platforms/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg()) }).then((r) => r.json()).catch(() => ({ ok: false, message: 'request failed' }))
    setTest(r.ok ? { state: 'ok', message: r.message } : { state: 'fail', message: r.message })
  }
  const connect = async () => {
    if (!sel) return
    setSaving(true)
    await fetch('/api/platforms', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, platform_type: sel.type, category: sel.meta, api_url: apiUrl, api_key: key, app_key: appKey, auth_type: sel.authType, auth_header: sel.authHeader, test_endpoint: sel.testEndpoint }),
    }).catch(() => {})
    setSaving(false)
    onConnected()
  }

  return (
    <>
      <div className="ks-drawer-scrim" onClick={onClose} />
      <aside className="ks-drawer ks-as-connect">
        <div className="ks-drawer__hd">
          <button className="ks-drawer__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
          <div className="ks-as__title"><Server size={15} /> {sel ? <>Connect {sel.name}</> : <>Connect a platform</>}</div>
          <div className="ks-as__sub">validate a key against its service</div>
        </div>

        <div className="ks-drawer__body" style={{ padding: '18px 22px' }}>
          {!sel ? (
            <>
              <div className="ks-as__grouplbl" style={{ marginTop: 0 }}>Pick a platform</div>
              {PRESETS.map((p) => (
                <button key={p.type} className="ks-prov" onClick={() => pick(p)}>
                  <span className="ks-prov__icon"><Mark>{p.code}</Mark></span>
                  <div className="ks-prov__main"><div className="ks-prov__name">{p.name}</div><div className="ks-prov__meta">{p.meta}</div></div>
                </button>
              ))}
            </>
          ) : (
            <>
              <button className="ks-as__back" onClick={() => setSel(null)}><ArrowLeft size={14} /> All platforms</button>
              <label className="ks-as__field"><span>Name</span>
                <input className="ks-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production Datadog" />
              </label>
              <label className="ks-as__field"><span>API URL</span>
                <input className="ks-input" value={apiUrl} onChange={(e) => { setApiUrl(e.target.value); setTest({ state: 'idle' }) }} readOnly={sel.fixedUrl} placeholder="https://api.example.com" spellCheck={false} autoCapitalize="off" />
              </label>
              <label className="ks-as__field"><span>API key</span>
                <input className="ks-input" type="password" value={key} onChange={(e) => { setKey(e.target.value); setTest({ state: 'idle' }) }} placeholder={sel.keyPh} spellCheck={false} autoCapitalize="off" />
              </label>
              {needsAppKey && (
                <label className="ks-as__field"><span>Application key <span style={{ color: 'var(--tx-dim)' }}>(for liveness checks)</span></span>
                  <input className="ks-input" type="password" value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder="Datadog application key" spellCheck={false} autoCapitalize="off" />
                </label>
              )}
              {test.state === 'fail' && <div className="ks-as__testmsg fail">{test.message}</div>}
              {test.state === 'ok' && <div className="ks-as__testmsg ok"><Check size={13} /> {test.message}</div>}
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
