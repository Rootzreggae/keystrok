'use client'

import { useEffect, useState } from 'react'
import { X, Server, ArrowLeft, Check } from 'lucide-react'
import { Mark } from '@/components/ks'

interface Preset {
  type: string; name: string; meta: string; code: string
  apiUrl: string; authType: string; authHeader: string; testEndpoint: string
  keyPh: string; fixedUrl: boolean
  keyHint?: string; docUrl?: string
  keyLabel?: string // primary credential label (default "API key")
  appKeyLabel?: string; appKeyPh?: string // 2nd-credential label/placeholder
  urlHint?: string // helper under a free-text API URL field (e.g. Grafana stack URL)
  keyPrefixes?: string[] // a key not starting with one of these is probably wrong
  sites?: { label: string; apiUrl: string }[] // region picker (Datadog)
  appKeyHint?: string // shows the 2nd-credential field when set
  failHint?: string // appended to a failed connection test
}

const PRESETS: Preset[] = [
  {
    type: 'datadog', name: 'Datadog', meta: 'Observability', code: 'DD',
    apiUrl: 'https://api.datadoghq.com', authType: 'api-key', authHeader: 'DD-API-KEY', testEndpoint: '/api/v1/validate',
    keyPh: '32-character hex value', fixedUrl: false,
    keyHint: 'The API key VALUE (32 hex chars), not the Key ID (the UUID). Organization Settings → API Keys.',
    docUrl: 'https://docs.datadoghq.com/account_management/api-app-keys/',
    sites: [
      { label: 'US1 · datadoghq.com', apiUrl: 'https://api.datadoghq.com' },
      { label: 'US3 · us3.datadoghq.com', apiUrl: 'https://api.us3.datadoghq.com' },
      { label: 'US5 · us5.datadoghq.com', apiUrl: 'https://api.us5.datadoghq.com' },
      { label: 'EU · datadoghq.eu', apiUrl: 'https://api.datadoghq.eu' },
      { label: 'AP1 · ap1.datadoghq.com', apiUrl: 'https://api.ap1.datadoghq.com' },
    ],
    appKeyHint: 'A separate Application key (40 chars) from Organization Settings → Application Keys. Keystrok uses it to list your keys and flag any leaked one that is still live.',
    failHint: 'if the key is right, check the site above matches your Datadog URL',
  },
  {
    type: 'grafana', name: 'Grafana', meta: 'Observability', code: 'GRF',
    apiUrl: 'https://your-stack.grafana.net', authType: 'bearer', authHeader: 'Authorization', testEndpoint: '/api/org',
    keyPh: 'glsa_…', fixedUrl: false,
    urlHint: 'Grafana Cloud: your stack URL, e.g. myorg.grafana.net. Self-hosted: your Grafana base URL.',
    keyHint: 'A service account token (starts glsa_), not a legacy API key. Administration → Users and access → Service accounts → add a token with Viewer access or higher.',
    keyPrefixes: ['glsa_'],
    docUrl: 'https://grafana.com/docs/grafana/latest/administration/service-accounts/',
    failHint: 'check the stack URL and that the token has Viewer access or higher',
  },
  {
    type: 'stripe', name: 'Stripe', meta: 'Payments', code: 'STR',
    apiUrl: 'https://api.stripe.com', authType: 'bearer', authHeader: 'Authorization', testEndpoint: '/v1/charges',
    keyPh: 'sk_live_… or sk_test_…', fixedUrl: true,
    keyHint: 'A secret key (sk_live_ / sk_test_) or a restricted key (rk_) with read access. Dashboard → Developers → API keys. Never the publishable key (pk_).',
    keyPrefixes: ['sk_', 'rk_'],
    docUrl: 'https://dashboard.stripe.com/apikeys',
    failHint: 'make sure it is a secret or restricted key (sk_ / rk_), not a publishable key (pk_)',
  },
  {
    type: 'github', name: 'GitHub', meta: 'Development', code: 'GH',
    apiUrl: 'https://api.github.com', authType: 'bearer', authHeader: 'Authorization', testEndpoint: '/user',
    keyPh: 'ghp_… or github_pat_…', fixedUrl: true,
    keyHint: 'A personal access token, classic (ghp_) or fine-grained (github_pat_). Settings → Developer settings → Personal access tokens. Give it read access.',
    keyPrefixes: ['ghp_', 'github_pat_', 'gho_', 'ghs_'],
    docUrl: 'https://github.com/settings/tokens',
    failHint: 'check the token has not expired and includes read access',
  },
  {
    type: 'aws', name: 'AWS', meta: 'Cloud', code: 'AWS',
    apiUrl: 'https://iam.amazonaws.com', authType: 'aws', authHeader: 'Authorization', testEndpoint: '',
    keyPh: 'AKIA…', fixedUrl: true, keyLabel: 'Access Key ID',
    keyHint: 'The Access Key ID (starts AKIA), IAM → Users → your user → Security credentials. Read-only access is enough.',
    keyPrefixes: ['AKIA'],
    appKeyLabel: 'Secret Access Key', appKeyPh: '40-character secret',
    appKeyHint: 'The Secret Access Key shown once when the access key was created. Keystrok uses it only to call IAM ListAccessKeys and GetAccessKeyLastUsed: is a leaked key still live, and where was it last used.',
    docUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',
    failHint: 'the full check runs on a liveness check, not here',
  },
  {
    type: 'custom', name: 'Custom / other', meta: 'Any API URL + key', code: 'API',
    apiUrl: '', authType: 'bearer', authHeader: 'Authorization', testEndpoint: '',
    keyPh: 'your API key', fixedUrl: false,
  },
]

