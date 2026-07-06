'use client'

import { useState } from 'react'
import { Palette, Bell, Mail } from 'lucide-react'
import { AppearanceSettings } from '@/components/ks/AppearanceSettings'
import { AlertsSettings } from '@/components/ks/AlertsSettings'
import { EmailSettings } from '@/components/ks/EmailSettings'

// Settings IA: a left rail of sections, grouped by kind. Preferences (personal,
// everyone) vs Admin (instance config, admin-only). Each section is its own view
// instead of one long scroll. Sub-nav is client state; no extra routes for 3 items.
type SectionId = 'appearance' | 'alerts' | 'email'
interface Section { id: SectionId; label: string; Icon: typeof Palette; admin: boolean; Comp: () => React.ReactNode }
interface Group { label: string; sections: Section[] }

const GROUPS: Group[] = [
  { label: 'Preferences', sections: [
    { id: 'appearance', label: 'Appearance', Icon: Palette, admin: false, Comp: AppearanceSettings },
  ] },
  { label: 'Admin', sections: [
    { id: 'alerts', label: 'Alerts', Icon: Bell, admin: true, Comp: AlertsSettings },
    { id: 'email', label: 'Email delivery', Icon: Mail, admin: true, Comp: EmailSettings },
  ] },
]

export function SettingsShell({ isAdmin }: { isAdmin: boolean }) {
  const groups = GROUPS
    .map((g) => ({ ...g, sections: g.sections.filter((s) => isAdmin || !s.admin) }))
    .filter((g) => g.sections.length > 0)
  const all = groups.flatMap((g) => g.sections)
  const [active, setActive] = useState<SectionId>(all[0]?.id ?? 'appearance')
  const current = all.find((s) => s.id === active) ?? all[0]

  return (
    <div className="ks-set">
      <nav className="ks-set__rail">
        {groups.map((g) => (
          <div className="ks-set__railgroup" key={g.label}>
            <div className="ks-set__raill">{g.label}</div>
            {g.sections.map((s) => (
              <button key={s.id} className={'ks-set__railitem' + (active === s.id ? ' active' : '')} onClick={() => setActive(s.id)}>
                <s.Icon size={15} /> {s.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="ks-set__content">
        {current && <current.Comp />}
      </div>
    </div>
  )
}
