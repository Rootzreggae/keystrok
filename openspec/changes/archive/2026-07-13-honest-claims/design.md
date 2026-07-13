# Design: Honest claims

## Constraints

- Posture is prefetched server-side and cached; changing its population changes what every Home visitor sees. That is the point, but it means the trend series and MTTR will move for anyone who was seeing a personal slice.
- The assistant's context is capped (60 keys / 60 findings / 30 workflows). Widening the population makes overflow more likely, so the cap needs an honest "and N more" note rather than silent truncation.
- The outcome ledger already computes the truthful verdict for a finished rotation (`outcomeFor`). The "Rotation complete" card must not re-derive its own story; it should consume the same verdict so the two can never disagree again.

## Decisions

### A1. Posture goes instance-wide
Drop the `userId` filter in `lib/posture-data.ts`. No signature change; every caller already treats it as the workspace's hygiene. The Home bands then count one population.

### A2. Assistant sees the workspace
Drop the `userId` filter on the assistant's key/finding/workflow context in `lib/assistant.ts`. Keep the provider config per-user. When the population exceeds the cap, say so in the context block ("showing 60 of N keys") so the model never implies completeness it doesn't have.

### B3. The completion card states its earned verdict
Lift `outcomeFor` out of the rotations page into `lib/blast-radius.ts` (it is already the home of honest verdicts) or a small shared helper, and have both the ledger and the completion card render from it. A failed rotation shows "Old key still live"; an unverifiable provider shows "Receipted by you"; only a liveness-verified revocation says the exposure is closed.

### B4. Runbook copy matches behavior
Replace "Keystrok recommends the order and watches traffic" with what is true: Keystrok recommends the order, gates the irreversible step, and verifies the outcome after the fact. Delete the dead `isAutomated` branch and its "Keystrok runs this check" actor chip; no template ships an automated step. Keep the advisory line's core promise (never rotates or revokes on its own), because that one is real.

### B5. Platforms discloses liveness capability per provider
The connect presets already know which providers are listable (`isListable`). Render that: providers that can verify liveness say so; providers that cannot say "connection only, cannot verify key liveness". Fix the empty-state copy to name AWS and Datadog (the two that work) instead of a list of providers that mostly don't.

### B6. Radius cell stops double-counting
Sites already include pipeline paths. Render "N sites (M in pipelines)" or drop the pipe segment from the cell entirely; the drawer carries the breakdown. Cheapest honest form wins.

### B7. "Observed" becomes what it is
The platform-usage row is evidence *that the key is being used*, not *by whom*. Retag it "platform usage" / "last used" without the `observed` claim, and keep the label reserved for the day Keystrok can actually observe a caller identity.

### C8. expiration-alerts anchors to risk start
Use `riskStart(key)` like every other surface. If the route is truly dead (no callers found), delete it instead; a dead route with a subtly different policy is a trap for the next reader.

## Verification

- Posture: prove instance-wide by comparing the Home bands' populations against `/api/keys` in the real app; they must agree.
- Assistant: inspect the built system prompt for a two-user workspace and confirm both users' keys appear, with the overflow note when capped.
- Completion card and ledger: force a rotation-failed key and confirm both surfaces say the same thing.
- Screenshots for every visible change; the usual PR convention.
