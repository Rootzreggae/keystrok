# Key Inventory & Rotation Policy Specification

## Purpose
The ledger of tracked keys and the single rotation clock: when each key must be rotated, anchored to when it was actually at risk, never to guessed platform dates.
## Requirements
### Requirement: Rotation windows anchored to risk start
The system SHALL compute one rotation window per key: `riskStart + ROTATION_DAYS[severity]` where `ROTATION_DAYS = {critical: 7, high: 30, medium: 60, low: 90}` (unknown severity reads as high). `riskStart` is discovery time (`foundAt`) unless an attested exposure date exists that is earlier and not in the future, in which case the earlier date wins. An exposure date can only make rotation more urgent, never later. `rotation-policy.ts` is the single source of these numbers.

#### Scenario: attested exposure
- **WHEN** a member sets an exposure date earlier than discovery
- **THEN** the window re-anchors to it, the source records `user` (human beats git), and a future date is rejected

### Requirement: Urgency and needs-action
The system SHALL derive urgency from days-until-due: overdue (crit) below zero, due-soon within max(2 days, 20% of the window), otherwise quiet. `needsAction` = overdue, due-soon, or any still-open critical. A rotated key whose post-rotation liveness check still finds it live (`rotation_failed`) is NOT resolved: it re-enters the open population and reads overdue.

#### Scenario: failed rotation stays open
- **WHEN** a key is marked rotated but a post-rotation check still finds it live
- **THEN** it reads overdue and re-enters the needs-action population instead of reading as handled

### Requirement: Shared workspace ledger
`getKeys()` SHALL return all non-false-positive keys instance-wide (no per-user filter), newest first, with derived flags: `usage_active` (live AND used within 7 days), `rotation_failed`, `break_accepted`, and blast-radius counts. No raw secret is ever present (zero-knowledge; masked preview only).

#### Scenario: shared visibility
- **WHEN** any member opens the ledger
- **THEN** they see every tracked key in the workspace, masked, never a raw secret

### Requirement: Key timeline
The per-key timeline SHALL compose only stored evidence: exposed (git or attested), discovered, last-used (flagged "used while exposed" when inside the window), liveness checks, and one receipt line per rotation run ("N of M steps receipted", flagging an unverified revoke step). The exposure window runs from riskStart to rotatedAt and stays open on a failed rotation. Terminal open states: "Awaiting rotation" (no rotation yet) or "Still exposed" (rotated but never revoked).

#### Scenario: used while exposed
- **WHEN** the platform reports the key was used inside the exposure window
- **THEN** the timeline flags that use in crit, the forensic point of the screen

### Requirement: Drawer honesty grammar
The key drawer SHALL show at most one banner (worst truth wins: failed rotation outranks active incident), say each fact once (identity in the header chips, liveness/window/found/at-risk in NOW), and only render prose for states that deviate from the default. Keystrok never displays a key's true creation or expiry date; it never sees one.

#### Scenario: one banner
- **WHEN** a key is both rotation-failed and live-and-used
- **THEN** only the failed-rotation banner renders; the worst truth wins and nothing is said twice

### Requirement: One population, every number
Every metric Keystrok renders SHALL count the same workspace-wide population. Operational counts (needs action, tracked, rotating) and hygiene metrics (SLA compliance, MTTR, open exposure days, trend) SHALL be computed instance-wide, never filtered to the signed-in user. Rotation urgency everywhere, including expiration alerts, SHALL anchor to the risk start (attested or git exposure date when earlier than discovery), never to discovery alone.

#### Scenario: Home's two bands agree
- **WHEN** a member opens Home in a workspace with several members' keys
- **THEN** the operational band and the hygiene band count the same keys, so the numbers are comparable

#### Scenario: exposure dates are honored everywhere
- **WHEN** a key has an attested exposure date earlier than discovery
- **THEN** every surface that states urgency, including alerts, uses it

