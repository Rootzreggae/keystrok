# Rotation Workflows Specification

## Purpose
Guided, operator-executed rotation runbooks with receipts. Keystrok recommends the order, gates the irreversible step, and verifies the outcome; it never rotates or revokes on its own.
## Requirements
### Requirement: Advisory, operator-gated runbooks
Every workflow SHALL be manual/guided: no step is automated, every state change is a human click, and Keystrok's server-side actions are limited to recording status, gating completion, and reading liveness. Guided templates exist for Grafana, Datadog, New Relic, and Dynatrace; all other platforms get the generic template. Template choice keys off the key's type.

#### Scenario: no automation
- **WHEN** any runbook step is reached
- **THEN** Keystrok records and verifies; the operator performs the action on the platform

### Requirement: Step gating
Steps SHALL complete only when their dependencies are completed or skipped (templates chain linearly, so the revoke step sits behind verify). The destructive step (revoke/disable the old key) is admin-only; destructive steps are required and cannot be skipped.

#### Scenario: revoke is gated
- **WHEN** a member reaches the destructive step
- **THEN** it requires admin, and its dependencies must be done first

### Requirement: The revoke gate
When completing the destructive step for a key with an accepted break, the system SHALL re-verify the acceptance snapshot: if the platform saw the key used since the acceptance, completion is refused (409) and the operator must re-read the radius and re-accept. After the destructive step completes and `rotatedAt` lands, a liveness pass runs immediately (best-effort) so a rotation that didn't stick is caught in the same breath.

#### Scenario: rotation that didn't stick
- **WHEN** the post-revoke check still finds the old key live
- **THEN** the key reads rotation_failed, re-enters the due list as open, and the outcome ledger shows "Old key still live" in crit

### Requirement: Completion semantics
A workflow SHALL auto-complete when all required steps are done, stamping `completedAt` and marking the key rotated with `rotatedAt`. Multiple historical workflows per key are allowed; only a pending/in-progress workflow blocks starting a new one.

#### Scenario: auto-complete
- **WHEN** the last required step is completed
- **THEN** the workflow completes, the key is marked rotated with a timestamp, and a liveness pass runs

### Requirement: Outcome ledger
The completed-rotations ledger SHALL verdict each run from post-rotation evidence, not workflow status: "Old key verified dead" (liveness re-checked revoked), "Verification pending" (revoke receipted, no post-rotation evidence yet), "Receipted by you" (provider can never verify), or crit "Old key still live". Pending renders as an open loop (hollow ring), and an accepted break or unverifiable provider caps the best attainable verdict honestly.

#### Scenario: unverifiable provider
- **WHEN** a rotation completes on a provider that cannot list keys
- **THEN** the verdict reads 'Receipted by you', never 'verified dead'

### Requirement: A finished rotation states the verdict it earned
The completion view SHALL render the same evidence-derived verdict as the outcome ledger: a rotation whose old key is still live says so, a rotation on a provider that cannot verify says it was receipted but not verified, and only a liveness-verified revocation SHALL claim the exposure is closed. No screen SHALL assert that the old key was verified idle when no post-rotation evidence exists.

#### Scenario: a failed rotation is not congratulated
- **WHEN** a post-rotation liveness check still finds the old key live
- **THEN** the completion view reports it, matching the ledger, instead of declaring the exposure closed

### Requirement: Runbook copy matches runbook behavior
The runbook SHALL describe only what Keystrok does: recommend the order, gate the irreversible step, and verify the outcome afterwards. It SHALL NOT claim to watch traffic continuously or to pre-fill verification checks, and SHALL NOT render actor chips for automated steps, since no step is automated. The advisory promise (Keystrok never rotates or revokes on its own) stays, because it is true.

#### Scenario: no phantom automation
- **WHEN** an operator reads any step
- **THEN** the copy attributes the action to the operator and the recording to Keystrok, with no claim of automated checking

