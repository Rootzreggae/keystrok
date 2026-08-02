# Alerting — Delta: rotation due reminders

## MODIFIED Requirements

### Requirement: Four alert kinds, one precedence
The system SHALL fire alerts for: `rotation_failed` (rotated but still live), `live_and_used` (active incident), `sla_crossed` (rotation window expired), `due_soon` (rotation deadline approaching), and `new_finding` (critical/high finding in a scheduled scan). Per key, the worst standing condition wins (rotation_failed > live_and_used > sla_crossed > due_soon).

#### Scenario: precedence
- **WHEN** a key is both past SLA and rotation-failed
- **THEN** only the rotation_failed alert fires

#### Scenario: reminder yields to overdue
- **WHEN** a key inside its reminder lead window crosses its rotation deadline without being rotated
- **THEN** the sla_crossed alert fires and the open due_soon event resolves silently, with no recovery message in between

## ADDED Requirements

### Requirement: Severity-scaled reminder lead
A not-yet-rotated key SHALL enter the `due_soon` condition when its days until rotation deadline are greater than zero and at most the lead for its severity: critical 2d, high 5d, medium 7d, low 10d (scaled against the 7/30/60/90d rotation windows, defined in the rotation policy module as the single source of truth). The countdown anchors on the same risk start as the deadline itself, so an attested earlier exposure pulls the reminder in exactly as it pulls the deadline in. Like `sla_crossed`, `due_soon` is knowable from stored dates and SHALL fire without fresh liveness evidence. The message SHALL read as advance notice, never as an incident page.

#### Scenario: one ping on entering the window
- **WHEN** a high-severity key reaches 5 days before its rotation deadline and the workspace has an alert channel configured
- **THEN** exactly one due_soon alert is delivered on that channel, and subsequent ticks inside the window send nothing

#### Scenario: rotated ahead of the deadline
- **WHEN** a key with an open due_soon event is rotated before its deadline
- **THEN** the event resolves with a recovery message stating the key was rotated ahead of its deadline

#### Scenario: no time left, no reminder
- **WHEN** a key's remaining window at evaluation time is already zero or negative (e.g. an attested exposure consumed the whole band)
- **THEN** no due_soon alert fires; the key goes directly to sla_crossed
