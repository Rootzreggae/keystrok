# Discovery / Scanner Specification

## Purpose
Find exposed API keys in source the user points at, triage them (promote / dismiss), and carry honest provenance (where, when, by whom committed) into the key ledger.

## Requirements

### Requirement: Line-local pattern detection
The scanner SHALL detect keys by per-line regex + entropy + validation functions, for: AWS (access/secret/session), Stripe (live/test/publishable/restricted), GitHub tokens, Grafana (service account + legacy), Datadog (api/app), New Relic (query/license), Slack, Prometheus bearer, Elasticsearch, Splunk (context-gated), PagerDuty (context-gated), JWT, env-var secrets, and generic high-entropy keys. Each pattern carries a static confidence (0.40-0.99) and severity; patterns below the preset's confidence threshold are skipped. Detection is line-local; multiline or JSON-aware parsing is out of scope.

#### Scenario: quoted config keys
- **WHEN** a known key shape appears behind a quoted JSON/YAML key name
- **THEN** the context patterns match (quote-tolerant since the detection benchmark), and `process.env`-style references are never flagged

### Requirement: Three scan sources with different guarantees
The system SHALL scan: (1) a server filesystem path (admin-only, background, honors quick/deep/full presets, path-constrained to home/Documents/Desktop and blocked from system/credential dirs); (2) a browser-picked folder (any member, synchronous, QUICK preset, contents-only so no git provenance); (3) a GitHub repo via GitHub App (any member, shallow `--depth 1` clone to a temp dir, deleted after; 1-hour installation tokens never persisted). Scheduled re-scan exists only for GitHub sources, gated by CRON_SECRET, throttled to one scan per source per 6 hours.

#### Scenario: browser folder provenance
- **WHEN** findings come from a browser-picked folder
- **THEN** they carry no git metadata and no derived exposure date; the rotation clock anchors to discovery time

### Requirement: Finding identity and re-scan reconciliation
The system SHALL identify a finding by hash of `filePath:lineNumber:detectionRule:keyPreview`. Re-scans update the existing finding in place (preserving triage status) and bump `KeyHash.seenCount`/`lastSeenAt`; "new finding" means a `KeyHash` first seen after the previous scan. A secret that moves file or line acquires a new identity and re-enters triage even if previously dismissed.

#### Scenario: secret moves file
- **WHEN** a dismissed secret is moved to another file or line
- **THEN** it acquires a new identity and re-enters triage as a new finding

### Requirement: Git-derived exposure dates
For git-tracked findings, the system SHALL derive `exposedAt` from `git blame` of the secret's line and carry it to the promoted key with source `git`. Exposure dates only ever make rotation more urgent (see key-inventory spec).

#### Scenario: blamed line
- **WHEN** a finding sits on a git-tracked line
- **THEN** git blame supplies the commit date as the exposure date, sourced as git

### Requirement: Triage flow
Any member SHALL be able to promote a finding (creates a DiscoveredKey with severity-mapped status, marks the finding resolved, logs Activity), dismiss it (status dismissed, logged as false positive), or restore it. There is no pattern-level allowlist; dismissal is the only suppression and it does not survive the secret moving.

#### Scenario: promote
- **WHEN** a member promotes a finding
- **THEN** a tracked key is created with the severity-mapped status, the finding reads resolved, and Activity records it

### Requirement: Zero-knowledge storage
The system SHALL never store raw secret values: findings and keys carry only a masked `keyPreview`; identity hashing uses the preview, not the secret.

#### Scenario: no secret at rest
- **WHEN** any finding or key is stored
- **THEN** only a masked preview is persisted; the raw secret exists nowhere in the database
