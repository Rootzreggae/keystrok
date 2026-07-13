# Alerting Specification

## Purpose
Page a human when a key's state crosses a line, without crying wolf on stale data.

## Requirements

### Requirement: Four alert kinds, one precedence
The system SHALL fire alerts for: `rotation_failed` (rotated but still live), `live_and_used` (active incident), `sla_crossed` (rotation window expired), and `new_finding` (critical/high finding in a scheduled scan). Per key, the worst standing condition wins (rotation_failed > live_and_used > sla_crossed).

#### Scenario: precedence
- **WHEN** a key is both past SLA and rotation-failed
- **THEN** only the rotation_failed alert fires

### Requirement: Freshness gating
`live_and_used` SHALL only fire on liveness evidence younger than 7 days. `rotation_failed` and `sla_crossed` are standing conditions knowable from stored dates and fire regardless of listing availability.

#### Scenario: stale liveness
- **WHEN** the last liveness check is older than 7 days
- **THEN** live_and_used is suppressed; standing conditions still fire

### Requirement: Edge-triggered, deduplicated delivery
The system SHALL keep at most one open AlertEvent per key and kind, send a recovery message when the condition clears, and treat delivery as best-effort (a failed send never blocks the pipeline). `new_finding` fires once per key hash.

#### Scenario: no repeat paging
- **WHEN** a condition persists across ticks
- **THEN** the alert is sent once and a recovery message follows when it clears

### Requirement: Channels
The system SHALL support three channels: Telegram (bot token, encrypted at rest), webhook (SSRF-guarded, Slack-compatible `text` plus a structured `incident` payload), and email via the configured mail transport. Alert configuration is a workspace singleton and admin-managed.

#### Scenario: the post-revoke page
- **WHEN** an operator completes the revoke step and the post-revoke liveness check still finds the old key live
- **THEN** a rotation_failed alert reaches the configured channel within that same request cycle
