# Discovery — delta

## MODIFIED Requirements

### Requirement: Three scan sources with different guarantees
The system SHALL scan: (1) a server filesystem path (admin-only, background, honors quick/deep/full presets, path-constrained to home/Documents/Desktop and blocked from system/credential dirs); (2) a browser-picked folder (any member, synchronous, QUICK preset, contents-only so no git provenance); (3) a GitHub repo via GitHub App (any member, shallow `--depth 1` clone to a temp dir, deleted after; 1-hour installation tokens never persisted). Scheduled re-scan exists only for GitHub sources, gated by CRON_SECRET, throttled to one scan per source per 6 hours. The system SHALL NOT claim to scan git history: only working-tree contents are read, so a secret committed and later deleted is not found, and no UI advertises otherwise.

#### Scenario: browser folder provenance
- **WHEN** findings come from a browser-picked folder
- **THEN** they carry no git metadata and no derived exposure date; the rotation clock anchors to discovery time

#### Scenario: deleted secret is out of scope
- **WHEN** a secret was committed and later removed from the working tree
- **THEN** Keystrok does not find it, and no coverage list implies it would

## ADDED Requirements

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
