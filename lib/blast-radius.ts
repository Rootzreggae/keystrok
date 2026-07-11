// Blast radius of one leaked key: what rotating it touches, derived only from
// data we actually hold (scan findings, git history, platform liveness). We
// never invent a consumer inventory; when consumers are unknown we say so.
// ponytail: observed caller identity (CloudTrail-class) is a separate lane.
import { isListable, isRecentlyUsed, providerOf } from '@/lib/liveness'
import { hasTemplate } from '@/lib/workflow-templates'

export type RadiusTone = 'ok' | 'warn' | 'crit'
export interface RadiusCheck {
  tone: RadiusTone
  title: string
  detail: string
}

// CI/deploy surfaces recognizable from a repo path alone. A finding in one of
// these means the pipeline injects or hardcodes the key, so rotation touches it.
const PIPELINE_RE =
  /(\.github\/workflows\/|\.gitlab-ci|\.circleci\/|\.buildkite\/|jenkinsfile|docker-compose[^/]*\.ya?ml$|\.tf$|\.tfvars$)/i
export const isPipelinePath = (p: string) => PIPELINE_RE.test(p)

export interface ConsumerInputs {
  platform: string
  liveStatus: string | null
  lastUsedAt: Date | null
  lastUsedSource: string | null
  breakAcceptedAt?: Date | null
  breakAcceptedBy?: string | null
}

/**
 * The honest "Consumed by" state. The truths, one row:
 *  - revoked on the platform: nothing left to break
 *  - live AND recently used, nothing mapped: hold before rotating (the hold trigger)
 *  - anything user-asserted: mapped by a human, labeled, unconfirmed; the hold
 *    lifts because the operator now knows what the rotation must touch
 *  - live, idle: consumers unknown, but nothing observed using it
 *  - unknown: either the provider can't report usage (terminal, most keys)
 *    or liveness was simply never checked
 */
export function consumerCheck(k: ConsumerInputs, asserted = 0, now: Date = new Date()): RadiusCheck {
  if (k.liveStatus === 'revoked')
    return { tone: 'ok', title: 'Nothing left to break', detail: 'the key is revoked on its platform' }
  if (asserted > 0)
    return {
      tone: 'warn',
      title: `Consumers mapped · ${asserted} user-asserted`,
      detail: `unconfirmed · verify each one during rotation${k.liveStatus === 'live' && isRecentlyUsed(k.lastUsedAt, now) ? ' · the key is live and in use' : ''}${k.breakAcceptedAt ? ' · break accepted' : ''}`,
    }
  // An accepted break is a cost the operator signed for, not a pass: warn, never ok.
  if (k.breakAcceptedAt)
    return {
      tone: 'warn',
      title: 'Break accepted',
      detail: `by ${k.breakAcceptedBy ?? 'unknown'} · re-verified at the revoke step · re-asked if traffic changes`,
    }
  if (k.liveStatus === 'live' && isRecentlyUsed(k.lastUsedAt, now))
    return {
      tone: 'crit',
      title: 'Hold before rotating',
      detail: `live and in use${k.lastUsedSource ? ` · ${k.lastUsedSource}` : ''} · consumers unknown`,
    }
  if (k.liveStatus === 'live')
    return { tone: 'warn', title: 'Consumers unknown', detail: 'the key is live · nothing observed using it recently' }
  if (!isListable(k.platform))
    return { tone: 'warn', title: 'Consumers unknown', detail: 'this provider cannot report key usage' }
  return { tone: 'warn', title: 'Consumers unknown', detail: 'liveness never checked · connect the platform to verify' }
}

/**
 * The revoke gate's re-verification: an accepted break holds only if the
 * traffic evidence hasn't moved since it was signed. If lastUsedAt changed,
 * the unknown consumer is not the one the operator looked at; re-ask.
 */
export function acceptanceHolds(snapshot: Date | null | undefined, current: Date | null | undefined): boolean {
  return (snapshot?.getTime() ?? null) === (current?.getTime() ?? null)
}

/** Human labels for how an asserted consumer reads the key; drives the
 *  "what rotation must touch" subtitle on its row. */
export const READ_MODES: Record<string, string> = {
  env_boot: 'env at boot · needs restart',
  env_run: 'env per run · picks up the new key',
  secret_store: 'secret store · update the store',
}

/** The rotation-readiness rail: replacement path, consumers, exposure sites. */
export function readinessChecks(
  platform: string,
  consumer: RadiusCheck,
  sites: number,
  pipes: number
): RadiusCheck[] {
  const guided = hasTemplate(providerOf(platform))
  return [
    guided
      ? { tone: 'ok', title: 'Replacement path known', detail: 'guided runbook for this platform' }
      : { tone: 'warn', title: 'Generic runbook only', detail: 'no platform-specific rotation guide yet' },
    consumer,
    sites > 0
      ? {
          tone: 'ok',
          title: 'Exposure sites listed',
          detail: `${sites} site${sites === 1 ? '' : 's'}${pipes ? ` · ${pipes} in deploy pipelines` : ''} · remove after rotating`,
        }
      : { tone: 'warn', title: 'No exposure sites on record', detail: 'only the original finding location is known' },
  ]
}

/** Plain-language rollup for the top of the radius. Counts only, no guesses. */
export function radiusSummary(sites: number, pipes: number, people: number, asserted = 0): string {
  const parts = [`${sites} exposure site${sites === 1 ? '' : 's'}`]
  if (asserted) parts.unshift(`${asserted} asserted consumer${asserted === 1 ? '' : 's'}`)
  if (pipes) parts.push(`${pipes} deploy pipeline${pipes === 1 ? '' : 's'}`)
  const touched = parts.length > 2 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts.join(' and ')
  const who = people ? ` ${people === 1 ? '1 person' : `${people} people`} touched the exposing commits.` : ''
  return `Rotating this key touches ${touched}.${who}`
}
