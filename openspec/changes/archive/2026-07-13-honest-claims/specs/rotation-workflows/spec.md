# Rotation workflows — delta

## ADDED Requirements

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
