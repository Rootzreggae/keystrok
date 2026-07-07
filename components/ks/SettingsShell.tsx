'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Palette, Bell, Mail, Users } from 'lucide-react'
import { AppearanceSettings } from '@/components/ks/AppearanceSettings'
import { AlertsSettings } from '@/components/ks/AlertsSettings'
import { EmailSettings } from '@/components/ks/EmailSettings'
import { TeamManager } from '@/components/ks/TeamManager'

// Settings IA: a left rail of sections, grouped by kind. Preferences (personal,
// everyone) vs Workspace (admin instance config + governance). Each section is
// its own view instead of one long scroll. Sub-nav is client state.
type SectionId = 'appearance' | 'team' | 'alerts' | 'email'
interface Section { id: SectionId; label: string; Icon: typeof Palette; admin: boolean; Comp: () => React.ReactNode }
interface Group { label: string; sections: Section[] }

const GROUPS: Group[] = [
  { label: 'Preferences', sections: [
    { id: 'appearance', label: 'Appearance', Icon: Palette, admin: false, Comp: AppearanceSettings },
  ] },
  { label: 'Workspace', sections: [
    { id: 'team', label: 'Team', Icon: Users, admin: true, Comp: TeamManager },
    { id: 'alerts', label: 'Alerts', Icon: Bell, admin: true, Comp: AlertsSettings },
    { id: 'email', label: 'Email delivery', Icon: Mail, admin: true, Comp: EmailSettings },
  ] },
]

export function SettingsShell({ isAdmin }: { isAdmin: boolean }) {
  const groups = GROUPS
    .map((g) => ({ ...g, sections: g.sections.filter((s) => isAdmin || !s.admin) }))
    .filter((g) => g.sections.length > 0)
  const all = groups.flatMap((g) => g.sections)
  // deep-link support (e.g. the old /team URL redirects to ?section=team)
  const wanted = useSearchParams().get('section') as SectionId | null
  const initial = all.find((s) => s.id === wanted)?.id ?? all[0]?.id ?? 'appearance'
  const [active, setActive] = useState<SectionId>(initial)
  const current = all.find((s) => s.id === active) ?? all[0]

  return (
    <div className="ks-railpage ks-set">
      {/* content fills between the main sidebar (left) and the nav rail (right) */}
      <div className="ks-railpage__content">
        {current && <current.Comp />}
      </div>
      <nav className="ks-railpage__rail">
        <div className="ks-railpage__railinner">
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
        </div>
      </nav>
    </div>
  )
}
