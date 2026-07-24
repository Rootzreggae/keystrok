# Manual Key Registration — Design

## Context

Today the only path into the ledger is Discovery: scanner finds a secret in source → `LocalScanFinding` → promote → `DiscoveredKey` (+ `KeyHash`). The ledger is zero-knowledge: masked preview and hash only, never the raw value. A freshly minted key that was never exposed has no entry point. All classification machinery needed for a paste already exists in `lib/scanner` (per-line patterns with confidence/severity) and `lib/crypto.ts` (masking, salted hashing).

**Important data reality:** no existing `KeyHash` row holds a value-derived hash. The scan path stores `hashIdentifier(filePath:line:rule:preview)` with an empty salt (deliberately deterministic, for re-scan dedup), and the promote path stores the placeholder `'promoted-' + finding.id`. The salted `hashKey()`/`verifyKeyHash()` functions exist in `lib/crypto.ts` but are unused by current rows. Manual registration introduces the first value-derived salted hashes, and everything that verifies a value against stored salts can only ever match manual-source rows.

## Goals / Non-Goals

**Goals:**
- Register one known key by paste; classify in-memory; persist only masked preview + salted hash + metadata.
- Rotation clock anchored to registration time; timeline begins at "registered", no exposure implied.
- A later Discovery finding whose value matches a registered key's hash links to that key as an exposure event (re-anchoring risk start, earlier-is-worse) instead of minting an unrelated finding identity.

**Non-Goals:**
- Bulk import, CSV, or platform-API-driven import (list keys from provider accounts).
- Storing or ever displaying the raw value after the request completes.
- UI design (owner: Nilson). This design stops at the API contract and data flow.
- Editing a registered key's value ("re-paste") — delete and re-register instead.

## Decisions

1. **New route `POST /api/keys/register`** (session-required, any member — same posture as promote). Body `{ value, name?, platform? }`. The value lives only in the request scope; the response returns the created ledger entry (masked). Rationale: one thin route delegating to `lib/`, matching the routes-thin/logic-in-lib house pattern. **No `console.log` of any part of the body** — the existing promote route's debug logging is explicitly the anti-pattern here.
2. **Classification = run the existing scanner patterns against the paste as a single synthetic line.** Match → keyType, severity, confidence, masked preview from the same helpers Discovery uses; one classifier, no drift. No match → treat as generic high-entropy secret, require the user-supplied `platform`/`name`, severity defaults to the policy's unknown→high.
3. **Persist as `DiscoveredKey` with `source: 'manual'`** plus a `KeyHash` row (`keyType: 'manual'` context preserved via existing fields). No new Prisma model; a new allowed value in an existing string column. Timeline and drawer read `source` to render "registered" instead of "discovered". Alternative considered — separate `RegisteredKey` model — rejected: it forks every ledger query and metric for zero behavioral gain (one-population rule in key-inventory spec).
4. **Risk start = `foundAt`, which for a manual key records registration time.** `riskStart()` in `rotation-policy.ts` already anchors on `foundAt` (Prisma default `now()`), so inserting the manual key with default `foundAt` gives the right clock with **zero rotation-policy changes** — do not add a source branch. No `exposedAt` at birth. If exposure evidence arrives later (hash-linked finding with git blame, or user attestation), the existing earlier-is-worse anchoring applies unchanged. The column name reading "found" for a never-found key is a display concern only; timeline/drawer copy renders it as "registered".
5. **Hash-link at scan time, verify-against-salt, inside `lib/scanner/core.ts`.** `hashKey()` salts randomly, so equal secrets produce different digests; linking therefore iterates `KeyHash` rows of manual-sourced keys and verifies the scan value against each stored salt (`verifyKeyHash()` in `lib/crypto.ts`). **Placement is load-bearing:** the raw matched value exists only inside `core.ts` (`const key = match[1] || match[0]`, dropped after hashing at ~line 531); by the time findings reach `processScanFindings` in the scan route, only preview/hash survive. The verify hook must run where `key` is in scope (or the value threaded in memory to the caller — never onto the persisted `Finding`). On match: attach the finding to the registered key, record the exposure event, skip new-identity creation. `// ponytail: O(registered-keys) verify per finding; index by key-format prefix if a workspace ever registers hundreds.`
6. **Rate-limit the register route** with the same in-memory limiter pattern used by `sendVerificationRequest` (it accepts secret material; abuse surface). Modest bound (e.g. 10/min/user).

## Risks / Trade-offs

- [Raw secret transits the server] → It already does for folder/repo scans; same handling rules: memory-only, no logging, no error message ever echoing the value. Add a test asserting the route's error paths return no fragment of the input.
- [User pastes a truncated/typo'd value] → Classification confidence will usually drop to generic; the masked preview shown back before confirm is the human check. Deletion stays available.
- [Duplicate registration of an already-tracked secret] → At registration, run the verify-against-salt pass over **manual-source** `KeyHash` rows; on match, refuse with a pointer to the existing key. **Honest limit:** a key already tracked via Discovery cannot be detected as a duplicate — its raw value is gone and its `KeyHash` is an identity hash, not a value hash — so pasting it creates a second, unlinked ledger entry. Accepted (zero-knowledge makes it undetectable); document in the FAQ rather than pretend otherwise.
- [Salt-verify cost grows with ledger size] → Accepted at current scale; ceiling and upgrade path noted in Decision 5.

## Migration Plan

Additive only: new route, new `source` value, no schema migration expected (verify `DiscoveredKey.source` has no enum constraint in Prisma — it's a string). Rollback = remove route; existing manual rows remain valid ledger entries.

## Open Questions

- Should registration ask for an optional "created on platform at" date as user attestation (earlier risk start), or is that scope creep for v1? Default: leave out; the attestation flow already exists post-hoc.
- Entry-point placement (empty state CTA vs toolbar) — Nilson's design pass.
