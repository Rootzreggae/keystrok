'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Server, RefreshCw } from 'lucide-react'
import { PlatformConnect } from '@/components/ks/PlatformConnect'
import { PanelLoading } from '@/components/ks/Loading'
import { platOf } from '@/lib/keys-display'

interface Platform {
  id: string
  name: string
  platform_type?: string
  category?: string
  key_count?: number
}

export default function PlatformsScreen() {
  const qc = useQueryClient()
  const [connectOpen, setConnectOpen] = useState(false)
  const [liveMsg, setLiveMsg] = useState<string | null>(null)

  // Match every leaked key's last-4 against what the connected platforms report
  // as live, then refresh the ledger so the live/revoked badges update.
  const check = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/liveness/check', { method: 'POST' })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error || 'Liveness check failed')
      return j
    },
    onSuccess: (j) => {
      qc.invalidateQueries({ queryKey: ['keys'] })
      const warn = j.warnings?.length ? ` · ${j.warnings.join('; ')}` : ''
      setLiveMsg(j.success ? `Checked ${j.checked}: ${j.live} live, ${j.revoked} revoked${warn}` : (j.warnings?.[0] || 'Nothing to check yet'))
    },
    onError: (e: Error) => setLiveMsg(e.message),
  })

  // Hydrated from the server (app/(authenticated)/platforms/page.tsx), so on a
  // refresh this is already populated — no loader, no empty-state flash.
  const { data: platforms = [], isLoading } = useQuery<Platform[]>({
    queryKey: ['platforms'],
    queryFn: async () => {
      const r = await fetch('/api/platforms')
      if (!r.ok) throw new Error('platforms')
      const j = await r.json()
      return j.platforms ?? j.data?.platforms ?? j.data ?? j ?? []
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/platforms/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to disconnect')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platforms'] }),
    onError: (e: Error) => alert(e.message),
  })

  const totalKeys = platforms.reduce((n, p) => n + (p.key_count ?? 0), 0)

  return (
    <div className="ks-page">
      <div className="ks-h" style={{ marginBottom: 20 }}>
        <span className="ks-h__t">Connected platforms</span>
        <span className="ks-h__n">· {platforms.length} connected · {totalKeys} keys managed</span>
        <span className="ks-h__act">
          {platforms.length > 0 && (
            <button className="ks-btn" disabled={check.isPending} onClick={() => { setLiveMsg(null); check.mutate() }}>
              <RefreshCw size={14} /> {check.isPending ? 'Checking…' : 'Check liveness'}
            </button>
          )}
          <button className="ks-btn" onClick={() => setConnectOpen(true)}>
            <ArrowRight size={14} /> Connect platform
          </button>
        </span>
      </div>

      {liveMsg && (
        <div style={{ marginTop: -8, marginBottom: 18, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx-mut)' }}>{liveMsg}</div>
      )}

      {isLoading ? (
        <PanelLoading minHeight={520} />
      ) : platforms.length === 0 ? (
        <div className="ks-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 520 }}>
          <div className="ks-empty">
            <span className="ks-empty__ico"><Server size={26} strokeWidth={1.75} /></span>
            <div className="ks-empty__t">No platforms connected</div>
            <div className="ks-empty__s">
              Connect a platform (Datadog, Grafana, Stripe, GitHub…) to validate that its keys are still live.
              A found key that&apos;s already revoked is far less urgent than one that still works.
            </div>
            <button className="ks-btn ks-btn--primary" style={{ marginTop: 18 }} onClick={() => setConnectOpen(true)}>
              <ArrowRight size={14} /> Connect a platform
            </button>
          </div>
        </div>
      ) : (
        <div className="ks-plat">
          {platforms.map((p) => (
            <div className="ks-platcard" key={p.id}>
              <span className="ks-platcard__mark">{platOf(p.platform_type || p.name).code}</span>
              <div className="ks-platcard__main">
                <div className="ks-platcard__name">{p.name}</div>
                <div className="ks-platcard__meta">{p.key_count ?? 0} key{(p.key_count ?? 0) !== 1 ? 's' : ''} tracked</div>
              </div>
              <span className="ks-platcard__status"><span className="ks-platcard__dot" /> connected</span>
              <button
                className="ks-platcard__disc"
                disabled={remove.isPending}
                onClick={() => confirm(`Disconnect ${p.name}? Keystrok will stop checking its keys' liveness.`) && remove.mutate(p.id)}
              >
                {remove.isPending ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ))}
        </div>
      )}

      <PlatformConnect
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnected={() => { qc.invalidateQueries({ queryKey: ['platforms'] }); setConnectOpen(false) }}
      />
    </div>
  )
}
