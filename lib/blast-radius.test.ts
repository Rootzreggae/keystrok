// Run: node --import ./scripts/register-alias.mjs lib/blast-radius.test.ts
// ponytail: plain asserts on the pure derivations; the route is a thin query.
import assert from 'node:assert/strict'
import { isPipelinePath, consumerCheck, readinessChecks, radiusSummary, radiusSentence, READ_MODES, acceptanceHolds } from './blast-radius.ts'

// Pipeline path classifier: CI/deploy surfaces only, never ordinary code.
assert.equal(isPipelinePath('.github/workflows/deploy.yml'), true)
assert.equal(isPipelinePath('infra/main.tf'), true)
assert.equal(isPipelinePath('ops/docker-compose.prod.yaml'), true)
assert.equal(isPipelinePath('ci/Jenkinsfile'), true)
assert.equal(isPipelinePath('.gitlab-ci.yml'), true)
assert.equal(isPipelinePath('src/auth.py'), false)
assert.equal(isPipelinePath('.env.staging'), false)
assert.equal(isPipelinePath('config/services.json'), false)
// "terraform" in a normal filename must not classify
assert.equal(isPipelinePath('docs/terraform-notes.md'), false)

// Consumer state: the four truths.
const NOW = new Date('2026-07-11T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000)
const base = { platform: 'aws', lastUsedSource: 'aws · us-east-1 / s3' }

// revoked: nothing left to break
assert.equal(consumerCheck({ ...base, liveStatus: 'revoked', lastUsedAt: daysAgo(1) }, 0, NOW).tone, 'ok')
// live + recently used: the hold trigger, and the evidence names the source
const hold = consumerCheck({ ...base, liveStatus: 'live', lastUsedAt: daysAgo(1) }, 0, NOW)
assert.equal(hold.tone, 'crit')
assert.equal(hold.title, 'Hold before rotating')
assert.ok(hold.detail.includes('us-east-1'))
// live but idle (outside the recency window): warn, not hold
assert.equal(consumerCheck({ ...base, liveStatus: 'live', lastUsedAt: daysAgo(30) }, 0, NOW).tone, 'warn')
// unknown + provider can't list keys: terminal unknown, says so
const grafana = consumerCheck({ platform: 'grafana', liveStatus: null, lastUsedAt: null, lastUsedSource: null }, 0, NOW)
assert.equal(grafana.tone, 'warn')
assert.ok(grafana.detail.includes('cannot report'))
// unknown + listable provider never checked: points at connecting
const unchecked = consumerCheck({ platform: 'datadog_api_key', liveStatus: null, lastUsedAt: null, lastUsedSource: null }, 0, NOW)
assert.ok(unchecked.detail.includes('never checked'))

// user assertions lift the hold (mapped by a human, labeled unconfirmed)...
const lifted = consumerCheck({ ...base, liveStatus: 'live', lastUsedAt: daysAgo(1) }, 2, NOW)
assert.equal(lifted.tone, 'warn')
assert.ok(lifted.title.includes('2 user-asserted'))
assert.ok(lifted.detail.includes('live and in use')) // the evidence stays visible
// ...but never outrank a revoked key's all-clear
assert.equal(consumerCheck({ ...base, liveStatus: 'revoked', lastUsedAt: null }, 3, NOW).tone, 'ok')
// read-mode labels exist for every mode the API accepts
for (const m of ['env_boot', 'env_run', 'secret_store']) assert.ok(READ_MODES[m])

// an accepted break downgrades the hold to warn, but never to ok (a signed cost)
const acceptedKey = { ...base, liveStatus: 'live', lastUsedAt: daysAgo(1), breakAcceptedAt: daysAgo(0), breakAcceptedBy: 'nilson@x' }
const accepted = consumerCheck(acceptedKey, 0, NOW)
assert.equal(accepted.tone, 'warn')
assert.equal(accepted.title, 'Break accepted')
assert.ok(accepted.detail.includes('nilson@x'))
// revoked still outranks an acceptance
assert.equal(consumerCheck({ ...acceptedKey, liveStatus: 'revoked' }, 0, NOW).tone, 'ok')
// assertions + acceptance coexist: the mapped state mentions the accepted break
assert.ok(consumerCheck(acceptedKey, 1, NOW).detail.includes('break accepted'))

// the revoke gate predicate: acceptance holds only on identical traffic evidence
const t = daysAgo(2)
assert.equal(acceptanceHolds(t, new Date(t.getTime())), true) // same instant, different objects
assert.equal(acceptanceHolds(t, daysAgo(1)), false) // used again since acceptance
assert.equal(acceptanceHolds(null, null), true) // never observed, still never observed
assert.equal(acceptanceHolds(null, daysAgo(1)), false) // usage appeared after acceptance
assert.equal(acceptanceHolds(t, null), false) // evidence vanished (platform reset); re-ask

// Readiness rail: guided runbook detection normalizes platform strings.
const okConsumer = { tone: 'ok', title: 'x', detail: 'y' } as const
const dd = readinessChecks('datadog_api_key', okConsumer, 4, 1)
assert.equal(dd.length, 3)
assert.equal(dd[0].tone, 'ok') // datadog has a guided template
assert.ok(dd[2].detail.includes('4 sites'))
assert.ok(dd[2].detail.includes('1 in deploy pipelines'))
assert.equal(readinessChecks('stripe_secret_live', okConsumer, 1, 0)[0].tone, 'warn') // no stripe template

// Summary: counts only, no invented consumers; asserted consumers lead when present.
assert.equal(radiusSummary(1, 0, 0), 'Rotating this key touches 1 exposure site.')
assert.equal(radiusSummary(4, 2, 1), 'Rotating this key touches 4 exposure sites and 2 deploy pipelines. 1 person touched the exposing commits.')
assert.equal(radiusSummary(1, 0, 0, 2), 'Rotating this key touches 2 asserted consumers and 1 exposure site.')
assert.equal(radiusSummary(4, 2, 0, 1), 'Rotating this key touches 1 asserted consumer, 4 exposure sites and 2 deploy pipelines.')

// The composed sentence: every clause claimable, honest per provider.
const live = { ...base, liveStatus: 'live', lastUsedAt: daysAgo(30) }
const s1 = radiusSentence(live, 1, 0, 0, NOW)
assert.equal(s1.lead, '1 exposure site')
assert.ok(s1.rest.includes('no mapped consumers'))
assert.ok(s1.rest.includes('nothing observed using it recently'))
assert.ok(s1.rest.includes('no platform runbook yet')) // aws has no template
const s2 = radiusSentence({ platform: 'grafana', liveStatus: null, lastUsedAt: null, lastUsedSource: null }, 2, 1, 0, NOW)
assert.equal(s2.lead, '2 exposure sites (1 in deploy pipelines)')
assert.ok(s2.rest.includes('cannot report usage')) // never claims "nothing observed"
const s3 = radiusSentence({ platform: 'datadog', liveStatus: 'live', lastUsedAt: daysAgo(1), lastUsedSource: 'datadog' }, 1, 0, 2, NOW)
assert.ok(s3.rest.includes('2 consumers mapped by hand'))
assert.ok(s3.rest.includes('an unknown caller used it recently'))
assert.ok(s3.rest.includes('Guided rotation runbook available'))
const s4 = radiusSentence({ ...live, breakAcceptedAt: daysAgo(0), breakAcceptedBy: 'nilson@x' }, 1, 0, 0, NOW)
assert.ok(s4.rest.includes('break accepted by nilson@x'))

console.log('blast-radius: all assertions passed')
