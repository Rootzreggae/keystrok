# Manual Registration Specification

## ADDED Requirements

### Requirement: Register a known key by paste
The system SHALL let any authenticated member register a single known key by pasting its value once. The value SHALL be processed in-memory only: classified by the same detection patterns Discovery uses (keyType, severity, confidence), reduced to a masked preview, and fingerprinted via the existing salted `KeyHash` scheme. The raw value SHALL never be persisted, logged, or echoed in any response or error message. The resulting ledger entry carries source `manual`, and its rotation clock anchors to the registration timestamp.

#### Scenario: recognized key shape
- **WHEN** a member pastes a value matching a known detection pattern (e.g. a Resend or Stripe key)
- **THEN** platform and severity are inferred, a masked preview is shown back for confirmation, and the confirmed key enters the ledger with source `manual` and risk start = registration time

#### Scenario: unrecognized secret
- **WHEN** the pasted value matches no pattern
- **THEN** it is treated as a generic high-entropy secret, the member must supply a name and platform, and severity defaults to the policy's unknown-severity handling

#### Scenario: zero-knowledge preserved
- **WHEN** registration completes or fails on any path
- **THEN** no fragment of the pasted value exists in the database, server logs, or response bodies beyond the masked preview

### Requirement: Duplicate registration refused among manual keys
At registration the system SHALL verify the pasted value against the stored salts of existing **manual-source** `KeyHash` rows and refuse to create a twin when the secret is already manually registered, pointing to the existing key instead. Keys that entered the ledger via Discovery cannot be duplicate-checked: their raw values were never kept and their `KeyHash` rows are finding-identity hashes, not value hashes. This limit SHALL be documented honestly (FAQ), not papered over.

#### Scenario: pasting an already-registered secret
- **WHEN** a member pastes a value whose salted hash verifies against an existing manual-source key
- **THEN** no new ledger entry is created and the response identifies the existing key

#### Scenario: pasting a discovery-tracked secret
- **WHEN** a member pastes a value that matches a key tracked via Discovery
- **THEN** a separate manual entry is created (the duplication is undetectable by design), and the documentation states this limit

### Requirement: Registration endpoint is rate-limited
The registration endpoint SHALL be rate-limited per user (same in-memory limiter pattern as magic-link sending), because it accepts secret material.

#### Scenario: paste flooding
- **WHEN** a user exceeds the per-minute registration limit
- **THEN** further attempts are rejected with a clear error and no classification work is performed
