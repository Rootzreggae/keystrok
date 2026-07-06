'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, X, Shield, AlertTriangle } from 'lucide-react'
import { Pill } from '@/components/ks'

type Role = 'admin' | 'member'
interface Member { id: string; email: string; role: Role; createdAt: string; you: boolean }
interface Invite { id: string; email: string; role: Role; createdAt: string }
interface TeamData { members: Member[]; invites: Invite[]; mailConfigured: boolean }

const joined = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const Avatar = ({ email, pending }: { email: string; pending?: boolean }) => (
  <span className={'ks-mbr__av' + (pending ? ' ks-mbr__av--pending' : '')}>{(email[0] || '?').toUpperCase()}</span>
)

export function TeamManager() {
  const qc = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('member')
  // One confirm at a time: a staged role change or a pending removal.
  const [confirm, setConfirm] = useState<{ kind: 'role' | 'remove'; id: string; email: string; role?: Role } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<TeamData>({
    queryKey: ['team'],
    queryFn: async () => {
      const r = await fetch('/api/team')
      if (r.status === 403) throw new Error('forbidden')
      if (!r.ok) throw new Error('team')
      return r.json()
    },
    retry: false,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['team'] })
  const run = (fn: () => Promise<Response>) => fn().then(async (r) => {
    if (!r.ok) { const j = await r.json().catch(() => null); throw new Error(j?.error || 'Something went wrong.') }
    setErr(null); refresh()
  }).catch((e: Error) => setErr(e.message))

  const invite = useMutation({
    mutationFn: () => fetch('/api/team/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, role: inviteRole }) }),
    onSuccess: async (r) => {
      if (!r.ok) { const j = await r.json().catch(() => null); setErr(j?.error || 'Could not send the invite.'); return }
      setErr(null); setInviteEmail(''); setInviteRole('member'); setInviting(false); refresh()
    },
  })

  const doRole = (id: string, role: Role) => run(() => fetch(`/api/team/members/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }))
  const doRemove = (id: string) => run(() => fetch(`/api/team/members/${id}`, { method: 'DELETE' }))
  const revokeInvite = (email: string) => run(() => fetch('/api/team/invite', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }))
  const resendInvite = (email: string) => run(() => fetch('/api/team/invite/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }))

  if (error) {
    return (
      <div className="ks-teamwrap">
        <div className="ks-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
          <div className="ks-empty">
            <span className="ks-empty__ico"><Shield size={26} strokeWidth={1.75} /></span>
            <div className="ks-empty__t">Admins only</div>
            <div className="ks-empty__s">Managing the team is limited to admins. Ask an admin to change your role.</div>
          </div>
        </div>
      </div>
    )
  }

  const members = data?.members ?? []
  const invites = data?.invites ?? []
  const adminCount = members.filter((m) => m.role === 'admin').length

  return (
    <div className="ks-teamwrap">
      <div className="ks-page__hd">
        <div>
          <span className="ks-panel__t" style={{ fontSize: 15 }}>Team</span>
          {!isLoading && <span className="ks-panel__sub" style={{ marginLeft: 10 }}>· {members.length} {members.length === 1 ? 'member' : 'members'} · {adminCount} {adminCount === 1 ? 'admin' : 'admins'}</span>}
        </div>
        {!inviting && (
          <button className="ks-btn ks-btn--primary" onClick={() => { setErr(null); setInviting(true) }}>
            <UserPlus size={14} /> Invite member
          </button>
        )}
      </div>

      {/* No mail transport wired up: invites (and magic links) are silently dropped. */}
      {data && !data.mailConfigured && (
        <div role="alert" style={{ margin: '0 0 16px', padding: '12px 14px', background: 'var(--high-dim)', border: '1px solid var(--high-line)', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.55, color: 'var(--tx-2)' }}>
          <AlertTriangle size={15} style={{ flex: 'none', marginTop: 1, color: 'var(--high)' }} />
          <div>
            <b style={{ color: 'var(--tx)' }}>Email isn&apos;t configured, so invites won&apos;t send.</b> This instance has no mail transport, invited people never get the sign-in link (and neither do magic-link logins). Set <code>RESEND_API_KEY</code>, or <code>EMAIL_SERVER_*</code> for your own SMTP, then restart. Until then, add someone by allowing their email and having them sign in at <code>/auth/signin</code> directly.
          </div>
        </div>
      )}

      {err && <div className="ks-drawer__err" role="alert" style={{ margin: '0 0 16px' }}>{err}</div>}

      {inviting && (
        <div className="ks-panel ks-invite">
          <div className="ks-panel__hd">
            <span className="ks-panel__t">Invite a member</span>
            <button className="ks-btn ks-btn--ghost ks-btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setInviting(false)}><X size={13} /></button>
          </div>
          <div className="ks-invite__body">
            <div className="ks-invite__row">
              <div style={{ flex: 1 }}>
                <label className="ks-invite__lbl">Email address</label>
                <input className="ks-input" placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoFocus />
              </div>
              <div style={{ width: 140 }}>
                <label className="ks-invite__lbl">Role</label>
                <select className="ks-input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button className="ks-btn ks-btn--primary" style={{ alignSelf: 'flex-end', height: 32 }} disabled={invite.isPending} onClick={() => invite.mutate()}>
                {invite.isPending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
            <div className="ks-invite__note">
              They get a magic-link sign-in at this address (no password). Members can scan, triage, and run rotations; only admins connect platforms and run the irreversible revoke step.
            </div>
          </div>
        </div>
      )}

      <div className="ks-panel">
        <div className="ks-panel__hd"><span className="ks-panel__t">Members</span><span className="ks-panel__sub">· {members.length}</span></div>
        <table className="ks-tbl ks-mbr__tbl">
          <thead><tr><th>Member</th><th style={{ width: 150 }}>Role</th><th style={{ width: 110 }}>Joined</th><th style={{ width: 96 }}></th></tr></thead>
          <tbody>
            {members.map((m) => {
              const lastAdmin = m.role === 'admin' && adminCount === 1
              const rowConfirm = confirm && confirm.id === m.id
              return (
                <tr key={m.id}>
                  <td>
                    <div className="ks-mbr__id">
                      <Avatar email={m.email} />
                      <span className="ks-mbr__email">{m.email}</span>
                      {m.you && <Pill tone="mut">you</Pill>}
                    </div>
                  </td>
                  <td>
                    <select
                      className="ks-input ks-mbr__role"
                      value={rowConfirm && confirm?.kind === 'role' ? confirm.role : m.role}
                      disabled={lastAdmin || m.you}
                      onChange={(e) => {
                        const role = e.target.value as Role
                        if (role !== m.role) setConfirm({ kind: 'role', id: m.id, email: m.email, role })
                        else setConfirm(null)
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  </td>
                  <td><span className="ks-mbr__meta">{joined(m.createdAt)}</span></td>
                  <td>
                    {m.you ? <span className="ks-mbr__meta" style={{ opacity: 0.5 }}>—</span>
                      : <button className="ks-btn ks-btn--sm ks-mbr__rm" disabled={lastAdmin} title={lastAdmin ? 'The team must keep at least one admin' : 'Remove from team'} onClick={() => setConfirm({ kind: 'remove', id: m.id, email: m.email })}>Remove</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {confirm && (
          <div className="ks-mbr__confirm">
            {confirm.kind === 'role' ? (
              <>
                <span>{confirm.role === 'admin'
                  ? <>Make <b>{confirm.email}</b> an admin? Admins can revoke keys, connect platforms, and manage the team.</>
                  : <>Change <b>{confirm.email}</b> to a member? They will lose admin abilities.</>}</span>
                <div className="ks-mbr__confirm-cta">
                  <button className="ks-btn ks-btn--sm" onClick={() => setConfirm(null)}>Cancel</button>
                  <button className="ks-btn ks-btn--primary ks-btn--sm" onClick={() => { doRole(confirm.id, confirm.role!); setConfirm(null) }}>Confirm change</button>
                </div>
              </>
            ) : (
              <>
                <span>Remove <b>{confirm.email}</b> from the team? They lose access immediately; the keys and findings they added stay in the workspace.</span>
                <div className="ks-mbr__confirm-cta">
                  <button className="ks-btn ks-btn--sm" onClick={() => setConfirm(null)}>Cancel</button>
                  <button className="ks-btn ks-btn--sm ks-mbr__rm" onClick={() => { doRemove(confirm.id); setConfirm(null) }}>Remove member</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {invites.length > 0 && (
        <div className="ks-panel">
          <div className="ks-panel__hd"><span className="ks-panel__t">Pending invites</span><span className="ks-panel__sub">· {invites.length}</span></div>
          {invites.map((iv) => (
            <div className="ks-mbr__inviterow" key={iv.id}>
              <Avatar email={iv.email} pending />
              <span className="ks-mbr__email">{iv.email}</span>
              <Pill tone="mut">{iv.role}</Pill>
              <span className="ks-mbr__meta" style={{ marginLeft: 'auto' }}>invited {joined(iv.createdAt)}</span>
              <button className="ks-btn ks-btn--sm" onClick={() => resendInvite(iv.email)}>Resend</button>
              <button className="ks-btn ks-btn--sm ks-mbr__rm" onClick={() => revokeInvite(iv.email)}>Revoke</button>
            </div>
          ))}
        </div>
      )}

      <div className="ks-mbr__foot">
        <Shield size={13} /> Self-hosted, so this instance is your whole team. The team always keeps at least one admin.
      </div>
    </div>
  )
}
