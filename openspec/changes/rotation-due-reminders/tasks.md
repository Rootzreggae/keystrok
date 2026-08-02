# Rotation Due Reminders — Tasks

## 1. Policy layer

- [ ] 1.1 Add `REMINDER_LEAD_DAYS` (critical 2, high 5, medium 7, low 10) + `reminderLeadDays(severity)` accessor to `lib/rotation-policy.ts`, mirroring the `ROTATION_DAYS`/`slaDays` idiom (unknown severity falls back to high)

## 2. Alerting

- [ ] 2.1 Widen `AlertKind` with `'due_soon'` and add the lowest-precedence branch to `incidentFor`: same `foundAt && !rotatedAt` guard as sla_crossed, fires when `0 < daysUntilDue(riskStart(k), k.severity) <= reminderLeadDays(k.severity)`; detail reads as advance notice ("rotation due in Nd"), severity mirrors the key
- [ ] 2.2 Add the `due_soon` recovery line to `recoveryText` ("rotated ahead of its deadline") and widen the narrow kind union at the `runAlerts` recovery call site; confirm `runAlerts` itself needs no changes (kind-agnostic fire/resolve/dedup)

## 3. Tests

- [ ] 3.1 `incidentFor` cases in `lib/alerting.test.ts`: inside lead window fires due_soon; outside window fires nothing; past deadline fires sla_crossed not due_soon (precedence + silent handoff); rotated key fires nothing; per-severity lead boundaries (e.g. high at 5d yes, 6d no); riskStart anchoring (attested exposure pulls the reminder in; exposure consuming the whole band skips due_soon entirely)
- [ ] 3.2 Recovery copy test: due_soon recovery text states rotated-ahead-of-deadline, and never the sla_crossed "back inside its window" line

## 4. Verification

- [ ] 4.1 Live e2e on dev: mint a tracked key with foundAt set so daysUntilDue lands inside its lead, run the tick, confirm exactly one reminder on the configured channel, then rotate → recovery message; purge minted rows after
- [ ] 4.2 Dogfood on the homelab: let the real registered key age into its lead window (or nudge foundAt) and confirm the Telegram reminder arrives
