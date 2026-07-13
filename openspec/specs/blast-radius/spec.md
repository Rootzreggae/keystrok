# Blast Radius Specification

## Purpose
Before an operator commits to rotating a key, show what the rotation touches, built strictly from observed data plus labeled human assertions. Unknowns say they are unknown; the map never invents a consumer.
## Requirements
### Requirement: Evidence-only panels
The radius SHALL derive: exposure sites from scan findings sharing the key's hash (deduped per file, falling back to the key's own location so sites never reads zero); deploy pipelines by path classification of those sites (.github/workflows, gitlab-ci, circleci, buildkite, Jenkinsfile, docker-compose, .tf/.tfvars), labeled "from repo scan"; people from git commit authorship, framed as context ("author of the exposing commit"), never blame.

#### Scenario: pipeline classification
- **WHEN** an exposure site lives in .github/workflows or a .tf file
- **THEN** it is listed under deploy pipelines, labeled from repo scan, never from deploy logs

### Requirement: Honest consumer state
The consumer verdict SHALL be exactly one of, in precedence order: revoked → "nothing left to break" (ok); any user assertions → "N user-asserted, unconfirmed" (warn, hold lifts); break accepted → warn, never ok (a signed cost); live and recently used with nothing mapped → "Hold before rotating" (crit); live idle → consumers unknown (warn); provider cannot report usage → terminal unknown (warn); liveness never checked → unknown (warn). The composed radius sentence uses the same honest variants: "nothing observed" is only claimable when the provider can observe.

#### Scenario: hold state cannot hide
- **WHEN** the consumer verdict is crit
- **THEN** the radius auto-expands with both recovery verbs (map a consumer / accept the break) visible; accept-the-break never sits behind a click

### Requirement: User-asserted consumers
Any member SHALL be able to assert a consumer the map missed (name, read mode env_boot/env_run/secret_store, optional owner). Assertions land immediately, stay labeled "user-asserted" (provenance, not truth), are deletable (a wrong assertion poisons the map), and both directions log to Activity. Asserting lifts the hold: the operator now knows what rotation must touch.

#### Scenario: assertion lifts the hold
- **WHEN** a member asserts the consumer the map missed
- **THEN** the row lands labeled user-asserted, the verdict downgrades from hold to mapped-but-unconfirmed, and Activity records the assertion

### Requirement: Accept-the-break with snapshot re-verification
Accepting the break SHALL require the key to be live, a server-verified typed confirm of the key's display name, and SHALL snapshot the traffic evidence (`lastUsedAt`) it was signed against. The runbook's destructive step re-verifies: if the key was used again since acceptance, completion is refused (409) and a fresh acceptance is required. Acceptance is withdrawable; both directions log to Activity.

#### Scenario: traffic moved
- **WHEN** the key is used again between acceptance and the revoke step
- **THEN** the revoke gate refuses with 409 and demands a fresh acceptance

### Requirement: Advisory posture
The radius and everything downstream SHALL only observe, verify, and record. Keystrok never rotates or revokes a key on its own.

#### Scenario: no autonomous action
- **WHEN** any radius state is reached
- **THEN** Keystrok has changed nothing on the platform; every state change was a human click

### Requirement: Counts and labels do not overstate
Exposure-site counts SHALL NOT be double-counted: pipeline sites are a subset of exposure sites, and any summary that shows both SHALL make the subset relationship explicit. The `observed` label SHALL be reserved for evidence of a consumer's identity; aggregate platform last-used evidence SHALL be labeled as what it is (platform usage), never as an observed consumer.

#### Scenario: the ledger cell does not inflate
- **WHEN** a key has three exposure sites, one of which is a pipeline file
- **THEN** the summary reads as three locations, not four

