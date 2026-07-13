# Access Control, Teams & Activity Specification

## Purpose
Who can sign in, who can do the irreversible things, and the shared record of what happened.

## Requirements

### Requirement: Invite-only magic-link auth
Sign-in SHALL be passwordless magic-link (24h single-use links, throttled to 4 sends per email per 15 minutes), denied unless the email is allowlisted (env list/domain, a pending invite, or an approved waitlist entry); `AUTH_OPEN_REGISTRATION` opts the whole instance open. Allowlist lookups fail closed. A removed member cannot sign back in even while allowlisted. First user bootstraps as admin; later users inherit their invite's role.

#### Scenario: removed member
- **WHEN** a removed member is still on the allowlist
- **THEN** sign-in is denied

### Requirement: Two roles, admin-gated destructive surface
Roles are admin and member. Admin-only: team management (invites, role changes, member removal), platform mutation and connection re-testing, alert and email-delivery settings, server-path scans, the manual liveness trigger, and the runbook's revoke step. The system SHALL always keep at least one admin (self-healing promotion of the earliest active user; a guard blocks removing/demoting the last admin). Everything else (triage, promote/dismiss, exposure dates, consumer assertions, activity, assistant, appearance) is open to any member: entering evidence is triage, not destruction.

#### Scenario: last admin
- **WHEN** the last active admin is demoted or removed
- **THEN** the action is refused; the workspace always keeps an admin

### Requirement: Shared workspace, soft removal
Keys, findings, workflows, platforms, and the activity feed SHALL be instance-wide (shared workspace), not per-user. Removed users are soft-removed so their attributed history is preserved. Per-user state is limited to the assistant provider config and browser-local appearance preferences.

#### Scenario: soft removal
- **WHEN** a member is removed
- **THEN** their keys, findings and receipts remain attributed and visible

### Requirement: Composed activity feed
The activity feed SHALL merge rotation workflows and the classified activity log over a 14-day window, grouped by day, with bulk same-verb operations collapsed. It is visible to any member.

#### Scenario: bulk triage
- **WHEN** a member dismisses ten findings at once
- **THEN** the feed groups them into one operation rather than ten rows

### Requirement: Advisory, metadata-only assistant
The optional BYO-LLM assistant (local/Ollama, Anthropic, OpenAI, or OpenAI-compatible; API key encrypted at rest; base URLs SSRF-guarded) SHALL be advisory and metadata-only: it never sees, requests, or emits a secret value, never rotates or revokes, and points the user to guided rotation. It reasons over key metadata, open findings, and in-progress rotation counts.

#### Scenario: secret never leaves
- **WHEN** the assistant is asked about a key
- **THEN** it reasons over metadata only; it never sees, requests, or emits the secret value
