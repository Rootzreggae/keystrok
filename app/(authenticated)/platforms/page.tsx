'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, X, Server } from 'lucide-react'
import { PlatformConnect } from '@/components/ks/PlatformConnect'
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

  const { data: platforms = [] } = useQuery<Platform[]>({
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
          <button className="ks-btn" onClick={() => setConnectOpen(true)}>
            <ArrowRight size={14} /> Connect platform
          </button>
        </span>
      </div>

      {platforms.length === 0 ? (
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
              <span className="ks-platcard__status">connected</span>
              <button
                className="ks-platcard__x"
                title="Disconnect"
                disabled={remove.isPending}
                onClick={() => confirm(`Disconnect ${p.name}?`) && remove.mutate(p.id)}
              >
                <X size={14} />
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
