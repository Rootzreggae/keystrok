# Discovery — Delta for Manual Registration

## MODIFIED Requirements

### Requirement: Finding identity and re-scan reconciliation
The system SHALL identify a finding by hash of `filePath:lineNumber:detectionRule:keyPreview`. Re-scans update the existing finding in place (preserving triage status) and bump `KeyHash.seenCount`/`lastSeenAt`; "new finding" means a `KeyHash` first seen after the previous scan. A secret that moves file or line acquires a new identity and re-enters triage even if previously dismissed. Before minting a new identity, the scanner SHALL verify the in-memory secret value against the stored salts of manual-source `KeyHash` rows; on a match the finding attaches to the already-tracked key as an exposure event (carrying file provenance and git-derived exposure date when available, re-anchoring risk start earlier-is-worse) instead of entering triage as an unrelated finding.

#### Scenario: secret moves file
- **WHEN** a dismissed secret is moved to another file or line
- **THEN** it acquires a new identity and re-enters triage as a new finding

#### Scenario: tracked key leaks into source
- **WHEN** a scan finds a secret whose value matches a manually registered key's hash
- **THEN** no independent triage finding is created; the existing key gains an exposure event, its risk start re-anchors to the exposure evidence when earlier, and the member is alerted that a tracked key is now exposed
