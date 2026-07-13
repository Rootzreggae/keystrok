# Liveness & Platforms Specification

## Purpose
Answer "is this leaked key still alive on its platform?" without ever holding the secret, and manage the platform connections that make that possible.

## Requirements

### Requirement: Zero-knowledge fingerprint matching
Liveness SHALL match a leaked key's last-4 fingerprint (from the masked preview) against the keys a connected platform lists. Three states only: live, revoked, unknown. On a fingerprint collision the system fails toward live, never toward safe. The scanner's likelihood heuristics never map to liveness.

#### Scenario: collision
- **WHEN** two keys share a last-4 and one is live
- **THEN** both read live; the system never fails toward safe

### Requirement: Listable providers only
Only providers whose list-keys API exposes a matchable fingerprint SHALL produce live/revoked verdicts: currently Datadog (api + application keys, needs an application key) and AWS (IAM ListAccessKeys via SigV4, needs the secret access key; lists only the connected credential's own IAM user). All other providers stay permanently unknown; UI copy must say "cannot report" for them, distinct from "never checked".

#### Scenario: listing failure never reads as revoked
- **WHEN** a provider's listing call fails (bad credential, network)
- **THEN** its keys keep their prior status and check time (a warning is recorded), and are never marked revoked by absence of data

### Requirement: Usage evidence
Where the provider reports it, the system SHALL store when a key was last used (AWS: date + region/service; Datadog: date only). "Recently used" means within 7 days. Live + recently used = an active incident.

#### Scenario: active incident
- **WHEN** a live key was used within 7 days
- **THEN** it reads as an active incident and the radius holds before rotating

### Requirement: Rotation-failed detection
A key SHALL read `rotation_failed` only with post-rotation evidence: marked rotated AND a liveness check at-or-after `rotatedAt` still found it live. Stale pre-rotation checks never count. Liveness runs on: manual admin trigger, the CRON_SECRET-gated tick, and automatically after a runbook's destructive step completes (ordered after `rotatedAt` lands so the evidence counts).

#### Scenario: stale evidence
- **WHEN** the only liveness check predates the rotation
- **THEN** the key does NOT read rotation-failed; post-rotation evidence is required

### Requirement: Credentials encrypted at rest
Platform credentials (and second credentials like Datadog application keys / AWS secrets) SHALL be AES-256-GCM encrypted at rest, decrypted only at point of use, and only ever leave the server masked. Connection tests and all user-configurable platform URLs pass the SSRF guard (scheme, private-range, and DNS checks; Telegram hosts are fixed).

#### Scenario: credential read back
- **WHEN** a platform credential is fetched for display
- **THEN** it comes back masked; plaintext exists only in memory at point of use

### Requirement: Connection testing
Test-before-connect SHALL be available to any member; re-testing and mutating a connected platform is admin-only. AWS connection tests are format-only (the real proof runs at liveness time); Stripe/GitHub hit fixed endpoints; others probe the user-supplied test endpoint.

#### Scenario: member tests before connecting
- **WHEN** a member tests a platform credential
- **THEN** the test runs; mutating or re-testing a connected platform requires admin
