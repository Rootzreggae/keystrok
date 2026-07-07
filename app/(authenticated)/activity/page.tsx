'use client'

import { useQuery } from '@tanstack/react-query'
import { Copy, Search, CheckCircle2, RefreshCw, X, Server, FileText, type LucideIcon } from 'lucide-react'
import { InlineLoading } from '@/components/ks/Loading'

interface Activity { id: string; action?: string; description?: string; createdAt: string }

// Actions the system performs vs. the operator drives, for the "who" line.
const SYSTEM_ACTIONS = new Set(['key_discovered', 'scan_started', 'scan_completed', 'security_alert'])

// ponytail: dup of dashboard's actIcon; consolidate if a third caller appears.
function actIcon(action?: string): LucideIcon {
  const a = action ?? ''
  if (/scan|discover/.test(a)) return Search
  if (/promot/.test(a)) return CheckCircle2
  if (/rotat|workflow/.test(a)) return RefreshCw
  if (/false|ignor|dismiss|revok/.test(a)) return X
  if (/platform|connect/.test(a)) return Server
  return FileText
}

// Absolute time for today's events; "Yesterday" / short date for older ones (matches the render).
function whenLabel(iso: string) {
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-GB')
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Wrap ALL_CAPS_SNAKE key names in a mono span, like the render.
const KEYTOKEN = /[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/                  // non-global: stateless .test()
const KEYSPLIT = new RegExp(`(${KEYTOKEN.source})`, 'g')         // global w/ capture: keeps tokens in split()
function highlightKeys(text: string) {
  return text.split(KEYSPLIT).map((part, i) =>
    KEYTOKEN.test(part)
      ? <code className="ks-actrow__k" key={i}>{part}</code>
      : part,
  )
}

export default function ActivityScreen() {
  const { data: activity = [], isLoading } = useQuery<Activity[]>({
    queryKey: ['activity-log'],
    queryFn: async () => {
      const r = await fetch('/api/activity/recent?limit=50')
      if (!r.ok) throw new Error('activity')
      const j = await r.json()
      return j.data?.activities ?? j.activities ?? j.data ?? []
    },
  })

  const exportLog = () => {
    const blob = new Blob([JSON.stringify(activity, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'keystrok-activity.json'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="ks-page" style={{ maxWidth: 835, margin: '0 auto' }}>
      <div className="ks-h" style={{ marginBottom: 20 }}>
        <span className="ks-h__t">Activity log</span>
        <span className="ks-h__n">· today</span>
        <span className="ks-h__act">
          <button className="ks-btn ks-btn--sm" onClick={exportLog} disabled={activity.length === 0}>
            <Copy size={13} /> Export
          </button>
        </span>
      </div>
      <div className="ks-panel" style={{ padding: '8px 22px' }}>
        {isLoading ? (
          <InlineLoading />
        ) : activity.length === 0 ? (
          <div style={{ padding: '28px 0', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--tx-dim)' }}>No activity yet.</div>
        ) : (
          <div className="ks-act">
            {activity.map((e) => {
              const Icon = actIcon(e.action)
              const system = e.action ? SYSTEM_ACTIONS.has(e.action) : false
              return (
                <div className="ks-actrow" key={e.id}>
                  <span className="ks-actrow__time">{whenLabel(e.createdAt)}</span>
                  <span className="ks-actrow__ico"><Icon size={13} strokeWidth={1.75} /></span>
                  <div>
                    <div className="ks-actrow__txt">{highlightKeys(e.description ?? e.action ?? 'Activity')}</div>
                    <div className="ks-actrow__who">{system ? 'Keystrok · system' : 'you'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
