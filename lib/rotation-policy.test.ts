// Run: node --experimental-strip-types lib/rotation-policy.test.ts
// ponytail: no framework, plain asserts, the smallest thing that fails if the bands break.
import assert from 'node:assert/strict'
import { rotationDueAt, daysUntilDue, rotationStatus, riskStart } from './rotation-policy.ts'

const DAY = 1000 * 60 * 60 * 24
const now = new Date('2026-06-23T00:00:00Z')
const ago = (d: number) => new Date(now.getTime() - d * DAY)

// Band boundaries (anchored to foundAt).
assert.equal(daysUntilDue(now, 'critical', now), 7)
assert.equal(daysUntilDue(now, 'high', now), 30)
assert.equal(daysUntilDue(now, 'medium', now), 60)
assert.equal(daysUntilDue(now, 'low', now), 90)

// Unknown severity falls back to the 'high' band, never throws.
assert.equal(daysUntilDue(now, 'bogus', now), 30)
assert.equal(daysUntilDue(now, '', now), 30)

// rotationDueAt = foundAt + band.
assert.equal(rotationDueAt(now, 'critical').getTime(), now.getTime() + 7 * DAY)

// A 7-day-old critical is overdue; a 7-day-old low is not.
assert.equal(rotationStatus({ foundAt: ago(7), severity: 'critical' }, now), 'overdue')
assert.equal(rotationStatus({ foundAt: ago(7), severity: 'low' }, now), 'ok')

// due-soon window: critical found 1 day ago is within 7 days of its due date.
assert.equal(rotationStatus({ foundAt: ago(1), severity: 'critical' }, now), 'due-soon')

// Rotated keys are never flagged, regardless of age.
assert.equal(rotationStatus({ foundAt: ago(999), severity: 'critical', status: 'rotated' }, now), 'rotated')

// --- riskStart: the exposure anchor ---
// No exposedAt -> falls back to foundAt (today's behavior).
assert.equal(riskStart({ foundAt: ago(3), exposedAt: null }, now).getTime(), ago(3).getTime())
// exposedAt earlier than discovery -> counts from exposure (the main win).
assert.equal(riskStart({ foundAt: ago(3), exposedAt: ago(200) }, now).getTime(), ago(200).getTime())
// exposedAt LATER than discovery -> ignored, never pushes the deadline out.
assert.equal(riskStart({ foundAt: ago(30), exposedAt: ago(1) }, now).getTime(), ago(30).getTime())
// exposedAt in the future -> ignored.
assert.equal(riskStart({ foundAt: ago(3), exposedAt: new Date(now.getTime() + 5 * DAY) }, now).getTime(), ago(3).getTime())
// A key found today but exposed 200d ago is deeply overdue even at 'low'.
assert.equal(rotationStatus({ foundAt: riskStart({ foundAt: now, exposedAt: ago(200) }, now), severity: 'low' }, now), 'overdue')

console.log('rotation-policy: all assertions passed')
