# Manual Key Registration — Tasks

## 1. Library layer

- [ ] 1.1 Add `classifyPastedKey(value)` to `lib/` reusing the scanner patterns against a single synthetic line: returns keyType, severity, confidence, masked preview; generic-high-entropy fallback when no pattern matches
- [ ] 1.2 Add `verifyAgainstTrackedHashes(value)` helper using `verifyKeyHash()` over **manual-source** `KeyHash` rows only (scan/promote rows hold identity hashes, not value hashes — nothing else can ever match); returns the matching key when tracked (used by both duplicate-refusal and scan-time linking)
- [ ] 1.3 Add `registerManualKey({ value, name?, platform?, userId })` creating `DiscoveredKey` (source `manual`, status from severity, riskStart = now) + `KeyHash` row; refuse duplicates via 1.2; never persist or log the raw value

## 2. API route

- [ ] 2.1 `POST /api/keys/register` — thin route: auth check, rate limit (same limiter pattern as `sendVerificationRequest`, ~10/min/user), delegate to 1.3; no `console.log` of any body content
- [ ] 2.2 Error paths return generic messages containing no fragment of the input; add a test asserting this for each failure branch (bad auth, rate-limited, duplicate, unclassifiable without platform)

## 3. Ledger and timeline honesty

- [ ] 3.1 Verify `DiscoveredKey.source` is unconstrained string in Prisma (no migration) and ledger queries/metrics include `manual`-sourced keys in the one population (key-inventory spec)
- [ ] 3.2 Timeline: manual-source keys start at "registered" (no exposure implied); drawer copy reflects tracked-since-birth state
- [ ] 3.3 Rotation policy: NO code change — manual keys record registration time in `foundAt` (Prisma default), which `riskStart()` already anchors on; add a test proving a manual key's window counts from registration and attested-exposure re-anchoring still applies
- [ ] 3.4 Docs: `docs/guide/faq.md` gains the honest duplicate limit (pasting a discovery-tracked key creates a separate entry; only manual-vs-manual duplicates are detectable)

## 4. Scan-time hash linking

- [ ] 4.1 Hook the verify inside `lib/scanner/core.ts` where the raw match (`const key = match[1] || match[0]`) is still in scope — by `processScanFindings` only preview/hash survive, so it cannot live there; never thread the raw value onto the persisted `Finding`. On match attach exposure event to the tracked key (file provenance + git blame date when available), re-anchor riskStart earlier-is-worse, skip triage entry, log Activity + alert
- [ ] 4.2 Test: registered key value planted in a scanned fixture → no new triage finding; key gains exposure event and urgency recomputes

## 5. UI entry point (design by Nilson)

- [ ] 5.1 Nilson designs the registration flow (empty-state CTA + toolbar affordance, paste → masked-preview confirm step)
- [ ] 5.2 Implement the designed flow against `POST /api/keys/register`
- [ ] 5.3 Keys empty state gains the second door: "Register a key" alongside "Go to Discovery"

## 6. Verification

- [ ] 6.1 Run the security battery (`keystrok-security-test`) — new route must reject unauthenticated access; secret-leak scan stays clean
- [ ] 6.2 End-to-end dogfood: register the real `n8n-digest` Resend key on the homelab instance; confirm ledger entry, rotation window, and masked-only persistence
