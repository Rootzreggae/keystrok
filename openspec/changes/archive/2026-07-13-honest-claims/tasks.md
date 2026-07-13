# Tasks: Honest claims

Branch: `exp/honest-claims`. One PR with screenshots; merge is Nilson's call.

## A. One workspace
- [x] A1: drop the `userId` filter in `lib/posture-data.ts` so hygiene metrics count the workspace, like every other surface.
- [x] A2: drop the `userId` filter on the assistant's key/finding/workflow context in `lib/assistant.ts` (provider config stays per-user); disclose truncation when the population exceeds the cap.

## B. Screens that overclaim
- [x] B3: share `outcomeFor` so the rotation completion card and the outcome ledger render the same evidence-derived verdict; a failed rotation is never congratulated.
- [x] B4: runbook copy matches behavior (no "watches traffic", no pre-fill claim); delete the dead automated-step actor chip. Keep the advisory promise.
- [x] B5: platforms disclose per-provider liveness capability; empty state names AWS and Datadog instead of providers that cannot verify.
- [x] B6: radius ledger cell stops double-counting pipelines into sites.
- [x] B7: retag the platform-usage row so `observed` is not claimed for aggregate last-used evidence.

## C. Anchoring
- [x] C8: `expiration-alerts` anchors to `riskStart`, or is deleted if it has no callers (a dead route with a divergent policy is a trap).

## Verify
- [x] Home's two bands count the same population, checked against `/api/keys` in the real app.
- [x] Assistant context includes another member's key in a two-user workspace.
- [x] A rotation-failed key reads the same on the completion card and in the ledger.
- [x] `npx tsc --noEmit` clean; blast-radius tests green.
- [x] Screenshots for every visible change.


## Notes from implementation (2026-07-13)

- C8: `expiration-alerts` had **zero callers** and anchored to `foundAt` while every other surface anchors to `riskStart`. Deleted rather than fixed: a dead route with a divergent policy is a trap for the next reader.
- B3 grew: the completion card told the truth while the header pill above it still said "Resolved" and the subtitle still said "rotation complete". Both now render from the same verdict, so the screen cannot contradict itself.
- A2: with the workspace population, the context caps matter more, so the prompt now discloses "showing N of M" instead of silently truncating.
- Proof for A1/A2: staged a key owned by the second user; it appeared in posture's open population and in the assistant's context (both previously invisible). Staged rows removed.
