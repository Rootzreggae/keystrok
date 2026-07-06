import { redirect } from 'next/navigation'

// Team management moved into Settings (admin governance lives with the other
// instance config). Keep the old URL working.
export default function TeamPage() {
  redirect('/settings?section=team')
}