// A value that looks like a UUID is almost always a Key ID pasted by mistake.
const looksLikeKeyId = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())

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

  // For region platforms, start with no site chosen so the user must pick one
  // (a silent default to the wrong region was the #1 connection error).
  const pick = (p: Preset) => { setSel(p); setName(p.type === 'custom' ? '' : p.name); setApiUrl(p.sites ? '' : p.apiUrl); setKey(''); setAppKey(''); setTest({ state: 'idle' }) }
  const needsAppKey = !!sel?.appKeyHint
  const ready = !!sel && !!name && !!key && !!apiUrl && (!needsAppKey || !!appKey)
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

  const Hint = ({ text, doc }: { text: string; doc?: string }) => (
    <div className="ks-as__hint">{text} {doc && <a className="ks-as__doclink" href={doc} target="_blank" rel="noreferrer">where do I find this? →</a>}</div>
  )

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

              {sel.sites ? (
                <label className="ks-as__field"><span>{sel.name} site</span>
                  <select className="ks-input ks-select" value={apiUrl} onChange={(e) => { setApiUrl(e.target.value); setTest({ state: 'idle' }) }}>
                    <option value="" disabled>Select your site…</option>
                    {sel.sites.map((s) => <option key={s.apiUrl} value={s.apiUrl}>{s.label}</option>)}
                  </select>
                  <Hint text="Match this to your Datadog URL (the domain in your browser). A wrong site is the most common connection error." />
                </label>
              ) : (
                <label className="ks-as__field"><span>API URL</span>
                  <input className="ks-input" value={apiUrl} onChange={(e) => { setApiUrl(e.target.value); setTest({ state: 'idle' }) }} readOnly={sel.fixedUrl} placeholder="https://api.example.com" spellCheck={false} autoCapitalize="off" />
                  {sel.urlHint && <Hint text={sel.urlHint} />}
                </label>
              )}

              <label className="ks-as__field"><span>{sel.keyLabel ?? 'API key'}</span>
                <input className="ks-input" type="password" value={key} onChange={(e) => { setKey(e.target.value); setTest({ state: 'idle' }) }} placeholder={sel.keyPh} spellCheck={false} autoCapitalize="off" />
                {sel.keyHint && <Hint text={sel.keyHint} doc={sel.docUrl} />}
                {key && looksLikeKeyId(key) && <div className="ks-as__warn">That looks like a Key ID (UUID), not the key value. Copy the key itself.</div>}
                {key && !looksLikeKeyId(key) && sel.keyPrefixes && !sel.keyPrefixes.some((p) => key.trim().startsWith(p)) && (
                  <div className="ks-as__warn">This doesn&apos;t look like a {sel.name} key (usually starts {sel.keyPrefixes.join(' or ')}).</div>
                )}
              </label>

              {needsAppKey && (
                <label className="ks-as__field"><span>{sel.appKeyLabel ?? 'Application key'}</span>
                  <input className="ks-input" type="password" value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder={sel.appKeyPh ?? '40-character application key'} spellCheck={false} autoCapitalize="off" />
                  <Hint text={sel.appKeyHint!} doc={sel.docUrl} />
                  {appKey && looksLikeKeyId(appKey) && <div className="ks-as__warn">That looks like a Key ID (UUID), not the application key value.</div>}
                </label>
              )}

              {test.state === 'fail' && <div className="ks-as__testmsg fail">{test.message}{sel.failHint ? ` · ${sel.failHint}` : ''}</div>}
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
