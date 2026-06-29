import {
  Shield,
  Key,
  Search,
  RotateCw,
  Check,
  CheckCircle,
  X,
  AlertTriangle,
  Lock,
  Eye,
  Terminal,
  Copy,
  Github,
  ArrowRight,
  ChevronRight,
  ChevronsRight,
  Zap,
  Clock,
  Users,
  Activity,
  Layers,
  GitBranch,
  Star,
  type LucideIcon,
} from 'lucide-react'

/**
 * Keystrok Icon primitive: the only sanctioned way to draw an icon
 * (design/DESIGN_SYSTEM.md). Renders a curated Lucide line icon inline as a
 * `currentColor` stroke at width 2 (the brand line weight), so it inherits the
 * surrounding text or status color. No emoji, no hand-rolled SVG.
 */

const ICONS: Record<string, LucideIcon> = {
  shield: Shield,
  key: Key,
  search: Search,
  'rotate-cw': RotateCw,
  check: Check,
  'check-circle': CheckCircle,
  x: X,
  'alert-triangle': AlertTriangle,
  lock: Lock,
  eye: Eye,
  terminal: Terminal,
  copy: Copy,
  github: Github,
  'arrow-right': ArrowRight,
  'chevron-right': ChevronRight,
  'chevrons-right': ChevronsRight,
  zap: Zap,
  clock: Clock,
  users: Users,
  activity: Activity,
  layers: Layers,
  'git-branch': GitBranch,
  star: Star,
}

export type IconName = keyof typeof ICONS

export interface IconProps {
  name: string
  size?: number
  color?: string
  className?: string
  'aria-hidden'?: boolean
}

export function Icon({ name, size = 16, color = 'currentColor', className, ...rest }: IconProps) {
  const Glyph = ICONS[name]
  if (!Glyph) return null
  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={2}
      className={className}
      aria-hidden={rest['aria-hidden'] ?? true}
      style={{ flexShrink: 0 }}
    />
  )
}

export default Icon
