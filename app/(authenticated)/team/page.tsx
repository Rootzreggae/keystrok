'use client'

// MOCKUP (static, placeholder data) for the Teams Members tab + invite flow.
// Not wired to any API. For design review only; delete or replace when building
// Phase B/C. See "Keystrok — Teams (Spec)".
import { useState } from 'react'
import { UserPlus, X, Shield } from 'lucide-react'
import { Pill } from '@/components/ks'

type Role = 'admin' | 'member'
interface Member { id: string; email: string; role: Role; joined: string; you?: boolean }
interface Invite { email: string; role: Role; invitedAgo: string }

const MEMBERS: Member[] = [
  { id: '1', email: 'aosparesdetres@gmail.com', role: 'admin', joined: '29 Jun', you: true },
  { id: '2', email: 'member@keystrok.test', role: 'member', joined: '2 Jul' },
  { id: '3', email: 'priya@company.com', role: 'admin', joined: '1 Jul' },
]
const INVITES: Invite[] = [
  { email: 'dev@company.com', role: 'member', invitedAgo: '2h' },
]

function Avatar({ email }: { email: string }) {
  return <span className="ks-mbr__av">{email[0].toUpperCase()}</span>
}

export default function TeamMock() {
  const [inviting, setInviting] = useState(false)
  const adminCount = MEMBERS.filter((m) => m.role === 'admin').length

  return (
    <div className="ks-home">
      <div className="ks-page__hd">
        <div>
          <span className="ks-panel__t" style={{ fontSize: 15 }}>Team</span>
          <span className="ks-panel__sub" style={{ marginLeft: 10 }}>· {MEMBERS.length} members · {adminCount} admins</span>
        </div>
        {!inviting && (
          <button className="ks-btn ks-btn--primary" onClick={() => setInviting(true)}>
            <UserPlus size={14} /> Invite member
          </button>
        )}
      </div>

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
                <input className="ks-input" placeholder="teammate@company.com" defaultValue="" />
              </div>
              <div style={{ width: 140 }}>
                <label className="ks-invite__lbl">Role</label>
                <select className="ks-input" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button className="ks-btn ks-btn--primary" style={{ alignSelf: 'flex-end', height: 32 }}>Send invite</button>
            </div>
            <div className="ks-invite__note">
              They get a magic-link sign-in at this address (no password). Members can scan, triage, and run rotations; only admins connect platforms and run the irreversible revoke step.
            </div>
          </div>
        </div>
      )}

      <div className="ks-panel">
        <div className="ks-panel__hd"><span className="ks-panel__t">Members</span><span className="ks-panel__sub">· {MEMBERS.length}</span></div>
        <table className="ks-tbl ks-mbr__tbl">
          <thead>
            <tr>
              <th>Member</th>
              <th style={{ width: 150 }}>Role</th>
              <th style={{ width: 110 }}>Joined</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {MEMBERS.map((m) => {
              const lastAdmin = m.role === 'admin' && adminCount === 1
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
                    <select className="ks-input ks-mbr__role" defaultValue={m.role} disabled={lastAdmin}>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  </td>
                  <td><span className="ks-mbr__meta">{m.joined}</span></td>
                  <td>
                    {m.you ? (
                      <span className="ks-mbr__meta" style={{ opacity: 0.5 }}>—</span>
                    ) : (
                      <button className="ks-btn ks-btn--sm ks-mbr__rm" title={lastAdmin ? 'The team must keep at least one admin' : 'Remove from team'} disabled={lastAdmin}>Remove</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {INVITES.length > 0 && (
        <div className="ks-panel">
          <div className="ks-panel__hd"><span className="ks-panel__t">Pending invites</span><span className="ks-panel__sub">· {INVITES.length}</span></div>
          {INVITES.map((iv) => (
            <div className="ks-mbr__inviterow" key={iv.email}>
              <span className="ks-mbr__av ks-mbr__av--pending">{iv.email[0].toUpperCase()}</span>
              <span className="ks-mbr__email">{iv.email}</span>
              <Pill tone="mut">{iv.role}</Pill>
              <span className="ks-mbr__meta" style={{ marginLeft: 'auto' }}>invited {iv.invitedAgo} ago</span>
              <button className="ks-btn ks-btn--sm">Resend</button>
              <button className="ks-btn ks-btn--sm ks-mbr__rm">Revoke</button>
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
