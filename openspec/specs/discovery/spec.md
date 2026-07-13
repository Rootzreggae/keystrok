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
The system SHALL scan: (1) a server filesystem path (admin-only, background, honors quick/deep/full presets, path-constrained to home/Documents/Desktop and blocked from system/credential dirs); (2) a browser-picked folder (any member, synchronous, QUICK preset, contents-only so no git provenance); (3) a GitHub repo via GitHub App (any member, shallow `--depth 1` clone to a temp dir, deleted after; 1-hour installation tokens never persisted). Scheduled re-scan exists only for GitHub sources, gated by CRON_SECRET, throttled to one scan per source per 6 hours. The system SHALL NOT claim to scan git history: only working-tree contents are read, so a secret committed and later deleted is not found, and no UI advertises otherwise.

#### Scenario: browser folder provenance
- **WHEN** findings come from a browser-picked folder
- **THEN** they carry no git metadata and no derived exposure date; the rotation clock anchors to discovery time

#### Scenario: deleted secret is out of scope
- **WHEN** a secret was committed and later removed from the working tree
- **THEN** Keystrok does not find it, and no coverage list implies it would

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

### Requirement: Every scan control is real
Scan options that the UI exposes SHALL change scan behavior. File-category and exclude-path options SHALL filter which files are read, at file discovery. Options that cannot be honored without lowering detection quality (key-type narrowing, per-scan confidence overrides) SHALL NOT exist in the UI, the request shape, or the database: detection thresholds belong to the scan preset alone.

#### Scenario: a toggle that does nothing cannot exist
- **WHEN** a coverage toggle is rendered in Settings
- **THEN** turning it off measurably changes which files the next scan reads

#### Scenario: recall is protected
- **WHEN** file-discovery filtering changes
- **THEN** the detection benchmark still reports its established recall with zero false positives

### Requirement: Scan status tells the truth
A running scan SHALL report real progress (files discovered, files scanned) from the scanner's own progress events. Cancelling a scan SHALL stop the running scanner and leave the session cancelled, not let it finish and overwrite the status. A failed scan SHALL surface its stored error message to the operator, and a scan that completed with per-finding processing errors SHALL disclose the count.

#### Scenario: cancel stops the work
- **WHEN** an operator cancels a running scan
- **THEN** the scanner stops reading files and the session stays cancelled

#### Scenario: failure is not silence
- **WHEN** a scan fails
- **THEN** the operator sees the error, not an empty inbox that looks like an all-clear

