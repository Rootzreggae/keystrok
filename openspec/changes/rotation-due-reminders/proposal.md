# Rotation Due Reminders — Proposal

## Why

Keystrok's rotation stance is advisory: we never rotate for you, we tell you when to. But today the alerting side of that promise only speaks *after* failure — `sla_crossed` fires once a key is already past its rotation deadline. An operator who configured Telegram or email gets silence right up to the moment they've missed the window. A reminder before the deadline is the missing half of the advisory contract, and it came up as user feedback matching a planned idea.

## What Changes

- New alert kind `due_soon`: a not-yet-rotated key whose rotation deadline is within its reminder lead window gets one heads-up on the already-configured alert channel (Telegram / email / webhook — whatever is set up, no new channel work).
- The lead time is **severity-scaled**, not fixed: a critical key's 7-day window earns a different notice period than a low key's 90-day window. The lead table lives in `lib/rotation-policy.ts` next to the existing severity bands (single source of truth for rotation timing).
- Precedence extends by one rung: `rotation_failed > live_and_used > sla_crossed > due_soon`. The reminder is the lowest-priority standing condition; when the deadline passes un-rotated, `sla_crossed` takes over and the reminder resolves silently (the existing kind-transition machinery already does this).
- Rotating the key before the deadline resolves the reminder with an honest recovery line ("rotated ahead of its deadline"), reusing the existing recovery path.
- No new delivery, dedup, or scheduling machinery: rides the hourly `/api/cron/tick` evaluation and the edge-triggered AlertEvent dedup (one ping per key, ever, per entry into the window).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `alerting`: the "Four alert kinds, one precedence" requirement becomes five kinds; precedence gains `due_soon` at the bottom; a new requirement pins the severity-scaled lead times and the no-noise transition semantics (silent handoff to `sla_crossed`, honest recovery on rotation).

## Impact

- `lib/rotation-policy.ts`: new `REMINDER_LEAD_DAYS` table + accessor (pure addition, no existing band changes).
- `lib/alerting.ts`: `AlertKind` union gains `'due_soon'`; `incidentFor` gains the lowest-precedence branch; `recoveryText` gains the due_soon line.
- `lib/alert-runner.ts`: no changes expected — fire/resolve/dedup machinery is kind-agnostic.
- No schema migration (`AlertEvent.kind` is an unconstrained string), no new config, no UI change: the reminder lands on the existing channel and shows up wherever AlertEvents already show.
