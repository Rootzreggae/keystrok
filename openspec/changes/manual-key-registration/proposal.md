# Manual Key Registration

## Why

The ledger can only be populated through Discovery (scan → triage → promote), so a key that was never exposed has no way in. This punishes the most responsible workflow — registering a freshly minted key at birth, before it ever touches a repo — and it means the "track" half of find/track/rotate only exists downstream of "find". Found by dogfooding: the author minted a Resend key and Keystrok had no door for it.

## What Changes

- A user can register a single known key directly into the ledger by pasting it once. The paste is processed in-memory only: existing detection patterns infer platform and severity, a masked preview and a salted `KeyHash` are derived, and the raw value is never persisted or logged (zero-knowledge preserved).
- Registered keys enter the ledger with source `manual`, rotation clock anchored to registration time, and no exposure — their timeline starts at "registered", not "discovered".
- If a later Discovery scan finds a secret whose hash matches a manually registered key, the finding links to the tracked key and re-anchors its risk start to the exposure evidence: a tracked key leaking is surfaced as an exposure event on an existing key, not an unrelated new finding.
- Manual fields the user supplies: a name/label and optionally the platform (when inference is ambiguous or the paste is a generic high-entropy secret).

## Capabilities

### New Capabilities
- `manual-registration`: registering a known key into the ledger by paste — in-memory classification, masked persistence, rotation clock from registration date.

### Modified Capabilities
- `key-inventory`: ledger population and timeline admit `manual`-sourced keys; risk-start anchoring gains a third origin (registration time) that an exposure date can still override to earlier-is-worse.
- `discovery`: re-scan reconciliation gains hash-match linking — a finding matching a registered key's `KeyHash` attaches to that key as an exposure event instead of creating an independent finding identity.

## Impact

- New UI entry point on the Keys ledger (empty state and toolbar) — UX designed by Nilson, out of scope here.
- New API route for registration (in-memory classification; nothing sensitive stored).
- Reuses: detection patterns (`lib/` scanner rules), `KeyHash` model + salted hashing, `DiscoveredKey` (new source value `manual`), rotation-policy anchoring.
- Prisma: likely no new model; a `registeredAt`/source distinction on the existing key path. Schema delta decided in design.
- No change to zero-knowledge posture: raw secrets remain never-stored.
