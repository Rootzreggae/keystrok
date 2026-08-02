# Rotation Due Reminders — Design

## Context

Alert evaluation is already a working pipeline: the hourly `/api/cron/tick` runs a liveness pass, then `runAlerts()` calls `incidentFor(key)` per key, which returns the single worst standing incident under a fixed precedence. `AlertEvent` rows give edge-triggered dedup (one open event per key+kind, fire on open, recovery on close), and `sendAlert()` delivers to whichever channel the workspace configured (Telegram, email, webhook). `sla_crossed` is already a time-driven standing condition computed from stored dates (`riskStart` + severity band), so a "before the deadline" sibling needs zero new infrastructure — only a new branch and its timing table.

Rotation windows are 7/30/60/90 days by severity (`ROTATION_DAYS` in `lib/rotation-policy.ts`, the declared single source of truth for rotation timing).

## Goals / Non-Goals

**Goals:**
- One heads-up per key before its rotation deadline, on the existing channel, with a lead time proportional to the severity band.
- Zero noise: no repeat pings, no false "recovery" when the reminder escalates into overdue.
- Timing knowledge stays in `rotation-policy.ts`; alerting only asks, never hardcodes.

**Non-Goals:**
- No per-user or per-key configurable lead times (workspace alert config stays a singleton; tune the table if Noxus feedback asks).
- No digest/batching (edge-triggered dedup already caps volume at one ping per key per window entry; revisit only if fleets make this noisy).
- No new channel, no UI, no schema migration.

## Decisions

### 1. Severity-scaled lead table in `rotation-policy.ts`

```
REMINDER_LEAD_DAYS: critical 2 · high 5 · medium 7 · low 10
```

Fixed per-band day counts, not a percentage. A percentage (e.g. 15% of window) yields awkward fractional leads (1.05d for critical) and hides the actual behavior behind arithmetic; a named table reads like `ROTATION_DAYS` beside it and is tunable per band independently. The values scale roughly with the window (2 of 7 days ≈ 29%, 10 of 90 ≈ 11%): tighter windows warrant proportionally earlier warning because there is less slack to absorb a slow response. Exposed via `reminderLeadDays(severity)` accessor mirroring `slaDays()`.

**Alternative considered**: fixed 2 days for all severities (the original idea). Rejected: 2 days before a 90-day deadline is indistinguishable from the overdue alert in practice, and 2 days is a third of a critical window anyway — the flat number was already severity-relative for critical keys and arbitrary for the rest.

### 2. `due_soon` is a standing condition at the bottom of the precedence

`incidentFor` gains one branch after `sla_crossed`, guarded the same way (`foundAt && !rotatedAt`): fire when `0 < daysUntilDue(riskStart(k), k.severity) <= reminderLeadDays(k.severity)`. Anchoring on `riskStart` (not raw `foundAt`) means an attested earlier exposure pulls the reminder in exactly as it pulls the deadline in — the reminder and the deadline can never disagree.

**Alternative considered**: a one-shot alert like `new_finding` (open+close in the same instant). Rejected: the standing-condition shape gives the rotated-early recovery for free and lets `sla_crossed` supersede it through the existing "resolve different-kind events silently" path. One-shot would need bespoke logic to avoid re-firing every tick.

### 3. Transition semantics are inherited, verified, not built

- **Enter window** → no open `due_soon` event → fire once, open event.
- **Deadline passes un-rotated** → `incidentFor` now returns `sla_crossed` (higher precedence) → runner fires `sla_crossed` and resolves the `due_soon` event *silently* (existing different-kind cleanup). No lying "all clear" between reminder and overdue.
- **Rotated inside the window** → `incidentFor` returns null → runner sends one recovery using the open event's kind. `recoveryText` gains a `due_soon` line: rotated ahead of its deadline. This is the only new copy besides the reminder itself.
- **Persists across ticks** → open event suppresses re-fire (existing dedup).

### 4. Alert severity mirrors the key, wording stays a heads-up

The `AlertEvent.severity` is the key's own severity (honest: a critical key's reminder matters more than a low key's), but `summaryText` wording must read as advance notice ("rotation due in Nd"), never as an incident page. Freshness gating does not apply: like `sla_crossed`, this is knowable from stored dates alone, so it fires even with no connected platform.

## Risks / Trade-offs

- [A key registered/discovered with less remaining window than its lead (e.g. attested exposure eats the whole band) skips due_soon and goes straight to sla_crossed] → Correct behavior, not a bug: the reminder's premise ("you still have time") is false there. Spec scenario pins this.
- [Hourly tick granularity means the ping lands up to an hour after the key enters the window] → Irrelevant at day-scale lead times.
- [Self-host instances without a cron tick never evaluate time-driven alerts] → Pre-existing property of sla_crossed, documented in the tick route; no worse here.
- [`recoveryText`'s parameter is typed to a narrower kind union in one call site] → Widen the type, no behavior change.

## Migration Plan

Pure addition: new kind value in an unconstrained string column, new branch below all existing precedence. Existing open AlertEvents are untouched. Rollback = revert; open `due_soon` events would then be resolved silently by the different-kind cleanup on the next tick. Ships on `:latest` like everything else.

## Open Questions

None — lead-table values are a tuning knob expected to move with pilot feedback, not an open design question.
